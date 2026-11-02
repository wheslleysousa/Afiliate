import React from 'react';
import { LayoutDashboard, ShoppingBag, Plus, MessageCircle, Grid3X3 } from 'lucide-react';
import type { AppTab } from '../types';

interface MobileNavProps {
  activeTab: AppTab;
  onNavigate: (tab: AppTab) => void;
  onMore: () => void;
}

/**
 * Primary Android navigation: four daily tasks and the full menu in "Mais".
 * Hidden on tablets/desktops where the existing sidebar remains available.
 */
export function MobileNav({ activeTab, onNavigate, onMore }: MobileNavProps) {
  const items: Array<{ id: AppTab | 'more'; label: string; icon: typeof LayoutDashboard }> = [
    { id: 'dashboard', label: 'Início', icon: LayoutDashboard },
    { id: 'marketplace', label: 'Explorar', icon: ShoppingBag },
    { id: 'new-product', label: 'Criar', icon: Plus },
    { id: 'whatsapp-auto', label: 'WhatsApp', icon: MessageCircle },
    { id: 'more', label: 'Mais', icon: Grid3X3 },
  ];
  const isMoreActive = !items.some(item => item.id !== 'more' && item.id === activeTab);

  return (
    <nav
      aria-label="Navegação principal"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-[#273245] bg-[#0e1420]/95 backdrop-blur-xl shadow-[0_-10px_38px_rgba(0,0,0,.25)]"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto max-w-xl grid grid-cols-5 gap-1 px-2 py-2">
        {items.map(({ id, label, icon: Icon }) => {
          const active = id === 'more' ? isMoreActive : activeTab === id;
          return (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-current={active ? 'page' : undefined}
              onClick={() => id === 'more' ? onMore() : onNavigate(id)}
              className={`min-h-14 rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors duration-200 active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-400 ${active
                ? 'bg-blue-500/15 text-blue-300'
                : 'text-[#a6b4c9] hover:text-white hover:bg-white/5'}`}
            >
              <Icon size={21} strokeWidth={active ? 2.4 : 1.8} aria-hidden="true" />
              <span>{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
