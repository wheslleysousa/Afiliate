import React, { useState, useEffect } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { GlobalProduct } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { db } from '../lib/firebase';
import { collection, query, orderBy, getDocs } from 'firebase/firestore';
import {
  DollarSign,
  AlertCircle,
  Tag,
  Star,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';

interface ProductChartsProps {
  product: GlobalProduct;
}

interface PricePoint {
  label: string;
  preco: number;
  formatado: string;
  recordedAt: string;
}

export const ProductCharts: React.FC<ProductChartsProps> = ({ product }) => {
  const [historyPoints, setHistoryPoints] = useState<PricePoint[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(true);

  // Preço atual real do produto
  const currentPriceNum = React.useMemo(() => {
    if (!product.price_to) return null;
    const raw = String(product.price_to).replace(/\./g, '').replace(',', '.');
    const num = parseFloat(raw);
    return isNaN(num) || num <= 0 ? null : num;
  }, [product.price_to]);

  // Preço "De" real do produto
  const originalPriceNum = React.useMemo(() => {
    if (!product.price_from) return null;
    const raw = String(product.price_from).replace(/\./g, '').replace(',', '.');
    const num = parseFloat(raw);
    return isNaN(num) || num <= 0 ? null : num;
  }, [product.price_from]);

  // Buscar histórico REAL registrado no Firestore
  useEffect(() => {
    let isMounted = true;
    const loadRealHistory = async () => {
      if (!product.id) {
        setLoadingHistory(false);
        return;
      }

      setLoadingHistory(true);
      try {
        const historyRef = collection(db, 'products', product.id, 'priceHistory');
        const q = query(historyRef, orderBy('recordedAt', 'asc'));
        const snap = await getDocs(q);

        if (!isMounted) return;

        const points: PricePoint[] = [];
        snap.forEach((doc) => {
          const d = doc.data();
          const pRaw = d.price ? String(d.price).replace(/\./g, '').replace(',', '.') : '';
          const pNum = parseFloat(pRaw);
          if (!isNaN(pNum) && pNum > 0) {
            const dateObj = d.recordedAt ? new Date(d.recordedAt) : new Date();
            const label = isNaN(dateObj.getTime())
              ? 'Data'
              : dateObj.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
            points.push({
              label,
              preco: pNum,
              formatado: formatPrice(pNum),
              recordedAt: d.recordedAt || '',
            });
          }
        });

        // Se houver preço atual e o histórico for vazio ou tiver apenas 1 ponto antigo diferente, podemos conferir
        setHistoryPoints(points);
      } catch (err) {
        console.error('[ProductCharts] Erro ao carregar histórico real:', err);
      } finally {
        if (isMounted) {
          setLoadingHistory(false);
        }
      }
    };

    loadRealHistory();
    return () => {
      isMounted = false;
    };
  }, [product.id, product.price_to]);

  // Verificar se há métricas reais suficientes para gerar a curva
  const hasSufficientData = historyPoints.length >= 2;

  const minPrice = React.useMemo(() => {
    if (!historyPoints.length) return currentPriceNum || 0;
    return Math.min(...historyPoints.map((p) => p.preco));
  }, [historyPoints, currentPriceNum]);

  const maxPrice = React.useMemo(() => {
    if (!historyPoints.length) return currentPriceNum || 0;
    return Math.max(...historyPoints.map((p) => p.preco));
  }, [historyPoints, currentPriceNum]);

  return (
    <div className="space-y-4">
      {/* ─── PAINEL DE MÉTRICAS REAIS DO PRODUTO ─── */}
      <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 sm:p-5 space-y-4 shadow-md">
        <div className="flex items-center justify-between gap-2 border-b border-[#1e2636] pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <DollarSign className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-extrabold text-white">Métricas Reais do Produto</h4>
              <p className="text-[11px] text-[#93a0b5]">Valores e dados extraídos diretamente da plataforma</p>
            </div>
          </div>

          {product.platform && (
            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-[#0e1119] text-[#93a0b5] border border-[#1e2636] capitalize">
              {product.platform}
            </span>
          )}
        </div>

        {/* Grade de Informações Reais */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Preço Atual */}
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] text-[#93a0b5] font-semibold flex items-center gap-1">
              <Tag className="w-3 h-3 text-emerald-400" /> Preço Atual
            </span>
            <span className="text-sm sm:text-base font-black text-emerald-400 mt-1 truncate">
              {product.price_to ? `R$ ${product.price_to}` : 'Sob consulta'}
            </span>
          </div>

          {/* Preço Anterior */}
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] text-[#93a0b5] font-semibold">Preço Original</span>
            <span className="text-xs sm:text-sm font-bold text-stone-400 line-through mt-1 truncate">
              {product.price_from ? `R$ ${product.price_from}` : '—'}
            </span>
          </div>

          {/* Quantidade Real de Vendas */}
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] text-[#93a0b5] font-semibold flex items-center gap-1">
              <ShoppingBag className="w-3 h-3 text-blue-400" /> Vendas
            </span>
            <span className="text-xs sm:text-sm font-black text-white mt-1 truncate">
              {product.sales_count
                ? product.sales_count.includes('vend')
                  ? product.sales_count
                  : `${product.sales_count} vendidos`
                : 'Não informado'}
            </span>
          </div>

          {/* Avaliações */}
          <div className="bg-[#0e1119] border border-[#1e2636] rounded-xl p-3 flex flex-col justify-between">
            <span className="text-[10px] text-[#93a0b5] font-semibold flex items-center gap-1">
              <Star className="w-3 h-3 text-amber-400 fill-amber-400" /> Avaliação
            </span>
            <div className="flex items-center gap-1 mt-1 truncate">
              <span className="text-xs sm:text-sm font-black text-amber-300">
                {product.stars ? `${product.stars} ★` : '—'}
              </span>
              {product.ratings_count && (
                <span className="text-[10px] text-[#93a0b5] truncate">({product.ratings_count})</span>
              )}
            </div>
          </div>
        </div>

        {/* ─── HISTÓRICO DE PREÇOS (SE HOUVER DADOS REAIS SUFICIENTES) ─── */}
        {loadingHistory ? (
          <div className="py-8 text-center text-xs text-[#93a0b5] animate-pulse">
            Consultando registros históricos no banco de dados...
          </div>
        ) : hasSufficientData ? (
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h5 className="text-xs font-bold text-white flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> Curva Histórica de Alteração de Preços
              </h5>
              <span className="text-[10px] text-[#93a0b5]">
                {historyPoints.length} registros capturados
              </span>
            </div>

            {/* Mínimo e Máximo Real */}
            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-[#0e1119] border border-[#1e2636] rounded-xl p-2">
                <span className="text-[10px] text-[#93a0b5] block">Menor Preço Registrado</span>
                <span className="font-extrabold text-emerald-400 text-xs">{formatPrice(minPrice)}</span>
              </div>
              <div className="bg-[#0e1119] border border-[#1e2636] rounded-xl p-2">
                <span className="text-[10px] text-[#93a0b5] block">Maior Preço Registrado</span>
                <span className="font-extrabold text-stone-300 text-xs">{formatPrice(maxPrice)}</span>
              </div>
            </div>

            <div className="h-44 sm:h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={historyPoints} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                  <defs>
                    <linearGradient id="realPriceGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fill: '#93a0b5', fontSize: 10 }}
                    axisLine={{ stroke: '#1e2636' }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={['auto', 'auto']}
                    tick={{ fill: '#93a0b5', fontSize: 10 }}
                    axisLine={{ stroke: '#1e2636' }}
                    tickLine={false}
                    tickFormatter={(val: any) => `R$${Math.round(val)}`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0e1119',
                      borderColor: '#1e2636',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '11px',
                      boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)',
                    }}
                    itemStyle={{ color: '#34d399', fontWeight: 'bold' }}
                    labelStyle={{ color: '#93a0b5', marginBottom: '2px' }}
                    formatter={(val: any) => [`R$ ${Number(val).toFixed(2).replace('.', ',')}`, 'Preço']}
                  />
                  <Area
                    type="monotone"
                    dataKey="preco"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#realPriceGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="bg-[#0e1119] border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-2.5 text-left">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-amber-300 block">
                Gráfico indisponível: informações históricas insuficientes
              </span>
              <p className="text-[11px] text-[#93a0b5] leading-relaxed">
                Este produto ainda não possui múltiplos pontos históricos de variação de preço registrados. As métricas exibidas acima representam os dados reais capturados na plataforma no momento da extração.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
