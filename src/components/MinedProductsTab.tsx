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
import type { MinedProductRef, GlobalProduct, ApiKeysConfig } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { buildAffiliateLink } from '../utils/affiliateLink';
import { isProductSharedRecently } from '../utils/sharingLogUtils';
import { ProductDetailModal } from './ProductDetailModal';
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
  sharedMap?: Record<string, number>;
  onToggleShared?: (productId: string) => void;
  onUseProduct?: (product: GlobalProduct) => void;
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
  amazon:       'bg-sky-500/20 text-sky-300 border-sky-500/30',
  aliexpress:   'bg-red-500/20 text-red-300 border-red-500/30',
  shein:        'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

export const MinedProductsTab: React.FC<MinedProductsTabProps> = ({
  uid,
  dailyMineCount,
  dailyMineLimit,
  apiKeys,
  sharedMap,
  onToggleShared,
  onUseProduct,
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
      ? item.productData?.title.toLowerCase().includes(search.trim().toLowerCase())
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-stone-900 border border-stone-800 p-5 rounded-2xl shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-extrabold text-white">Meus Produtos Minerados</h2>
            <p className="text-xs text-stone-400">
              Sua lista exclusiva de produtos. Controle a divulgação de 24h, adicione a favoritos e organize suas copies.
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold border border-stone-700 transition-all shrink-0"
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
            : 'bg-stone-900 border-stone-800 text-stone-400'
        }`}>
          <span className="font-medium">
            {dailyMineCount >= dailyMineLimit
              ? '⚠ Limite diário atingido'
              : `Minerados hoje: ${dailyMineCount} / ${dailyMineLimit}`}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 bg-stone-700 rounded-full overflow-hidden">
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
      <div className="flex items-center gap-2 p-1.5 bg-stone-950 border border-stone-800 rounded-2xl overflow-x-auto scrollbar-none">
        <button
          onClick={() => setFilter('ready_24h')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'ready_24h'
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
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
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Clock className="w-3.5 h-3.5 text-amber-300" />
          <span>Divulgados nas Últimas 24h ({sharedCount})</span>
        </button>

        <button
          onClick={() => setFilter('all')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'all'
              ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
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
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
          <span>Favoritos ({favoritesCount})</span>
        </button>

        <button
          onClick={() => setFilter('archived')}
          className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            filter === 'archived'
              ? 'bg-stone-800 text-white border border-stone-700'
              : 'text-stone-400 hover:text-stone-200 hover:bg-stone-900'
          }`}
        >
          <Archive className="w-3.5 h-3.5" />
          <span>Arquivados ({archivedCount})</span>
        </button>
      </div>

      {/* Controles de Busca e Plataforma */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder="Buscar por título em Meus Produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs sm:text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="w-full sm:w-52 px-3 py-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs sm:text-sm text-stone-200 font-semibold focus:outline-none focus:border-sky-500"
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
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
              {visible.map((item) => (
                <MinedCard
                  key={item.productId}
                  item={item}
                  apiKeys={apiKeys}
                  sharedMap={sharedMap}
                  onToggleShared={onToggleShared}
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

      {/* Modal de Detalhes & Gerador de Copy / Roteiro */}
      {selectedProductForModal && (
        <ProductDetailModal
          product={selectedProductForModal}
          apiKeys={apiKeys || {}}
          sharedMap={sharedMap}
          onToggleShared={onToggleShared}
          onClose={() => setSelectedProductForModal(null)}
        />
      )}
    </div>
  );
};

// ─── Card Individual do Produto no Meus Produtos ─────────────────────────────

interface MinedCardProps {
  item: EnrichedMinedProduct;
  apiKeys?: ApiKeysConfig;
  sharedMap?: Record<string, number>;
  onToggleShared?: (productId: string) => void;
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
  sharedMap,
  onToggleShared,
  onOpenDetail,
  onUseProduct,
  onToggleFavorite,
  onToggleArchive,
  onDelete,
  isDeleting,
}) => {
  const [imgError, setImgError] = useState(false);
  const [copied, setCopied] = useState(false);
  const p = item.productData;
  const isArchived = item.status === 'archived';

  if (!p) {
    return (
      <div className="flex flex-col bg-stone-900/50 border border-stone-800 rounded-2xl overflow-hidden opacity-50 p-3 gap-2">
        <div className="aspect-square bg-stone-800 flex items-center justify-center rounded-xl">
          <AlertCircle className="w-10 h-10 text-stone-600" />
        </div>
        <p className="text-xs text-stone-500 font-medium">Produto indisponível</p>
        <div className="flex items-center gap-2 mt-auto">
          <button onClick={onToggleArchive} className="text-[10px] text-sky-400 hover:underline">
            {isArchived ? 'Restaurar' : 'Arquivar'}
          </button>
          <button onClick={onDelete} disabled={isDeleting} className="text-[10px] text-red-400 hover:underline">
            Excluir
          </button>
        </div>
      </div>
    );
  }

  const affiliateUrl = buildAffiliateLink(p.original_link, item.platform, apiKeys || {});
  const sharedStatus = isProductSharedRecently(item.productId, sharedMap);

  const handleQuickToggleShared = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggleShared) {
      onToggleShared(item.productId);
    }
  };

  const handleCopyLink = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(affiliateUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      onClick={() => onOpenDetail && onOpenDetail(p)}
      className={`group cursor-pointer flex flex-col bg-stone-900 border rounded-2xl overflow-hidden transition-all hover:shadow-xl relative ${
        sharedStatus.isShared
          ? 'border-emerald-500/50 bg-emerald-950/10'
          : isArchived
          ? 'border-stone-800 opacity-60'
          : 'border-stone-800 hover:border-sky-500/40 hover:shadow-sky-500/5'
      }`}
    >
      {/* Imagem do Produto + Badges Integrados */}
      <div className="relative aspect-square bg-stone-950 overflow-hidden">
        {p.image_url && !imgError ? (
          <img
            src={p.image_url}
            alt={p.title}
            onError={() => setImgError(true)}
            className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
              sharedStatus.isShared ? 'opacity-85 grayscale-[15%]' : ''
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-stone-900 text-stone-700">
            <Tag className="w-10 h-10" />
          </div>
        )}

        {/* Ribbon de Produto Divulgado (24h) */}
        {sharedStatus.isShared && (
          <div className="absolute inset-x-0 top-0 bg-emerald-600/95 text-white text-[10px] font-extrabold px-2 py-1 flex items-center justify-between backdrop-blur-md z-10">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-white" />
              Divulgado ({sharedStatus.hoursAgoFormatted})
            </span>
            <span className="text-[9px] opacity-90 font-mono">
              Libera {sharedStatus.remainingFormatted}
            </span>
          </div>
        )}

        {/* Badge da Plataforma */}
        <span className={`absolute ${sharedStatus.isShared ? 'top-7' : 'top-2'} left-2 text-[9px] sm:text-[10px] font-bold px-2 py-0.5 rounded-full border shadow-md backdrop-blur-md transition-all ${platformColor[item.platform] ?? 'bg-stone-800 text-stone-300'}`}>
          {platformLabel[item.platform] ?? item.platform}
        </span>

        {/* Action icons no topo superior direito (Favoritar, Arquivar, Excluir) */}
        <div className={`absolute ${sharedStatus.isShared ? 'top-7' : 'top-2'} right-2 flex items-center gap-1 bg-stone-950/80 p-1 rounded-full backdrop-blur-md border border-stone-800 z-10`}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleFavorite();
            }}
            title={item.favorite ? 'Remover favorito' : 'Favoritar'}
            className="p-1 hover:bg-stone-800 rounded-full transition-colors"
          >
            {item.favorite ? (
              <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
            ) : (
              <StarOff className="w-3.5 h-3.5 text-stone-400 hover:text-amber-400" />
            )}
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleArchive();
            }}
            title={isArchived ? 'Restaurar' : 'Arquivar'}
            className="p-1 hover:bg-stone-800 rounded-full transition-colors"
          >
            <Archive className={`w-3.5 h-3.5 ${isArchived ? 'text-sky-400' : 'text-stone-400 hover:text-sky-400'}`} />
          </button>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            disabled={isDeleting}
            title="Excluir produto"
            className="p-1 hover:bg-red-500/20 text-stone-400 hover:text-red-400 rounded-full transition-colors disabled:opacity-50"
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
        <h4 className="text-xs font-semibold text-stone-200 leading-snug line-clamp-2 group-hover:text-sky-300 transition-colors">
          {p.title}
        </h4>

        {/* Bloco de Preço */}
        <div className="mt-auto flex flex-col gap-0.5">
          {p.price_from && p.price_from !== p.price_to && (
            <span className="text-[10px] text-stone-500 line-through">
              {formatPrice(p.price_from)}
            </span>
          )}

          <div className="flex items-baseline gap-1.5 flex-wrap">
            <span className="text-sm sm:text-base font-extrabold text-white">
              {formatPrice(p.price_to)}
            </span>
            {p.discount_pct && (
              <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
                -{p.discount_pct}%
              </span>
            )}
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center gap-1.5 mt-1">
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (onOpenDetail) onOpenDetail(p);
            }}
            className="flex-1 py-2 sm:py-2.5 px-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-600/20 flex items-center justify-center gap-1.5 truncate"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Divulgar</span>
          </button>

          {/* Toggle status de 24h */}
          <button
            onClick={handleQuickToggleShared}
            title={sharedStatus.isShared ? 'Desmarcar divulgação (Liberar produto)' : 'Marcar como divulgado por 24h'}
            className={`p-2 sm:py-2.5 rounded-xl border text-xs font-bold transition-all shrink-0 flex items-center justify-center ${
              sharedStatus.isShared
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                : 'bg-stone-800 text-stone-400 border-stone-700 hover:text-white hover:bg-stone-700'
            }`}
          >
            {sharedStatus.isShared ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Check className="w-4 h-4 opacity-50 hover:opacity-100" />
            )}
          </button>

          {/* Copiar Link de Afiliado */}
          <button
            onClick={handleCopyLink}
            title={copied ? "Link Copiado!" : "Copiar Link de Afiliado"}
            className="p-2 sm:py-2.5 rounded-xl bg-stone-800 text-stone-300 border border-stone-700 hover:text-white hover:bg-stone-700 transition-all shrink-0"
          >
            {copied ? (
              <Check className="w-4 h-4 text-emerald-400" />
            ) : (
              <Copy className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
