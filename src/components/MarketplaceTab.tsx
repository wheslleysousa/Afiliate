import React, { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  startAfter,
  DocumentSnapshot,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate } from '../types';
import { ProductDetailModal } from './ProductDetailModal';
import { PriceBlock } from './PriceBlock';
import { formatPrice } from '../utils/formatPrice';
import { calculateCommission, calculateSalesTrend } from '../utils/marketplaceUtils';
import {
  Globe,
  Search,
  SlidersHorizontal,
  Loader2,
  ChevronDown,
  X,
  Layers,
  ShoppingBag,
  Filter,
  Check,
  TrendingUp,
  Percent,
} from 'lucide-react';

const PLATFORMS = [
  { id: '', label: 'Todas as Plataformas' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'aliexpress', label: 'AliExpress' },
  { id: 'shein', label: 'Shein' },
];

const CATEGORIES = [
  { id: '', label: 'Todas as Categorias' },
  { id: 'Alimentos & Bebidas', label: 'Alimentos & Bebidas' },
  { id: 'Beleza', label: 'Beleza' },
  { id: 'Brinquedos & Hobbies', label: 'Brinquedos & Hobbies' },
  { id: 'Casa & Cozinha', label: 'Casa & Cozinha' },
  { id: 'Eletrônicos', label: 'Eletrônicos' },
  { id: 'Moda', label: 'Moda' },
  { id: 'Ferramentas', label: 'Ferramentas' },
  { id: 'Saúde', label: 'Saúde' },
];

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

const PAGE_SIZE = 24;

interface MarketplaceTabProps {
  currentUserId?: string;
  apiKeys?: ApiKeysConfig;
  commissionRates?: CommissionRatesConfig;
  sharedMap?: Record<string, number>;
  onToggleShared?: (productId: string) => void;
  onUseProduct?: (product: GlobalProduct) => void;
  onNavigateToSettings?: () => void;
  onNavigateToMyProducts?: () => void;
  onUpdateProductCommission?: (productId: string, ratePct: number | null, amountVal: number | null) => void;
  onAddCustomTemplate?: (template: CopyTemplate) => void;
  userMinedIds?: Set<string>;
}

