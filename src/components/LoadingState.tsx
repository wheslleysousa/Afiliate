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
    <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl p-8 flex flex-col items-center justify-center space-y-4 shadow-xl">
      <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 border-r-blue-400 rounded-full animate-spin"></div>
      <p className="text-sm font-semibold text-[#eef2f9] animate-pulse transition-all">
        {MESSAGES[index]}
      </p>
    </div>
  );
};

export default LoadingState;
