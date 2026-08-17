import React, { useState, useEffect, useCallback } from 'react';
import {
  BarChart3, MousePointerClick, ShoppingCart, DollarSign, Percent,
  RefreshCw, AlertTriangle, TrendingUp, Wallet,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell,
} from 'recharts';
import { ApiKeysConfig } from '../types';
import { apiFetch } from '../utils/apiBase';

interface PlatformMetrics {
  connected: boolean;
  account: string | null;
  clicks: number;
  orders: number;
  revenue: number;
  commission: number;
  conversionRate: number;
  lastSync: string;
  source: string;
}

interface MetricsResponse {
  success: boolean;
  extractedAt: string;
  platforms: {
    shopee: PlatformMetrics;
    mercadolivre: PlatformMetrics;
    tiktokshop: PlatformMetrics;
    amazon: PlatformMetrics;
  };
  totalExtracted: {
    clicks: number;
    orders: number;
    revenue: number;
    commission: number;
  };
}

interface DashboardTabProps {
  apiKeys: ApiKeysConfig;
  onNavigateToSettings?: () => void;
}

const PLATFORM_META: Record<string, { label: string; color: string; emoji: string }> = {
  shopee: { label: 'Shopee', color: '#ee4d2d', emoji: '🛍️' },
  mercadolivre: { label: 'Mercado Livre', color: '#ffe600', emoji: '🟡' },
  tiktokshop: { label: 'TikTok Shop', color: '#25f4ee', emoji: '🎵' },
  amazon: { label: 'Amazon', color: '#ff9900', emoji: '📦' },
};

