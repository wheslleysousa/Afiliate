import React, { useState } from 'react';
import { ApiKeysConfig, UserProfile } from '../types';
import { getMlRedirectUri } from '../App';
import { 
  Settings, 
  User, 
  Check, 
  Save, 
  ShieldCheck, 
  Sparkles, 
  Key, 
  Info, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink, 
  HelpCircle,
  Copy,
  CheckCheck,
  Building,
  AlertTriangle,
  X
} from 'lucide-react';

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
  colorClass: string;
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini IA',
    badge: 'Chaves de API',
    description: 'Adicione suas chaves gratuitas do Google AI Studio para geração automatizada de copys com inteligência artificial.',
    guideUrl: 'https://aistudio.google.com/app/apikey',
    colorClass: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400',
  },
  {
    id: 'mercadolivre',
    name: 'Mercado Livre',
    badge: 'Conexão por 1 Clique',
    description: 'Sincronização oficial via OAuth para extração automática de títulos, fotos, preços e parcelas.',
    guideUrl: 'https://developers.mercadolibre.com.br/',
    colorClass: 'border-amber-500/30 bg-amber-500/5 text-amber-400',
  },
  {
    id: 'shopee',
    name: 'Shopee Afiliados',
    badge: 'API / Tag',
    description: 'Integração de ofertas e redirecionamento de links de comissão para a Shopee.',
    guideUrl: 'https://affiliate.shopee.com.br/',
    colorClass: 'border-orange-500/30 bg-orange-500/5 text-orange-400',
  },
  {
    id: 'amazon',
    name: 'Amazon Associados',
    badge: 'Tag de Rastreamento',
    description: 'Insira sua Tag de Associado Amazon para gerar automaticamente links comissionados.',
    guideUrl: 'https://associados.amazon.com.br/',
    colorClass: 'border-yellow-500/30 bg-yellow-500/5 text-yellow-400',
  },
  {
    id: 'aliexpress',
    name: 'AliExpress Portals',
    badge: 'API Key',
    description: 'Rastreamento de promoções e comissão oficial de vendas do AliExpress.',
    guideUrl: 'https://portals.aliexpress.com/',
    colorClass: 'border-red-500/30 bg-red-500/5 text-red-400',
  },
  {
    id: 'shein',
    name: 'Shein Publisher',
    badge: 'Token / ID',
    description: 'Ative seu token de parceiro Shein para lucrar promovendo peças de moda.',
    guideUrl: 'https://www.shein.com/',
    colorClass: 'border-stone-500/30 bg-stone-500/5 text-stone-300',
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
  const [oauthOpened, setOauthOpened] = useState(false);

  // Dynamic values
  const redirectUri = getMlRedirectUri();
  const [copiedRedirect, setCopiedRedirect] = useState(false);

  // Dynamic explanation modals
  const [activeOAuthModal, setActiveOAuthModal] = useState<string | null>(null);

  // Inline Manual Edit Form State
  const [editingProvider, setEditingProvider] = useState<ProviderType | null>(null);
  const [tempManualValue, setTempManualValue] = useState('');

  // Gemini Multi-Key Management State
  const [newGeminiKey, setNewGeminiKey] = useState('');
  const [validatingKeyIndex, setValidatingKeyIndex] = useState<number | 'new' | null>(null);
  const [geminiValidationMsg, setGeminiValidationMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Normalized Gemini Keys List
  const geminiKeysList: string[] = Array.isArray(apiKeys.geminiApiKeys) && apiKeys.geminiApiKeys.length > 0
    ? apiKeys.geminiApiKeys
    : apiKeys.geminiApiKey ? [apiKeys.geminiApiKey] : [];

  // Add and validate new Gemini Key
  const handleAddAndValidateNewGeminiKey = async () => {
    if (!newGeminiKey.trim()) {
      setGeminiValidationMsg({ type: 'error', text: 'Por favor, insira uma chave de API do Gemini.' });
      return;
    }

    const cleanKey = newGeminiKey.trim();

    if (geminiKeysList.includes(cleanKey)) {
      setGeminiValidationMsg({ type: 'error', text: 'Esta chave de API do Gemini já está cadastrada na sua lista.' });
      return;
    }

    setValidatingKeyIndex('new');
    setGeminiValidationMsg(null);

    try {
      const res = await fetch('/api/gemini/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: cleanKey })
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        const updatedList = [...geminiKeysList, cleanKey];
        const newConfig: ApiKeysConfig = {
          ...apiKeys,
          geminiApiKey: updatedList[0],
          geminiApiKeys: updatedList,
        };

        onSaveApiKeys(newConfig);
        setNewGeminiKey('');
        setGeminiValidationMsg({
          type: 'success',
          text: `Chave ${updatedList.length} testada com sucesso e salva automaticamente!`
        });
        setTimeout(() => setGeminiValidationMsg(null), 4500);
      } else {
        setGeminiValidationMsg({
          type: 'error',
          text: data.error || 'A chave informada é inválida ou ultrapassou a cota do Google AI Studio.'
        });
      }
    } catch (err: any) {
      console.error('[Validate Key Error]', err);
      setGeminiValidationMsg({
        type: 'error',
        text: 'Não foi possível conectar ao servidor para validar a chave.'
      });
    } finally {
      setValidatingKeyIndex(null);
    }
  };

  // Test an existing Gemini Key in list
  const handleTestExistingKey = async (index: number) => {
    const keyToTest = geminiKeysList[index];
    if (!keyToTest) return;

    setValidatingKeyIndex(index);
    setGeminiValidationMsg(null);

    try {
      const res = await fetch('/api/gemini/validate-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: keyToTest })
      });

      const data = await res.json();

      if (res.ok && data.valid) {
        setGeminiValidationMsg({
          type: 'success',
          text: `Chave ${index + 1} testada com sucesso! Está ativa e operando perfeitamente.`
        });
        setTimeout(() => setGeminiValidationMsg(null), 4500);
      } else {
        setGeminiValidationMsg({
          type: 'error',
          text: `Falha no teste da Chave ${index + 1}: ${data.error || 'Inativa ou sem cota disponível'}`
        });
      }
    } catch (err) {
      setGeminiValidationMsg({
        type: 'error',
        text: `Erro ao testar a Chave ${index + 1}.`
      });
    } finally {
      setValidatingKeyIndex(null);
    }
  };

  // Remove a Gemini Key
  const handleRemoveGeminiKey = (index: number) => {
    const updatedList = geminiKeysList.filter((_, i) => i !== index);
    const newConfig: ApiKeysConfig = {
      ...apiKeys,
      geminiApiKey: updatedList[0] || '',
      geminiApiKeys: updatedList,
    };
    onSaveApiKeys(newConfig);
    setSavedSuccess(`Chave ${index + 1} removida. As chaves restantes foram reordenadas automaticamente.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  // ML OAuth Redirect (App ID and Secret are automatically pre-configured)
  const handleMlOAuthRedirect = () => {
    // Falls back to the hardcoded developer credentials
    const appId = apiKeys.mercadoLivreAppId?.trim() || '1096973158666349';
    const clientSecret = apiKeys.mercadoLivreClientSecret?.trim() || '5YoWCSRNr90KiVumj0tf35NGkpOAbops';

    // Synchronize these keys first
    onSaveApiKeys({
      ...apiKeys,
      mercadoLivreAppId: appId,
      mercadoLivreClientSecret: clientSecret,
    });

    const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    setOauthOpened(true);
    window.open(authUrl, '_blank');
  };

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(redirectUri);
    setCopiedRedirect(true);
    setTimeout(() => setCopiedRedirect(false), 2000);
  };

  const isConfigured = (provider: ProviderType): boolean => {
    if (provider === 'mercadolivre') {
      return !!apiKeys.mercadoLivreKey;
    }
    if (provider === 'shopee') return !!apiKeys.shopeeKey;
    if (provider === 'amazon') return !!apiKeys.amazonKey;
    if (provider === 'aliexpress') return !!apiKeys.aliExpressKey;
    if (provider === 'shein') return !!apiKeys.sheinKey;
    if (provider === 'gemini') return !!apiKeys.geminiApiKey;
    return false;
  };

  const handleStartManualEdit = (provider: ProviderType) => {
    setEditingProvider(provider);
    if (provider === 'shopee') setTempManualValue(apiKeys.shopeeKey || '');
    else if (provider === 'amazon') setTempManualValue(apiKeys.amazonKey || '');
    else if (provider === 'aliexpress') setTempManualValue(apiKeys.aliExpressKey || '');
    else if (provider === 'shein') setTempManualValue(apiKeys.sheinKey || '');
    else if (provider === 'gemini') setTempManualValue(apiKeys.geminiApiKey || '');
  };

  const handleSaveManualKey = (provider: ProviderType) => {
    const updated = { ...apiKeys };
    if (provider === 'shopee') updated.shopeeKey = tempManualValue;
    else if (provider === 'amazon') updated.amazonKey = tempManualValue;
    else if (provider === 'aliexpress') updated.aliExpressKey = tempManualValue;
    else if (provider === 'shein') updated.sheinKey = tempManualValue;
    else if (provider === 'gemini') updated.geminiApiKey = tempManualValue;

    onSaveApiKeys(updated);
    setEditingProvider(null);
    setSavedSuccess(`Configurações de ${PROVIDERS.find(p => p.id === provider)?.name} atualizadas!`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleRemoveKey = (provider: ProviderType) => {
    const updated = { ...apiKeys };
    if (provider === 'mercadolivre') {
      updated.mercadoLivreKey = '';
      updated.mercadoLivreRefreshToken = '';
      updated.mercadoLivreExpiresAt = 0;
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

    onSaveApiKeys(updated);
    setSavedSuccess(`Integração com ${PROVIDERS.find(p => p.id === provider)?.name} desvinculada.`);
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ name, email });
    setSavedSuccess('Dados do perfil atualizados com sucesso!');
    setTimeout(() => setSavedSuccess(null), 3000);
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
            <h2 className="text-xl font-extrabold text-white">Configurações do Sistema & APIs</h2>
            <p className="text-xs text-stone-400">
              Gerencie suas chaves de IA do Gemini e vincule suas contas de afiliados
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

      {/* Dedicated Google Gemini API Keys Management Section */}
      <div className="bg-stone-900 border border-emerald-500/30 rounded-2xl p-6 space-y-5 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                <span>Chaves de API do Google Gemini IA</span>
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  {geminiKeysList.length} {geminiKeysList.length === 1 ? 'Chave Ativa' : 'Chaves Ativas'}
                </span>
              </h3>
              <p className="text-xs text-stone-400">
                Adicione suas chaves gratuitas do Google AI Studio para geração de copys com IA.
              </p>
            </div>
          </div>

          <a
            href="https://aistudio.google.com/app/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-center shrink-0"
          >
            <span>Obter Chave Grátis no Google ↗</span>
          </a>
        </div>

        {/* Form to Add New Key */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-stone-200 block">
            Adicionar Nova Chave do Gemini (AI Studio):
          </label>
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="password"
              placeholder="Cole sua chave aqui (ex: AIzaSy...)"
              value={newGeminiKey}
              onChange={(e) => setNewGeminiKey(e.target.value)}
              className="flex-1 px-3.5 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-emerald-500"
            />
            <button
              type="button"
              disabled={validatingKeyIndex === 'new'}
              onClick={handleAddAndValidateNewGeminiKey}
              className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-stone-950 font-extrabold text-xs rounded-xl transition-all shadow-md shadow-emerald-500/10 flex items-center justify-center gap-2 shrink-0"
            >
              {validatingKeyIndex === 'new' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Validando Chave...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Validar e Salvar Chave</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Validation Feedback Alert */}
        {geminiValidationMsg && (
          <div
            className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2.5 animate-fadeIn ${
              geminiValidationMsg.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/10 border-red-500/40 text-red-300'
            }`}
          >
            {geminiValidationMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{geminiValidationMsg.text}</span>
          </div>
        )}

        {/* List of Registered Keys */}
        {geminiKeysList.length > 0 ? (
          <div className="space-y-2">
            <span className="text-[11px] font-bold text-stone-400 block uppercase tracking-wider">
              Sua Lista de Chaves Cadastradas:
            </span>
            <div className="space-y-2">
              {geminiKeysList.map((key, index) => {
                const masked = key.length > 12 ? `${key.slice(0, 6)}...${key.slice(-4)}` : '••••••••';
                const isValidatingThis = validatingKeyIndex === index;

                return (
                  <div
                    key={index}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-stone-950 border border-stone-800 rounded-xl hover:border-stone-750 transition-all"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-7 h-7 rounded-lg bg-stone-900 border border-stone-800 text-stone-300 font-extrabold text-xs flex items-center justify-center shrink-0">
                        #{index + 1}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-mono font-bold text-emerald-300 block truncate">
                          {masked}
                        </span>
                        <span className="text-[10px] text-stone-500 block">
                          Chave ativa e pronta para uso na geração de copys
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        disabled={isValidatingThis}
                        onClick={() => handleTestExistingKey(index)}
                        className="px-3 py-1.5 bg-stone-850 hover:bg-stone-750 text-stone-300 border border-stone-700 hover:border-stone-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1.5"
                      >
                        {isValidatingThis ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-emerald-400" />
                            <span>Testando...</span>
                          </>
                        ) : (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Testar Chave</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleRemoveGeminiKey(index)}
                        className="px-2.5 py-1.5 bg-red-950/40 hover:bg-red-900/50 text-red-400 border border-red-500/30 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1"
                        title="Remover Chave"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Excluir</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-stone-950/60 border border-dashed border-stone-800 rounded-xl text-center space-y-1">
            <p className="text-xs font-semibold text-stone-400">Nenhuma chave do Gemini cadastrada ainda.</p>
            <p className="text-[11px] text-stone-500">
              Cole sua chave de API do Google AI Studio acima e clique em "Validar e Salvar Chave".
            </p>
          </div>
        )}

        {/* Info Box */}
        <div className="p-3 bg-emerald-950/20 border border-emerald-500/20 rounded-xl text-[11px] text-emerald-300/90 leading-relaxed flex items-start gap-2">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            <strong>Sistema de Rotação Automática</strong>: Cadastre 2 ou mais chaves do Google AI Studio para nunca ficar sem cota. Caso uma chave atinja o limite por minuto, o aplicativo chaveia automaticamente para a próxima chave válida!
          </span>
        </div>
      </div>

      {oauthOpened && !isConfigured('mercadolivre') && (
        <div className="bg-blue-500/10 border border-blue-500/30 text-blue-200 p-5 rounded-2xl space-y-3 animate-fadeIn">
          <div className="flex items-center gap-2">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Aguardando Autorização do Mercado Livre...
            </h4>
          </div>
          <p className="text-xs text-stone-300 leading-relaxed">
            Uma nova guia do seu navegador foi aberta para você fazer login e autorizar o aplicativo no Mercado Livre. 
            Se a janela foi bloqueada pelo seu navegador, clique no botão abaixo para tentar abrir novamente.
          </p>
          <div className="flex gap-2.5">
            <button
              onClick={handleMlOAuthRedirect}
              className="px-3.5 py-1.5 bg-blue-500 hover:bg-blue-400 text-stone-950 text-xs font-extrabold rounded-lg transition-all"
            >
              Abrir Janela Novamente
            </button>
            <button
              onClick={() => setOauthOpened(false)}
              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-300 text-xs font-bold rounded-lg"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Dynamic Environment & Redirect URI Alert */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-3 shadow-xl">
        <div className="flex items-center gap-2 border-b border-stone-800 pb-3">
          <Building className="w-4 h-4 text-blue-400" />
          <h4 className="text-xs font-bold text-white uppercase tracking-wider">
            Painel de Testes & Redirecionamento de Redes (Redirect URI)
          </h4>
        </div>
        
        <p className="text-xs text-stone-300 leading-relaxed">
          Para que a vinculação automática por <strong>OAuth</strong> funcione no Mercado Livre, certifique-se de que a URL abaixo está cadastrada no campo <strong>"Redirect URIs"</strong> dentro do seu aplicativo no portal <a href="https://developers.mercadolibre.com.br" target="_blank" rel="noreferrer" className="text-amber-400 underline font-semibold hover:text-amber-300">Mercado Livre Developers</a>:
        </p>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-stone-950 p-3 rounded-xl border border-stone-800">
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-stone-500 block uppercase tracking-wider mb-0.5">
              URL de Retorno Atual para este Ambiente
            </span>
            <code className="text-xs font-mono text-amber-300 truncate block select-all">
              {redirectUri}
            </code>
          </div>
          <button
            type="button"
            onClick={handleCopyRedirectUri}
            className="px-4 py-2 bg-stone-850 hover:bg-stone-750 text-stone-200 text-xs font-bold rounded-lg border border-stone-700 hover:border-stone-600 transition-all flex items-center gap-1.5 self-start sm:self-center"
          >
            {copiedRedirect ? (
              <>
                <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span className="text-emerald-300">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copiar Link</span>
              </>
            )}
          </button>
        </div>

        <div className="text-[10px] text-stone-400 leading-normal flex items-start gap-1.5">
          <Info className="w-3 h-3 text-blue-400 shrink-0 mt-0.5" />
          <span>
            Esta URL muda automaticamente caso você esteja testando pelo <strong>Google AI Studio Preview</strong> ou no seu domínio do <strong>Render</strong>. Ambas são compatíveis!
          </span>
        </div>
      </div>

      {/* Grid of Active Connection Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PROVIDERS.map((provider) => {
          const configured = isConfigured(provider.id);
          const isEditing = editingProvider === provider.id;

          return (
            <div
              key={provider.id}
              className={`p-5 rounded-2xl border transition-all flex flex-col justify-between space-y-4 ${
                configured
                  ? 'bg-stone-900/90 border-emerald-500/40 shadow-lg shadow-emerald-950/5'
                  : 'bg-stone-900 border-stone-800/80'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-white">{provider.name}</span>
                    <span className="text-[9px] bg-stone-950/80 text-stone-400 px-2 py-0.5 rounded-full border border-stone-800">
                      {provider.badge}
                    </span>
                  </div>

                  {configured ? (
                    <span className="text-[10px] bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                      <span>Vinculado</span>
                    </span>
                  ) : (
                    <span className="text-[10px] bg-stone-950 text-stone-500 px-2 py-0.5 rounded-full border border-stone-800">
                      Não vinculado
                    </span>
                  )}
                </div>

                <p className="text-xs text-stone-400 leading-relaxed min-h-[36px]">{provider.description}</p>
              </div>

              {/* Inline Action block for the Provider */}
              <div className="pt-3 border-t border-stone-850 space-y-3">
                
                {/* Manual inline configuration form if toggled */}
                {isEditing ? (
                  <div className="space-y-2.5 animate-fadeIn">
                    <label className="text-[11px] font-bold text-stone-300 block">
                      {provider.id === 'gemini' ? 'Sua Chave de API Google AI Studio' : 'Seu Associate Tag / Chave de Afiliado'}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="password"
                        placeholder={provider.id === 'amazon' ? 'suatag-20' : 'Chave / Token...'}
                        value={tempManualValue}
                        onChange={(e) => setTempManualValue(e.target.value)}
                        className="flex-1 p-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-blue-500"
                      />
                      <button
                        type="button"
                        onClick={() => handleSaveManualKey(provider.id)}
                        className="px-3 bg-blue-500 hover:bg-blue-400 text-stone-950 font-bold text-xs rounded-xl transition-all"
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingProvider(null)}
                        className="px-2.5 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded-xl"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    
                    {/* Primary Button Strategy */}
                    {provider.id === 'mercadolivre' ? (
                      configured ? (
                        <div className="flex items-center gap-3 justify-between w-full">
                          <span className="text-[10px] text-stone-400 font-medium">
                            Conexão ativa com renovação inteligente de tokens.
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRemoveKey('mercadolivre')}
                            className="px-3 py-1.5 border border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs font-bold rounded-lg transition-all flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>Desvincular</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleMlOAuthRedirect}
                          className="w-full py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-extrabold text-xs rounded-xl transition-all shadow-md shadow-amber-500/10 flex items-center justify-center gap-1.5 animate-pulse"
                        >
                          <span>🔗 Vincular Conta Mercado Livre (OAuth)</span>
                        </button>
                      )
                    ) : (
                      // Other Platforms
                      <div className="flex items-center justify-between w-full gap-2">
                        {configured ? (
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] text-emerald-400/90 font-bold font-mono truncate max-w-[120px]">
                              Key: ***{String(apiKeys[provider.id === 'shopee' ? 'shopeeKey' : provider.id === 'amazon' ? 'amazonKey' : provider.id === 'aliexpress' ? 'aliExpressKey' : provider.id === 'shein' ? 'sheinKey' : 'geminiApiKey'] || '').slice(-4)}
                            </span>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => handleStartManualEdit(provider.id)}
                                className="text-[10px] text-stone-400 hover:text-white underline font-semibold"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemoveKey(provider.id)}
                                className="text-[10px] text-red-400 hover:text-red-300"
                                title="Desvincular"
                              >
                                Desvincular
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => setActiveOAuthModal(provider.id)}
                              className="px-3 py-1.5 bg-stone-800 hover:bg-stone-750 text-stone-200 border border-stone-700 hover:border-stone-600 text-[11px] font-bold rounded-lg transition-all flex items-center gap-1"
                            >
                              <span>🔗 Vincular (OAuth)</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleStartManualEdit(provider.id)}
                              className="text-[10px] text-stone-500 hover:text-stone-300 underline font-semibold"
                            >
                              Configurar Manual
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Developer Guide Link */}
                    {provider.guideUrl && !isEditing && (
                      <a
                        href={provider.guideUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-500 hover:text-stone-300 text-[10px] flex items-center gap-0.5 mt-1"
                      >
                        <span>Portal Developers</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    )}

                  </div>
                )}

              </div>
            </div>
          );
        })}
      </div>

      {/* Profile Data Section */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-stone-800 pb-3">
          <User className="w-4 h-4 text-emerald-400" />
          <span>Meus Dados do Perfil</span>
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

      {/* Informational Modal: OAuth configurations for other platforms */}
      {activeOAuthModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-stone-900 border border-stone-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-scaleIn text-stone-200">
            
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertTriangle className="w-5 h-5" />
                <span>Integração de Desenvolvedor Necessária</span>
              </div>
              <button
                onClick={() => setActiveOAuthModal(null)}
                className="text-stone-400 hover:text-white p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs leading-relaxed text-stone-300">
              <p>
                Deseja integrar com sua conta de afiliado oficial da plataforma <strong>{PROVIDERS.find(p => p.id === activeOAuthModal)?.name}</strong>?
              </p>
              <p>
                Para habilitar a vinculação oficial com 1 clique (OAuth) nesta rede, o desenvolvedor do site precisa cadastrar as credenciais de aplicativo parceiro (App ID & Client Secret) nas configurações globais do código.
              </p>
              <p className="bg-stone-950 p-3 rounded-xl border border-stone-800 text-stone-400">
                Atualmente, <strong>apenas o Mercado Livre</strong> está com credenciais de desenvolvedor totalmente pré-configuradas e prontas para vinculação automática direta.
              </p>
              <p>
                Enquanto o administrador configura as credenciais, você pode usar a <strong>Configuração Manual</strong> diretamente no card de conexão para salvar sua chave ou tag pessoal e começar a usar!
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-stone-800">
              <button
                type="button"
                onClick={() => setActiveOAuthModal(null)}
                className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-stone-300 font-bold text-xs rounded-xl"
              >
                Entendi, Fechar
              </button>
              <button
                type="button"
                onClick={() => {
                  const prov = activeOAuthModal as ProviderType;
                  setActiveOAuthModal(null);
                  handleStartManualEdit(prov);
                }}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-400 text-stone-950 font-bold text-xs rounded-xl"
              >
                Configurar Manualmente
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
