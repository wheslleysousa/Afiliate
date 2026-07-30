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
import { PriceHistoryModal } from './PriceHistoryModal';
import { ProductDetailModal } from './ProductDetailModal';
import { Badge, CommissionBadge } from './Badge';
import { formatPrice } from '../utils/formatPrice';
import { buildAffiliateLink } from '../utils/affiliateLink';
import { calculateCommission, calculateSalesTrend } from '../utils/marketplaceUtils';
import {
  Globe,
  Search,
  RefreshCw,
  Loader2,
  ChevronDown,
  Tag,
  Share2,
  ArrowUpDown,
  Utensils,
  Sparkle,
  Gamepad2,
  Home,
  Tv,
  Shirt,
  Wrench,
  HeartPulse,
  Layers,
  Check,
  Copy,
} from 'lucide-react';

const PLATFORMS = ['mercadolivre', 'shopee', 'amazon', 'aliexpress', 'shein'] as const;
const PAGE_SIZE = 24;

const CATEGORIES = [
  { id: '', label: 'Todas as Categorias', icon: Layers },
  { id: 'Alimentos & Bebidas', label: 'Alimentos & Bebidas', icon: Utensils },
  { id: 'Beleza', label: 'Beleza', icon: Sparkle },
  { id: 'Brinquedos & Hobbies', label: 'Brinquedos & Hobbies', icon: Gamepad2 },
  { id: 'Casa & Cozinha', label: 'Casa & Cozinha', icon: Home },
  { id: 'Eletrônicos', label: 'Eletrônicos', icon: Tv },
  { id: 'Moda', label: 'Moda', icon: Shirt },
  { id: 'Ferramentas', label: 'Ferramentas', icon: Wrench },
  { id: 'Saúde', label: 'Saúde', icon: HeartPulse },
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
  shopee:       'bg-amber-500/20 text-amber-300 border-amber-500/30',
  amazon:       'bg-blue-500/20 text-blue-300 border-blue-500/30',
  aliexpress:   'bg-red-500/20 text-red-300 border-red-500/30',
  shein:        'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

interface MarketplaceTabProps {
  currentUserId?: string;
  apiKeys?: ApiKeysConfig;
  commissionRates?: CommissionRatesConfig;
  sharedMap?: Record<string, number>;
  onToggleShared?: (productId: string) => void;
  onUseProduct?: (product: GlobalProduct) => void;
  onNavigateToSettings?: () => void;
  onUpdateProductCommission?: (productId: string, ratePct: number | null, amountVal: number | null) => void;
  onAddCustomTemplate?: (template: CopyTemplate) => void;
}

export const MarketplaceTab: React.FC<MarketplaceTabProps> = ({
  currentUserId,
  apiKeys,
  commissionRates,
  sharedMap,
  onToggleShared,
  onUseProduct,
  onNavigateToSettings,
  onUpdateProductCommission,
  onAddCustomTemplate,
}) => {
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // Filtros & Ordenação
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [sortBy, setSortBy] = useState<'commission_amount' | 'commission_rate' | 'trend' | 'price_asc'>('commission_amount');
  const [error, setError] = useState<string | null>(null);

  // Modal de Detalhes / Divulgação do Produto
  const [selectedProductForModal, setSelectedProductForModal] = useState<GlobalProduct | null>(null);

  const fetchProducts = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      setLastDoc(null);
      setProducts([]);
    } else {
      setLoadingMore(true);
    }
    setError(null);

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
    } catch (e: any) {
      console.error('[Marketplace] Erro ao carregar produtos:', e);
      setError('Não foi possível carregar o marketplace. Tente novamente.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [platformFilter, lastDoc]);

  useEffect(() => {
    fetchProducts(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformFilter]);

  // Filtro de busca local e categoria
  let filtered = products.filter((p) => {
    const matchesSearch = !search.trim() || p.title.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = !categoryFilter || (p.category && p.category.toLowerCase() === categoryFilter.toLowerCase());

    return matchesSearch && matchesCategory;
  });

  // Ordenar produtos
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

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Header com Estatísticas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0e1119] border border-[#1e2636] p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Marketplace Global de Afiliados</h2>
            <p className="text-xs text-[#93a0b5]">
              {filtered.length} produto{filtered.length !== 1 ? 's' : ''} disponível{filtered.length !== 1 ? 'eis' : ''} com comissão estimada em tempo real
            </p>
          </div>
        </div>

        <button
          onClick={() => fetchProducts(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#151a26] hover:bg-stone-800 text-stone-200 text-xs font-semibold border border-[#1e2636] hover:border-blue-500/50 transition-all shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5 text-blue-400" />
          Atualizar Produtos
        </button>
      </div>

      {/* Categorias (Filtro por Categoria) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = categoryFilter === cat.id;
          return (
            <button
              key={cat.id || 'all'}
              onClick={() => setCategoryFilter(cat.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                isActive
                  ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
                  : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636] hover:border-stone-700'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Controles: Busca, Menu Suspenso de Ordenação e Filtro por Plataforma */}
      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
        {/* Busca */}
        <div className="relative sm:col-span-5">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a0b5]" />
          <input
            type="text"
            placeholder="Buscar por produto ou palavra-chave..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs sm:text-sm text-[#eef2f9] placeholder-[#93a0b5] focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Filtro por Plataforma */}
        <div className="relative sm:col-span-3">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs sm:text-sm text-[#eef2f9] focus:outline-none focus:border-blue-500 transition-colors cursor-pointer"
          >
            <option value="">Todas as Plataformas</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#93a0b5] pointer-events-none" />
        </div>

        {/* Menu Suspenso de Ordenação */}
        <div className="relative sm:col-span-4">
          <select
            value={sortBy}
            onChange={(e: any) => setSortBy(e.target.value)}
            className="w-full appearance-none pl-3 pr-8 py-2.5 bg-[#0e1119] border border-blue-500/40 rounded-xl text-xs sm:text-sm font-bold text-white focus:outline-none focus:border-blue-500 transition-colors cursor-pointer bg-blue-950/20"
          >
            <option value="commission_amount">Sort: Maior Valor de Comissão (R$)</option>
            <option value="commission_rate">Sort: Maior Comissão % (%)</option>
            <option value="trend">Sort: Vendas em Alta ↗</option>
            <option value="price_asc">Sort: Menor Preço (R$)</option>
          </select>
          <ArrowUpDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400 pointer-events-none" />
        </div>
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
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      )}

      {/* Grade de Produtos */}
      {!loading && (
        <>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-500 bg-black rounded-2xl border border-stone-800">
              <Globe className="w-12 h-12 mb-3 opacity-30 text-blue-500" />
              <p className="text-sm font-semibold text-stone-300">Nenhum produto encontrado com estes filtros.</p>
              <p className="text-xs mt-1 text-stone-500">Tente buscar por outro termo ou limpar os filtros.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {filtered.map((product) => (
                <MarketplaceCard
                  key={product.id}
                  product={product}
                  currentUserId={currentUserId}
                  apiKeys={apiKeys}
                  commissionRates={commissionRates}
                  onOpenDetail={() => setSelectedProductForModal(product)}
                />
              ))}
            </div>
          )}

          {/* Botão Carregar Mais */}
          {hasMore && !search && !categoryFilter && (
            <div className="flex justify-center pt-3">
              <button
                onClick={() => fetchProducts(false)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-black hover:bg-stone-900 text-stone-200 text-xs font-bold border border-stone-800 hover:border-blue-500/50 transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-blue-400" />
                )}
                Carregar mais produtos
              </button>
            </div>
          )}
        </>
      )}

      {/* Modal Completo de Divulgação do Produto */}
      {selectedProductForModal && (
        <ProductDetailModal
          product={selectedProductForModal}
          apiKeys={apiKeys}
          commissionRates={commissionRates}
          sharedMap={sharedMap}
          onToggleShared={onToggleShared}
          onUpdateProductCommission={onUpdateProductCommission}
          onClose={() => setSelectedProductForModal(null)}
          onNavigateToSettings={onNavigateToSettings}
          onAddCustomTemplate={onAddCustomTemplate}
        />
      )}
    </div>
  );
};

