import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  arrayRemove,
  increment,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MinedProductRef, GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { buildAffiliateLink } from '../utils/affiliateLink';
import { isProductSharedRecently } from '../utils/sharingLogUtils';
import { ProductDetailModal } from './ProductDetailModal';
import { PriceBlock } from './PriceBlock';
import { CommissionBadge } from './Badge';
import { calculateCommission } from '../utils/marketplaceUtils';
import {
  PackageCheck,
  Star,
  StarOff,
  Loader2,
  Search,
  Archive,
  Tag,
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  X,
  Trash2,
  Share2,
  CheckCircle2,
  Clock,
  Check,
  Sparkles,
  Layers,
  Copy,
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
}

interface EnrichedMinedProduct extends MinedProductRef {
  productData: GlobalProduct | null;
}

const platformLabel: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  shein: 'Shein',
};

const platformColor: Record<string, string> = {
  mercadolivre: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  shopee:       'bg-orange-500/20 text-orange-300 border-orange-500/30',
  amazon:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  aliexpress:   'bg-red-500/20 text-red-300 border-red-500/30',
  shein:        'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

export const MinedProductsTab: React.FC<MinedProductsTabProps> = ({
  uid,
  dailyMineCount,
  dailyMineLimit,
  apiKeys,
  commissionRates,
  sharedMap,
  onToggleShared,
  onUseProduct,
  onUpdateProductCommission,
  onAddCustomTemplate,
}) => {
  const [items, setItems] = useState<EnrichedMinedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'ready_24h' | 'shared_24h' | 'favorites' | 'archived'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedProductForModal, setSelectedProductForModal] = useState<GlobalProduct | null>(null);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 600);
  };

  useEffect(() => {
    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'users', uid, 'minedProducts'),
      orderBy('minedAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snap) => {
      const minedRefs = snap.docs.map((d) => d.data() as MinedProductRef);

      const enriched = await Promise.all(
        minedRefs.map(async (ref) => {
          try {
            const productSnap = await getDoc(doc(db, 'products', ref.productId));
            return {
              ...ref,
              productData: productSnap.exists() ? (productSnap.data() as GlobalProduct) : null,
            };
          } catch {
            return { ...ref, productData: null };
          }
        })
      );

      setItems(enriched);
      setLoading(false);
    }, (e) => {
      console.error('[MinedProducts] Erro em tempo real:', e);
      setError('Erro ao carregar produtos minerados em tempo real.');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const toggleFavorite = async (productId: string, current: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid, 'minedProducts', productId), {
        favorite: !current,
      });
      setItems((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, favorite: !current } : item
        )
      );
    } catch (e) {
      console.error('Erro ao atualizar favorito:', e);
    }
  };

  const toggleArchive = async (productId: string, current: string) => {
    const next = current === 'archived' ? 'active' : 'archived';
    try {
      await updateDoc(doc(db, 'users', uid, 'minedProducts', productId), {
        status: next,
      });
      setItems((prev) =>
        prev.map((item) =>
          item.productId === productId ? { ...item, status: next } : item
        )
      );
    } catch (e) {
      console.error('Erro ao arquivar produto:', e);
    }
  };

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [productToDelete, setProductToDelete] = useState<{ id: string; title: string } | null>(null);
  const [productToShare, setProductToShare] = useState<{ id: string; title: string } | null>(null);
  const [productToUndoShare, setProductToUndoShare] = useState<{ id: string; title: string } | null>(null);

  const confirmShare = () => {
    if (!productToShare || !onToggleShared) return;
    onToggleShared(productToShare.id);
    setProductToShare(null);
  };

  const confirmUndoShare = () => {
    if (!productToUndoShare || !onToggleShared) return;
    onToggleShared(productToUndoShare.id);
    setProductToUndoShare(null);
  };

  const confirmDelete = async () => {
    if (!productToDelete) return;
    const productId = productToDelete.id;
    setDeletingId(productId);
    try {
      await deleteDoc(doc(db, 'users', uid, 'minedProducts', productId));

      try {
        const productRef = doc(db, 'products', productId);
        await updateDoc(productRef, {
          miners: arrayRemove(uid),
          mineCount: increment(-1),
        });
      } catch {
        // Ignora caso produto global não exista
      }

      setItems((prev) => prev.filter((item) => item.productId !== productId));
      setProductToDelete(null);
    } catch (e) {
      console.error('Erro ao excluir produto:', e);
      setError('Não foi possível excluir o produto.');
    } finally {
      setDeletingId(null);
    }
  };

  // Filtrar localmente
  const visible = items.filter((item) => {
    const matchSearch = search.trim()
      ? (item.productData?.title || '').toLowerCase().includes(search.trim().toLowerCase())
      : true;

    const matchPlatform = platformFilter === 'all' || item.platform === platformFilter;

    const isShared24h = isProductSharedRecently(item.productId, sharedMap).isShared;

    let matchFilter = true;
    if (filter === 'all') {
      matchFilter = item.status !== 'archived';
    } else if (filter === 'ready_24h') {
      matchFilter = item.status !== 'archived' && !isShared24h;
    } else if (filter === 'shared_24h') {
      matchFilter = item.status !== 'archived' && isShared24h;
    } else if (filter === 'favorites') {
      matchFilter = item.favorite && item.status !== 'archived';
    } else if (filter === 'archived') {
      matchFilter = item.status === 'archived';
    }

    return matchSearch && matchPlatform && matchFilter;
  });

  const activeItems = items.filter((i) => i.status !== 'archived');
  const readyCount = activeItems.filter((i) => !isProductSharedRecently(i.productId, sharedMap).isShared).length;
  const sharedCount = activeItems.filter((i) => isProductSharedRecently(i.productId, sharedMap).isShared).length;
  const favoritesCount = activeItems.filter((i) => i.favorite).length;
  const archivedCount = items.filter((i) => i.status === 'archived').length;

  return (
    <div className="flex flex-col gap-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0e1119] border border-[#1e2636] p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/15 border border-blue-500/30 text-blue-400">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Meus Produtos Minerados</h2>
            <p className="text-xs text-[#93a0b5]">
              Sua lista exclusiva de produtos. Controle a divulgação de 24h, adicione a favoritos e organize suas copies.
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#151a26] hover:bg-stone-800 text-stone-300 text-xs font-bold border border-[#1e2636] transition-all shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Widget de cota diária */}
      {dailyMineCount !== undefined && dailyMineLimit !== undefined && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs ${
          dailyMineCount >= dailyMineLimit
            ? 'bg-red-950/40 border-red-500/30 text-red-400'
            : dailyMineCount >= dailyMineLimit * 0.8
            ? 'bg-amber-950/40 border-amber-500/30 text-amber-400'
            : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5]'
        }`}>
          <span className="font-medium">
            {dailyMineCount >= dailyMineLimit
              ? '⚠ Limite diário atingido'
              : `Minerados hoje: ${dailyMineCount} / ${dailyMineLimit}`}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-[#151a26] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  dailyMineCount >= dailyMineLimit
                    ? 'bg-red-500'
                    : dailyMineCount >= dailyMineLimit * 0.8
                    ? 'bg-amber-500'
                    : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((dailyMineCount / dailyMineLimit) * 100, 100)}%` }}
              />
            </div>
            <span className="font-bold">
              {Math.min(Math.round((dailyMineCount / dailyMineLimit) * 100), 100)}%
            </span>
          </div>
        </div>
      )}

      {/* Filtros de Status & Anti-Duplicação 24h */}
      <div className="flex items-center gap-2 p-1.5 bg-[#07090f] border border-[#1e2636] rounded-2xl overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilter('ready_24h')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'ready_24h'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
          <span>Prontos para Divulgar ({readyCount})</span>
        </button>

        <button
          onClick={() => setFilter('shared_24h')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'shared_24h'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/20'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119]'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>Divulgados nas Últimas 24h ({sharedCount})</span>
        </button>

        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'all'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Todos ({activeItems.length})</span>
        </button>

        <button
          onClick={() => setFilter('favorites')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'favorites'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119]'
          }`}
        >
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Favoritos ({favoritesCount})</span>
        </button>

        <button
          onClick={() => setFilter('archived')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'archived'
              ? 'bg-[#151a26] text-white border border-[#1e2636]'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119]'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Arquivados ({archivedCount})</span>
        </button>
      </div>

      {/* Controles de Busca e Plataforma */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a0b5]" />
          <input
            type="text"
            placeholder="Buscar por título em Meus Produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs sm:text-sm text-[#eef2f9] placeholder-[#93a0b5] focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="w-full sm:w-52 px-3 py-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs sm:text-sm text-[#eef2f9] font-semibold focus:outline-none focus:border-blue-500"
        >
          <option value="all">Todas as Plataformas</option>
          <option value="mercadolivre">Mercado Livre</option>
          <option value="amazon">Amazon</option>
          <option value="shopee">Shopee</option>
          <option value="aliexpress">AliExpress</option>
          <option value="shein">Shein</option>
        </select>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-xs sm:text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Grid de Produtos */}
      {!loading && (
        <>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-stone-900 border border-stone-800 rounded-2xl text-stone-500 text-center space-y-3">
              <PackageCheck className="w-12 h-12 text-stone-600" />
              <p className="text-sm font-bold text-white">Nenhum produto encontrado</p>
              <p className="text-xs text-stone-400 max-w-sm mx-auto">
                {filter === 'favorites'
                  ? 'Você ainda não marcou nenhum produto como favorito.'
                  : filter === 'archived'
                  ? 'Você não possui produtos arquivados.'
                  : filter === 'ready_24h'
                  ? 'Todos os seus produtos foram divulgados nas últimas 24h!'
                  : 'Nenhum produto encontrado para sua busca. Explore o Marketplace Global para adicionar mais.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
              {visible.map((item) => (
                <MinedCard
                  key={item.productId}
                  item={item}
                  apiKeys={apiKeys}
                  commissionRates={commissionRates}
                  sharedMap={sharedMap}
                  onRequestShare={(id, title) => setProductToShare({ id, title })}
                  onRequestUndoShare={(id, title) => setProductToUndoShare({ id, title })}
                  onOpenDetail={(product) => setSelectedProductForModal(product)}
                  onUseProduct={onUseProduct}
                  onToggleFavorite={() => toggleFavorite(item.productId, item.favorite)}
                  onToggleArchive={() => toggleArchive(item.productId, item.status)}
                  onDelete={() => setProductToDelete({ id: item.productId, title: item.productData?.title || item.productId })}
                  isDeleting={deletingId === item.productId}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal Popup de Confirmação de Exclusão */}
      {productToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <button
              onClick={() => setProductToDelete(null)}
              disabled={deletingId !== null}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-red-500/15 border border-red-500/30 text-red-400 rounded-2xl shrink-0">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Excluir produto dos Meus Produtos</h3>
                <p className="text-xs text-stone-400 mt-0.5">Esta ação removerá o produto da sua lista pessoal.</p>
              </div>
            </div>

            <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800/80">
              <p className="text-[10px] uppercase font-bold text-stone-500 mb-1 tracking-wider">Produto a ser removido</p>
              <p className="text-xs font-semibold text-stone-200 line-clamp-2">{productToDelete.title}</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setProductToDelete(null)}
                disabled={deletingId !== null}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deletingId !== null}
                className="px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-lg shadow-red-950/50 transition-all disabled:opacity-50"
              >
                {deletingId ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Excluindo...</span>
                  </>
                ) : (
                  <span>Confirmar Exclusão</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup de Confirmação para Marcar como Enviado (24h) */}
      {productToShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <button
              onClick={() => setProductToShare(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 rounded-2xl shrink-0">
                <Clock className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Marcar como divulgado?</h3>
                <p className="text-xs text-stone-400 mt-0.5">Ativação do ciclo de 24 horas</p>
              </div>
            </div>

            <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800/80 space-y-2">
              <p className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Produto selecionado</p>
              <p className="text-xs font-semibold text-stone-200 line-clamp-2">{productToShare.title}</p>
              <p className="text-xs text-amber-300/90 pt-1 border-t border-stone-800/80">
                ⚠ Este produto ficará pausado por 24 horas e só poderá ser enviado novamente após este período.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setProductToShare(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmShare}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/50 transition-all"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Confirmar Envio</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Popup de Confirmação para Desfazer Envio (Zerar 24h) */}
      {productToUndoShare && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-md bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5">
            <button
              onClick={() => setProductToUndoShare(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500/15 border border-amber-500/30 text-amber-400 rounded-2xl shrink-0">
                <RefreshCw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Desfazer divulgação?</h3>
                <p className="text-xs text-stone-400 mt-0.5">Reset de contagem de tempo</p>
              </div>
            </div>

            <div className="bg-stone-950 p-3.5 rounded-2xl border border-stone-800/80 space-y-2">
              <p className="text-[10px] uppercase font-bold text-stone-500 tracking-wider">Produto selecionado</p>
              <p className="text-xs font-semibold text-stone-200 line-clamp-2">{productToUndoShare.title}</p>
              <p className="text-xs text-emerald-300/90 pt-1 border-t border-stone-800/80">
                ✓ Ao desfazer esta ação, o tempo de espera de 24 horas será zerado e o produto estará disponível imediatamente para novas divulgações.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={() => setProductToUndoShare(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmUndoShare}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-amber-950/50 transition-all"
              >
                <span>Sim, Zerar Tempo</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes & Gerador de Copy / Roteiro */}
      {selectedProductForModal && (
        <ProductDetailModal
          product={selectedProductForModal}
          currentUserId={uid}
          apiKeys={apiKeys || {}}
          commissionRates={commissionRates}
          sharedMap={sharedMap}
          onToggleShared={onToggleShared}
          onUpdateProductCommission={onUpdateProductCommission}
          onClose={() => setSelectedProductForModal(null)}
          onAddCustomTemplate={onAddCustomTemplate}
          isAlreadyInMyProducts={true}
        />
      )}
    </div>
  );
};

// ─── Card Individual do Produto no Meus Produtos ─────────────────────────────

interface MinedCardProps {
  item: EnrichedMinedProduct;
  apiKeys?: ApiKeysConfig;
  commissionRates?: CommissionRatesConfig;
  sharedMap?: Record<string, number>;
  onRequestShare: (id: string, title: string) => void;
  onRequestUndoShare: (id: string, title: string) => void;
  onOpenDetail?: (product: GlobalProduct) => void;
  onUseProduct?: (product: GlobalProduct) => void;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
  onDelete: () => void;
  isDeleting?: boolean;
}

const MinedCard: React.FC<MinedCardProps> = ({
  item,
  apiKeys,
  commissionRates,
  sharedMap,
  onRequestShare,
  onRequestUndoShare,
  onOpenDetail,
  onUseProduct,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  isDeleting,
}) => {
  const [imgError, setImgError] = useState(false);
  const [showDesc, setShowDesc] = useState(false);
  const p = item.productData;
  const isArchived = item.status === 'archived';
  const comm = p ? calculateCommission(p.price_to, p.platform, p, null, null, commissionRates) : null;

  if (!p) {
    return (
      <div className="flex flex-col bg-[#0e1119]/50 border border-[#1e2636] rounded-2xl overflow-hidden opacity-50 p-3 gap-2">
        <div className="aspect-square bg-[#151a26] flex items-center justify-center rounded-xl">
          <AlertCircle className="w-10 h-10 text-[#93a0b5]" />
        </div>
        <p className="text-xs text-[#93a0b5] font-medium">Produto indisponível</p>
        <div className="flex items-center gap-2 mt-auto">
          <button onClick={onToggleArchive} className="text-[10px] text-blue-400 hover:underline">
            {isArchived ? 'Restaurar' : 'Arquivar'}
          </button>
          <button onClick={onDelete} disabled={isDeleting} className="text-[10px] text-red-400 hover:underline">
            Excluir
          </button>
        </div>
      </div>
    );
  }

  const sharedStatus = isProductSharedRecently(item.productId, sharedMap);

  return (
    <div
      onClick={() => onOpenDetail && onOpenDetail(p)}
      className={`group cursor-pointer flex flex-col border rounded-2xl overflow-hidden transition-all hover:shadow-xl relative ${
        sharedStatus.isShared
          ? 'border-amber-500/30 bg-[#0e1119]/90 grayscale-[25%] opacity-80'
          : isArchived
          ? 'border-[#1e2636] opacity-60 bg-[#0e1119]'
          : 'border-[#1e2636] bg-[#0e1119] hover:border-blue-500/40 hover:shadow-blue-500/5'
      }`}
    >
      {/* Imagem do Produto + Badges Integrados */}
      <div className="relative aspect-square bg-[#07090f] overflow-hidden">
        {p.image_url && !imgError ? (
          <img
            src={p.image_url}
            alt={p.title}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
              sharedStatus.isShared ? 'opacity-75' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#151a26] text-[#93a0b5]">
            <Tag className="w-10 h-10" />
          </div>
        )}

        {/* Ribbon de Produto Divulgado (24h) */}
        {sharedStatus.isShared && (
          <div className="absolute inset-x-0 top-0 bg-amber-600/95 text-stone-950 font-black text-[10px] px-2 py-1 flex items-center justify-between backdrop-blur-md z-10">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-stone-950" />
              Pausado ({sharedStatus.hoursAgoFormatted})
            </span>
            <span className="text-[9px] font-mono font-bold">
              Libera {sharedStatus.remainingFormatted}
            </span>
          </div>
        )}

        {/* Badge da Plataforma */}
        <span className={`absolute ${sharedStatus.isShared ? 'top-7' : 'top-2'} left-2 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-md backdrop-blur-md transition-all ${platformColor[item.platform] ?? 'bg-[#151a26] text-stone-300'}`}>
          {platformLabel[item.platform] ?? item.platform}
        </span>

        {/* Action icons no topo superior direito (Favoritar, Arquivar, Excluir) */}
        <div className={`absolute ${sharedStatus.isShared ? 'top-7' : 'top-2'} right-2 flex items-center gap-1 bg-[#07090f]/80 p-1 rounded-full backdrop-blur-md border border-[#1e2636] z-10`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={item.favorite ? 'Remover favorito' : 'Favoritar'}
            className="p-1 hover:bg-[#151a26] rounded-full transition-colors"
          >
            {item.favorite ? (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            ) : (
              <StarOff className="w-3.5 h-3.5 text-[#93a0b5] hover:text-amber-400" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive();
            }}
            title={isArchived ? 'Restaurar' : 'Arquivar'}
            className="p-1 hover:bg-[#151a26] rounded-full transition-colors"
          >
            <Archive className={`w-3.5 h-3.5 ${isArchived ? 'text-blue-400' : 'text-[#93a0b5] hover:text-blue-400'}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            title="Excluir produto"
            className="p-1 hover:bg-red-500/20 text-[#93a0b5] hover:text-red-400 rounded-full transition-colors disabled:opacity-50"
          >
            {isDeleting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-red-400" />
            ) : (
              <Trash2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Conteúdo do Card */}
      <div className="flex flex-col flex-1 p-2.5 sm:p-3 gap-2">
        {/* Título do Produto */}
        <h4 className="text-xs font-semibold text-[#eef2f9] leading-snug line-clamp-2 group-hover:text-blue-300 transition-colors">
          {p.title || 'Produto sem título'}
        </h4>

        {/* Descrição do Produto com Ver mais / ver menos */}
        {p.description && (
          <div className="text-[11px] text-[#93a0b5] bg-[#07090f] p-2 rounded-lg border border-[#1e2636]/80 space-y-1">
            <span className="text-[9px] font-bold uppercase tracking-wider text-blue-400 block">
              Descrição
            </span>
            <p className={`leading-relaxed whitespace-pre-line ${!showDesc ? 'line-clamp-2' : ''}`}>
              {p.description}
            </p>
            {p.description.length > 70 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDesc(!showDesc);
                }}
                className="text-[10px] font-bold text-blue-400 hover:underline block mt-0.5 focus:outline-none"
              >
                {showDesc ? 'ver menos' : 'ver mais'}
              </button>
            )}
          </div>
        )}

        {/* Bloco de Preço Padronizado */}
        <PriceBlock product={p} className="mt-auto" />

        {/* Bloco de Comissão Estimada e Categoria */}
        {comm && (
          <div className="bg-[#151a26]/40 border border-[#1e2636] p-2 rounded-xl flex flex-col gap-1 text-xs my-1">
            <div className="text-emerald-400 font-bold text-[11px] sm:text-xs">
              Comissão estimada: {comm.ratePct}% = R$ {comm.amount.toFixed(2).replace('.', ',')}
            </div>
            {p.category ? (
              <div className="text-[10px] text-[#93a0b5] truncate" title={p.category}>
                🏷️ estimativa (categoria: {p.category})
              </div>
            ) : (
              <div className="text-[10px] text-amber-400 font-medium">
                ⚠️ estimativa (categoria ausente - usando padrão)
              </div>
            )}
          </div>
        )}

        {/* Botões de Ação Empilhados (Divulgar e Marcar/Desfazer como enviado) */}
        <div className="flex flex-col gap-1.5 mt-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenDetail) onOpenDetail(p);
            }}
            className="w-full py-2 sm:py-2.5 px-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span>Divulgar Produto</span>
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              if (sharedStatus.isShared) {
                onRequestUndoShare(p.id, p.title || 'Produto');
              } else {
                onRequestShare(p.id, p.title || 'Produto');
              }
            }}
            className={`w-full py-2 sm:py-2.5 px-2 rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-1.5 whitespace-nowrap ${
              sharedStatus.isShared
                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40 hover:bg-amber-900/80 hover:text-white'
                : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:bg-emerald-900/80 hover:text-white'
            }`}
          >
            {sharedStatus.isShared ? (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                <span>Desfazer Enviado</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Marcar como Enviado</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
