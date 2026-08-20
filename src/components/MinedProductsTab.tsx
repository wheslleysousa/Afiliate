import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  setDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { apiFetch } from '../utils/apiBase';
import type { MinedProductRef, GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate, UserCategory } from '../types';
import { ProductDetailModal } from './ProductDetailModal';
import { PriceBlock } from './PriceBlock';
import { calculateCommission } from '../utils/marketplaceUtils';
import { formatPrice } from '../utils/formatPrice';
import {
  PackageCheck,
  Star,
  Search,
  Archive,
  Trash2,
  CheckCircle2,
  Clock,
  Check,
  ShoppingBag,
  Loader2,
  Filter,
} from 'lucide-react';

interface MinedProductsTabProps {
  uid: string;
  dailyMineCount?: number;
  dailyMineLimit?: number;
  apiKeys?: ApiKeysConfig;
  commissionRates?: CommissionRatesConfig;
  sharedMap?: Record<string, number>;
  onToggleShared?: (productId: string) => void;
  onUseProduct?: (product: GlobalProduct) => void;
  onUpdateProductCommission?: (productId: string, ratePct: number | null, amountVal: number | null) => void;
  onAddCustomTemplate?: (template: CopyTemplate) => void;
  customTemplates?: CopyTemplate[];
  defaultTemplateId?: string;
  onNavigateToProjects?: (product: GlobalProduct) => void;
}

interface EnrichedMinedProduct extends MinedProductRef {
  productData: GlobalProduct | null;
  lastSharedAt?: number | string | null;
  archived?: boolean;
}

const PLATFORMS = [
  { id: 'all', label: 'Todas as Plataformas' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'aliexpress', label: 'AliExpress' },
  { id: 'shein', label: 'Shein' },
  { id: 'tiktokshop', label: 'TikTok Shop' },
];

const STATUS_OPTIONS = [
  { id: 'all', label: 'Todos os Produtos' },
  { id: 'ready_24h', label: 'Prontos para Exibição' },
  { id: 'shared_24h', label: 'Exibidos nas Últimas 24h' },
  { id: 'favorites', label: 'Favoritos ⭐' },
  { id: 'archived', label: 'Arquivados 📦' },
];

const platformLabel: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  shein: 'Shein',
  tiktokshop: 'TikTok Shop',
};

