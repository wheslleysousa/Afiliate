import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface WhatsAppAlertProps {
  type: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  onClose?: () => void;
  autoCloseMs?: number;
}

export const WhatsAppAlert: React.FC<WhatsAppAlertProps> = ({
  type,
  title,
  message,
  onClose,
  autoCloseMs = 6000,
}) => {
  useEffect(() => {
    if (autoCloseMs && onClose) {
      const timer = setTimeout(() => {
        onClose();
      }, autoCloseMs);
      return () => clearTimeout(timer);
    }
  }, [autoCloseMs, onClose]);

  const styles = {
    error: {
      bg: 'bg-red-500/10 border-red-500/30 text-red-200',
      iconBg: 'bg-red-500/20 text-red-400 border-red-500/30',
      icon: AlertCircle,
      defaultTitle: 'Atenção / Ocorreu um Erro',
    },
    success: {
      bg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200',
      iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      icon: CheckCircle2,
      defaultTitle: 'Operação Concluída',
    },
    info: {
      bg: 'bg-blue-500/10 border-blue-500/30 text-blue-200',
      iconBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      icon: Info,
      defaultTitle: 'Informação Importante',
    },
  }[type];

  const Icon = styles.icon;

  return (
    <div
      className={`border p-4 rounded-xl relative flex items-start gap-3 transition-all animate-fadeIn shadow-lg ${styles.bg}`}
    >
      <div className={`p-2 rounded-lg border shrink-0 ${styles.iconBg}`}>
        <Icon className="w-5 h-5" />
      </div>

      <div className="flex-1 pr-6 space-y-0.5">
        <h4 className="text-xs font-bold text-white tracking-wide">
          {title || styles.defaultTitle}
        </h4>
        <p className="text-xs text-stone-300 leading-relaxed font-sans">{message}</p>
      </div>

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-stone-400 hover:text-white p-1 rounded-md transition-colors"
          title="Fechar mensagem"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};
