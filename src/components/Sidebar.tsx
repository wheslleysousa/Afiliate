import React from 'react';
import { AppTab, UserProfile } from '../types';
import { PlusCircle, ShoppingBag, Globe, PackageCheck, Settings, Code2, LogOut, Sparkles, ChevronLeft, ChevronRight, Menu, X, BarChart2, Bot, LayoutTemplate, Puzzle, Scissors, Film, Link2 } from 'lucide-react';

interface SidebarProps {
  activeTab: AppTab;
  setActiveTab: (tab: AppTab) => void;
  user: UserProfile;
  onLogout: () => void;
  savedCount: number;
  minedCount: number;
  dailyMineCount?: number;
  dailyMineLimit?: number;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  user,
  onLogout,
  savedCount,
  minedCount,
  dailyMineCount,
  dailyMineLimit,
  isExpanded,
  setIsExpanded,
  mobileOpen,
  setMobileOpen,
}) => {
  const menuItems: { id: AppTab; label: string; icon: (isActive: boolean) => React.ReactNode; badge?: number }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (active) => <BarChart2 className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'marketplace',
      label: 'Marketplace Global',
      icon: (active) => <Globe className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'my-products',
      label: 'Meus Produtos',
      icon: (active) => <PackageCheck className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
      badge: minedCount,
    },
    {
      id: 'projects',
      label: 'Projetos',
      icon: (active) => <Film className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'whatsapp-auto',
      label: 'Automação Zap',
      icon: (active) => <Bot className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: (active) => <LayoutTemplate className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'extension',
      label: 'Extensão',
      icon: (active) => <Puzzle className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'url-shortener',
      label: 'Encurtador de Links',
      icon: (active) => <Scissors className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'bio',
      label: 'Link in Bio',
      icon: (active) => <Link2 className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: (active) => <Settings className={`w-5 h-5 shrink-0 ${active ? 'text-blue-400' : 'text-[#93a0b5]'}`} />,
    },
  ];

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 bottom-0 z-50 bg-[#0e1119] border-r border-[#1e2636] transition-all duration-300 flex flex-col justify-between ${
          /* Mobile Drawer Positioning */
          mobileOpen ? 'translate-x-0 w-72' : '-translate-x-full md:translate-x-0'
        } ${
          /* Desktop Responsive Widths */
          isExpanded ? 'md:w-64' : 'md:w-20'
        }`}
      >
        {/* Top Header & Logo */}
        <div>
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#1e2636]">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              {(isExpanded || mobileOpen) && (
                <div className="animate-fadeIn truncate">
                  <h1 className="font-extrabold text-base text-white tracking-tight leading-none">afiliate</h1>
                  <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">Painel Afiliado</span>
                </div>
              )}
            </div>

            {/* Collapse button on Desktop */}
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="hidden md:flex p-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white border border-[#1e2636] transition-all"
              title={isExpanded ? 'Recolher Menu' : 'Expandir Menu'}
            >
              {isExpanded ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {/* Close button on Mobile */}
            <button
              onClick={() => setMobileOpen(false)}
              className="md:hidden p-1.5 rounded-lg bg-[#151a26] text-[#93a0b5] hover:text-white border border-[#1e2636]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="p-3 space-y-1.5">
            {menuItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  title={item.label}
                  className={`w-full p-3 rounded-xl font-semibold text-xs transition-all flex items-center gap-3 relative group ${
                    isActive
                      ? 'bg-blue-600/15 text-blue-300 border border-blue-500/40 shadow-sm'
                      : 'text-[#93a0b5] hover:text-white hover:bg-[#151a26] border border-transparent'
                  }`}
                >
                  {item.icon(isActive)}

                  {(isExpanded || mobileOpen) && (
                    <span className="truncate text-left flex-1">{item.label}</span>
                  )}

                  {item.badge !== undefined && item.badge > 0 && (
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'bg-[#151a26] text-blue-400 border border-blue-500/30'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* User Profile & Logout Bottom Bar */}
        <div className="p-3 border-t border-[#1e2636] bg-[#0e1119]">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold flex items-center justify-center text-xs shrink-0">
                {user.name.charAt(0).toUpperCase()}
              </div>

              {(isExpanded || mobileOpen) && (
                <div className="truncate text-left">
                  <p className="text-xs font-bold text-white truncate">{user.name}</p>
                  <p className="text-[10px] text-[#93a0b5] truncate">{user.email}</p>
                </div>
              )}
            </div>

            {(isExpanded || mobileOpen) && (
              <button
                onClick={onLogout}
                title="Sair da Conta"
                className="p-2 text-[#93a0b5] hover:text-red-400 hover:bg-red-950/40 rounded-lg transition-all shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          {(isExpanded || mobileOpen) && dailyMineCount !== undefined && dailyMineLimit !== undefined && (
            <div className="mt-3 px-1">
              <div className="flex justify-between text-[10px] font-bold text-[#93a0b5] mb-1.5">
                <span>Minerados hoje</span>
                <span className={dailyMineCount >= dailyMineLimit ? 'text-red-400' : 'text-emerald-400'}>
                  {dailyMineCount}/{dailyMineLimit}
                </span>
              </div>
              <div className="w-full h-1.5 bg-[#151a26] border border-[#1e2636] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    dailyMineCount >= dailyMineLimit ? 'bg-red-500' : dailyMineCount >= dailyMineLimit * 0.8 ? 'bg-amber-500' : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min((dailyMineCount / dailyMineLimit) * 100, 100)}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
