import React from 'react';
import { Sparkles, Code2, History, Zap, CheckCircle2 } from 'lucide-react';

interface NavbarProps {
  activeTab: 'generator' | 'history' | 'apiDocs';
  setActiveTab: (tab: 'generator' | 'history' | 'apiDocs') => void;
  savedCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab, savedCount }) => {
  return (
    <header className="sticky top-0 z-30 bg-stone-900/95 backdrop-blur-md border-b border-stone-800 text-stone-100 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 p-0.5 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <div className="w-full h-full bg-stone-950 rounded-[10px] flex items-center justify-center">
                <Zap className="w-5 h-5 text-emerald-400 fill-emerald-400/20" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-white tracking-tight">AfiliaCopy</h1>
                <span className="bg-emerald-500/10 text-emerald-400 text-[11px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  v1.0.0
                </span>
              </div>
              <p className="text-xs text-stone-400 hidden sm:block">Extração & Gerador de Copy para Afiliados</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('generator')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'generator'
                  ? 'bg-emerald-500 text-stone-950 shadow-sm shadow-emerald-500/20'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Gerador</span>
            </button>

            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all relative ${
                activeTab === 'history'
                  ? 'bg-emerald-500 text-stone-950 shadow-sm shadow-emerald-500/20'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Histórico</span>
              {savedCount > 0 && (
                <span className={`text-xs px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'history' ? 'bg-stone-950 text-emerald-400' : 'bg-emerald-500/20 text-emerald-400'
                }`}>
                  {savedCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('apiDocs')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'apiDocs'
                  ? 'bg-emerald-500 text-stone-950 shadow-sm shadow-emerald-500/20'
                  : 'text-stone-300 hover:text-white hover:bg-stone-800'
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
