import React, { useEffect } from 'react';
import { Bell, Flame, Share2, Sparkles, X, Clock, CheckCircle2, ArrowRight } from 'lucide-react';

interface DisclosureAlarmModalProps {
  intervalMinutes: number;
  onAcknowledgeAndNavigate: () => void;
  onSnooze: () => void;
}

export const DisclosureAlarmModal: React.FC<DisclosureAlarmModalProps> = ({
  intervalMinutes,
  onAcknowledgeAndNavigate,
  onSnooze,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-stone-900 border-2 border-pink-500/80 rounded-3xl p-6 shadow-2xl shadow-pink-500/20 text-center overflow-hidden flex flex-col items-center gap-5">
        
        {/* Efeito de Luz de Fundo */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-pink-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-violet-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Ícone de Alarme Pulsante */}
        <div className="relative">
          <div className="absolute inset-0 bg-pink-500 rounded-full animate-ping opacity-30" />
          <div className="relative p-4 rounded-2xl bg-gradient-to-tr from-pink-600 to-violet-600 text-white shadow-lg shadow-pink-500/30">
            <Bell className="w-10 h-10 animate-bounce" />
          </div>
        </div>

        {/* Título & Texto */}
        <div className="space-y-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide bg-pink-500/15 border border-pink-500/30 text-pink-400">
            <Clock className="w-3.5 h-3.5" />
            Lembrete Programado ({intervalMinutes}min)
          </span>
          <h2 className="text-xl sm:text-2xl font-black text-white leading-tight">
            ⏰ Hora de Divulgar um Novo Produto!
          </h2>
          <p className="text-xs sm:text-sm text-stone-300 leading-relaxed max-w-md mx-auto">
            Mantenha suas vendas ativas! Selecione um produto disponível no Marketplace, copie o roteiro ou copy e compartilhe nas suas redes sociais.
          </p>
        </div>

        {/* Dica de Alto Impacto */}
        <div className="w-full p-3.5 rounded-2xl bg-stone-950 border border-stone-800 text-left flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs text-stone-300 space-y-0.5">
            <strong className="text-white block">Controle Anti-Duplicação 24h:</strong>
            Os produtos que você divulgar hoje só voltarão a ser recomendados após 24 horas, garantindo ofertas sempre atualizadas para os seus clientes.
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full pt-2">
          <button
            onClick={onAcknowledgeAndNavigate}
            className="w-full sm:flex-1 py-3.5 px-5 bg-gradient-to-r from-pink-600 via-purple-600 to-violet-600 hover:opacity-95 text-white rounded-2xl font-extrabold text-xs sm:text-sm shadow-xl shadow-pink-600/30 flex items-center justify-center gap-2 transition-all transform active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span>Escolher Produto & Divulgar</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          <button
            onClick={onSnooze}
            className="w-full sm:w-auto py-3.5 px-5 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-2xl font-bold text-xs border border-stone-700 transition-all"
          >
            Adiar por {intervalMinutes}min
          </button>
        </div>

      </div>
    </div>
  );
};