// ─── Card Individual do Produto no Marketplace ─────────────────────────────────

interface MarketplaceCardProps {
  product: GlobalProduct;
  currentUserId?: string;
  apiKeys?: ApiKeysConfig;
  commissionRates?: CommissionRatesConfig;
  onOpenDetail: () => void;
}

const MarketplaceCard: React.FC<MarketplaceCardProps> = ({
  product,
  currentUserId,
  apiKeys,
  commissionRates,
  onOpenDetail,
}) => {
  const [imgError, setImgError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [copied, setCopied] = useState(false);

  const hasDiscount = !!(product.price_from && product.price_from !== product.price_to);

  // Comissão Estimada
  const commission = calculateCommission(
    product.price_to,
    product.platform,
    product,
    null,
    null,
    commissionRates
  );

  // Tendência de Vendas (Cresceu/Diminuiu)
  const trend = calculateSalesTrend(product);

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    const link = buildAffiliateLink(product.original_link, product.platform, apiKeys || {});
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={onOpenDetail}
      className="group cursor-pointer flex flex-col bg-[#0e1119] border border-[#1e2636] hover:border-blue-500/60 rounded-2xl overflow-hidden transition-all hover:shadow-xl hover:shadow-blue-500/10 relative"
    >
      {/* Imagem do Produto + Badges Integrados */}
      <div className="relative aspect-square bg-[#07090f] overflow-hidden">
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-[#151a26] text-[#93a0b5]">
            <Tag className="w-10 h-10" />
          </div>
        )}

        {/* Badge da Plataforma (Canto Superior Esquerdo) */}
        <span className={`absolute top-2 left-2 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-md backdrop-blur-md transition-all ${platformColor[product.platform] ?? 'bg-stone-800 text-stone-300'}`}>
          {platformLabel[product.platform] ?? product.platform}
        </span>

        {/* Badge % de Comissão em Destaque Verde/Amarelo no Canto da Imagem */}
        <div className="absolute bottom-2 right-2 z-10">
          <Badge variant="green-yellow">
            <span>+{commission.ratePct}% comissão</span>
          </Badge>
        </div>

        {/* Badge de Tendência de Vendas */}
        {trend.pct !== null && (
          <span
            className={`absolute top-2 right-2 text-[9px] sm:text-[10px] font-extrabold px-2 py-0.5 rounded-full border shadow-md backdrop-blur-md flex items-center gap-0.5 transition-all ${
              trend.isUp
                ? 'bg-emerald-950/90 text-emerald-400 border-emerald-500/40'
                : 'bg-red-950/90 text-red-400 border-red-500/40'
            }`}
          >
            {trend.formatted}
          </span>
        )}
      </div>

      {/* Conteúdo do Card */}
      <div className="flex flex-col flex-1 p-2.5 sm:p-3 gap-2">
        {/* Título do Produto */}
        <h4 className="text-xs font-semibold text-stone-200 leading-snug line-clamp-2 group-hover:text-blue-400 transition-colors">
          {product.title || 'Produto sem título'}
        </h4>

        {/* Bloco de Preço e Desconto */}
        <div className="mt-auto flex flex-col gap-0.5">
          {hasDiscount && (
            <span className="text-[10px] text-stone-500 line-through">
              {formatPrice(product.price_from!)}
            </span>
          )}

          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-extrabold text-white">
              {formatPrice(product.price_to)}
            </span>
            {product.discount_pct != null && product.discount_pct > 0 && (
              <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                -{product.discount_pct}%
              </span>
            )}
          </div>
        </div>

        {/* Bloco de Comissão Estimada e Categoria */}
        <div className="bg-[#151a26]/40 border border-[#1e2636] p-2 rounded-xl flex flex-col gap-1 text-xs">
          <div className="text-emerald-400 font-bold">
            Comissão estimada: {commission.ratePct}% = R$ {commission.amount.toFixed(2).replace('.', ',')}
          </div>
          {product.category ? (
            <div className="text-[10px] text-[#93a0b5] truncate" title={product.category}>
              🏷️ estimativa (categoria: {product.category})
            </div>
          ) : (
            <div className="text-[10px] text-amber-400 font-medium">
              ⚠️ estimativa (categoria ausente - usando padrão)
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-1.5 mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpenDetail();
            }}
            className="w-full py-2 sm:py-2.5 px-3 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/20 flex items-center justify-center gap-1.5 whitespace-nowrap"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span>Divulgar este produto</span>
          </button>
        </div>
      </div>

      {/* Modal Histórico de Preço individual se necessário */}
      {showHistory && (
        <PriceHistoryModal
          product={product}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};
