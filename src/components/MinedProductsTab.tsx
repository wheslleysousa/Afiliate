import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MinedProductRef, GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate } from '../types';
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
}) => {
  const [items, setItems] = useState<EnrichedMinedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready_24h' | 'shared_24h' | 'favorites' | 'archived'>('all');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [selectedProductForModal, setSelectedProductForModal] = useState<GlobalProduct | null>(null);

  useEffect(() => {
    if (!uid) return;
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
      },
      (e) => {
        console.error('[MinedProducts] Erro em tempo real:', e);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [uid]);

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

  return (
    <div className="space-y-6">
      {/* Header com Busca */}
      <div className="bg-[#0e1119] border border-[#1e2636] p-4 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="p-2.5 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white">Meus Produtos Adicionados</h2>
            <p className="text-xs text-[#93a0b5]">
              {filtered.length} produto{filtered.length !== 1 ? 's' : ''} em sua coleção
            </p>
          </div>
        </div>

        {/* Busca em Meus Produtos */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a0b5]" />
          <input
            type="text"
            placeholder="Pesquisar em meus produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white placeholder-[#93a0b5] focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Painel de Filtros Organizado em Grupos de Chips */}
      <div className="bg-[#0e1119] border border-[#1e2636] p-4 rounded-2xl space-y-4">
        {/* Grupo 1: Status */}
        <div className="space-y-2">
          <span className="text-[11px] font-extrabold text-[#93a0b5] uppercase tracking-wider block">
            Status do Produto:
          </span>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((st) => {
              const isActive = statusFilter === st.id;
              return (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id as any)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
                      : 'bg-[#151a26] text-[#93a0b5] hover:text-white border-[#1e2636]'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grupo 2: Plataforma */}
        <div className="space-y-2 pt-2 border-t border-[#1e2636]">
          <span className="text-[11px] font-extrabold text-[#93a0b5] uppercase tracking-wider block">
            Plataforma:
          </span>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((pl) => {
              const isActive = platformFilter === pl.id;
              return (
                <button
                  key={pl.id}
                  onClick={() => setPlatformFilter(pl.id)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                    isActive
                      ? 'bg-amber-500 text-stone-950 border-amber-400 font-extrabold shadow-md shadow-amber-500/20'
                      : 'bg-[#151a26] text-[#93a0b5] hover:text-white border-[#1e2636]'
                  }`}
                >
                  {pl.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Lista de Produtos */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0e1119] rounded-2xl border border-[#1e2636] p-6 space-y-2">
              <ShoppingBag className="w-12 h-12 text-stone-600 mb-1" />
              <p className="text-sm font-extrabold text-white">Nenhum produto em Meus Produtos</p>
              <p className="text-xs text-[#93a0b5]">
                Acesse a aba "Marketplace Global" para explorar e adicionar novos produtos à sua coleção.
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
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformColor[product.platform] || 'bg-stone-800 text-stone-300'}`}>
                        {platformLabel[product.platform] || product.platform}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleFavorite(item.productId, Boolean(item.favorite))}
                          className="p-1 rounded-lg bg-[#151a26] hover:bg-stone-800 text-amber-400 transition-colors"
                          title={item.favorite ? 'Remover dos favoritos' : 'Favoritar produto'}
                        >
                          <Star className={`w-3.5 h-3.5 ${item.favorite ? 'fill-amber-400' : ''}`} />
                        </button>

                        <button
                          onClick={() => toggleArchive(item.productId, Boolean(item.archived))}
                          className="p-1 rounded-lg bg-[#151a26] hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
                          title={item.archived ? 'Desarquivar' : 'Arquivar'}
                        >
                          <Archive className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => setDeleteConfirmItem(item)}
                          className="p-1 rounded-lg bg-[#151a26] hover:bg-red-500/20 text-stone-400 hover:text-red-400 transition-colors"
                          title="Remover produto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

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
                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                          />
                        ) : (
                          <ShoppingBag className="w-10 h-10 text-stone-600" />
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {product.title}
                      </h3>

                      {/* Stars & Sales Indicators */}
                      {(product.stars || product.sales_count) && (
                        <div className="flex items-center gap-2 text-[10px] text-[#93a0b5]">
                          {product.stars && (
                            <div className="flex items-center gap-0.5 text-amber-400">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span className="font-bold">{product.stars}</span>
                            </div>
                          )}
                          {product.stars && product.sales_count && <span className="text-stone-700">•</span>}
                          {product.sales_count && (
                            <span className="truncate">{product.sales_count}</span>
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
                  {deleteConfirmItem.productData?.price_to
                    ? (typeof deleteConfirmItem.productData.price_to === 'number'
                        ? `R$ ${(deleteConfirmItem.productData.price_to as number).toFixed(2).replace('.', ',')}`
                        : `R$ ${deleteConfirmItem.productData.price_to}`)
                    : ''}
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
          currentUserId={uid}
          apiKeys={apiKeys}
          commissionRates={commissionRates}
          onClose={() => setSelectedProductForModal(null)}
          onAddCustomTemplate={onAddCustomTemplate}
          customTemplates={customTemplates}
          defaultTemplateId={defaultTemplateId}
        />
      )}
    </div>
  );
};
