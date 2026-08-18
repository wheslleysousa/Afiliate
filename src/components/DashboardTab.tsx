import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  BarChart3, ShoppingCart, DollarSign, Wallet, Receipt,
  RefreshCw, AlertTriangle, TrendingUp, Package, CalendarDays, MousePointerClick,
} from 'lucide-react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
} from 'recharts';
import { ApiKeysConfig } from '../types';
import { apiFetch } from '../utils/apiBase';

interface ShopeeReport {
  connected: boolean;
  reason?: string;
  error?: string;
  totals: { orders: number; sales: number; commission: number; avgTicket: number };
  byDay: { date: string; commission: number; orders: number }[];
  topProducts: { name: string; count: number }[];
  recent: { purchaseTime: number | null; commission: number; item: string }[];
  extractedAt?: string;
}

interface DashboardTabProps {
  apiKeys: ApiKeysConfig;
  onNavigateToSettings?: () => void;
}

type RangeKey = 'today' | 'yesterday' | '7d' | '15d' | '30d' | '60d' | '90d' | 'all' | 'custom';

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: 'today', label: 'Hoje' },
  { key: 'yesterday', label: 'Ontem' },
  { key: '7d', label: '7 dias' },
  { key: '15d', label: '15 dias' },
  { key: '30d', label: '30 dias' },
  { key: '60d', label: '60 dias' },
  { key: '90d', label: '90 dias' },
  { key: 'all', label: 'Tudo' },
  { key: 'custom', label: 'Personalizado' },
];

const fmtMoney = (v: number) =>
  `R$ ${(Number(v) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtInt = (v: number) => (Number(v) || 0).toLocaleString('pt-BR');
const fmtDay = (iso: string) => {
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}` : iso;
};
const secs = (d: Date) => Math.floor(d.getTime() / 1000);
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };

function computeRange(key: RangeKey, customStart?: string, customEnd?: string): { startTime: number | null; endTime: number | null } {
  const now = new Date();
  if (key === 'all') return { startTime: null, endTime: null };
  if (key === 'today') return { startTime: secs(startOfDay(now)), endTime: secs(now) };
  if (key === 'yesterday') {
    const y = new Date(now); y.setDate(y.getDate() - 1);
    return { startTime: secs(startOfDay(y)), endTime: secs(endOfDay(y)) };
  }
  if (key === 'custom') {
    if (!customStart || !customEnd) return { startTime: null, endTime: null };
    return { startTime: secs(startOfDay(new Date(customStart))), endTime: secs(endOfDay(new Date(customEnd))) };
  }
  const days = parseInt(key, 10); // '7d' -> 7
  const start = new Date(now); start.setDate(start.getDate() - days);
  return { startTime: secs(startOfDay(start)), endTime: secs(now) };
}

