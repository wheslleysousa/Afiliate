import React, { useState, useEffect } from 'react';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { NewProductTab } from './components/NewProductTab';
import { SavedProductsTab } from './components/SavedProductsTab';
import { MarketplaceTab } from './components/MarketplaceTab';
import { MinedProductsTab } from './components/MinedProductsTab';
import { SettingsTab } from './components/SettingsTab';
import { ApiDocsModal } from './components/ApiDocsModal';
import { AppTab, UserProfile, SavedHistoryItem, ProductData, GeminiCopyVariation, ApiKeysConfig, ScrapedProduct, MinedProductRef } from './types';
import { Sparkles, Menu, ShieldCheck, Zap, Loader2 } from 'lucide-react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  upsertToMarketplace,
  incrementDailyMineCount,
  checkMiningLimit,
  PLAN_LIMITS,
  getDailyMineCount,
} from './utils/marketplaceUtils';

// Helper function to resolve the registered redirect URI for Mercado Livre OAuth dynamically
export const getMlRedirectUri = () => {
  const origin = window.location.origin;
  if (origin.includes('run.app') || origin.includes('aistudio') || origin.includes('web-preview')) {
    return 'https://ais-dev-5teru3rok43774mjkuxp2x-165140757857.us-east1.run.app/settings';
  }
  return origin + '/settings';
};

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
  const [minedItems, setMinedItems] = useState<MinedProductRef[]>([]);
  const [dailyMineCount, setDailyMineCount] = useState<number>(0);

  // API Keys State
  const [apiKeys, setApiKeys] = useState<ApiKeysConfig>({});

  // OAuth State
  const [oauthExchanging, setOauthExchanging] = useState(false);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [oauthSuccess, setOauthSuccess] = useState(false);

  // Listen to Mercado Livre OAuth callback code in URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !authLoading && currentUser?.id && apiKeys && !oauthExchanging && !oauthSuccess && !oauthError) {
      const exchangeCode = async () => {
        setOauthExchanging(true);
        setOauthError(null);
        try {
          // Grab current keys or default values
          const appId = apiKeys.mercadoLivreAppId || '1096973158666349';
          const clientSecret = apiKeys.mercadoLivreClientSecret || '5YoWCSRNr90KiVumj0tf35NGkpOAbops';
          const redirectUri = getMlRedirectUri();

          const res = await fetch('/api/ml-exchange-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              code,
              redirectUri,
              appId,
              clientSecret
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            const updatedKeys: ApiKeysConfig = {
              ...apiKeys,
              mercadoLivreKey: data.mercadoLivreKey,
              mercadoLivreRefreshToken: data.mercadoLivreRefreshToken,
              mercadoLivreExpiresAt: data.mercadoLivreExpiresAt
            };
            await handleSaveApiKeys(updatedKeys);
            setOauthSuccess(true);
            
            // Clean up the URL query params without reloading
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
            
            // Redirect to settings to show active state
            setActiveTab('settings');
          } else {
            setOauthError(data.error || 'Falha ao vincular com o Mercado Livre.');
            // Clean up the URL query params even on error
            const cleanUrl = window.location.origin + window.location.pathname;
            window.history.replaceState({}, document.title, cleanUrl);
          }
        } catch (err: any) {
          console.error('[ML OAuth Error]', err);
          const isNetworkError = err.message === 'Failed to fetch' || err.toString().includes('Failed to fetch');
          setOauthError(
            isNetworkError 
              ? 'Não foi possível conectar ao servidor. O aplicativo está iniciando ou reiniciando. Aguarde alguns segundos e tente novamente.'
              : (err.message || 'Erro ao comunicar com o servidor.')
          );
        } finally {
          setOauthExchanging(false);
        }
      };
      
      exchangeCode();
    }
  }, [authLoading, currentUser, apiKeys]);

  // Listen to Firebase Auth state change and load user data from Firestore
  useEffect(() => {
    let unsubscribeKeys: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      // Clean up previous keys listener if any
      if (unsubscribeKeys) {
        unsubscribeKeys();
        unsubscribeKeys = null;
      }

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

        // Set up real-time listener for user API Keys config from Firestore
        const defaultKeys = {
          mercadoLivreAppId: '1096973158666349',
          mercadoLivreClientSecret: '5YoWCSRNr90KiVumj0tf35NGkpOAbops',
        };

        try {
          const minedSnap = await getDocs(
            query(
              collection(db, 'users', fbUser.uid, 'minedProducts'),
              orderBy('minedAt', 'desc')
            )
          );
          setMinedItems(minedSnap.docs.map((d) => d.data() as MinedProductRef));
          getDailyMineCount(fbUser.uid).then(setDailyMineCount).catch(console.error);
        } catch (e) {
          console.error('Erro ao carregar minedProducts:', e);
        }

        unsubscribeKeys = onSnapshot(
          doc(db, 'users', fbUser.uid, 'userConfig', 'apiKeys'),
          (snapshot) => {
            if (snapshot.exists()) {
              setApiKeys({ ...defaultKeys, ...(snapshot.data() as ApiKeysConfig) });
            } else {
              setApiKeys(defaultKeys);
            }
          },
          (err) => {
            console.error('Erro ao escutar chaves de API no Firestore:', err);
            // Fallback to one-time getDoc
            getDoc(doc(db, 'users', fbUser.uid, 'userConfig', 'apiKeys')).then((keysSnap) => {
              if (keysSnap.exists()) {
                setApiKeys({ ...defaultKeys, ...(keysSnap.data() as ApiKeysConfig) });
              } else {
                setApiKeys(defaultKeys);
              }
            }).catch(() => {
              setApiKeys(defaultKeys);
            });
          }
        );

        const origUnsub = unsubscribeKeys;
        unsubscribeKeys = () => {
          origUnsub();
        };

      } else {
        setCurrentUser(null);
        setSavedItems([]);
        setMinedItems([]);
        setDailyMineCount(0);
        setApiKeys({});
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeKeys) {
        unsubscribeKeys();
      }
    };
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
  const handleSaveProduct = async (
    product: ScrapedProduct,
    variations: GeminiCopyVariation[],
    selectedIndex: number
  ) => {
    const newItem: SavedHistoryItem = {
      id: 'saved_' + Date.now(),
      product,
      variations,
      selectedCopyIndex: selectedIndex,
      createdAt: new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }),
    };

    setSavedItems((prev) => [newItem, ...prev]);

    if (currentUser?.id) {
      // 1. Salvar no histórico pessoal do usuário (comportamento existente)
      try {
        await setDoc(doc(db, 'users', currentUser.id, 'savedProducts', newItem.id), newItem);
      } catch (e) {
        console.error('Erro ao salvar produto no Firestore:', e);
      }

      // 2. Verificar limite diário antes de inserir no marketplace
      try {
        const { allowed, current, limit } = await checkMiningLimit(currentUser.id);

        if (!allowed) {
          console.warn(`[Marketplace] Limite diário atingido (${current}/${limit}). Produto salvo apenas no histórico pessoal.`);
          // Não bloqueia o salvamento pessoal — apenas não insere no marketplace
          return;
        }

        // 3. Upsert no Marketplace Global
        const result = await upsertToMarketplace(currentUser.id, product);
        console.log(
          `[Marketplace] Produto ${result.isNew ? 'criado' : 'atualizado'} no marketplace. ID: ${result.globalId}` +
          (result.priceChanged ? ' (preço atualizado)' : '')
        );

        // 4. Incrementar contador diário
        await incrementDailyMineCount(currentUser.id);
        setDailyMineCount((prev) => prev + 1);

        // 5. Recarregar a lista de produtos minerados localmente
        const minedSnap = await getDocs(
          query(
            collection(db, 'users', currentUser.id, 'minedProducts'),
            orderBy('minedAt', 'desc')
          )
        );
        setMinedItems(minedSnap.docs.map((d) => d.data() as MinedProductRef));

      } catch (e) {
        // Falha no marketplace NÃO deve bloquear o fluxo principal
        console.error('[Marketplace] Erro ao sincronizar com marketplace global:', e);
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

  // Loading indicator for Mercado Livre OAuth exchange
  if (oauthExchanging) {
    return (
      <div className="min-h-screen bg-stone-950 flex flex-col items-center justify-center p-4 text-stone-100 space-y-4 text-center">
        <Loader2 className="w-10 h-10 text-amber-400 animate-spin" />
        <h3 className="text-lg font-bold text-white">Vinculando sua conta do Mercado Livre...</h3>
        <p className="text-xs text-stone-400 max-w-sm">
          Aguarde um instante enquanto nosso servidor realiza a autenticação oficial e gera as suas chaves de acesso automáticas de afiliados.
        </p>
      </div>
    );
  }

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
        minedCount={minedItems.length}
        dailyMineCount={dailyMineCount}
        dailyMineLimit={PLAN_LIMITS.free}
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
                {activeTab === 'saved-products' && 'Histórico Pessoal'}
                {activeTab === 'marketplace' && 'Marketplace Global'}
                {activeTab === 'my-products' && 'Meus Minerados'}
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
          {oauthSuccess && (
            <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
                <span>Parabéns! Sua conta do Mercado Livre foi vinculada oficialmente com sucesso. O token será renovado de forma totalmente automática a partir de agora!</span>
              </div>
              <button onClick={() => setOauthSuccess(false)} className="text-emerald-400 hover:text-white font-bold p-1">✕</button>
            </div>
          )}

          {oauthError && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl text-xs font-bold flex items-center justify-between gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="shrink-0 text-red-400 font-bold text-base">⚠️</span>
                <span>Erro ao vincular Mercado Livre: {oauthError} Certifique-se de que inseriu o App ID e Client Secret corretos e que configurou a URL de retorno no portal do desenvolvedor.</span>
              </div>
              <button onClick={() => setOauthError(null)} className="text-red-400 hover:text-white font-bold p-1">✕</button>
            </div>
          )}

          {activeTab === 'new-product' && (
            <NewProductTab
              onSaveProduct={handleSaveProduct}
              savedCount={savedItems.length}
              apiKeys={apiKeys}
              onSaveApiKeys={handleSaveApiKeys}
              uid={currentUser.id}
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

          {activeTab === 'marketplace' && (
            <MarketplaceTab currentUserId={currentUser?.id} />
          )}

          {activeTab === 'my-products' && (
            <MinedProductsTab
              uid={currentUser?.id || ''}
              dailyMineCount={dailyMineCount}
              dailyMineLimit={PLAN_LIMITS.free}
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
