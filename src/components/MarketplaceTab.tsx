import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  where,
  doc,
  setDoc,
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
  X,
  ShoppingBag,
  Plus,
  CheckCircle2,
  Star,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

const PLATFORMS = [
  { id: '', label: 'Todas as Plataformas' },
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'aliexpress', label: 'AliExpress' },
  { id: 'shein', label: 'Shein' },
  { id: 'tiktokshop', label: 'TikTok Shop' },
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
  tiktokshop: 'TikTok Shop',
};

const platformColor: Record<string, string> = {
  mercadolivre: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  shopee: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  amazon: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  aliexpress: 'bg-red-500/20 text-red-300 border-red-500/30',
  shein: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  tiktokshop: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

const ITEMS_PER_PAGE = 12; // 2x2 com 6 linhas por página

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
  customTemplates?: CopyTemplate[];
  defaultTemplateId?: string;
}

export const MarketplaceTab: React.FC<MarketplaceTabProps> = ({
  currentUserId,
  apiKeys,
  commissionRates,
  onAddCustomTemplate,
  userMinedIds = new Set(),
  customTemplates = [],
  defaultTemplateId,
}) => {
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [loading, setLoading] = useState(true);

  // Busca e Filtros
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'commission_amount' | 'commission_rate' | 'trend' | 'price_asc'>('commission_amount');
  
  // Paginação tradicional
  const [currentPage, setCurrentPage] = useState(1);

  // Modal de Filtros
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  // Modal de Detalhes do Produto
  const [selectedProductForModal, setSelectedProductForModal] = useState<GlobalProduct | null>(null);

  // Conjunto local de IDs minerados/adicionados pelo usuário
  const [localMinedIds, setLocalMinedIds] = useState<Set<string>>(new Set(userMinedIds));

  useEffect(() => {
    setLocalMinedIds(new Set(userMinedIds));
  }, [userMinedIds]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let q = query(
        collection(db, 'products'),
        orderBy('lastMinedAt', 'desc'),
        limit(200)
      );

      if (platformFilter) {
        q = query(
          collection(db, 'products'),
          where('platform', '==', platformFilter),
          orderBy('lastMinedAt', 'desc'),
          limit(200)
        );
      }

      const snap = await getDocs(q);
      const docs = snap.docs.map((d) => d.data() as GlobalProduct);
      setProducts(docs);
    } catch (e) {
      console.error('[Marketplace] Erro ao carregar produtos:', e);
    } finally {
      setLoading(false);
    }
  }, [platformFilter]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Resetar para a primeira página sempre que os filtros ou busca mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [search, platformFilter, categoryFilter, sortBy]);

  // Adicionar produto a Meus Produtos no Firestore
  const handleAddToMyProducts = async (product: GlobalProduct, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!currentUserId) return;

    setLocalMinedIds((prev) => new Set([...prev, product.id]));

    try {
      await setDoc(doc(db, 'users', currentUserId, 'minedProducts', product.id), {
        productId: product.id,
        minedAt: new Date().toISOString(),
        favorite: false,
        archived: false,
      }, { merge: true });
    } catch (err) {
      console.error('[Marketplace] Erro ao adicionar a Meus Produtos:', err);
    }
  };

  // Filtragem local por busca e categoria
  const filtered = useMemo(() => {
    const list = products.filter((p) => {
      const matchesSearch = !search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase());
      const matchesCategory = !categoryFilter || (p.category && p.category.toLowerCase() === categoryFilter.toLowerCase());
      return matchesSearch && matchesCategory;
    });

    // Ordenação
    list.sort((a, b) => {
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

    return list;
  }, [products, search, categoryFilter, sortBy, commissionRates]);

  // Cálculos de Paginação
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filtered.length);
  const currentProducts = filtered.slice(startIndex, endIndex);

  // Mudar de página com rolagem suave
  const goToPage = (pageNumber: number) => {
    if (pageNumber < 1 || pageNumber > totalPages) return;
    setCurrentPage(pageNumber);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Gerar lista de números de páginas para o controle visual
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 4) {
        pages.push(1, 2, 3, 4, 5, '...', totalPages);
      } else if (currentPage >= totalPages - 3) {
        pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
      } else {
        pages.push(1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages);
      }
    }
    return pages;
  };

  const activeFiltersCount = (platformFilter ? 1 : 0) + (categoryFilter ? 1 : 0) + (sortBy !== 'commission_amount' ? 1 : 0);

  return (
    <div className="w-full max-w-full overflow-hidden space-y-5 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e2636] pb-3">
        <div className="min-w-0">
          <h1 className="text-lg font-extrabold text-white flex items-center gap-2 truncate">
            <Globe className="w-5 h-5 text-blue-400 shrink-0" /> Marketplace Global
          </h1>
          <p className="text-xs text-[#93a0b5] truncate">
            Explore produtos minerados pela comunidade prontos para adicionar e faturar.
          </p>
        </div>
      </div>

      {/* Search Header: Pesquisa + Botão Filtro */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 bg-[#0e1119] border border-[#1e2636] p-3 sm:p-3.5 rounded-2xl w-full">
        {/* Campo de Pesquisa */}
        <div className="relative flex-1 w-full min-w-0">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a0b5]" />
          <input
            type="text"
            placeholder="Pesquisar por título, categoria ou produto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white placeholder:text-[#93a0b5] focus:outline-none focus:border-blue-500 transition-colors"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#93a0b5] hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Botão de Filtros */}
        <button
          onClick={() => setIsFilterModalOpen(true)}
          className={`flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 w-full sm:w-auto cursor-pointer ${
            activeFiltersCount > 0
              ? 'bg-blue-600/20 text-blue-300 border-blue-500/40'
              : 'bg-[#151a26] text-[#93a0b5] border-[#1e2636] hover:text-white'
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Filtros</span>
          {activeFiltersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-blue-500 text-white text-[10px] flex items-center justify-center font-black">
              {activeFiltersCount}
            </span>
          )}
        </button>
      </div>

      {/* Barra de Filtros Ativos */}
      {activeFiltersCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-[11px] text-[#93a0b5] font-semibold">Filtros ativos:</span>
          {platformFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#151a26] text-white border border-[#1e2636] text-[10px]">
              {platformLabel[platformFilter] || platformFilter}
              <button onClick={() => setPlatformFilter('')} className="hover:text-rose-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {categoryFilter && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#151a26] text-white border border-[#1e2636] text-[10px]">
              {categoryFilter}
              <button onClick={() => setCategoryFilter('')} className="hover:text-rose-400">
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {sortBy !== 'commission_amount' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#151a26] text-white border border-[#1e2636] text-[10px]">
              Ordenação ativa
              <button onClick={() => setSortBy('commission_amount')} className="hover:text-rose-400">
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

      {/* Loading Skeleton State */}
      {loading && (
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 w-full">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-3 sm:p-4 space-y-3 animate-pulse">
              <div className="w-full aspect-square bg-[#151a26] rounded-xl" />
              <div className="h-3 bg-[#151a26] rounded-full w-2/3" />
              <div className="h-4 bg-[#151a26] rounded-full w-full" />
              <div className="h-6 bg-[#151a26] rounded-xl w-1/2 pt-2" />
            </div>
          ))}
        </div>
      )}

      {/* Grid de Produtos 2x2 (Um ao lado do outro, rigorosamente contido nas bordas) */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center bg-[#0e1119] rounded-2xl border border-[#1e2636] p-6 space-y-2 w-full">
              <ShoppingBag className="w-10 h-10 text-[#93a0b5] opacity-50" />
              <p className="text-sm font-extrabold text-white">Nenhum produto encontrado</p>
              <p className="text-xs text-[#93a0b5] max-w-sm">
                Tente ajustar o termo de pesquisa ou remover os filtros aplicados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:gap-5 w-full">
              {currentProducts.map((product) => {
                const comm = calculateCommission(
                  product.price_to,
                  product.platform,
                  product,
                  null,
                  null,
                  commissionRates
                );
                const isAlreadyInMine = localMinedIds.has(product.id);

                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProductForModal(product)}
                    className="w-full max-w-full overflow-hidden bg-[#0e1119] border border-[#1e2636] hover:border-blue-500/50 rounded-2xl p-3 sm:p-4.5 flex flex-col justify-between gap-3 cursor-pointer transition-all hover:scale-[1.008] group shadow-xl"
                  >
                    <div className="space-y-2.5 min-w-0">
                      {/* Top Bar: Tags de Plataforma e Categoria */}
                      <div className="flex items-center justify-between gap-1.5 flex-wrap min-w-0">
                        <span className={`text-[9px] sm:text-[10px] font-bold px-2 sm:px-2.5 py-0.5 rounded-full border truncate shrink-0 ${platformColor[product.platform] || 'bg-[#151a26] text-[#93a0b5]'}`}>
                          {platformLabel[product.platform] || product.platform}
                        </span>
                        {product.category && (
                          <span className="text-[9px] sm:text-[10px] font-semibold text-[#93a0b5] truncate max-w-[80px] sm:max-w-[130px]">
                            {product.category}
                          </span>
                        )}
                      </div>

                      {/* Imagem do Produto */}
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

                      {/* Título & Avaliações */}
                      <div className="space-y-1.5 min-w-0">
                        <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug min-h-[2rem] break-words">
                          {product.title}
                        </h3>

                        {/* Stars & Sales Indicators */}
                        <div className="flex items-center gap-1.5 text-[10px] text-[#93a0b5] flex-wrap min-w-0">
                          {product.stars && (
                            <div className="flex items-center gap-0.5 text-amber-400 shrink-0">
                              <Star className="w-3 h-3 fill-amber-400" />
                              <span className="font-bold">{product.stars}</span>
                            </div>
                          )}
                          {product.stars && product.sales_count && <span className="text-[#1e2636]">•</span>}
                          {product.sales_count && (
                            <span className="truncate text-stone-300 font-medium">
                              {product.sales_count.includes('vend') ? product.sales_count : `${product.sales_count} vendidos`}
                            </span>
                          )}
                        </div>

                        {/* Bloco de Preços */}
                        <div className="min-w-0 overflow-hidden">
                          <PriceBlock
                            product={product}
                            size="sm"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Bloco Inferior: Comissão Estimada por Extenso + Botão Adicionar a Meus Produtos */}
                    <div className="pt-2.5 border-t border-[#1e2636] space-y-2 min-w-0">
                      {/* Comissão Estimada por extenso */}
                      <div className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-emerald-400 flex flex-col gap-0.5 min-w-0 overflow-hidden">
                        <span className="text-[9px] sm:text-[10px] font-black tracking-wide uppercase text-emerald-400 truncate">
                          Comissão Estimada
                        </span>
                        <div className="flex items-center justify-between gap-1 flex-wrap min-w-0">
                          <span className="text-xs sm:text-sm font-black text-white truncate">
                            {formatPrice(comm.amount)}
                          </span>
                          <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-300 rounded-full border border-emerald-500/30 shrink-0">
                            {comm.ratePct}%
                          </span>
                        </div>
                      </div>

                      {/* Botão Adicionar a Meus Produtos */}
                      <button
                        type="button"
                        onClick={(e) => handleAddToMyProducts(product, e)}
                        className={`w-full py-2 sm:py-2.5 px-2 rounded-xl font-extrabold text-[11px] sm:text-xs flex items-center justify-center gap-1.5 transition-all shadow-md cursor-pointer min-w-0 ${
                          isAlreadyInMine
                            ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                        }`}
                      >
                        {isAlreadyInMine ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                            <span className="truncate">Adicionado ✓</span>
                          </>
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5 shrink-0" />
                            <span className="truncate">Adicionar a Meus Produtos</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ─── PAGINAÇÃO TRADICIONAL ESTILO MARKETPLACE (1, 2, 3 ... 8, 9) ─── */}
          {filtered.length > 0 && totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6 border-t border-[#1e2636] w-full">
              {/* Contador Informativo */}
              <div className="text-xs text-[#93a0b5] text-center sm:text-left">
                Mostrando <span className="font-bold text-white">{startIndex + 1}</span>-
                <span className="font-bold text-white">{endIndex}</span> de{' '}
                <span className="font-bold text-white">{filtered.length}</span> produtos • Página{' '}
                <span className="font-bold text-white">{currentPage}</span> de{' '}
                <span className="font-bold text-white">{totalPages}</span>
              </div>

              {/* Controles de Navegação */}
              <div className="flex items-center gap-1 flex-wrap justify-center">
                {/* Primeira Página */}
                <button
                  type="button"
                  onClick={() => goToPage(1)}
                  disabled={currentPage === 1}
                  title="Primeira página"
                  className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                    currentPage === 1
                      ? 'bg-[#0e1119] border-[#1e2636] text-stone-600 cursor-not-allowed'
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500 cursor-pointer'
                  }`}
                >
                  <ChevronsLeft className="w-3.5 h-3.5" />
                </button>

                {/* Página Anterior */}
                <button
                  type="button"
                  onClick={() => goToPage(currentPage - 1)}
                  disabled={currentPage === 1}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                    currentPage === 1
                      ? 'bg-[#0e1119] border-[#1e2636] text-stone-600 cursor-not-allowed'
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500 cursor-pointer'
                  }`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                {/* Números das Páginas (Ex: 1, 2, 3 ... 8, 9) */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((p, idx) => {
                    if (p === '...') {
                      return (
                        <span key={`dots-${idx}`} className="px-2 text-xs text-[#93a0b5] select-none font-bold">
                          ...
                        </span>
                      );
                    }

                    const pageNum = p as number;
                    const isActive = pageNum === currentPage;

                    return (
                      <button
                        key={pageNum}
                        type="button"
                        onClick={() => goToPage(pageNum)}
                        className={`min-w-[32px] h-8 px-2 rounded-xl text-xs font-black transition-all flex items-center justify-center cursor-pointer ${
                          isActive
                            ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border border-blue-500'
                            : 'bg-[#0e1119] text-[#93a0b5] border border-[#1e2636] hover:text-white hover:border-blue-500/50'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                </div>

                {/* Próxima Página */}
                <button
                  type="button"
                  onClick={() => goToPage(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-1 transition-all ${
                    currentPage === totalPages
                      ? 'bg-[#0e1119] border-[#1e2636] text-stone-600 cursor-not-allowed'
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500 cursor-pointer'
                  }`}
                >
                  <span className="hidden sm:inline">Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>

                {/* Última Página */}
                <button
                  type="button"
                  onClick={() => goToPage(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Última página"
                  className={`p-2 rounded-xl border text-xs font-bold transition-all ${
                    currentPage === totalPages
                      ? 'bg-[#0e1119] border-[#1e2636] text-stone-600 cursor-not-allowed'
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500 cursor-pointer'
                  }`}
                >
                  <ChevronsRight className="w-3.5 h-3.5" />
                </button>
              </div>
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
              <button onClick={() => setIsFilterModalOpen(false)} className="text-[#93a0b5] hover:text-white cursor-pointer">
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
                className="text-xs font-bold text-stone-400 hover:text-white cursor-pointer"
              >
                Limpar Filtros
              </button>
              <button
                onClick={() => setIsFilterModalOpen(false)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs shadow-md shadow-blue-600/20 cursor-pointer"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Detalhes do Produto (Modo Marketplace: Sem WhatsApp nem Compartilhar) */}
      {selectedProductForModal && (
        <ProductDetailModal
          product={selectedProductForModal}
          mode="marketplace"
          isAlreadyMined={localMinedIds.has(selectedProductForModal.id)}
          currentUserId={currentUserId}
          apiKeys={apiKeys}
          commissionRates={commissionRates}
          onClose={() => setSelectedProductForModal(null)}
          onAddCustomTemplate={onAddCustomTemplate}
          customTemplates={customTemplates}
          defaultTemplateId={defaultTemplateId}
          onAddToMyProducts={(prod) => handleAddToMyProducts(prod)}
          onProductEnriched={(enriched) => {
            setProducts((prev) =>
              prev.map((p) => (p.id === enriched.id ? enriched : p))
            );
            setSelectedProductForModal(enriched);
          }}
        />
      )}
    </div>
  );
};