export const DashboardTab: React.FC<DashboardTabProps> = ({ apiKeys, onNavigateToSettings }) => {
  const [data, setData] = useState<ShopeeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('30d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const shopeeConfigured = !!(apiKeys?.shopeeAppId && apiKeys?.shopeeSecret);
  const [clicksTotal, setClicksTotal] = useState(0);

  useEffect(() => {
    let alive = true;
    apiFetch('/api/analytics/clicks')
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        const map = j?.clicksMap || {};
        let sum = 0;
        Object.values(map).forEach((v: any) => { sum += (v?.clicks || 0); });
        setClicksTotal(sum);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  const load = useCallback(async (r: RangeKey, cs?: string, ce?: string) => {
    setLoading(true);
    setError(null);
    try {
      const { startTime, endTime } = computeRange(r, cs, ce);
      const res = await apiFetch('/api/shopee/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKeys, startTime, endTime }),
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        throw new Error(`Falha ao buscar o relatório (HTTP ${res.status}). ${txt.slice(0, 140)}`);
      }
      setData((await res.json()) as ShopeeReport);
    } catch (e: any) {
      setError(e?.message || 'Não foi possível carregar o relatório da Shopee agora.');
    } finally {
      setLoading(false);
    }
  }, [apiKeys]);

  useEffect(() => {
    if (range !== 'custom') load(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const t = data?.totals;
  const canApplyCustom = range === 'custom' && !!customStart && !!customEnd;

  const rangeLabel = useMemo(() => RANGE_OPTIONS.find((o) => o.key === range)?.label || '', [range]);

  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg sm:text-xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-blue-400" /> Dashboard <span className="text-[#ee4d2d]">Shopee</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#93a0b5] mt-0.5">
            Suas métricas reais de afiliado da Shopee — período: <span className="text-[#eef2f9] font-semibold">{rangeLabel}</span>.
          </p>
        </div>
        <button
          onClick={() => load(range, customStart, customEnd)}
          disabled={loading}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Atualizando...' : 'Atualizar'}
        </button>
      </div>

      {/* Filtro de período */}
      <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-3 sm:p-4 shadow-lg shadow-black/20">
        <div className="flex items-center gap-2 mb-2 text-[11px] font-bold uppercase tracking-wide text-[#93a0b5]">
          <CalendarDays className="w-3.5 h-3.5" /> Período
        </div>
        <div className="flex flex-wrap gap-2">
          {RANGE_OPTIONS.map((o) => (
            <button
              key={o.key}
              onClick={() => setRange(o.key)}
              className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                range === o.key
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500/40'
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        {range === 'custom' && (
          <div className="flex flex-wrap items-end gap-3 mt-3">
            <label className="flex flex-col gap-1 text-[11px] font-bold text-[#93a0b5]">
              De
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)}
                className="bg-[#0e1119] border border-[#1e2636] rounded-lg text-[#eef2f9] text-xs px-3 py-2 outline-none focus:border-blue-500" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-bold text-[#93a0b5]">
              Até
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)}
                className="bg-[#0e1119] border border-[#1e2636] rounded-lg text-[#eef2f9] text-xs px-3 py-2 outline-none focus:border-blue-500" />
            </label>
            <button
              onClick={() => load('custom', customStart, customEnd)}
              disabled={!canApplyCustom || loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg px-4 py-2 text-xs"
            >
              Aplicar
            </button>
          </div>
        )}
        <p className="text-[10px] text-[#64708a] mt-2">A Shopee limita o relatório a no máximo ~90 dias por consulta.</p>
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
            <span>Configure seu <b>App ID</b> e <b>Secret</b> da API de Afiliados da Shopee em Configurações para ver suas métricas.</span>
          </div>
          {onNavigateToSettings && (
            <button onClick={onNavigateToSettings} className="shrink-0 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-100 font-semibold rounded-lg px-3 py-1.5">
              Configurar
            </button>
          )}
        </div>
      )}

      {data?.connected && data?.error && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-200 p-4 rounded-xl text-xs flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
          <span>{data.error}</span>
        </div>
      )}

      {/* Totais */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <StatCard icon={<MousePointerClick className="w-4 h-4" />} label="Cliques nos links" value={fmtInt(clicksTotal)} accent="text-amber-400" loading={false} />
        <StatCard icon={<ShoppingCart className="w-4 h-4" />} label="Pedidos" value={fmtInt(t?.orders || 0)} accent="text-blue-400" loading={loading} />
        <StatCard icon={<DollarSign className="w-4 h-4" />} label="Vendas" value={fmtMoney(t?.sales || 0)} accent="text-white" loading={loading} />
        <StatCard icon={<Wallet className="w-4 h-4" />} label="Comissão" value={fmtMoney(t?.commission || 0)} accent="text-emerald-400" loading={loading} />
        <StatCard icon={<Receipt className="w-4 h-4" />} label="Ticket médio" value={fmtMoney(t?.avgTicket || 0)} accent="text-[#eef2f9]" loading={loading} />
      </div>

      {/* Gráfico comissão por dia */}
      <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20">
        <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-emerald-400" /> Comissão por dia
        </h2>
        {data && data.byDay.length > 0 ? (
          <div className="h-56 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.byDay} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <defs>
                  <linearGradient id="commGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e2636" vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: '#93a0b5', fontSize: 11 }} axisLine={{ stroke: '#1e2636' }} tickLine={false} />
                <YAxis tick={{ fill: '#93a0b5', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip
                  labelFormatter={(l: any) => fmtDay(String(l))}
                  contentStyle={{ background: '#0e1119', border: '1px solid #1e2636', borderRadius: 12, color: '#eef2f9', fontSize: 12 }}
                  formatter={(v: any) => [fmtMoney(Number(v)), 'Comissão']}
                />
                <Area type="monotone" dataKey="commission" stroke="#10b981" strokeWidth={2} fill="url(#commGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyHint text={loading ? 'Carregando...' : 'Sem conversões neste período. Assim que você tiver vendas de afiliado, elas aparecem aqui.'} />
        )}
      </div>

      {/* Top produtos + conversões recentes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-3">
            <Package className="w-4 h-4 text-blue-400" /> Produtos que mais venderam
          </h2>
          {data && data.topProducts.length > 0 ? (
            <ul className="space-y-2">
              {data.topProducts.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-3 bg-[#0e1119] border border-[#1e2636] rounded-xl px-3 py-2">
                  <span className="text-xs text-[#eef2f9] truncate">{p.name}</span>
                  <span className="text-xs font-bold text-blue-300 shrink-0">{fmtInt(p.count)}x</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="Sem dados de produtos neste período." />
          )}
        </div>

        <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 sm:p-5 shadow-lg shadow-black/20">
          <h2 className="text-sm font-extrabold text-white flex items-center gap-2 mb-3">
            <Receipt className="w-4 h-4 text-emerald-400" /> Conversões recentes
          </h2>
          {data && data.recent.length > 0 ? (
            <ul className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {data.recent.map((r, i) => (
                <li key={i} className="flex items-center justify-between gap-3 bg-[#0e1119] border border-[#1e2636] rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <div className="text-xs text-[#eef2f9] truncate">{r.item}</div>
                    <div className="text-[10px] text-[#64708a]">{r.purchaseTime ? new Date(r.purchaseTime).toLocaleString('pt-BR') : '—'}</div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400 shrink-0">{fmtMoney(r.commission)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyHint text="Sem conversões neste período." />
          )}
        </div>
      </div>

      <p className="text-[11px] text-[#64708a] text-center">
        Dados da API oficial de Afiliados da Shopee. {data?.extractedAt ? `Última atualização: ${data.extractedAt}.` : ''}
      </p>
    </div>
  );
};

const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string; accent: string; loading?: boolean }> = ({ icon, label, value, accent, loading }) => (
  <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 shadow-lg shadow-black/20">
    <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[#93a0b5]">
      <span className={accent}>{icon}</span> {label}
    </div>
    <div className={`mt-2 text-xl font-extrabold ${accent} ${loading ? 'opacity-40 animate-pulse' : ''}`}>{value}</div>
  </div>
);

const EmptyHint: React.FC<{ text: string }> = ({ text }) => (
  <div className="text-center text-xs text-[#64708a] py-8">{text}</div>
);
