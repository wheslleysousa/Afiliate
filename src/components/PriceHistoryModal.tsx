import React, { useState, useEffect } from 'react';
import {
  collection,
  query,
  orderBy,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { PriceHistoryEntry, GlobalProduct } from '../types';
import { TrendingDown, TrendingUp, Minus, X, Loader2, Clock } from 'lucide-react';

interface PriceHistoryModalProps {
  product: GlobalProduct;
  onClose: () => void;
}

export const PriceHistoryModal: React.FC<PriceHistoryModalProps> = ({ product, onClose }) => {
  const [history, setHistory] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const snap = await getDocs(
          query(
            collection(db, 'products', product.id, 'priceHistory'),
            orderBy('recordedAt', 'desc'),
            limit(30)
          )
        );
        setHistory(
          snap.docs.map((d) => ({ id: d.id, ...d.data() } as PriceHistoryEntry))
        );
      } catch (e) {
        console.error('Erro ao carregar histórico de preço:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [product.id]);

  // Calcula variação entre o preço mais antigo e o mais recente
  const parseBRL = (str: string) => parseFloat(str.replace(/[R$\s.]/g, '').replace(',', '.')) || 0;

  const priceVariation = (() => {
    if (history.length < 2) return null;
    const latest = parseBRL(history[0].price);
    const oldest = parseBRL(history[history.length - 1].price);
    if (oldest === 0) return null;
    const pct = ((latest - oldest) / oldest) * 100;
    return { pct: Math.round(pct * 10) / 10, latest, oldest };
  })();

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-stone-900 border border-stone-700 rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-stone-800">
          <div className="flex-1 pr-4">
            <p className="text-xs text-stone-400 mb-1">Histórico de Preço</p>
            <p className="text-sm font-semibold text-white line-clamp-2">{product.title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-stone-800 text-stone-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sumário de variação */}
        {priceVariation && (
          <div className={`mx-4 mt-4 p-3 rounded-xl border flex items-center gap-3 ${
            priceVariation.pct < 0
              ? 'bg-emerald-500/10 border-emerald-500/30'
              : priceVariation.pct > 0
              ? 'bg-red-500/10 border-red-500/30'
              : 'bg-stone-800 border-stone-700'
          }`}>
            {priceVariation.pct < 0 ? (
              <TrendingDown className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : priceVariation.pct > 0 ? (
              <TrendingUp className="w-5 h-5 text-red-400 shrink-0" />
            ) : (
              <Minus className="w-5 h-5 text-stone-400 shrink-0" />
            )}
            <div>
              <p className={`text-sm font-bold ${
                priceVariation.pct < 0 ? 'text-emerald-400' : priceVariation.pct > 0 ? 'text-red-400' : 'text-stone-300'
              }`}>
                {priceVariation.pct < 0 ? '▼' : priceVariation.pct > 0 ? '▲' : '='} {Math.abs(priceVariation.pct)}% no período
              </p>
              <p className="text-[11px] text-stone-400">
                De R$ {history[history.length - 1].price} → R$ {history[0].price}
              </p>
            </div>
          </div>
        )}

        {/* Lista de histórico */}
        <div className="p-4 max-h-72 overflow-y-auto flex flex-col gap-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-stone-500">
              <Clock className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">Nenhum histórico disponível ainda.</p>
            </div>
          ) : (
            history.map((entry, idx) => {
              const isLatest = idx === 0;
              return (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between py-2.5 px-3 rounded-xl ${
                    isLatest ? 'bg-stone-800 border border-stone-700' : 'bg-stone-900/50'
                  }`}
                >
                  <div>
                    <p className={`text-sm font-semibold ${isLatest ? 'text-emerald-400' : 'text-stone-300'}`}>
                      R$ {entry.price}
                      {isLatest && (
                        <span className="ml-2 text-[10px] text-emerald-500 font-bold">ATUAL</span>
                      )}
                    </p>
                    {entry.price_from && entry.price_from !== entry.price && (
                      <p className="text-[10px] text-stone-500 line-through">R$ {entry.price_from}</p>
                    )}
                  </div>
                  <p className="text-[10px] text-stone-500">{formatDate(entry.recordedAt)}</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