const platformColor: Record<string, string> = {
  mercadolivre: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  shopee:       'bg-orange-500/20 text-orange-300 border-orange-500/30',
  amazon:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  aliexpress:   'bg-red-500/20 text-red-300 border-red-500/30',
  shein:        'bg-pink-500/20 text-pink-300 border-pink-500/30',
  tiktokshop:   'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

export const MinedProductsTab: React.FC<MinedProductsTabProps> = ({
  uid,
  apiKeys,
  commissionRates,
  onAddCustomTemplate,
  customTemplates = [],
  defaultTemplateId,
  onNavigateToProjects,
}) => {
  const [items, setItems] = useState<EnrichedMinedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready_24h' | 'shared_24h' | 'favorites' | 'archived'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all'); // 'all' | catId | 'none'
  const [userCategories, setUserCategories] = useState<UserCategory[]>([]);
  const [assignForId, setAssignForId] = useState<string | null>(null); // produto sendo categorizado
  const [selectedProductForModal, setSelectedProductForModal] = useState<GlobalProduct | null>(null);

  // Categorias criadas pelo usuário — guardadas em UM doc (users/{uid}/userConfig/categories)
  // para a extensão poder LER via GET (a listagem de coleção via REST dava 403).
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid, 'userConfig', 'categories');
    const unsub = onSnapshot(ref, (snap) => {
      const data = snap.exists() ? (snap.data() as any) : null;
      setUserCategories(Array.isArray(data?.items) ? (data.items as UserCategory[]) : []);
    }, () => {});
    return () => unsub();
  }, [uid]);

  const CATEGORY_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
  const saveCategories = async (items: UserCategory[]) => {
    if (!uid) return;
    try { await setDoc(doc(db, 'users', uid, 'userConfig', 'categories'), { items, updatedAt: new Date().toISOString() }, { merge: true }); } catch (e) { console.error(e); }
  };
  const createCategory = async () => {
    const name = window.prompt('Nome da nova categoria:');
    const n = (name || '').trim();
    if (!n || !uid) return;
    const id = 'cat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const color = CATEGORY_COLORS[userCategories.length % CATEGORY_COLORS.length];
    await saveCategories([...userCategories, { id, name: n, color, createdAt: new Date().toISOString() }]);
  };
  const deleteCategory = async (id: string) => {
    if (!uid) return;
    if (!window.confirm('Excluir esta categoria? Os produtos não serão apagados, apenas deixam de ter essa categoria.')) return;
    await saveCategories(userCategories.filter((c) => c.id !== id));
    if (categoryFilter === id) setCategoryFilter('all');
  };
  const toggleProductCategory = async (productId: string, catId: string, current: string[]) => {
    if (!uid) return;
    const next = current.includes(catId)
      ? current.filter((x) => x !== catId)
      : (current.length >= 2 ? current : [...current, catId]);
    try { await updateDoc(doc(db, 'users', uid, 'minedProducts', productId), { categories: next }); } catch (e) { console.error(e); }
  };
  const catById = (id: string) => userCategories.find((c) => c.id === id);

  useEffect(() => {
    if (!uid) return;
    let isMounted = true;
    setLoading(true);

    const q = query(
      collection(db, 'users', uid, 'minedProducts'),
      orderBy('minedAt', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      async (snap) => {
        const minedRefs = snap.docs.map((d) => d.data() as MinedProductRef);

        const enriched = await Promise.all(
          minedRefs.map(async (ref) => {
            try {
              const productSnap = await getDoc(doc(db, 'products', ref.productId));
              const globalData = productSnap.exists() ? (productSnap.data() as GlobalProduct) : null;
              // Override por-usuário (dados verificados pela API salvos no ref do usuário,
              // que sempre pode gravar — o doc global pode ter regra que bloqueia a escrita).
              const override = (ref as any).enriched as Partial<GlobalProduct> | undefined;
              const productData = globalData
                ? ({ ...globalData, ...(override || {}) } as GlobalProduct)
                : (override ? ({ ...(override as GlobalProduct) }) : null);
              return { ...ref, productData };
            } catch {
              return { ...ref, productData: null };
            }
          })
        );

        if (isMounted) {
          setItems(enriched);
          setLoading(false);
        }
      },
      (e) => {
        console.error('[MinedProducts] Erro em tempo real:', e);
        if (isMounted) setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [uid]);

  // ── Verificação automática: mesmo que a extensão mande dados errados, ao chegar
  // no app cada produto passa pela API (scrape/afiliado) e o que fica SALVO é o
  // que a API retornou — preço, imagem, vendas, comissão e o LINK CURTO. ──────────
  const verifyingRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!uid || !items.length) return;
    const SIX_H = 6 * 3600 * 1000;
    // pega os que precisam de verificação: não verificados, sem preço antigo,
    // ou verificados há mais de 6h (reverifica tudo periodicamente).
    const pending = items.filter((it) => {
      const pd = it.productData;
      if (!pd || !pd.original_link) return false;
      if (verifyingRef.current.has(it.productId)) return false;
      const verified = !!pd.verifiedByApi;
      const stale = pd.lastVerifiedAt ? (Date.now() - Date.parse(pd.lastVerifiedAt) > SIX_H) : false;
      if (verified && !stale) return false;
      if (stale) return true; // passou 6h → revalida
      const plat = (pd.platform || '').toLowerCase();
      return plat === 'shopee' || !pd.price_from;
    }).slice(0, 20); // até 20 por rodada; o resto entra nas próximas cargas

    if (!pending.length) return;

    let cancelled = false;
    (async () => {
      for (const it of pending) {
        if (cancelled) break;
        verifyingRef.current.add(it.productId);
        const pd = it.productData as GlobalProduct;
        try {
          const resp = await apiFetch('/api/scrape', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pd.original_link, apiKeys: apiKeys || {} }),
          });
          if (!resp.ok) continue;
          const raw = await resp.json();
          const s: any = (raw && raw.data) ? raw.data : raw;
          if (!s || s.error || !(s.title || s.price_to)) continue;
          const updates: Partial<GlobalProduct> = {
            title: s.title || pd.title,
            image_url: s.image_url || pd.image_url,
            pictures: (Array.isArray(s.pictures) && s.pictures.length) ? s.pictures : pd.pictures,
            price_to: s.price_to || pd.price_to,
            price_from: s.price_from || pd.price_from,
            pix_price: s.pix_price ?? pd.pix_price ?? null,
            discount_pct: s.discount_pct ?? pd.discount_pct ?? null,
            stars: (s.stars !== undefined && s.stars !== null) ? s.stars : pd.stars,
            sales_count: (s.sales_count !== undefined && s.sales_count !== null) ? s.sales_count : pd.sales_count,
            category: s.category || pd.category,
            commission_rate: s.commission_rate ?? pd.commission_rate ?? null,
            commission_amount: s.commission_amount ?? pd.commission_amount ?? null,
            // Link de afiliado CURTO (s.shopee/meli.la/amzn.to) — nunca o link longo
            affiliate_link: s.affiliate_link || pd.affiliate_link || null,
            verifiedByApi: true,
            lastVerifiedAt: new Date().toISOString(),
          };
          // 1) doc global (corrige o Marketplace) — pode falhar por regra se não for miner
          try { await setDoc(doc(db, 'products', it.productId), updates, { merge: true }); } catch { /* sem permissão no global */ }
          // 2) override no ref do usuário — SEMPRE grava (garante que não "some" ao recarregar)
          try { await updateDoc(doc(db, 'users', uid, 'minedProducts', it.productId), { enriched: updates }); } catch { /* ignore */ }
          if (!cancelled) {
            setItems((prev) => prev.map((x) => x.productId === it.productId
              ? { ...x, productData: { ...(x.productData as GlobalProduct), ...updates } }
              : x));
          }
        } catch { /* segue para o próximo */ }
      }
    })();

    return () => { cancelled = true; };
  }, [items, uid, apiKeys]);

  const [deleteConfirmItem, setDeleteConfirmItem] = useState<EnrichedMinedProduct | null>(null);
  const [isDeletingProduct, setIsDeletingProduct] = useState(false);

  const toggleFavorite = async (productId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid, 'minedProducts', productId), {
        favorite: !current,
      });
    } catch (e) {
      console.error('Erro ao atualizar favorito:', e);
    }
  };

  const toggleArchive = async (productId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid, 'minedProducts', productId), {
        archived: !current,
      });
    } catch (e) {
      console.error('Erro ao atualizar arquivo:', e);
    }
  };

  const confirmDeleteProduct = async () => {
    if (!deleteConfirmItem) return;
    setIsDeletingProduct(true);
    try {
      await deleteDoc(doc(db, 'users', uid, 'minedProducts', deleteConfirmItem.productId));
      setDeleteConfirmItem(null);
    } catch (e) {
      console.error('Erro ao excluir produto:', e);
    } finally {
      setIsDeletingProduct(false);
    }
  };

  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Filtragem
  const filtered = items.filter((item) => {
    if (!item.productData) return false;
    const p = item.productData;

    // Busca por termo
    const matchesSearch = !search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase());
    if (!matchesSearch) return false;

    // Filtro por plataforma
    if (platformFilter !== 'all' && p.platform !== platformFilter) return false;

    // Filtro por categoria (categorias ficam no ref do produto minerado)
    const itemCats = ((item as any).categories as string[] | undefined) || [];
    if (categoryFilter === 'none') { if (itemCats.length) return false; }
    else if (categoryFilter !== 'all') { if (!itemCats.includes(categoryFilter)) return false; }

    // Filtro por status
    const lastSharedMs = typeof item.lastSharedAt === 'number' ? item.lastSharedAt : (item.lastSharedAt ? new Date(item.lastSharedAt).getTime() : 0);
    const isSharedRecently = lastSharedMs > 0 && (now - lastSharedMs) < TWENTY_FOUR_HOURS;

    if (statusFilter === 'archived') return Boolean(item.archived);
    if (item.archived) return false; // esconder arquivados das outras visões

    if (statusFilter === 'favorites') return Boolean(item.favorite);
    if (statusFilter === 'ready_24h') return !isSharedRecently;
    if (statusFilter === 'shared_24h') return Boolean(isSharedRecently);

    return true;
  });

  const activeFilterCount =
    (statusFilter !== 'all' ? 1 : 0) +
    (platformFilter !== 'all' ? 1 : 0) +
    (categoryFilter !== 'all' ? 1 : 0) +
    (search.trim() ? 1 : 0);
  const clearFilters = () => { setStatusFilter('all'); setPlatformFilter('all'); setCategoryFilter('all'); setSearch(''); };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Header Padronizado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e2636] pb-3">
        <div>
          <h1 className="text-lg font-extrabold text-white">Meus Produtos</h1>
          <p className="text-xs text-[#93a0b5]">
            {filtered.length} produto{filtered.length !== 1 ? 's' : ''} minerado{filtered.length !== 1 ? 's' : ''} em sua coleção pessoal.
          </p>
        </div>

        {/* Busca em Meus Produtos */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a0b5]" />
          <input
            type="text"
            placeholder="Pesquisar em meus produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-[#eef2f9] placeholder-[#93a0b5] focus:outline-none focus:border-blue-500 shadow-inner"
          />
        </div>
      </div>

      {/* ── Painel de Filtros (redesign) ───────────────────────────────── */}
      <div className="bg-gradient-to-b from-[#0e1119] to-[#0b0e15] border border-[#1e2636] rounded-2xl overflow-hidden">
        {/* Cabeçalho do painel */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#1e2636] bg-[#0e1119]/60">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <Filter className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <span className="text-xs font-extrabold text-white">Filtros</span>
            {activeFilterCount > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-600/20 text-blue-300 border border-blue-500/30">{activeFilterCount} ativo{activeFilterCount > 1 ? 's' : ''}</span>
            )}
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-[11px] font-bold text-[#93a0b5] hover:text-red-400 transition-colors cursor-pointer">Limpar filtros</button>
          )}
        </div>

        <div className="p-4 space-y-4">
          {/* Status */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7a90]">Status</span>
            <div className="flex flex-wrap gap-1.5">
              {STATUS_OPTIONS.map((st) => {
                const isActive = statusFilter === st.id;
                return (
                  <button key={st.id} onClick={() => setStatusFilter(st.id as any)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${isActive ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-600/30' : 'bg-[#151a26] text-[#93a0b5] hover:text-white hover:border-[#2a3548] border-[#1e2636]'}`}>
                    {st.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Loja */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7a90]">Loja</span>
            <div className="flex flex-wrap gap-1.5">
              {PLATFORMS.map((pl) => {
                const isActive = platformFilter === pl.id;
                return (
                  <button key={pl.id} onClick={() => setPlatformFilter(pl.id)}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all border cursor-pointer ${isActive ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm' : 'bg-[#151a26] text-[#93a0b5] hover:text-white hover:border-[#2a3548] border-[#1e2636]'}`}>
                    {pl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Categoria */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#6b7a90]">Categoria</span>
              <button onClick={createCategory} className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer">＋ Nova categoria</button>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${categoryFilter === 'all' ? 'bg-blue-600 text-white border-blue-400' : 'bg-[#151a26] text-[#93a0b5] hover:text-white border-[#1e2636]'}`}>Todas</button>
              {userCategories.map((c) => {
                const isActive = categoryFilter === c.id;
                return (
                  <span key={c.id} className="inline-flex items-center rounded-full border text-xs font-semibold transition-all overflow-hidden" style={{ borderColor: isActive ? c.color : '#1e2636', background: isActive ? (c.color + '33') : '#151a26' }}>
                    <button onClick={() => setCategoryFilter(c.id)} className={`inline-flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 cursor-pointer ${isActive ? 'text-white' : 'text-[#93a0b5] hover:text-white'}`}>
                      <span className="w-2 h-2 rounded-full" style={{ background: c.color }} />
                      {c.name}
                    </button>
                    <button onClick={() => deleteCategory(c.id)} title="Excluir categoria" className="pr-2 pl-0.5 py-1.5 text-[#6b7a90] hover:text-red-400 cursor-pointer">×</button>
                  </span>
                );
              })}
              <button onClick={() => setCategoryFilter('none')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-all ${categoryFilter === 'none' ? 'bg-[#334155] text-white border-[#475569]' : 'bg-[#151a26] text-[#93a0b5] hover:text-white border-[#1e2636]'}`}>Sem categoria</button>
            </div>
            {userCategories.length === 0 && (
              <p className="text-[11px] text-[#6b7a90]">Crie categorias para organizar seus produtos — elas também aparecem na extensão para você classificar antes de enviar.</p>
            )}
          </div>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 space-y-3 animate-pulse">
              <div className="w-full aspect-square bg-[#151a26] rounded-xl" />
              <div className="h-3 bg-[#151a26] rounded-full w-2/3" />
              <div className="h-4 bg-[#151a26] rounded-full w-full" />
              <div className="h-6 bg-[#151a26] rounded-xl w-1/2 pt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Lista de Produtos */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center bg-[#0e1119] rounded-2xl border border-[#1e2636] p-6 space-y-2">
              <ShoppingBag className="w-10 h-10 text-[#93a0b5] opacity-50" />
              <p className="text-sm font-extrabold text-white">Nenhum produto em Meus Produtos</p>
              <p className="text-xs text-[#93a0b5] max-w-sm">
                Nenhum item corresponde ao filtro ou busca selecionada.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((item) => {
                const product = item.productData!;
                const comm = calculateCommission(
                  product.price_to,
                  product.platform,
                  product,
                  null,
                  null,
                  commissionRates
                );

                return (
                  <div
                    key={item.productId}
                    className="bg-[#0e1119] border border-[#1e2636] hover:border-blue-500/50 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all shadow-lg group relative"
                  >
                    {/* Botões Superiores: Favoritar / Excluir */}
                    <div className="flex items-center justify-between gap-2 z-10">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformColor[product.platform] || 'bg-[#151a26] text-[#93a0b5]'}`}>
                        {platformLabel[product.platform] || product.platform}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleFavorite(item.productId, Boolean(item.favorite))}
                          className="p-1 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-amber-400 transition-colors cursor-pointer"
                          title={item.favorite ? 'Remover dos favoritos' : 'Favoritar produto'}
                        >
                          <Star className={`w-3.5 h-3.5 ${item.favorite ? 'fill-amber-400' : ''}`} />
                        </button>

                        <button
                          onClick={() => toggleArchive(item.productId, Boolean(item.archived))}
                          className="p-1 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white transition-colors cursor-pointer"
                          title={item.archived ? 'Desarquivar' : 'Arquivar'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setAssignForId(item.productId)}
                          className="p-1 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-blue-300 transition-colors cursor-pointer"
                          title="Definir categorias"
                        >
                          <Filter className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmItem(item)}
                          className="p-1 rounded-lg bg-[#151a26] hover:bg-red-500/20 text-[#93a0b5] hover:text-red-400 transition-colors cursor-pointer"
                          title="Remover produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Chips de categorias atribuídas */}
                    {(((item as any).categories as string[] | undefined) || []).length > 0 && (
                      <div className="flex flex-wrap gap-1 -mt-1">
                        {(((item as any).categories as string[]) || []).map((cid) => {
                          const c = catById(cid);
                          if (!c) return null;
                          return <span key={cid} className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: c.color + '33', color: '#fff', border: `1px solid ${c.color}` }}>{c.name}</span>;
                        })}
                      </div>
                    )}

                    {/* Clique para abrir modal */}
                    <div
                      onClick={() => setSelectedProductForModal(product)}
                      className="space-y-2 cursor-pointer"
                    >
                      <div className="w-full aspect-square bg-[#151a26] border border-[#1e2636] rounded-xl overflow-hidden flex items-center justify-center p-2">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
                            alt={product.title}
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <ShoppingBag className="w-10 h-10 text-[#93a0b5]" />
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {product.title}
                      </h3>

                      {/* Stars & Sales Indicators */}
                      {(product.stars || product.sales_count) && (
                        <div className="flex items-center gap-2 text-[10px] text-[#93a0b5] flex-wrap">
                          {product.stars && (
                            <div className="flex items-center gap-1 text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span className="font-bold">{product.stars}</span>
                              {product.ratings_count && (
                                <span className="text-[#93a0b5] font-normal">({product.ratings_count})</span>
                              )}
                            </div>
                          )}
                          {product.stars && product.sales_count && <span className="text-[#1e2636]">•</span>}
                          {product.sales_count && (
                            <span className="truncate text-stone-300 font-medium">
                              {product.sales_count.includes('vend') ? product.sales_count : `${product.sales_count} vendidos`}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[#1e2636] space-y-1.5">
                      <PriceBlock
                        product={product}
                        size="sm"
                      />

                      <div className="flex items-center justify-between text-[11px] bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 rounded-xl text-emerald-400 font-extrabold">
                        <span>Comissão est.:</span>
                        <span>{formatPrice(comm.amount)} ({comm.ratePct}%)</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Modal: definir categorias de um produto (até 2) */}
      {assignForId && (() => {
        const it = items.find((x) => x.productId === assignForId);
        const cur = ((it as any)?.categories as string[] | undefined) || [];
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn" onClick={() => setAssignForId(null)}>
            <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h3 className="text-base font-extrabold text-white">Categorias do produto</h3>
                <button onClick={() => setAssignForId(null)} className="text-[#93a0b5] hover:text-white cursor-pointer">✕</button>
              </div>
              <p className="text-xs text-[#93a0b5]">Selecione até 2 categorias. {cur.length >= 2 && <span className="text-amber-300">Limite de 2 atingido.</span>}</p>
              {userCategories.length === 0 ? (
                <div className="text-xs text-[#93a0b5]">Você ainda não criou categorias. Feche e clique em <b>＋ Nova</b> na barra de categorias.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {userCategories.map((c) => {
                    const on = cur.includes(c.id);
                    return (
                      <button key={c.id} onClick={() => toggleProductCategory(assignForId, c.id, cur)}
                        className="text-xs font-bold px-3 py-1.5 rounded-xl border cursor-pointer transition-all"
                        style={{ borderColor: on ? c.color : '#1e2636', background: on ? (c.color + '33') : '#151a26', color: on ? '#fff' : '#93a0b5' }}>
                        {on ? '✓ ' : ''}{c.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <button onClick={createCategory} className="w-full text-xs font-bold py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20 cursor-pointer">＋ Criar nova categoria</button>
            </div>
          </div>
        );
      })()}

      {/* Modal de Confirmação de Exclusão */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl relative">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Excluir Produto</h3>
                <p className="text-xs text-stone-400">Esta ação removerá o produto da sua lista.</p>
              </div>
            </div>

            <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl flex items-center gap-3">
              {deleteConfirmItem.productData?.image_url ? (
                <img
                  src={deleteConfirmItem.productData.image_url}
                  alt={deleteConfirmItem.productData.title}
                  className="w-12 h-12 rounded-lg object-cover border border-[#1e2636] shrink-0"
                />
              ) : (
                <div className="w-12 h-12 bg-stone-800 rounded-lg flex items-center justify-center shrink-0">
                  <ShoppingBag className="w-6 h-6 text-stone-500" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white truncate">
                  {deleteConfirmItem.productData?.title || 'Produto'}
                </h4>
                <p className="text-[11px] text-emerald-400 font-extrabold mt-0.5">
                  {formatPrice(deleteConfirmItem.productData?.price_to)}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-300 leading-relaxed">
              Deseja realmente excluir este produto da sua coleção?
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                disabled={isDeletingProduct}
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 bg-[#151a26] hover:bg-stone-800 text-stone-300 rounded-xl text-xs font-bold border border-[#1e2636] transition-colors"
              >
                Cancelar
              </button>
              <button
                disabled={isDeletingProduct}
                onClick={confirmDeleteProduct}
                className="px-5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-red-950/50 flex items-center gap-2"
              >
                {isDeletingProduct ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                Sim, Excluir Produto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Produto */}
      {selectedProductForModal && (
        <ProductDetailModal
          product={selectedProductForModal}
          mode="my-products"
          isAlreadyMined={true}
          currentUserId={uid}
          apiKeys={apiKeys}
          commissionRates={commissionRates}
          onClose={() => setSelectedProductForModal(null)}
          onAddCustomTemplate={onAddCustomTemplate}
          customTemplates={customTemplates}
          defaultTemplateId={defaultTemplateId}
          onGenerateVideoScript={onNavigateToProjects}
        />
      )}
    </div>
  );
};
