import React from 'react';
import { Sparkles, Code2, History, Zap, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  activeTab: 'generator' | 'history' | 'apiDocs';
  setActiveTab: (tab: 'generator' | 'history' | 'apiDocs') => void;
  savedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, savedCount }) => {
  return (
    <header className="sticky top-0 z-30 bg-[#0e1119]/95 backdrop-blur-md border-b border-[#1e2636] text-[#eef2f9] shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center shadow-lg shadow-blue-600/10">
              <Zap className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg text-white tracking-tight">AfiliaCopy</h1>
                <span className="bg-blue-500/10 text-blue-400 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                  v1.0.2
                </span>
              </div>
              <p className="text-xs text-[#93a0b5] hidden sm:block">Extração & Gerador de Copy para Afiliados</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'generator'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'text-[#93a0b5] hover:text-white hover:bg-[#151a26]'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Gerador</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all relative ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'text-[#93a0b5] hover:text-white hover:bg-[#151a26]'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
              {savedCount > 0 && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  activeTab === 'history' ? 'bg-[#0e1119] text-blue-400' : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                }`}>
                  {savedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('apiDocs')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm font-semibold transition-all ${
                activeTab === 'apiDocs'
                  ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                  : 'text-[#93a0b5] hover:text-white hover:bg-[#151a26]'
              }`}
            >
              <Code2 className="w-4 h-4" />
              <span className="hidden md:inline">Documentação API</span>
              <span className="md:hidden">API</span>
            </button>
          </nav>

        </div>
      </div>
    </header>
  );
};
