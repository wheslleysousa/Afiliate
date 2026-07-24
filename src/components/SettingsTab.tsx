import React, { useState } from 'react';
import { ApiKeysConfig, UserProfile } from '../types';
import { Settings, User, Check, Save, ShieldCheck, Sparkles, Key, Info, Plus, Trash2, CheckCircle2, AlertCircle, Loader2, ExternalLink, HelpCircle } from 'lucide-react';

interface SettingsTabProps {
  user: UserProfile;
  apiKeys: ApiKeysConfig;
  onSaveApiKeys: (keys: ApiKeysConfig) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

type ProviderType = 'mercadolivre' | 'shopee' | 'amazon' | 'aliexpress' | 'shein' | 'gemini';

interface ProviderInfo {
  id: ProviderType;
  name: string;
  badge: string;
  description: string;
  guideUrl?: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'mercadolivre',
    name: 'Mercado Livre',
    badge: 'Foco Principal',
    description: 'Extração automática de título, preços, fotos e parcelamento de links do Mercado Livre.',
    guideUrl: 'https://developers.mercadolibre.com.br/',
  },
  {
    id: 'shopee',
    name: 'Shopee Afiliados',
    badge: 'Popular',
    description: 'Chave de API oficial do programa de afiliados Shopee para rastreamento de ofertas.',
    guideUrl: 'https://affiliate.shopee.com.br/',
  },
  {
    id: 'amazon',
    name: 'Amazon Associados',
    badge: 'E-commerce',
    description: 'Tag de rastreamento do programa Amazon Associados para geração automática de links de comissão.',
    guideUrl: 'https://associados.amazon.com.br/',
  },
  {
    id: 'aliexpress',
    name: 'AliExpress Portals',
    badge: 'Internacional',
    description: 'App Key / App Secret do portal de afiliados AliExpress.',
    guideUrl: 'https://portals.aliexpress.com/',
  },
  {
    id: 'shein',
    name: 'Shein Publisher',
    badge: 'Moda',
    description: 'Token do programa de parceiros e afiliados Shein.',
    guideUrl: 'https://www.shein.com/',
  },
  {
    id: 'gemini',
    name: 'Gemini IA Customizada',
    badge: 'Inteligência Artificial',
    description: 'Sua chave de API pessoal do Google AI Studio para geração das copies de vendas.',
    guideUrl: 'https://aistudio.google.com/',
  },
];

