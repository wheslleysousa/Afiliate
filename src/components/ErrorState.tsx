import React from 'react';

interface ErrorStateProps {
  message: string;
  onRetry: () => void;
}

export const ErrorState: React.FC<ErrorStateProps> = ({ message, onRetry }) => {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-6 text-center space-y-4 shadow-lg">
      <div className="text-3xl">❌</div>
      <div className="space-y-1">
        <h3 className="text-base font-bold text-red-400">Falha ao extrair produto</h3>
        <p className="text-xs text-slate-300 max-w-md mx-auto">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-5 py-2 border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
      >
        <span>🔄 Tentar novamente</span>
      </button>
    </div>
  );
};

export default ErrorState;