export const MarketplaceTab: React.FC<MarketplaceTabProps> = ({
  currentUserId,
  apiKeys,
  commissionRates,
  onAddCustomTemplate,
}) => {
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Busca e Filtros
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'commission_amount' | 'commission_rate' | 'trend' | 'price_asc'>('commission_amount');
  
  // Modal de Filtros
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Modal de Detalhes do Produto
  const [selectedProductForModal, setSelectedProductForModal] = useState<GlobalProduct | null>(null);

  const fetchProducts = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setLastDoc(null);
      setProducts([]);
    } else {
      setLoadingMore(true);
    }

    try {
      let q = query(
        collection(db, 'products'),
        orderBy('lastMinedAt', 'desc'),
        limit(PAGE_SIZE)
      );

      if (platformFilter) {
        q = query(
          collection(db, 'products'),
          where('platform', '==', platformFilter),
          orderBy('lastMinedAt', 'desc'),
          limit(PAGE_SIZE)
        );
      }

      if (!reset && lastDoc) {
        q = query(q, startAfter(lastDoc));
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => d.data() as GlobalProduct);

      setProducts((prev) => (reset ? docs : [...prev, ...docs]));
      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } catch (e) {
      console.error('[Marketplace] Erro ao carregar produtos:', e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [platformFilter, lastDoc]);

  useEffect(() => {
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformFilter]);

  // Filtragem local por busca e categoria
  let filtered = products.filter((p) => {
    const matchesSearch = !search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = !categoryFilter || (p.category && p.category.toLowerCase() === categoryFilter.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  // Ordenação
  filtered.sort((a, b) => {
    const commA = calculateCommission(a.price_to, a.platform, a, null, null, commissionRates);
    const commB = calculateCommission(b.price_to, b.platform, b, null, null, commissionRates);

    if (sortBy === 'commission_amount') {
      return commB.amount - commA.amount;
    }
    if (sortBy === 'commission_rate') {
      return commB.ratePct - commA.ratePct;
    }
    if (sortBy === 'trend') {
      const trendA = calculateSalesTrend(a);
      const trendB = calculateSalesTrend(b);
      return trendB.pct - trendA.pct;
    }
    if (sortBy === 'price_asc') {
      const priceA = parseFloat(a.price_to.replace(',', '.')) || 0;
      const priceB = parseFloat(b.price_to.replace(',', '.')) || 0;
      return priceA - priceB;
    }
    return 0;
  });

  const activeFiltersCount = (platformFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (sortBy !== 'commission_amount' ? 1 : 0);

  return (
    <div className="space-y-6">
      {/* Search Header: Pesquisa + Botão Filtro */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-[#0e1119] border border-[#1e2636] p-4 rounded-2xl">
        {/* Campo de Pesquisa */}
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a0b5]" />
          <input
            type="text"
            placeholder="Pesquisar produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs sm:text-sm text-white placeholder-[#93a0b5] focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Botão de Filtro */}
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold text-xs flex items-center justify-center gap-2 border transition-all shrink-0 ${
            activeFiltersCount > 0
              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
              : 'bg-[#151a26] hover:bg-stone-800 text-stone-200 border-[#1e2636]'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4 text-blue-400" />
          <span>Filtro</span>
          {activeFiltersCount > 0 && (
            <span className="ml-1 w-5 h-5 rounded-full bg-white text-blue-600 text-[10px] font-black flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Badges de Filtros Ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-[#93a0b5]">Filtros ativos:</span>
          {platformFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#151a26] border border-[#1e2636] text-xs font-semibold text-white">
              Plataforma: {platformLabel[platformFilter] || platformFilter}
              <button onClick={() => setPlatformFilter('')} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {categoryFilter && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#151a26] border border-[#1e2636] text-xs font-semibold text-white">
              Categoria: {categoryFilter}
              <button onClick={() => setCategoryFilter('')} className="hover:text-red-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          <button
            onClick={() => {
              setPlatformFilter('');
              setCategoryFilter('');
              setSortBy('commission_amount');
            }}
            className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
          >
            Limpar todos
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Grid de Produtos */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-[#0e1119] rounded-2xl border border-[#1e2636] p-6 space-y-2">
              <ShoppingBag className="w-12 h-12 text-stone-600 mb-1" />
              <p className="text-sm font-extrabold text-white">Nenhum produto encontrado</p>
              <p className="text-xs text-[#93a0b5]">
                Tente ajustar o termo de pesquisa ou remover os filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filtered.map((product) => {
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
                    key={product.id}
                    onClick={() => setSelectedProductForModal(product)}
                    className="bg-[#0e1119] border border-[#1e2636] hover:border-blue-500/50 rounded-2xl p-4 flex flex-col justify-between gap-3 cursor-pointer transition-all hover:scale-[1.02] group shadow-lg"
                  >
                    <div className="space-y-2">
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

                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformColor[product.platform] || 'bg-stone-800 text-stone-300'}`}>
                          {platformLabel[product.platform] || product.platform}
                        </span>
                        {product.category && (
                          <span className="text-[10px] font-semibold text-[#93a0b5] truncate max-w-[110px]">
                            {product.category}
                          </span>
                        )}
                      </div>

                      <h3 className="text-xs font-bold text-white line-clamp-2 leading-snug">
                        {product.title}
                      </h3>
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

          {/* Carregar Mais */}
          {hasMore && !search && (
            <div className="flex justify-center pt-4">
              <button
                onClick={() => fetchProducts(false)}
                disabled={loadingMore}
                className="px-6 py-2.5 rounded-xl bg-[#0e1119] hover:bg-[#151a26] text-white text-xs font-extrabold border border-[#1e2636] transition-all flex items-center gap-2"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin text-blue-400" /> : <ChevronDown className="w-4 h-4 text-blue-400" />}
                Carregar mais produtos
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal de Filtros */}
      {isFilterModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-blue-400" /> Filtros do Marketplace
              </h3>
              <button onClick={() => setIsFilterModalOpen(false)} className="text-[#93a0b5] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Seleção de Plataforma */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5">Plataforma</label>
                <select
                  value={platformFilter}
                  onChange={(e) => setPlatformFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {PLATFORMS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Seleção de Categoria */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5">Categoria</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Ordenação */}
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1.5">Ordenar Por</label>
                <select
                  value={sortBy}
                  onChange={(e: any) => setSortBy(e.target.value)}
                  className="w-full px-3 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="commission_amount">Maior Valor de Comissão (R$)</option>
                  <option value="commission_rate">Maior % de Comissão (%)</option>
                  <option value="trend">Vendas em Alta ↗</option>
                  <option value="price_asc">Menor Preço (R$)</option>
                </select>
              </div>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-between pt-3 border-t border-[#1e2636]">
              <button
                onClick={() => {
                  setPlatformFilter('');
                  setCategoryFilter('');
                  setSortBy('commission_amount');
                }}
                className="text-xs font-bold text-stone-400 hover:text-white"
              >
                Limpar Filtros
              </button>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/20"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Produto */}
      {selectedProductForModal && (
        <ProductDetailModal
          product={selectedProductForModal}
          currentUserId={currentUserId}
          apiKeys={apiKeys}
          commissionRates={commissionRates}
          onClose={() => setSelectedProductForModal(null)}
          onAddCustomTemplate={onAddCustomTemplate}
        />
      )}
    </div>
  );
};
