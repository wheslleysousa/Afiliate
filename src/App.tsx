import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthModal } from './components/AuthModal';
import { Sidebar } from './components/Sidebar';
import { NewProductTab } from './components/NewProductTab';
import { SavedProductsTab } from './components/SavedProductsTab';
import { MarketplaceTab } from './components/MarketplaceTab';
import { MinedProductsTab } from './components/MinedProductsTab';
import { AnalyticsTab } from './components/AnalyticsTab';
import { SettingsTab } from './components/SettingsTab';
import { WhatsAppAutomationTab } from './components/WhatsAppAutomationTab';
import { TemplatesTab } from './components/TemplatesTab';
import { ExtensionTab } from './components/ExtensionTab';
import { TimezoneModal } from './components/TimezoneModal';
import { ApiDocsModal } from './components/ApiDocsModal';
import { DisclosureAlarmModal } from './components/DisclosureAlarmModal';
import { AppTab, UserProfile, SavedHistoryItem, ProductData, GeminiCopyVariation, ApiKeysConfig, ScrapedProduct, MinedProductRef, GlobalProduct, CommissionRatesConfig, CopyTemplate } from './types';
import { Sparkles, Menu, ShieldCheck, Zap, Loader2, PackageCheck, Globe, Clock } from 'lucide-react';
import {
  getSavedTimezone,
  saveTimezoneToStorage,
  getTimezoneInfo,
  formatCurrentTimeInTimezone
} from './utils/timezoneUtils';
import firebaseConfigJson from '../firebase-applet-config.json';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs, writeBatch, onSnapshot, query, orderBy } from 'firebase/firestore';
import {
  upsertToMarketplace,
  incrementDailyMineCount,
  checkMiningLimit,
  PLAN_LIMITS,
  getDailyMineCount,
  DEFAULT_COMMISSION_CONFIG,
} from './utils/marketplaceUtils';
import {
  getSharedProductsMap,
  toggleProductShared,
  markProductAsShared,
} from './utils/sharingLogUtils';
import {
  AlarmSettings,
  getAlarmSettings,
  saveAlarmSettings,
  shouldTriggerAlarm,
  playAlarmSound,
  sendBrowserNotification,
} from './utils/alarmUtils';

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

  // Commission Rates Config State
  const [commissionRates, setCommissionRates] = useState<CommissionRatesConfig>(DEFAULT_COMMISSION_CONFIG);

  // Custom Templates State
  const [customTemplates, setCustomTemplates] = useState<CopyTemplate[]>([]);
  const [defaultTemplateId, setDefaultTemplateId] = useState<string>('whatsapp-urgency');

  const handleSaveDefaultTemplateId = async (id: string) => {
    setDefaultTemplateId(id);
    if (currentUser?.id) {
      try {
        await setDoc(doc(db, 'users', currentUser.id, 'userConfig', 'templatesConfig'), { defaultTemplateId: id }, { merge: true });
      } catch (e) {
        console.error('Erro ao salvar template padrão no Firestore:', e);
      }
    }
  };

  // CRUD de Templates Personalizados no Firestore
  const handleAddCustomTemplate = async (template: CopyTemplate) => {
    if (!currentUser?.id) return;
    try {
      const docRef = doc(db, 'users', currentUser.id, 'templates', template.id);
      await setDoc(docRef, template);
    } catch (e) {
      console.error('Erro ao adicionar template no Firestore:', e);
    }
  };

  const handleDeleteCustomTemplate = async (templateId: string) => {
    // Atualização otimista imediata na interface
    setCustomTemplates((prev) => prev.filter((t) => t.id !== templateId));
    if (!currentUser?.id) return;
    try {
      const docRef = doc(db, 'users', currentUser.id, 'templates', templateId);
      await deleteDoc(docRef);
    } catch (e) {
      console.error('Erro ao excluir template no Firestore:', e);
    }
  };

  // Salvar Configurações de Comissões
  const handleSaveCommissionRates = async (updated: CommissionRatesConfig) => {
    setCommissionRates(updated);
    if (currentUser?.id) {
      try {
        await setDoc(doc(db, 'users', currentUser.id, 'userConfig', 'commissionRates'), updated);
      } catch (e) {
        console.error('Erro ao salvar taxas de comissão no Firestore:', e);
      }
    }
  };

  // Atualizar comissão de um produto específico (override manual)
  const handleUpdateProductCommission = async (productId: string, ratePct: number | null, amountVal: number | null) => {
    try {
      await updateDoc(doc(db, 'products', productId), {
        commission_rate: ratePct,
        commission_amount: amountVal,
      });
    } catch (e) {
      console.error('Erro ao atualizar comissão do produto no Firestore:', e);
    }
  };

  // Shared Products 24h State
  const [sharedMap, setSharedMap] = useState<Record<string, number>>(() => getSharedProductsMap());

  // Alarm & Lembretes State
  const [alarmSettings, setAlarmSettings] = useState<AlarmSettings>(() => getAlarmSettings());
  const [showAlarmModal, setShowAlarmModal] = useState<boolean>(false);

  // Timezone State
  const [currentTimezone, setCurrentTimezone] = useState<string>(() => getSavedTimezone());
  const [showTimezoneModal, setShowTimezoneModal] = useState<boolean>(false);
  const [currentTimeFormatted, setCurrentTimeFormatted] = useState<string>(() =>
    formatCurrentTimeInTimezone(getSavedTimezone())
  );

  // Relógio em tempo real do fuso horário
  useEffect(() => {
    const updateTicker = () => {
      setCurrentTimeFormatted(formatCurrentTimeInTimezone(currentTimezone));
    };
    updateTicker();
    const interval = setInterval(updateTicker, 1000);
    return () => clearInterval(interval);
  }, [currentTimezone]);

  const handleSelectTimezone = async (tzId: string) => {
    setCurrentTimezone(tzId);
    saveTimezoneToStorage(tzId);
    if (currentUser?.id) {
      try {
        await setDoc(doc(db, 'users', currentUser.id), { timezone: tzId }, { merge: true });
      } catch (e) {
        console.error('Erro ao atualizar fuso horário no Firestore:', e);
      }
    }
  };

  // Selected product to copy state
  const [selectedProductForCopy, setSelectedProductForCopy] = useState<GlobalProduct | null>(null);

  // Alternar Status de Divulgação 24h
  const handleToggleSharedProduct = (productId: string) => {
    const res = toggleProductShared(productId);
    setSharedMap(res.newMap);
  };

  // Salvar Configurações de Alarme
  const handleSaveAlarmSettings = (updated: AlarmSettings) => {
    setAlarmSettings(updated);
    saveAlarmSettings(updated);
  };

  // Ações de confirmação do Alarme
  const handleAlarmAction = (navigateToMyProducts: boolean) => {
    const now = Date.now();
    const updated = { ...alarmSettings, lastTriggeredAt: now };
    setAlarmSettings(updated);
    saveAlarmSettings(updated);
    setShowAlarmModal(false);
    if (navigateToMyProducts) {
      setActiveTab('my-products');
    }
  };

  // Loop em segundo plano para verificar disparo do alarme de divulgação
  useEffect(() => {
    const checkAlarmLoop = () => {
      if (shouldTriggerAlarm(alarmSettings)) {
        setShowAlarmModal(true);
        if (alarmSettings.soundEnabled) {
          playAlarmSound();
        }
        sendBrowserNotification(
          '⏰ HORA DE DIVULGAR NOVO PRODUTO!',
          `Lembrete programado de ${alarmSettings.intervalMinutes} minutos! Abra o app para divulgar uma oferta.`
        );
      }
    };

    // Verificar imediatamente e a cada 10 segundos
    checkAlarmLoop();
    const timer = setInterval(checkAlarmLoop, 10000);
    return () => clearInterval(timer);
  }, [alarmSettings]);

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

          let data: any; const contentType = res.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { data = await res.json(); } else { throw new Error("Resposta inválida (não-JSON) do servidor."); }
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
    let unsubscribeCommRates: (() => void) | null = null;
    let unsubscribeMined: (() => void) | null = null;
    let unsubscribeDailyStats: (() => void) | null = null;
    let unsubscribeTemplates: (() => void) | null = null;
    let unsubscribeDefaultTemplate: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (fbUser) => {
      // Clean up previous listeners if any
      if (unsubscribeKeys) {
        unsubscribeKeys();
        unsubscribeKeys = null;
      }
      if (unsubscribeCommRates) {
        unsubscribeCommRates();
        unsubscribeCommRates = null;
      }
      if (unsubscribeMined) {
        unsubscribeMined();
        unsubscribeMined = null;
      }
      if (unsubscribeDailyStats) {
        unsubscribeDailyStats();
        unsubscribeDailyStats = null;
      }
      if (unsubscribeTemplates) {
        unsubscribeTemplates();
        unsubscribeTemplates = null;
      }
      if (unsubscribeDefaultTemplate) {
        unsubscribeDefaultTemplate();
        unsubscribeDefaultTemplate = null;
      }

      if (fbUser) {
        // Fetch user profile from Firestore
        let userDocData: any = null;
        try {
          const uSnap = await getDoc(doc(db, 'users', fbUser.uid));
          if (uSnap.exists()) {
            userDocData = uSnap.data();
            if (userDocData?.timezone) {
              setCurrentTimezone(userDocData.timezone);
              saveTimezoneToStorage(userDocData.timezone);
            }
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

        // 1. Escutar minedProducts em tempo real
        try {
          const minedQuery = query(
            collection(db, 'users', fbUser.uid, 'minedProducts'),
            orderBy('minedAt', 'desc')
          );
          unsubscribeMined = onSnapshot(
            minedQuery,
            (snap) => {
              setMinedItems(snap.docs.map((d) => d.data() as MinedProductRef));
            },
            (err) => {
              console.error('Erro ao escutar minedProducts em tempo real:', err);
            }
          );
        } catch (e) {
          console.error('Erro ao iniciar listener de minedProducts:', e);
        }

        // 2. Escutar contador de mineração de HOJE em tempo real
        const todayStr = new Date().toISOString().slice(0, 10);
        try {
          unsubscribeDailyStats = onSnapshot(
            doc(db, 'users', fbUser.uid, 'dailyStats', todayStr),
            (snap) => {
              if (snap.exists()) {
                setDailyMineCount((snap.data().count as number) || 0);
              } else {
                setDailyMineCount(0);
              }
            },
            (err) => {
              console.error('Erro ao escutar dailyStats em tempo real:', err);
            }
          );
        } catch (e) {
          console.error('Erro ao iniciar listener de dailyStats:', e);
        }

        // 3. Set up real-time listener for user API Keys config from Firestore
        const defaultKeys = {
          mercadoLivreAppId: '1096973158666349',
          mercadoLivreClientSecret: '5YoWCSRNr90KiVumj0tf35NGkpOAbops',
        };

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

        // 4. Set up real-time listener for user Commission Rates config from Firestore
        unsubscribeCommRates = onSnapshot(
          doc(db, 'users', fbUser.uid, 'userConfig', 'commissionRates'),
          (snapshot) => {
            if (snapshot.exists()) {
              setCommissionRates(snapshot.data() as CommissionRatesConfig);
            } else {
              setCommissionRates(DEFAULT_COMMISSION_CONFIG);
            }
          },
          (err) => {
            console.error('Erro ao escutar taxas de comissão no Firestore:', err);
          }
        );

        // 5. Set up real-time listener for user Copy Templates from Firestore users/{uid}/templates
        try {
          unsubscribeTemplates = onSnapshot(
            collection(db, 'users', fbUser.uid, 'templates'),
            (snapshot) => {
              const temps: CopyTemplate[] = [];
              snapshot.forEach((docSnap) => {
                temps.push({ id: docSnap.id, ...docSnap.data() } as CopyTemplate);
              });
              setCustomTemplates(temps);
            },
            (err) => {
              console.error('Erro ao escutar templates do usuário no Firestore:', err);
            }
          );
        } catch (e) {
          console.error('Erro ao iniciar listener de templates personalizados:', e);
        }

        // 5.5. Set up real-time listener for defaultTemplateId from Firestore
        try {
          unsubscribeDefaultTemplate = onSnapshot(
            doc(db, 'users', fbUser.uid, 'userConfig', 'templatesConfig'),
            (snapshot) => {
              if (snapshot.exists()) {
                const data = snapshot.data();
                if (data?.defaultTemplateId) {
                  setDefaultTemplateId(data.defaultTemplateId);
                }
              }
            },
            (err) => {
              console.error('Erro ao escutar template padrão no Firestore:', err);
            }
          );
        } catch (e) {
          console.error('Erro ao iniciar listener de template padrão:', e);
        }

      } else {
        setCurrentUser(null);
        setSavedItems([]);
        setMinedItems([]);
        setDailyMineCount(0);
        setApiKeys({});
        setCommissionRates(DEFAULT_COMMISSION_CONFIG);
        setCustomTemplates([]);
        setDefaultTemplateId('whatsapp-urgency');
      }
      setAuthLoading(false);
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeKeys) unsubscribeKeys();
      if (unsubscribeCommRates) unsubscribeCommRates();
      if (unsubscribeMined) unsubscribeMined();
      if (unsubscribeDailyStats) unsubscribeDailyStats();
      if (unsubscribeTemplates) unsubscribeTemplates();
      if (unsubscribeDefaultTemplate) unsubscribeDefaultTemplate();
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
      <ThemeProvider>
        <div className="min-h-screen bg-black flex flex-col items-center justify-center p-4 text-white space-y-3">
          <div className="p-3 rounded-2xl bg-blue-600/15 border border-blue-500/30 shadow-lg shadow-blue-600/10">
            <Loader2 className="w-7 h-7 text-blue-400 animate-spin" />
          </div>
          <p className="text-xs font-bold text-stone-200 tracking-wider uppercase">Carregando dados</p>
        </div>
      </ThemeProvider>
    );
  }

  const handleUseProduct = (product: GlobalProduct) => {
    setSelectedProductForCopy(product);
    setActiveTab('new-product');
  };

  // If user is not logged in, show Auth Screen
  if (!currentUser) {
    return (
      <ThemeProvider>
        <AuthModal onLoginSuccess={handleLoginSuccess} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-[#07090f] text-[#eef2f9] font-sans selection:bg-blue-600 selection:text-white flex flex-col md:flex-row">
      
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
        <header className="h-16 px-4 sm:px-6 border-b border-[#1e2636] bg-[#0e1119]/90 backdrop-blur-md sticky top-0 z-30 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger Menu Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#151a26] hover:bg-stone-800 text-stone-200 border border-[#1e2636]"
              aria-label="Abrir menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#93a0b5] uppercase tracking-wider hidden sm:inline">
                Painel do Afiliado /
              </span>
              <span className="text-xs sm:text-sm font-extrabold text-white">
                {activeTab === 'new-product' && 'Novo Produto'}
                {activeTab === 'marketplace' && 'Marketplace Global'}
                {activeTab === 'my-products' && 'Meus Produtos'}
                {activeTab === 'analytics' && 'Analytics de Afiliado'}
                {activeTab === 'whatsapp-auto' && 'Automação Zap'}
                {activeTab === 'templates' && 'Templates de Copy'}
                {activeTab === 'settings' && 'Configurações'}
                {activeTab === 'api-docs' && 'Documentação API'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Interactive Timezone Selector Badge */}
            <button
              onClick={() => setShowTimezoneModal(true)}
              title="Clique para alterar o fuso horário"
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-[#151a26] hover:bg-[#1f2738] border border-[#1e2636] hover:border-blue-500/40 text-[#eef2f9] transition-all cursor-pointer font-medium"
            >
              <Globe className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-bold">{getTimezoneInfo(currentTimezone).flag} {getTimezoneInfo(currentTimezone).offset}</span>
              <span className="text-[10px] font-mono text-emerald-400 font-bold hidden sm:inline">
                {currentTimeFormatted}
              </span>
            </button>

            {/* Daily Mine Counter Badge */}
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              dailyMineCount >= PLAN_LIMITS.free
                ? 'bg-red-500/15 border-red-500/30 text-red-400 font-semibold'
                : 'bg-[#151a26] border-[#1e2636] text-[#eef2f9] font-medium'
            }`}>
              <PackageCheck className="w-3.5 h-3.5 text-[#93a0b5]" />
              <span>{dailyMineCount}/{PLAN_LIMITS.free} hoje</span>
            </div>

            <div className="hidden sm:flex items-center gap-2 bg-[#07090f] px-3 py-1.5 rounded-full border border-[#1e2636] text-xs text-[#eef2f9]">
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
              selectedProductForCopy={selectedProductForCopy}
              commissionRates={commissionRates}
              customTemplates={customTemplates}
              onAddCustomTemplate={handleAddCustomTemplate}
              onDeleteCustomTemplate={handleDeleteCustomTemplate}
              defaultTemplateId={defaultTemplateId}
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
            <MarketplaceTab
              currentUserId={currentUser?.id}
              apiKeys={apiKeys}
              commissionRates={commissionRates}
              sharedMap={sharedMap}
              onToggleShared={handleToggleSharedProduct}
              onUseProduct={handleUseProduct}
              onUpdateProductCommission={handleUpdateProductCommission}
              onNavigateToSettings={() => setActiveTab('settings')}
              onNavigateToMyProducts={() => setActiveTab('my-products')}
              onAddCustomTemplate={handleAddCustomTemplate}
              userMinedIds={new Set(minedItems.map((m) => m.productId))}
              customTemplates={customTemplates}
              defaultTemplateId={defaultTemplateId}
            />
          )}

          {activeTab === 'my-products' && (
            <MinedProductsTab
              uid={currentUser?.id || ''}
              dailyMineCount={dailyMineCount}
              dailyMineLimit={PLAN_LIMITS.free}
              apiKeys={apiKeys}
              commissionRates={commissionRates}
              sharedMap={sharedMap}
              onToggleShared={handleToggleSharedProduct}
              onUseProduct={handleUseProduct}
              onUpdateProductCommission={handleUpdateProductCommission}
              onAddCustomTemplate={handleAddCustomTemplate}
              customTemplates={customTemplates}
              defaultTemplateId={defaultTemplateId}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              currentUserId={currentUser?.id}
              minedProducts={minedItems.map((m) => m.productData).filter(Boolean) as GlobalProduct[]}
              apiKeys={apiKeys}
              commissionRates={commissionRates}
            />
          )}

          {activeTab === 'whatsapp-auto' && currentUser && (
            <WhatsAppAutomationTab
              uid={currentUser.id}
              apiKeys={apiKeys}
              customTemplates={customTemplates}
              defaultTemplateId={defaultTemplateId}
            />
          )}

          {activeTab === 'templates' && (
            <TemplatesTab
              customTemplates={customTemplates}
              onAddCustomTemplate={handleAddCustomTemplate}
              onDeleteCustomTemplate={handleDeleteCustomTemplate}
              apiKeys={apiKeys}
              defaultTemplateId={defaultTemplateId}
              onSaveDefaultTemplateId={handleSaveDefaultTemplateId}
            />
          )}

          {activeTab === 'extension' && <ExtensionTab />}

          {activeTab === 'settings' && (
            <SettingsTab
              user={currentUser}
              apiKeys={apiKeys}
              alarmSettings={alarmSettings}
              commissionRates={commissionRates}
              currentTimezone={currentTimezone}
              onOpenTimezoneModal={() => setShowTimezoneModal(true)}
              onSaveAlarmSettings={handleSaveAlarmSettings}
              onSaveApiKeys={handleSaveApiKeys}
              onSaveCommissionRates={handleSaveCommissionRates}
              onUpdateProfile={handleUpdateProfile}
            />
          )}

          {activeTab === 'api-docs' && <ApiDocsModal />}
        </main>

        {/* Modal de Alarme / Lembrete de Divulgação */}
        {showAlarmModal && (
          <DisclosureAlarmModal
            alarmSettings={alarmSettings}
            onAcknowledge={() => handleAlarmAction(true)}
            onSnooze={() => handleAlarmAction(false)}
          />
        )}

        {/* Modal de Seleção de Fuso Horário */}
        {showTimezoneModal && (
          <TimezoneModal
            currentTimezone={currentTimezone}
            onSelectTimezone={handleSelectTimezone}
            onClose={() => setShowTimezoneModal(false)}
          />
        )}

        {/* Footer */}
        <footer className="border-t border-[#1e2636] bg-[#07090f] py-5 text-center text-xs text-[#93a0b5] mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex items-center justify-center">
            <div className="flex items-center gap-2">
              <span className="font-bold text-stone-200">Afiliate</span>
              <span>© {new Date().getFullYear()} — Todos os direitos reservados.</span>
            </div>
          </div>
        </footer>

      </div>
    </div>
  </ThemeProvider>
);
}
