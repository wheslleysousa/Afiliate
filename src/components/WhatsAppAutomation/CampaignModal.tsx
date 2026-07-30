import React, { useState, useEffect } from 'react';
import type { WaCampaign, WaGroup, CampaignObjective, CampaignPacing } from '../../types';
import {
  X,
  Target,
  Clock,
  Filter,
  Zap,
  Check,
  Calendar,
  Sparkles,
  Users,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  BarChart2,
  DollarSign,
  Tag,
  MessageSquare,
} from 'lucide-react';

interface CampaignModalProps {
  campaign: WaCampaign | null; // null for new campaign
  waGroups: WaGroup[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (campaignData: Partial<WaCampaign>) => Promise<void>;
}

const ALL_PLATFORMS = [
  { id: 'mercadolivre', label: 'Mercado Livre' },
  { id: 'shopee', label: 'Shopee' },
  { id: 'amazon', label: 'Amazon' },
  { id: 'aliexpress', label: 'AliExpress' },
  { id: 'shein', label: 'Shein' },
];

const DAYS_OF_WEEK = [
  { day: 0, label: 'Dom' },
  { day: 1, label: 'Seg' },
  { day: 2, label: 'Ter' },
  { day: 3, label: 'Qua' },
  { day: 4, label: 'Qui' },
  { day: 5, label: 'Sex' },
  { day: 6, label: 'Sáb' },
];

export const CampaignModal: React.FC<CampaignModalProps> = ({
  campaign,
  waGroups,
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [targetGroupIds, setTargetGroupIds] = useState<string[]>([]);
  const [objective, setObjective] = useState<CampaignObjective>('mais_vendidos');
  
  // Filters
  const [minSales, setMinSales] = useState<number | ''>('');
  const [minDiscount, setMinDiscount] = useState<number | ''>('');
  const [platforms, setPlatforms] = useState<string[]>(['mercadolivre', 'shopee', 'amazon', 'aliexpress', 'shein']);
  const [categoriesStr, setCategoriesStr] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<number | ''>('');

  // Quantity & Window
  const [quantity, setQuantity] = useState<number>(30);
  const [windowMinutes, setWindowMinutes] = useState<number>(30);

  // Pacing
  const [pacing, setPacing] = useState<CampaignPacing>('aleatorio');
  const [minGapSec, setMinGapSec] = useState<number>(30);
  const [maxGapSec, setMaxGapSec] = useState<number>(120);

  // Schedule
  const [startHour, setStartHour] = useState<string>('09:00');
  const [endHour, setEndHour] = useState<string>('21:00');
  const [days, setDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [timezone, setTimezone] = useState<string>('America/Sao_Paulo');

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || '');
      setEnabled(campaign.enabled ?? true);
      setTargetGroupIds(campaign.targetGroupIds || []);
      setObjective(campaign.objective || 'mais_vendidos');
      
      setMinSales(campaign.filters?.minSales ?? '');
      setMinDiscount(campaign.filters?.minDiscount ?? '');
      setPlatforms(campaign.filters?.platforms || ['mercadolivre', 'shopee', 'amazon', 'aliexpress', 'shein']);
      setCategoriesStr((campaign.filters?.categories || []).join(', '));
      setMaxPrice(campaign.filters?.maxPrice ?? '');

      setQuantity(campaign.quantity ?? 30);
      setWindowMinutes(campaign.windowMinutes ?? 30);

      setPacing(campaign.pacing || 'aleatorio');
      setMinGapSec(campaign.minGapSec ?? 30);
      setMaxGapSec(campaign.maxGapSec ?? 120);

      setStartHour(campaign.schedule?.startHour || '09:00');
      setEndHour(campaign.schedule?.endHour || '21:00');
      setDays(campaign.schedule?.days || [0, 1, 2, 3, 4, 5, 6]);
      setTimezone(campaign.schedule?.timezone || 'America/Sao_Paulo');
    } else {
      // Default reset
      setName('');
      setEnabled(true);
      setTargetGroupIds(waGroups.map(g => g.groupId)); // select all by default
      setObjective('mais_vendidos');
      setMinSales('');
      setMinDiscount('');
      setPlatforms(['mercadolivre', 'shopee', 'amazon', 'aliexpress', 'shein']);
      setCategoriesStr('');
      setMaxPrice('');
      setQuantity(30);
      setWindowMinutes(30);
      setPacing('aleatorio');
      setMinGapSec(30);
      setMaxGapSec(120);
      setStartHour('09:00');
      setEndHour('21:00');
      setDays([0, 1, 2, 3, 4, 5, 6]);
      setTimezone('America/Sao_Paulo');
    }
    setError(null);
  }, [campaign, waGroups, isOpen]);

  if (!isOpen) return null;

  const togglePlatform = (id: string) => {
    if (platforms.includes(id)) {
      setPlatforms(platforms.filter((p) => p !== id));
    } else {
      setPlatforms([...platforms, id]);
    }
  };

  const toggleDay = (dayNum: number) => {
    if (days.includes(dayNum)) {
      setDays(days.filter((d) => d !== dayNum));
    } else {
      setDays([...days, dayNum].sort((a, b) => a - b));
    }
  };

  const toggleGroup = (groupId: string) => {
    if (targetGroupIds.includes(groupId)) {
      setTargetGroupIds(targetGroupIds.filter((id) => id !== groupId));
    } else {
      setTargetGroupIds([...targetGroupIds, groupId]);
    }
  };

  const handleSelectAllGroups = () => {
    if (targetGroupIds.length === waGroups.length) {
      setTargetGroupIds([]);
    } else {
      setTargetGroupIds(waGroups.map((g) => g.groupId));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Informe um nome para a campanha.');
      return;
    }
    if (targetGroupIds.length === 0) {
      setError('Selecione ao menos um grupo do WhatsApp como alvo.');
      return;
    }

    const categories = categoriesStr
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);

    setSaving(true);
    setError(null);

    try {
      await onSave({
        name: name.trim(),
        enabled,
        targetGroupIds,
        objective,
        filters: {
          minSales: minSales !== '' ? Number(minSales) : undefined,
          minDiscount: minDiscount !== '' ? Number(minDiscount) : undefined,
          platforms,
          categories,
          maxPrice: maxPrice !== '' ? Number(maxPrice) : undefined,
        },
        quantity: Number(quantity) || 30,
        windowMinutes: Number(windowMinutes) || 30,
        pacing,
        minGapSec: Number(minGapSec) || 30,
        maxGapSec: Number(maxGapSec) || 120,
        schedule: {
          startHour,
          endHour,
          days,
          timezone,
        },
      });
      setSaving(false);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar campanha:', err);
      setError(err?.message || 'Erro ao salvar campanha.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-3xl rounded-2xl p-6 my-8 space-y-6 animate-fadeIn relative max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2636] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-blue-600/20 border border-blue-500/30 text-blue-400 rounded-xl">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">
                {campaign ? 'Editar Campanha de Disparo' : 'Nova Campanha de Disparo'}
              </h3>
              <p className="text-xs text-stone-400">
                Configure os grupos, filtros de produtos, volume e ritmo de envios automatizados.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#151a26] text-stone-400 hover:text-white border border-[#1e2636]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-3 rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Nome e Toggle Ativo */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-[#151a26]/50 p-4 rounded-xl border border-[#1e2636]">
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-stone-300">
                Nome da Campanha <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Ofertas Quentes - Manhã (Gr. Vips)"
                className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2.5 focus:outline-none focus:border-blue-500"
                required
              />
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-3 bg-[#0e1119] border border-[#1e2636] px-4 py-2.5 rounded-xl">
              <span className="text-xs font-bold text-stone-300">Status:</span>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  enabled ? 'bg-emerald-600' : 'bg-stone-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    enabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs font-bold ${enabled ? 'text-emerald-400' : 'text-stone-400'}`}>
                {enabled ? 'Ativa' : 'Pausada'}
              </span>
            </div>
          </div>

          {/* Grupos-Alvo */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-stone-300 flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-400" />
                Grupos do WhatsApp Alvo ({targetGroupIds.length} selecionados)
              </label>
              {waGroups.length > 0 && (
                <button
                  type="button"
                  onClick={handleSelectAllGroups}
                  className="text-xs text-blue-400 hover:underline font-semibold"
                >
                  {targetGroupIds.length === waGroups.length ? 'Desmarcar Todos' : 'Selecionar Todos'}
                </button>
              )}
            </div>

            {waGroups.length === 0 ? (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs rounded-xl">
                Nenhum grupo encontrado no seu Firestore. Aguarde o worker sincronizar seus grupos do WhatsApp.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-2 bg-[#151a26]/30 rounded-xl border border-[#1e2636]">
                {waGroups.map((g) => {
                  const isChecked = targetGroupIds.includes(g.groupId);
                  return (
                    <div
                      key={g.groupId}
                      onClick={() => toggleGroup(g.groupId)}
                      className={`p-2.5 rounded-xl border cursor-pointer transition-all flex items-center gap-3 ${
                        isChecked
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-white'
                          : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:border-stone-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by div click
                        className="rounded border-stone-700 text-emerald-500 focus:ring-emerald-500 h-4 w-4"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold truncate">{g.name}</div>
                        <div className="text-[10px] text-stone-500">
                          {g.size || g.participantsCount || 0} membros {g.isAdmin ? '• Admin' : ''}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Objetivo do Disparo */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-stone-300 flex items-center gap-2">
              <Target className="w-4 h-4 text-blue-400" />
              Objetivo de Mineração / Seleção
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {[
                { id: 'mais_vendidos', label: '🔥 Mais Vendidos', desc: 'Prioriza maior nº de vendas' },
                { id: 'maior_desconto', label: '⚡ Maior Desconto', desc: 'Prioriza % OFF mais alto' },
                { id: 'maior_comissao', label: '💰 Maior Comissão', desc: 'Prioriza valor R$ comissão' },
                { id: 'mais_recentes', label: '🆕 Mais Recentes', desc: 'Últimos produtos minerados' },
              ].map((obj) => {
                const isSelected = objective === obj.id;
                return (
                  <button
                    key={obj.id}
                    type="button"
                    onClick={() => setObjective(obj.id as CampaignObjective)}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-950/30'
                        : 'bg-[#151a26]/50 border-[#1e2636] text-stone-400 hover:border-stone-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{obj.label}</div>
                    <div className="text-[10px] text-stone-400 mt-1">{obj.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtros de Produtos */}
          <div className="space-y-3 bg-[#151a26]/50 p-4 rounded-2xl border border-[#1e2636]">
            <h4 className="text-xs font-bold text-stone-200 flex items-center gap-2">
              <Filter className="w-4 h-4 text-amber-400" />
              Filtros Avançados de Produtos
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400">Vendas Mínimas</label>
                <input
                  type="number"
                  placeholder="Ex: 50"
                  value={minSales}
                  onChange={(e) => setMinSales(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-stone-400">Desconto Mínimo (%)</label>
                <input
                  type="number"
                  placeholder="Ex: 20"
                  value={minDiscount}
                  onChange={(e) => setMinDiscount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-stone-400">Preço Máximo (R$)</label>
                <input
                  type="number"
                  placeholder="Ex: 250"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-stone-400">Plataformas Aceitas</label>
              <div className="flex flex-wrap gap-2">
                {ALL_PLATFORMS.map((plat) => {
                  const isSel = platforms.includes(plat.id);
                  return (
                    <button
                      key={plat.id}
                      type="button"
                      onClick={() => togglePlatform(plat.id)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                        isSel
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : 'bg-[#0e1119] border-[#1e2636] text-stone-500'
                      }`}
                    >
                      {isSel ? '✓ ' : ''}{plat.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-[11px] text-stone-400">Categorias (separadas por vírgula, opcional)</label>
              <input
                type="text"
                placeholder="Ex: Eletrônicos, Celulares, Casa"
                value={categoriesStr}
                onChange={(e) => setCategoriesStr(e.target.value)}
                className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
              />
            </div>
          </div>

          {/* Quantidade, Janela e Ritmo (Pacing) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Quantidade & Janela */}
            <div className="space-y-3 bg-[#151a26]/50 p-4 rounded-2xl border border-[#1e2636]">
              <h4 className="text-xs font-bold text-stone-200 flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-emerald-400" />
                Volume de Disparos
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400">Qtd. Produtos</label>
                  <input
                    type="number"
                    min="1"
                    max="500"
                    value={quantity}
                    onChange={(e) => setQuantity(Number(e.target.value))}
                    className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] text-stone-400">Janela (minutos)</label>
                  <input
                    type="number"
                    min="1"
                    max="1440"
                    value={windowMinutes}
                    onChange={(e) => setWindowMinutes(Number(e.target.value))}
                    className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
                  />
                </div>
              </div>
              <p className="text-[10px] text-stone-400">
                A campanha tentará distribuir <strong>{quantity} ofertas</strong> ao longo de <strong>{windowMinutes} minutos</strong>.
              </p>
            </div>

            {/* Pacing (Ritmo) */}
            <div className="space-y-3 bg-[#151a26]/50 p-4 rounded-2xl border border-[#1e2636]">
              <h4 className="text-xs font-bold text-stone-200 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                Ritmo (Pacing)
              </h4>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPacing('aleatorio')}
                  className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                    pacing === 'aleatorio'
                      ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                      : 'bg-[#0e1119] border-[#1e2636] text-stone-400'
                  }`}
                >
                  🎲 Aleatório (Recomendado)
                </button>
                <button
                  type="button"
                  onClick={() => setPacing('uniforme')}
                  className={`p-2.5 rounded-xl border text-left text-xs font-bold transition-all ${
                    pacing === 'uniforme'
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300'
                      : 'bg-[#0e1119] border-[#1e2636] text-stone-400'
                  }`}
                >
                  ⏱️ Uniforme
                </button>
              </div>

              {pacing === 'aleatorio' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400">Gap Mín (seg)</label>
                    <input
                      type="number"
                      value={minGapSec}
                      onChange={(e) => setMinGapSec(Number(e.target.value))}
                      className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-2.5 py-1.5"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-stone-400">Gap Máx (seg)</label>
                    <input
                      type="number"
                      value={maxGapSec}
                      onChange={(e) => setMaxGapSec(Number(e.target.value))}
                      className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-2.5 py-1.5"
                    />
                  </div>
                </div>
              )}

              <p className="text-[10px] text-stone-400">
                {pacing === 'aleatorio'
                  ? `Intervalos sorteados entre ${minGapSec}s e ${maxGapSec}s em lotes irregulares para proteger sua conta contra banimentos.`
                  : 'Distribuição exatamente espaçada e uniforme.'}
              </p>
            </div>
          </div>

          {/* Horários e Agendamento */}
          <div className="space-y-3 bg-[#151a26]/50 p-4 rounded-2xl border border-[#1e2636]">
            <h4 className="text-xs font-bold text-stone-200 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" />
              Horário de Funcionamento
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] text-stone-400">Início</label>
                <input
                  type="time"
                  value={startHour}
                  onChange={(e) => setStartHour(e.target.value)}
                  className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-stone-400">Fim</label>
                <input
                  type="time"
                  value={endHour}
                  onChange={(e) => setEndHour(e.target.value)}
                  className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] text-stone-400">Fuso Horário</label>
                <input
                  type="text"
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full bg-[#0e1119] border border-[#1e2636] text-stone-100 text-xs rounded-xl px-3 py-2 font-mono"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-1">
              <label className="text-[11px] text-stone-400">Dias da Semana Permitidos</label>
              <div className="flex flex-wrap gap-1.5">
                {DAYS_OF_WEEK.map((d) => {
                  const isSel = days.includes(d.day);
                  return (
                    <button
                      key={d.day}
                      type="button"
                      onClick={() => toggleDay(d.day)}
                      className={`w-10 h-8 rounded-lg border text-xs font-bold transition-all ${
                        isSel
                          ? 'bg-emerald-600 border-emerald-500 text-white'
                          : 'bg-[#0e1119] border-[#1e2636] text-stone-500 hover:text-stone-300'
                      }`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#1e2636]">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="px-5 py-2.5 bg-[#151a26] hover:bg-stone-800 text-stone-300 text-xs font-bold rounded-xl border border-[#1e2636]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-lg shadow-blue-950/50 disabled:opacity-50"
            >
              {saving ? (
                <>Salvando...</>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  {campaign ? 'Atualizar Campanha' : 'Criar Campanha'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
