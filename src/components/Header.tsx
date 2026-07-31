import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-[#0e1119] border-b border-[#1e2636] py-5 px-4 text-center shadow-lg">
      <div className="max-w-4xl mx-auto flex flex-col items-center justify-center gap-1">
        <div className="flex items-center gap-2">
          <span className="text-2xl sm:text-3xl">🔗</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">AfiliaCopy</h1>
        </div>
        <p className="text-xs sm:text-sm text-blue-400 font-medium">
          Cole o link → gere a copy → compartilhe no WhatsApp
        </p>
      </div>
    </header>
  );
};

export default Header;
