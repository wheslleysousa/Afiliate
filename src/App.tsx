import React, { useState, useEffect } from 'react';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { NewProductTab } from './components/NewProductTab';
import { SavedProductsTab } from './components/SavedProductsTab';
import { SettingsTab } from './components/SettingsTab';
import { ApiDocsModal } from './components/ApiDocsModal';
import { AppTab, UserProfile, SavedHistoryItem, ProductData, GeminiCopyVariation, ApiKeysConfig } from './types';
import { Sparkles, Menu, ShieldCheck, Zap } from 'lucide-react';

export default function App() {
  // User Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    try {
      const saved = localStorage.getItem('afiliacopy_active_user');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Sidebar navigation & responsive state
  const [activeTab, setActiveTab] = useState<AppTab>('new-product');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Saved Products State
  const [savedItems, setSavedItems] = useState<SavedHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('afiliacopy_saved_products');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeysConfig>(() => {
    try {
      const saved = localStorage.getItem('afiliacopy_api_keys');
      return saved ? JSON.parse(saved) : {};
    } catch (e) {
      return {};
    }
  });

  // Sync state to LocalStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('afiliacopy_active_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('afiliacopy_active_user');
    }
  }, [currentUser]);

  useEffect(() => {
    localStorage.setItem('afiliacopy_saved_products', JSON.stringify(savedItems));
  }, [savedItems]);

  useEffect(() => {
    localStorage.setItem('afiliacopy_api_keys', JSON.stringify(apiKeys));
  }, [apiKeys]);

  // Handle Login & Registration Success
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
  };

  // Handle Logout
  const handleLogout = () => {
    setCurrentUser(null);
  };

  // Handle Save New Product to Dashboard
  const handleSaveProduct = (product: ProductData, variations: GeminiCopyVariation[], selectedIndex: number) => {
    const newItem: SavedHistoryItem = {
      id: 'saved_' + Date.now(),
      product,
      variations,
      selectedCopyIndex: selectedIndex,
      createdAt: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    };

    setSavedItems((prev) => [newItem, ...prev]);
  };

  const handleDeleteSavedItem = (id: string) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleClearAllSaved = () => {
    setSavedItems([]);
  };

  // If user is not logged in, show Auth Screen first
  if (!currentUser) {
    return <AuthModal onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-stone-950 text-stone-100 font-sans selection:bg-emerald-500 selection:text-stone-950 flex flex-col md:flex-row">
      
      {/* Left Collapsible Sidebar Navigation */}
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={currentUser}
        onLogout={handleLogout}
        savedCount={savedItems.length}
        isExpanded={isSidebarExpanded}
        setIsExpanded={setIsSidebarExpanded}
        mobileOpen={mobileMenuOpen}
        setMobileOpen={setMobileMenuOpen}
      />

      {/* Main Content Area */}
      <div
        className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          isSidebarExpanded ? 'md:ml-64' : 'md:ml-20'
        }`}
      >
        {/* Top Navbar Header */}
        <header className="h-16 px-4 sm:px-6 border-b border-stone-800 bg-stone-900/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-stone-400 uppercase tracking-wider hidden sm:inline">
                Painel do Afiliado /
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {activeTab === 'new-product' && 'Cadastrar Novo Produto'}
                {activeTab === 'saved-products' && 'Produtos Cadastrados'}
                {activeTab === 'settings' && 'Configurações'}
                {activeTab === 'api-docs' && 'Documentação API'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 bg-stone-950 px-3 py-1.5 rounded-full border border-stone-800 text-xs text-stone-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold">{currentUser.name}</span>
            </div>
          </div>
        </header>

        {/* Dynamic Page Views */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl w-full mx-auto">
          {activeTab === 'new-product' && (
            <NewProductTab
              onSaveProduct={handleSaveProduct}
              savedCount={savedItems.length}
            />
          )}

          {activeTab === 'saved-products' && (
            <SavedProductsTab
              items={savedItems}
              onDelete={handleDeleteSavedItem}
              onClearAll={handleClearAllSaved}
              onNavigateToNew={() => setActiveTab('new-product')}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              user={currentUser}
              apiKeys={apiKeys}
              onSaveApiKeys={setApiKeys}
              onUpdateProfile={(updated) => setCurrentUser((prev) => (prev ? { ...prev, ...updated } : null))}
            />
          )}

          {activeTab === 'api-docs' && <ApiDocsModal />}
        </main>

        {/* Footer */}
        <footer className="border-t border-stone-900 bg-stone-950 py-5 text-center text-xs text-stone-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-stone-300">AfiliaCopy v2.0</span>
              <span>— Suporte a Mercado Livre, Shopee, Amazon, AliExpress e Shein</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Painel do Afiliado Ativo</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
