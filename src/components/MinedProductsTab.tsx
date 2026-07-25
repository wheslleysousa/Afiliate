import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { MinedProductRef, GlobalProduct } from '../types';
import {
  PackageCheck,
  Star,
  StarOff,
  ExternalLink,
  Loader2,
  Search,
  Archive,
  Tag,
  RefreshCw,
} from 'lucide-react';

interface MinedProductsTabProps {
  uid: string;
  dailyMineCount?: number;
  dailyMineLimit?: number;
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

export const MinedProductsTab: React.FC<MinedProductsTabProps> = ({ uid, dailyMineCount, dailyMineLimit }) => {
  const [items, setItems] = useState<EnrichedMinedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'favorites' | 'archived'>('all');
  const [error, setError] = useState<string | null>(null);

  const loadMinedProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const refs = query(
        collection(db, 'users', uid, 'minedProducts'),
        orderBy('minedAt', 'desc')
      );
      const snap = await getDocs(refs);
      const minedRefs = snap.docs.map((d) => d.data() as MinedProductRef);

      // Enriquecer com dados do marketplace global
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
    } catch (e) {
      console.error('[MinedProducts] Erro ao carregar:', e);
      setError('Não foi possível carregar seus produtos minerados.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMinedProducts();
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

  // Filtrar localmente
  const visible = items.filter((item) => {
    const matchSearch = search.trim()
      ? item.productData?.title.toLowerCase().includes(search.trim().toLowerCase())
      : true;

    const matchFilter =
      filter === 'all'
        ? item.status !== 'archived'
        : filter === 'favorites'
        ? item.favorite && item.status !== 'archived'
        : item.status === 'archived';

    return matchSearch && matchFilter;
  });

  const stats = {
    total: items.filter((i) => i.status !== 'archived').length,
    favorites: items.filter((i) => i.favorite && i.status !== 'archived').length,
    archived: items.filter((i) => i.status === 'archived').length,
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400">
            <PackageCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Meus Produtos Minerados</h2>
            <p className="text-xs text-stone-400">
              {stats.total} ativo{stats.total !== 1 ? 's' : ''} · {stats.favorites} favorito{stats.favorites !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <button
          onClick={loadMinedProducts}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-sm font-medium border border-stone-700 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar
        </button>
      </div>

      {/* Widget de cota diária */}
      {dailyMineCount !== undefined && dailyMineLimit !== undefined && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-xs ${
          dailyMineCount >= dailyMineLimit
            ? 'bg-red-950/40 border-red-500/30 text-red-400'
            : dailyMineCount >= dailyMineLimit * 0.8
            ? 'bg-yellow-950/40 border-yellow-500/30 text-yellow-400'
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
                    ? 'bg-yellow-500'
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

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-500" />
          <input
            type="text"
            placeholder="Buscar nos seus produtos minerados..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-stone-900 border border-stone-700 rounded-xl text-sm text-stone-200 placeholder-stone-500 focus:outline-none focus:border-sky-500 transition-colors"
          />
        </div>

        <div className="flex gap-2">
          {(['all', 'favorites', 'archived'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                filter === f
                  ? 'bg-sky-500/15 text-sky-300 border-sky-500/40'
                  : 'bg-stone-900 text-stone-400 border-stone-700 hover:border-stone-600'
              }`}
            >
              {f === 'all' ? `Todos (${stats.total})` : f === 'favorites' ? `⭐ (${stats.favorites})` : `Arquivados (${stats.archived})`}
            </button>
          ))}
        </div>
      </div>

      {/* Erro */}
      {error && (
        <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <>
          {visible.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-stone-500">
              <PackageCheck className="w-12 h-12 mb-4 opacity-30" />
              <p className="text-sm">
                {filter === 'favorites'
                  ? 'Nenhum produto favoritado.'
                  : filter === 'archived'
                  ? 'Nenhum produto arquivado.'
                  : 'Você ainda não minerou nenhum produto.'}
              </p>
              {filter === 'all' && (
                <p className="text-xs mt-1">Salve produtos no "Novo Produto" para que apareçam aqui.</p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {visible.map((item) => (
                <MinedCard
                  key={item.productId}
                  item={item}
                  onToggleFavorite={() => toggleFavorite(item.productId, item.favorite)}
                  onToggleArchive={() => toggleArchive(item.productId, item.status)}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ─── Card individual ─────────────────────────────────────────────────────────

interface MinedCardProps {
  item: EnrichedMinedProduct;
  onToggleFavorite: () => void;
  onToggleArchive: () => void;
}

const MinedCard: React.FC<MinedCardProps> = ({ item, onToggleFavorite, onToggleArchive }) => {
  const [imgError, setImgError] = useState(false);
  const p = item.productData;
  const isArchived = item.status === 'archived';

  const minedDate = new Date(item.minedAt).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  });

  return (
    <div
      className={`group flex flex-col bg-stone-900 border rounded-2xl overflow-hidden transition-all ${
        isArchived
          ? 'border-stone-800 opacity-60'
          : 'border-stone-800 hover:border-sky-500/40 hover:shadow-lg hover:shadow-sky-500/5'
      }`}
    >
      {/* Imagem */}
      <div className="relative aspect-square bg-stone-800 overflow-hidden">
        {p?.image_url && !imgError ? (
          <img
            src={p.image_url}
            alt={p?.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Tag className="w-10 h-10 text-stone-600" />
          </div>
        )}

        {/* Badge plataforma */}
        <span className={`absolute top-2 left-2 text-[10px] font-bold px-2 py-0.5 rounded-full border ${platformColor[item.platform] ?? 'bg-stone-700 text-stone-300 border-stone-600'}`}>
          {platformLabel[item.platform] ?? item.platform}
        </span>

        {/* Badge arquivado */}
        {isArchived && (
          <div className="absolute inset-0 bg-stone-950/60 flex items-center justify-center">
            <span className="text-xs font-bold text-stone-400 bg-stone-900 px-3 py-1 rounded-full border border-stone-700">
              Arquivado
            </span>
          </div>
        )}
      </div>

      {/* Conteúdo */}
      <div className="flex flex-col flex-1 p-3 gap-2">
        <p className="text-xs text-stone-200 font-medium leading-snug line-clamp-2">
          {p?.title ?? 'Produto indisponível'}
        </p>

        {p && (
          <div className="mt-auto">
            <p className="text-sm font-bold text-emerald-400">R$ {p.price_to}</p>
            {p.installments && (
              <p className="text-[10px] text-stone-400">{p.installments}</p>
            )}
          </div>
        )}

        {/* Meta */}
        <div className="pt-2 border-t border-stone-800 flex items-center justify-between gap-2">
          <span className="text-[10px] text-stone-500">Minerado em {minedDate}</span>

          <div className="flex items-center gap-1">
            {/* Favoritar */}
            <button
              onClick={onToggleFavorite}
              title={item.favorite ? 'Remover favorito' : 'Favoritar'}
              className="p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
            >
              {item.favorite ? (
                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
              ) : (
                <StarOff className="w-3.5 h-3.5 text-stone-500 hover:text-yellow-400" />
              )}
            </button>

            {/* Arquivar / Restaurar */}
            <button
              onClick={onToggleArchive}
              title={isArchived ? 'Restaurar' : 'Arquivar'}
              className="p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
            >
              <Archive className={`w-3.5 h-3.5 ${isArchived ? 'text-sky-400' : 'text-stone-500 hover:text-sky-400'}`} />
            </button>

            {/* Ver produto */}
            {p?.original_link && (
              <a
                href={p.original_link}
                target="_blank"
                rel="noopener noreferrer"
                className="p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
                title="Ver produto"
              >
                <ExternalLink className="w-3.5 h-3.5 text-stone-500 hover:text-sky-400" />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