const fmtMoney = (v: number) =>
  `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (v: number) => (Number(v) || 0).toLocaleString('pt-BR');

export const DashboardTab: React.FC<DashboardTabProps> = ({ apiKeys, onNavigateToSettings }) => {
  const [data, setData] = useState<MetricsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shopeeConfigured = !!(apiKeys?.shopeeAppId && apiKeys?.shopeeSecret);

  const loadMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/integrations/extract-metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha ao buscar métricas (HTTP ${res.status}). ${txt.slice(0, 160)}`);
      }
      const json = (await res.json()) as MetricsResponse;
      setData(json);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível carregar as métricas agora.');
    } finally {
      setLoading(false);
    }
  }, [apiKeys]);

  useEffect(() => {
    loadMetrics();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shopee = data?.platforms?.shopee;
  const others = data
    ? (['mercadolivre', 'tiktokshop', 'amazon'] as const).map((k) => ({ key: k, m: data.platforms[k] }))
    : [];

  const chartData = data
    ? (['shopee', 'mercadolivre', 'tiktokshop', 'amazon'] as const).map((k) => ({
        name: PLATFORM_META[k].label,
        comissao: Number(data.platforms[k]?.commission || 0),
        color: PLATFORM_META[k].color,
      }))
    : [];

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" /> Dashboard de Afiliado
          </h1>
          <p className="text-xs sm:text-sm text-[#93a0b5] mt-0.5">
            Métricas reais das suas contas de afiliado (Shopee, Mercado Livre, TikTok Shop e Amazon).
          </p>
        </div>
        <button
          onClick={loadMetrics}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-xs font-semibold flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {!shopeeConfigured && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl text-xs flex items-start justify-between gap-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
            <span>
              Configure seu <b>App ID</b> e <b>Secret</b> da API de Afiliados da Shopee em Configurações para ver
              as métricas de cliques, pedidos e comissão da Shopee.
            </span>
          </div>
          {onNavigateToSettings && (
            <button
              onClick={onNavigateToSettings}
              className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-100 font-semibold rounded-lg px-3 py-1.5"
            >
              Configurar
            </button>
          )}
        </div>
      )}

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <TotalCard icon={<MousePointerClick className="w-4 h-4" />} label="Cliques" value={fmtInt(data?.totalExtracted?.clicks || 0)} accent="text-blue-400" loading={loading} />
        <TotalCard icon={<ShoppingCart className="w-4 h-4" />} label="Pedidos" value={fmtInt(data?.totalExtracted?.orders || 0)} accent="text-emerald-400" loading={loading} />
        <TotalCard icon={<DollarSign className="w-4 h-4" />} label="Vendas (R$)" value={fmtMoney(data?.totalExtracted?.revenue || 0)} accent="text-white" loading={loading} />
        <TotalCard icon={<Wallet className="w-4 h-4" />} label="Comissão (R$)" value={fmtMoney(data?.totalExtracted?.commission || 0)} accent="text-emerald-400" loading={loading} />
      </div>

      {/* Destaque Shopee */}
      <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
            <span>🛍️</span> Shopee Afiliados
            {shopee?.connected ? (
              <span className="text-[10px] font-bold uppercase bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 rounded-full px-2 py-0.5">Conectado</span>
            ) : (
              <span className="text-[10px] font-bold uppercase bg-[#1e2636] text-[#93a0b5] border border-[#1e2636] rounded-full px-2 py-0.5">Sem dados</span>
            )}
          </h2>
          <span className="text-[10px] text-[#64708a]">{shopee?.lastSync || ''}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <MiniStat label="Cliques" value={fmtInt(shopee?.clicks || 0)} icon={<MousePointerClick className="w-3.5 h-3.5" />} />
          <MiniStat label="Pedidos" value={fmtInt(shopee?.orders || 0)} icon={<ShoppingCart className="w-3.5 h-3.5" />} />
          <MiniStat label="Vendas" value={fmtMoney(shopee?.revenue || 0)} icon={<DollarSign className="w-3.5 h-3.5" />} />
          <MiniStat label="Comissão" value={fmtMoney(shopee?.commission || 0)} icon={<Wallet className="w-3.5 h-3.5" />} highlight />
          <MiniStat label="Conversão" value={`${shopee?.conversionRate || 0}%`} icon={<Percent className="w-3.5 h-3.5" />} />
        </div>
      </div>

      {/* Gráfico de comissão por plataforma */}
      <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Comissão por plataforma
        </h2>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e2636" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#93a0b5', fontSize: 11 }} axisLine={{ stroke: '#1e2636' }} tickLine={false} />
              <YAxis tick={{ fill: '#93a0b5', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                contentStyle={{ background: '#0e1119', border: '1px solid #1e2636', borderRadius: 12, color: '#eef2f9', fontSize: 12 }}
                formatter={(v: any) => [fmtMoney(Number(v)), 'Comissão']}
              />
              <Bar dataKey="comissao" radius={[6, 6, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Outras plataformas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {others.map(({ key, m }) => (
          <div key={key} className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 shadow-lg shadow-black/20">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{PLATFORM_META[key].emoji}</span> {PLATFORM_META[key].label}
              </h3>
              {m?.connected ? (
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
              ) : (
                <span className="w-2 h-2 rounded-full" style={{ background: '#39435a' }} />
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <MiniStat label="Pedidos" value={fmtInt(m?.orders || 0)} icon={<ShoppingCart className="w-3.5 h-3.5" />} compact />
              <MiniStat label="Comissão" value={fmtMoney(m?.commission || 0)} icon={<Wallet className="w-3.5 h-3.5" />} compact highlight />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-[#64708a] text-center">
        Os dados vêm das APIs oficiais de afiliado de cada plataforma. A Shopee exige App ID + Secret configurados.
        {data?.extractedAt ? ` Última extração: ${data.extractedAt}.` : ''}
      </p>
    </div>
  );
};

const TotalCard: React.FC<{ icon: React.ReactNode; label: string; value: string; accent: string; loading?: boolean }> = ({ icon, label, value, accent, loading }) => (
  <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 shadow-lg shadow-black/20">
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#93a0b5]">
      <span className={accent}>{icon}</span> {label}
    </div>
    <div className={`mt-2 text-xl font-extrabold ${accent} ${loading ? 'opacity-40 animate-pulse' : ''}`}>{value}</div>
  </div>
);

const MiniStat: React.FC<{ label: string; value: string; icon: React.ReactNode; highlight?: boolean; compact?: boolean }> = ({ label, value, icon, highlight, compact }) => (
  <div className={`bg-[#0e1119] border border-[#1e2636] rounded-xl ${compact ? 'p-2.5' : 'p-3'}`}>
    <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[#93a0b5]">
      <span className="text-[#64708a]">{icon}</span> {label}
    </div>
    <div className={`mt-1 font-extrabold ${compact ? 'text-sm' : 'text-base'} ${highlight ? 'text-emerald-400' : 'text-white'}`}>{value}</div>
  </div>
);