export const SettingsTab: React.FC<SettingsTabProps> = ({
  user,
  apiKeys,
  onSaveApiKeys,
  onUpdateProfile,
}) => {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<ProviderType>('mercadolivre');
  
  // Guide Modal State for ML
  const [showMlHelpModal, setShowMlHelpModal] = useState(false);

  // Form State for Key Editing
  const [keysForm, setKeysForm] = useState<ApiKeysConfig>({
    mercadoLivreAppId: apiKeys.mercadoLivreAppId || '',
    mercadoLivreClientSecret: apiKeys.mercadoLivreClientSecret || '',
    mercadoLivreKey: apiKeys.mercadoLivreKey || '',
    shopeeKey: apiKeys.shopeeKey || '',
    amazonKey: apiKeys.amazonKey || '',
    aliExpressKey: apiKeys.aliExpressKey || '',
    sheinKey: apiKeys.sheinKey || '',
    geminiApiKey: apiKeys.geminiApiKey || '',
  });

  // Testing State
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestAndSave = async () => {
    setIsTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/test-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          keys: keysForm,
        }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setTestResult({ success: true, message: data.message || 'API validada com sucesso!' });
        
        // Save to parent state and Firestore
        onSaveApiKeys(keysForm);
        setSavedSuccess(`Chave do ${PROVIDERS.find(p => p.id === selectedProvider)?.name} testada e salva com sucesso!`);
        
        setTimeout(() => {
          setIsModalOpen(false);
          setTestResult(null);
        }, 1500);
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha ao validar credenciais. Verifique os dados e tente novamente.',
        });
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: 'Erro de conexão ao testar API: ' + (err.message || 'Falha de rede'),
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleRemoveKey = (provider: ProviderType) => {
    const updated = { ...keysForm };
    if (provider === 'mercadolivre') {
      updated.mercadoLivreAppId = '';
      updated.mercadoLivreClientSecret = '';
      updated.mercadoLivreKey = '';
    } else if (provider === 'shopee') {
      updated.shopeeKey = '';
    } else if (provider === 'amazon') {
      updated.amazonKey = '';
    } else if (provider === 'aliexpress') {
      updated.aliExpressKey = '';
    } else if (provider === 'shein') {
      updated.sheinKey = '';
    } else if (provider === 'gemini') {
      updated.geminiApiKey = '';
    }

    setKeysForm(updated);
    onSaveApiKeys(updated);
    setSavedSuccess(`Integração do ${PROVIDERS.find(p => p.id === provider)?.name} removida.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ name, email });
    setSavedSuccess('Dados do perfil atualizados com sucesso!');
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const isConfigured = (provider: ProviderType): boolean => {
    if (provider === 'mercadolivre') {
      return !!(keysForm.mercadoLivreAppId || keysForm.mercadoLivreKey);
    }
    if (provider === 'shopee') return !!keysForm.shopeeKey;
    if (provider === 'amazon') return !!keysForm.amazonKey;
    if (provider === 'aliexpress') return !!keysForm.aliExpressKey;
    if (provider === 'shein') return !!keysForm.sheinKey;
    if (provider === 'gemini') return !!keysForm.geminiApiKey;
    return false;
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      
      {/* Header */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Configurações & Integrações com APIs</h2>
            <p className="text-xs text-stone-400">
              Gerencie suas credenciais salvas no seu banco de dados pessoal do Firebase
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="px-3 py-2 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-2 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>{savedSuccess}</span>
          </div>
        )}
      </div>

      {/* User Profile Section */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-stone-800 pb-3">
          <User className="w-4 h-4 text-emerald-400" />
          <span>Dados do Perfil</span>
        </h3>

        <form onSubmit={handleSaveProfile} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">Nome Completo</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-stone-300 block mb-1">E-mail Cadastrado</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="sm:col-span-2 flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Atualizar Perfil</span>
            </button>
          </div>
        </form>
      </div>

      {/* API Integrations Manager */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="border-b border-stone-800 pb-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Conexões de API & Redes de Afiliados</span>
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Adicione e valide as chaves de API das suas contas para extração automática e geração de links
            </p>
          </div>

          <button
            onClick={() => {
              setTestResult(null);
              setIsModalOpen(true);
            }}
            className="px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar / Configurar API</span>
          </button>
        </div>

        {/* Mercado Livre Special Guidance Alert */}
        <div className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg shrink-0 mt-0.5 sm:mt-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-amber-400">Como obter as credenciais do Mercado Livre?</h4>
              <p className="text-[11px] text-stone-300 mt-0.5">
                Saiba exatamente onde encontrar o <strong>App ID</strong>, <strong>Client Secret</strong> e o <strong>Access Token</strong> no painel de desenvolvedor do Mercado Livre.
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowMlHelpModal(true)}
            className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Ver Passo a Passo</span>
          </button>
        </div>

        {/* Grid of Active Integrations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {PROVIDERS.map((provider) => {
            const configured = isConfigured(provider.id);

            return (
              <div
                key={provider.id}
                className={`p-4 rounded-xl border transition-all ${
                  configured
                    ? 'bg-stone-950/80 border-emerald-500/40 shadow-lg shadow-emerald-950/10'
                    : 'bg-stone-950/40 border-stone-800'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-white">{provider.name}</span>
                    <span className="text-[10px] bg-stone-800 text-stone-400 px-2 py-0.5 rounded border border-stone-700">
                      {provider.badge}
                    </span>
                  </div>

                  {configured ? (
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Ativo</span>
                    </span>
                  ) : (
                    <span className="text-[10px] bg-stone-800/80 text-stone-500 px-2 py-0.5 rounded">
                      Não configurado
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-stone-400 mb-3">{provider.description}</p>

                <div className="flex items-center justify-between pt-2 border-t border-stone-800/80 text-xs">
                  {configured ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedProvider(provider.id);
                          setTestResult(null);
                          setIsModalOpen(true);
                        }}
                        className="text-amber-400 hover:text-amber-300 font-semibold text-[11px] underline"
                      >
                        Editar Credenciais
                      </button>
                      <button
                        onClick={() => handleRemoveKey(provider.id)}
                        className="text-red-400 hover:text-red-300 p-1 hover:bg-red-950/30 rounded"
                        title="Remover chave"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedProvider(provider.id);
                        setTestResult(null);
                        setIsModalOpen(true);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold text-[11px] flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Configurar Agora</span>
                    </button>
                  )}

                  {provider.guideUrl && (
                    <a
                      href={provider.guideUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-stone-500 hover:text-stone-300 text-[10px] flex items-center gap-0.5"
                    >
                      <span>Documentação</span>
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: Adicionar / Editar Credenciais de API com Validação por Teste */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-scaleIn">
            
            {/* Modal Title */}
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Configurar Integração de API</h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            {/* Provider Selector */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1.5">Selecione o Provedor / Plataforma</label>
              <select
                value={selectedProvider}
                onChange={(e) => {
                  setSelectedProvider(e.target.value as ProviderType);
                  setTestResult(null);
                }}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-semibold focus:outline-none focus:border-emerald-500"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.badge})
                  </option>
                ))}
              </select>
            </div>

            {/* Dynamic Provider Form */}
            <div className="bg-stone-950 border border-stone-800/80 rounded-xl p-4 space-y-4">
              
              {/* Mercado Livre Form */}
              {selectedProvider === 'mercadolivre' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400">Credenciais Mercado Livre Developers</span>
                    <button
                      type="button"
                      onClick={() => setShowMlHelpModal(true)}
                      className="text-[10px] text-amber-300 underline flex items-center gap-1"
                    >
                      <Info className="w-3 h-3" />
                      <span>Onde encontrar?</span>
                    </button>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-300 block mb-1">App ID (Client ID)</label>
                    <input
                      type="text"
                      placeholder="Ex: 847392019284..."
                      value={keysForm.mercadoLivreAppId || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, mercadoLivreAppId: e.target.value })}
                      className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-stone-500 block mt-1">ID da sua aplicação no portal Developers Mercado Libre</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-300 block mb-1">Chave Secreta (Client Secret)</label>
                    <input
                      type="password"
                      placeholder="Ex: 3xAmPlE_S3cr3t_K3y..."
                      value={keysForm.mercadoLivreClientSecret || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, mercadoLivreClientSecret: e.target.value })}
                      className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-stone-500 block mt-1">Client Secret da sua aplicação</span>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-stone-300 block mb-1">Access Token / Bearer Token (Opcional)</label>
                    <input
                      type="password"
                      placeholder="Ex: APP_USR-847392019284..."
                      value={keysForm.mercadoLivreKey || ''}
                      onChange={(e) => setKeysForm({ ...keysForm, mercadoLivreKey: e.target.value })}
                      className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-[10px] text-stone-500 block mt-1">Se preenchido o App ID + Client Secret, o token pode ser renovado automaticamente.</span>
                  </div>
                </div>
              )}

              {/* Shopee Form */}
              {selectedProvider === 'shopee' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-300 block mb-1">Shopee Affiliate API Key / Secret</label>
                  <input
                    type="password"
                    placeholder="Ex: shopee_aff_sec_..."
                    value={keysForm.shopeeKey || ''}
                    onChange={(e) => setKeysForm({ ...keysForm, shopeeKey: e.target.value })}
                    className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-500 block mt-1">Chave do portal Shopee Affiliate</span>
                </div>
              )}

              {/* Amazon Form */}
              {selectedProvider === 'amazon' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-300 block mb-1">Amazon Associates Tracking Tag</label>
                  <input
                    type="text"
                    placeholder="Ex: suatag-20"
                    value={keysForm.amazonKey || ''}
                    onChange={(e) => setKeysForm({ ...keysForm, amazonKey: e.target.value })}
                    className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-500 block mt-1">ID de Associados Amazon (Ex: tag=seunome-20)</span>
                </div>
              )}

              {/* AliExpress Form */}
              {selectedProvider === 'aliexpress' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-300 block mb-1">AliExpress App Key / Secret</label>
                  <input
                    type="password"
                    placeholder="Ex: ali_app_key_..."
                    value={keysForm.aliExpressKey || ''}
                    onChange={(e) => setKeysForm({ ...keysForm, aliExpressKey: e.target.value })}
                    className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-500 block mt-1">Chave do portal AliExpress Portals</span>
                </div>
              )}

              {/* Shein Form */}
              {selectedProvider === 'shein' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-300 block mb-1">Shein Publisher Token</label>
                  <input
                    type="password"
                    placeholder="Ex: shein_tok_..."
                    value={keysForm.sheinKey || ''}
                    onChange={(e) => setKeysForm({ ...keysForm, sheinKey: e.target.value })}
                    className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-500 block mt-1">Token de Publisher do programa Shein</span>
                </div>
              )}

              {/* Gemini Form */}
              {selectedProvider === 'gemini' && (
                <div>
                  <label className="text-[11px] font-semibold text-stone-300 block mb-1">Chave de API do Gemini (Google AI Studio)</label>
                  <input
                    type="password"
                    placeholder="Ex: AIzaSy..."
                    value={keysForm.geminiApiKey || ''}
                    onChange={(e) => setKeysForm({ ...keysForm, geminiApiKey: e.target.value })}
                    className="w-full p-2.5 bg-stone-900 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[10px] text-stone-500 block mt-1">Chave gerada no aistudio.google.com</span>
                </div>
              )}

            </div>

            {/* Test Feedback Result */}
            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 animate-fadeIn ${
                  testResult.success
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-red-500/10 border-red-500/40 text-red-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-semibold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={handleTestAndSave}
                disabled={isTesting}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50"
              >
                {isTesting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Testando Conexão...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>Testar e Salvar no Firebase</span>
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Help Modal: Passo a passo do Mercado Livre */}
      {showMlHelpModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto text-stone-200">
            
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <HelpCircle className="w-5 h-5" />
                <span>Onde conseguir as credenciais do Mercado Livre?</span>
              </div>
              <button
                onClick={() => setShowMlHelpModal(false)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-stone-300">
              <p>
                Para integrar a API oficial do Mercado Livre ao seu aplicativo de afiliados, siga estes passos simples:
              </p>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                <h5 className="font-bold text-amber-400 flex items-center gap-1.5">
                  <span>1. ID do Aplicativo (App ID) e Chave Secreta (Client Secret)</span>
                </h5>
                <ol className="list-decimal list-inside space-y-1 text-stone-400 pl-1">
                  <li>Acesse o portal oficial: <a href="https://developers.mercadolibre.com.br/" target="_blank" rel="noreferrer" className="text-amber-300 underline font-semibold">developers.mercadolibre.com.br</a>.</li>
                  <li>Faça login com a sua conta do Mercado Livre.</li>
                  <li>No menu superior, clique em <strong>"Meus Aplicativos"</strong> e selecione <strong>"Criar um novo aplicativo"</strong>.</li>
                  <li>Preencha o nome do app e escolha a área (ex: Integradora / Vendas / Afiliados).</li>
                  <li>Após criar, o sistema gera o <strong>App ID (Client ID)</strong> e o <strong>Client Secret</strong>. Copie e cole aqui nas Configurações!</li>
                </ol>
              </div>

              <div className="bg-stone-950 p-3 rounded-xl border border-stone-800 space-y-2">
                <h5 className="font-bold text-emerald-400 flex items-center gap-1.5">
                  <span>2. Access Token (Bearer Token)</span>
                </h5>
                <p className="text-stone-400">
                  O <strong>Access Token</strong> (`APP_USR-...`) é a permissão de acesso gerada via OAuth.
                </p>
                <ul className="list-disc list-inside space-y-1 text-stone-400 pl-1">
                  <li><strong>Automático:</strong> Se você preencher o <strong>App ID</strong> e o <strong>Client Secret</strong>, nosso servidor tentará obter e renovar o token automaticamente!</li>
                  <li><strong>Manual:</strong> No painel do Mercado Livre Developers, você também pode ir em <i>"Autenticação e Autorização"</i> e clicar em <strong>"Gerar Token de Teste"</strong> para copiar seu token diretamente.</li>
                </ul>
              </div>

              <div className="bg-emerald-950/20 border border-emerald-500/30 p-3 rounded-xl text-emerald-300 text-[11px] font-medium">
                ✅ O teste integrado no botão "Testar e Salvar no Firebase" verifica na hora se as credenciais estão válidas enviando uma requisição aos servidores do Mercado Livre!
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-stone-800">
              <button
                onClick={() => setShowMlHelpModal(false)}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-stone-950 font-bold text-xs rounded-xl transition-all"
              >
                Entendi, voltar para as Configurações
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
