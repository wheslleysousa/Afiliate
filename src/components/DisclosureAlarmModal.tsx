import React from 'react';
import { Bell, Share2, Sparkles, Clock, ArrowRight } from 'lucide-react';
import { AlarmSettings } from '../utils/alarmUtils';

interface DisclosureAlarmModalProps {
  alarmSettings: AlarmSettings;
  onAcknowledge: () => void;
  onSnooze: () => void;
}

export const DisclosureAlarmModal: React.FC<DisclosureAlarmModalProps> = ({
  alarmSettings,
  onAcknowledge,
  onSnooze,
}) => {
  const intervalMinutes = alarmSettings?.intervalMinutes || 15;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0e1119] border-2 border-blue-500/80 rounded-3xl p-6 shadow-2xl shadow-blue-500/20 text-center overflow-hidden flex flex-col items-center gap-5">
        
        {/* Efeito de Luz de Fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />

        {/* Ícone de Alarme Pulsante */}
        <div className="relative">
          <div className="absolute inset-0 bg-blue-500 rounded-full animate-ping opacity-30" />
          <div className="relative p-4 rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-500/30">
            <Bell className="w-10 h-10 animate-bounce" />
          </div>
        </div>

        {/* Título & Texto */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-blue-500/15 border border-blue-500/30 text-blue-400">
            <Clock className="w-3.5 h-3.5" />
            Lembrete Programado ({intervalMinutes} min)
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            ⏰ Hora de Divulgar um Novo Produto!
          </h2>
          <p className="text-xs sm:text-sm text-[#93a0b5] leading-relaxed max-w-md mx-auto">
            Mantenha suas vendas ativas! Selecione um produto na aba <strong className="text-white">Meus Produtos</strong>, copie a oferta e compartilhe nas suas redes sociais.
          </p>
        </div>

        {/* Dica de Alto Impacto */}
        <div className="w-full p-3.5 rounded-2xl bg-[#07090f] border border-[#1e2636] text-left flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-[#93a0b5] space-y-0.5">
            <strong className="text-white block">Controle Anti-Duplicação 24h:</strong>
            Os produtos que você divulgar hoje só voltarão a ser recomendados após 24 horas, garantindo ofertas sempre atualizadas para os seus clientes.
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
          <button
            type="button"
            onClick={onAcknowledge}
            className="w-full sm:flex-1 py-3.5 px-5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-extrabold text-xs sm:text-sm shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Escolher Produto & Divulgar</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={onSnooze}
            className="w-full sm:w-auto py-3.5 px-5 bg-[#151a26] hover:bg-[#1e2636] text-[#eef2f9] rounded-2xl font-bold text-xs border border-[#1e2636] transition-all cursor-pointer"
          >
            Adiar {intervalMinutes} min
          </button>
        </div>

      </div>
    </div>
  );
};
