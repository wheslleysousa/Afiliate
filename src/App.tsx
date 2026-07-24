import React, { useState, useEffect } from 'react';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { NewProductTab } from './components/NewProductTab';
import { SavedProductsTab } from './components/SavedProductsTab';
import { SettingsTab } from './components/SettingsTab';
import { ApiDocsModal } from './components/ApiDocsModal';
import { AppTab, UserProfile, SavedHistoryItem, ProductData, GeminiCopyVariation, ApiKeysConfig } from './types';
import { Sparkles, Menu, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch } from 'firebase/firestore';

export default function App() {
  // User Authentication State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Sidebar navigation & responsive state
  const [activeTab, setActiveTab] = useState<AppTab>('new-product');
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Saved Products State
  const [savedItems, setSavedItems] = useState<SavedHistoryItem[]>([]);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeysConfig>({});

  // Listen to Firebase Auth state change and load user data from Firestore
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (fbUser) => {
      if (fbUser) {
        // Fetch user profile from Firestore
        let userDocData: any = null;
        try {
          const uSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (uSnap.exists()) {
            userDocData = uSnap.data();
          }
        } catch (e) {
          console.error('Erro ao buscar dados do perfil no Firestore:', e);
        }

        const profile: UserProfile = {
          id: fbUser.uid,
          name: fbUser.displayName || userDocData?.name || fbUser.email?.split('@')[0] || 'Afiliado',
          email: fbUser.email?.toLowerCase() || userDocData?.email || '',
          createdAt: userDocData?.createdAt || new Date().toLocaleDateString('pt-BR'),
        };
        setCurrentUser(profile);

        // Fetch Saved Products collection for this specific user
        try {
          const savedSnap = await getDocs(collection(db, 'users', fbUser.uid, 'savedProducts'));
          const productsList: SavedHistoryItem[] = [];
          savedSnap.forEach((docSnap) => {
            productsList.push(docSnap.data() as SavedHistoryItem);
          });
          // Sort newest items first
          productsList.sort((a, b) => (b.id > a.id ? 1 : -1));
          setSavedItems(productsList);
        } catch (e) {
          console.error('Erro ao buscar produtos salvos no Firestore:', e);
          setSavedItems([]);
        }

        // Fetch user API Keys config from Firestore
        try {
          const keysSnap = await getDoc(doc(db, 'users', fbUser.uid, 'userConfig', 'apiKeys'));
          const defaultKeys = {
            mercadoLivreAppId: '1096973158666349',
            mercadoLivreClientSecret: '5YoWCSRNr90KiVumj0tf35NGkpOAbops',
          };
          if (keysSnap.exists()) {
            setApiKeys({ ...defaultKeys, ...(keysSnap.data() as ApiKeysConfig) });
          } else {
            setApiKeys(defaultKeys);
          }
        } catch (e) {
          console.error('Erro ao buscar chaves de API no Firestore:', e);
          setApiKeys({
            mercadoLivreAppId: '1096973158666349',
            mercadoLivreClientSecret: '5YoWCSRNr90KiVumj0tf35NGkpOAbops',
          });
        }
      } else {
        setCurrentUser(null);
        setSavedItems([]);
        setApiKeys({});
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Handle Login & Registration Success
  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
  };

  // Handle Logout
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error('Erro ao sair do Firebase:', e);
    }
    setCurrentUser(null);
  };

  // Handle Save New Product to Firestore & State
  const handleSaveProduct = async (product: ProductData, variations: GeminiCopyVariation[], selectedIndex: number) => {
    const newItem: SavedHistoryItem = {
      id: 'saved_' + Date.now(),
      product,
      variations,
      selectedCopyIndex: selectedIndex,
      createdAt: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    };

    setSavedItems((prev) => [newItem, ...prev]);

    if (currentUser?.id) {
      try {
        await setDoc(doc(db, 'users', currentUser.id, 'savedProducts', newItem.id), newItem);
      } catch (e) {
        console.error('Erro ao salvar produto no Firestore:', e);
      }
    }
  };

  const handleDeleteSavedItem = async (id: string) => {
    setSavedItems((prev) => prev.filter((item) => item.id !== id));

    if (currentUser?.id) {
      try {
        await deleteDoc(doc(db, 'users', currentUser.id, 'savedProducts', id));
      } catch (e) {
        console.error('Erro ao excluir produto do Firestore:', e);
      }
    }
  };

  const handleClearAllSaved = async () => {
    const previousItems = [...savedItems];
    setSavedItems([]);

    if (currentUser?.id) {
      try {
        const batch = writeBatch(db);
        previousItems.forEach((item) => {
          batch.delete(doc(db, 'users', currentUser.id, 'savedProducts', item.id));
        });
        await batch.commit();
      } catch (e) {
        console.error('Erro ao limpar histórico no Firestore:', e);
      }
    }
  };

  const handleSaveApiKeys = async (newKeys: ApiKeysConfig) => {
    setApiKeys(newKeys);
    if (currentUser?.id) {
      try {
        await setDoc(doc(db, 'users', currentUser.id, 'userConfig', 'apiKeys'), newKeys, { merge: true });
      } catch (e) {
        console.error('Erro ao salvar chaves de API no Firestore:', e);
      }
    }
  };

  const handleUpdateProfile = async (updated: { name: string; email: string }) => {
    setCurrentUser((prev) => (prev ? { ...prev, ...updated } : null));
    if (currentUser?.id) {
      try {
        await setDoc(doc(db, 'users', currentUser.id), updated, { merge: true });
      } catch (e) {
        console.error('Erro ao atualizar perfil no Firestore:', e);
      }
    }
  };

  // Loading indicator while checking Firebase Auth status
  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 text-stone-100 space-y-3">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
        <p className="text-xs text-stone-400 font-medium">Carregando dados do Firebase...</p>
      </div>
    );
  }

  // If user is not logged in, show Auth Screen
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
              apiKeys={apiKeys}
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
              onSaveApiKeys={handleSaveApiKeys}
              onUpdateProfile={handleUpdateProfile}
            />
          )}

          {activeTab === 'api-docs' && <ApiDocsModal />}
        </main>

        {/* Footer */}
        <footer className="border-t border-stone-900 bg-stone-950 py-5 text-center text-xs text-stone-500 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" />
              <span className="font-semibold text-stone-300">afiliate v2.0</span>
              <span>— Suporte a Mercado Livre, Shopee, Amazon, AliExpress e Shein</span>
            </div>
            <div className="flex items-center gap-2 text-emerald-500 font-medium">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Conectado ao Firebase Firestore (ytdark-2026)</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  );
}
