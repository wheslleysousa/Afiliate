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
import type { GlobalProduct } from '../types';
import { PriceHistoryModal } from './PriceHistoryModal';
import {
  Globe,
  Search,
  RefreshCw,
  ExternalLink,
  Users,
  TrendingDown,
  Loader2,
  ChevronDown,
  Tag,
} from 'lucide-react';

const PLATFORMS = ['mercadolivre', 'shopee', 'amazon', 'aliexpress', 'shein'] as const;
const PAGE_SIZE = 24;

const platformLabel: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  shein: 'Shein',
};

const platformColor: Record<string, string> = {
  mercadolivre:  'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  shopee:        'bg-orange-500/20 text-orange-300 border-orange-500/30',
  amazon:        'bg-sky-500/20 text-sky-300 border-sky-500/30',
  aliexpress:    'bg-red-500/20 text-red-300 border-red-500/30',
  shein:         'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

interface MarketplaceTabProps {
  currentUserId?: string;
}

export const MarketplaceTab: React.FC<MarketplaceTabProps> = ({ currentUserId }) => {
  const [products, setProducts] = useState<GlobalProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<DocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

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

      setProducts((prev) => reset ? docs : [...prev, ...docs]);
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

  // Filtro de busca local (por título)
  const visible = search.trim()
    ? products.filter((p) =>
        p.title.toLowerCase().includes(search.trim().toLowerCase())
      )
    : products;

  const formatPrice = (price: string) => {
    if (price.startsWith('R$')) return price;
    return `R$ ${price}`;
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Marketplace Global</h2>
            <p className="text-xs text-stone-400">{products.length} produto{products.length !== 1 ? 's' : ''} carregado{products.length !== 1 ? 's' : ''}</p>
          </div>
        </div>
        <button
          onClick={() => fetchProducts(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium border border-stone-700 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Busca por título */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder="Buscar produto no marketplace..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-900 border border-stone-700 rounded-xl text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        {/* Filtro de plataforma */}
        <div className="relative">
          <select
            value={platformFilter}
            onChange={(e) => setPlatformFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2.5 bg-stone-900 border border-stone-700 rounded-xl text-sm text-stone-200 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer"
          >
            <option value="">Todas as plataformas</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {platformLabel[p]}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500 pointer-events-none" />
        </div>
      </div>

      {/* Estado de erro */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading inicial */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      )}

      {/* Grade de produtos */}
      {!loading && (
        <>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-500">
              <Globe className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">Nenhum produto encontrado no marketplace.</p>
              <p className="text-xs mt-1">Salve produtos para que apareçam aqui.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visible.map((product) => (
                <MarketplaceCard key={product.id} product={product} currentUserId={currentUserId} />
              ))}
            </div>
          )}

          {/* Carregar mais */}
          {hasMore && !search && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => fetchProducts(false)}
                disabled={loadingMore}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium border border-stone-700 transition-all disabled:opacity-50"
              >
                {loadingMore ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
                Carregar mais
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Card do produto no marketplace ─────────────────────────────────────────

interface MarketplaceCardProps {
  product: GlobalProduct;
  currentUserId?: string;
}

const MarketplaceCard: React.FC<MarketplaceCardProps> = ({ product, currentUserId }) => {
  const [imgError, setImgError] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const isMiner = currentUserId ? product.miners.includes(currentUserId) : false;

  const hasDiscount = product.price_from && product.price_from !== product.price_to;

  return (
    <div className="group flex flex-col bg-stone-900 border border-stone-800 rounded-2xl overflow-hidden hover:border-violet-500/40 transition-all hover:shadow-lg hover:shadow-violet-500/5">
      {/* Imagem */}
      <div className="relative aspect-square bg-stone-800 overflow-hidden">
        {product.image_url && !imgError ? (
          <img
            src={product.image_url}
            alt={product.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-10 h-10 text-stone-600" />
          </div>
        )}

        {/* Badge de plataforma */}
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformColor[product.platform] ?? 'bg-stone-700 text-stone-300 border-stone-600'}`}>
          {platformLabel[product.platform] ?? product.platform}
        </span>

        {/* Badge "minerado por mim" */}
        {isMiner && (
          <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            ✓ Meu
          </span>
        )}
      </div>

      {/* Informações */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-xs text-stone-200 font-medium leading-snug line-clamp-2">
          {product.title}
        </p>

        {/* Preços */}
        <div className="mt-auto">
          {hasDiscount && (
            <p className="text-[10px] text-stone-500 line-through">
              R$ {product.price_from}
            </p>
          )}
          <p className="text-sm font-bold text-emerald-400">
            R$ {product.price_to}
          </p>
          {product.installments && (
            <p className="text-[10px] text-stone-400">{product.installments}</p>
          )}
        </div>

        {/* Meta: mineradores + botão */}
        <div className="flex items-center justify-between pt-2 border-t border-stone-800">
          <div className="flex items-center gap-1 text-stone-500">
            <Users className="w-3 h-3" />
            <span className="text-[10px]">{product.mineCount} miner{product.mineCount !== 1 ? 's' : ''}</span>
          </div>
          <a
            href={product.original_link}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-semibold text-violet-400 hover:text-violet-300 transition-colors"
          >
            Ver produto
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Botão para abrir histórico de preço */}
      <div className="px-3 pb-3">
        <button
          onClick={() => setShowHistory(true)}
          className="w-full py-1.5 rounded-xl text-[11px] font-semibold text-stone-400 hover:text-violet-300 hover:bg-violet-500/10 border border-stone-800 hover:border-violet-500/30 transition-all flex items-center justify-center gap-1"
        >
          <TrendingDown className="w-3 h-3" />
          Ver histórico de preço
        </button>
      </div>

      {/* Modal */}
      {showHistory && (
        <PriceHistoryModal
          product={product}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};
