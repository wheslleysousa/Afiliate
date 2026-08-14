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
        <h3 className="text-base font-extrabold text-red-400">Falha ao extrair produto</h3>
        <p className="text-xs text-[#93a0b5] max-w-md mx-auto">{message}</p>
      </div>
      <button
        onClick={onRetry}
        className="px-5 py-2.5 bg-[#0e1119] hover:bg-[#151a26] border border-[#1e2636] text-[#eef2f9] rounded-xl text-xs font-semibold transition-all inline-flex items-center gap-1.5"
      >
        <span>🔄 Tentar novamente</span>
      </button>
    </div>
  );
};

export default ErrorState;
