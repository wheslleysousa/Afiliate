import React, { useState, useEffect } from 'react';

const MESSAGES = [
  '🔍 Detectando plataforma...',
  '📦 Buscando dados do produto...',
  '🖼️ Carregando imagem...',
];

export const LoadingState: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % MESSAGES.length);
    }, 1500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 shadow-xl">
      <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 border-r-violet-500 rounded-full animate-spin"></div>
      <p className="text-sm font-semibold text-slate-200 animate-pulse transition-all">
        {MESSAGES[index]}
      </p>
    </div>
  );
};

export default LoadingState;
