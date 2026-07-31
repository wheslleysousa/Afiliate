import React, { useState } from 'react';
import { ApiKeysConfig, UserProfile, CommissionRatesConfig } from '../types';
import { DEFAULT_COMMISSION_CONFIG } from '../utils/marketplaceUtils';
import { extractCleanTrackingId } from '../utils/affiliateLink';
import { 
  AlarmSettings, 
  getAlarmSettings, 
  saveAlarmSettings, 
  playAlarmSound, 
  requestNotificationPermission,
  ALARM_SOUND_OPTIONS
} from '../utils/alarmUtils';
import { 
  Settings, 
  User, 
  Check, 
  Save, 
  Sparkles, 
  Info, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ExternalLink, 
  HelpCircle,
  X,
  Link as LinkIcon,
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  Edit3,
  Lock,
  Bell,
  Clock,
  Volume2,
  VolumeX,
  Smartphone,
  ShieldCheck,
  Percent,
  RotateCcw,
  Tag
} from 'lucide-react';

import mlGuideImg from '../assets/images/ml_affiliate_guide_1785084147367.jpg';
import amazonGuideImg from '../assets/images/amazon_affiliate_guide_1785084162144.jpg';
import shopeeGuideImg from '../assets/images/shopee_affiliate_guide_1785084171645.jpg';
import aliexpressGuideImg from '../assets/images/aliexpress_affiliate_guide_1785084183068.jpg';
import sheinGuideImg from '../assets/images/shein_affiliate_guide_1785084194940.jpg';

interface SettingsTabProps {
  user: UserProfile;
  apiKeys: ApiKeysConfig;
  alarmSettings?: AlarmSettings;
  commissionRates?: CommissionRatesConfig;
  onSaveAlarmSettings?: (settings: AlarmSettings) => void;
  onSaveApiKeys: (keys: ApiKeysConfig) => void;
  onSaveCommissionRates?: (rates: CommissionRatesConfig) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

interface HelpGuide {
  title: string;
  platform: string;
  color: string;
  badgeColor: string;
  obtainUrl: string;
  guideImage: string;
  steps: string[];
  example: string;
}

const AFFILIATE_HELP_GUIDES: Record<string, HelpGuide> = {
  mercadolivre: {
    title: 'Mercado Livre Tracking ID',
    platform: 'Mercado Livre Afiliados',
    color: 'text-amber-400',
    badgeColor: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
    obtainUrl: 'https://www.mercadolivre.com.br/afiliados',
    guideImage: mlGuideImg,
    example: 'sowh5608494 ou social/sowh5608494',
    steps: [
      'No aplicativo Mercado Livre (no celular): Vá em Perfil -> Perfil de Afiliado.',
      'Localize o campo "URL do perfil" onde aparece o seu código único (ex: sowh5608494).',
      'Ou no computador: Acesse o portal oficial de Afiliados do Mercado Livre e vá em Gerador de Links.',
      'Copie esse código de afiliado/tracking e cole no campo "Mercado Livre Tracking ID" no nosso app.',
    ],
  },
  amazon: {
    title: 'Amazon Tag de Associado',
    platform: 'Amazon Associados',
    color: 'text-yellow-400',
    badgeColor: 'bg-yellow-500/15 border-yellow-500/30 text-yellow-400',
    obtainUrl: 'https://associados.amazon.com.br/',
    guideImage: amazonGuideImg,
    example: 'suatag-20',
    steps: [
      'Acesse a plataforma oficial do Amazon Associados Brasil (botão abaixo "Obter meu ID").',
      'Entre com a sua conta de Associado Amazon.',
      'Olhe para o canto superior direito do painel de controle do Associado (conforme destacado na imagem abaixo).',
      'Copie a sua "Tag de Store / Id de Associado" (ela sempre termina com -20 no Brasil, ex: minhaloja-20).',
      'Cole essa Tag exatamente como está no campo da Amazon no aplicativo.',
    ],
  },
  shopee: {
    title: 'Shopee ID de Afiliado / Tracking',
    platform: 'Shopee Afiliados',
    color: 'text-orange-400',
    badgeColor: 'bg-orange-500/15 border-orange-500/30 text-orange-400',
    obtainUrl: 'https://affiliate.shopee.com.br/',
    guideImage: shopeeGuideImg,
    example: '12345678 ou seu_sub_id',
    steps: [
      'Acesse o Portal do Afiliado Shopee Brasil.',
      'Faça login na sua conta de parceiro Shopee Afiliados.',
      'Vá em "Configurações da Conta" (Account Settings) ou na seção de "Links Personalizados / Ofertas".',
      'Copie seu "Affiliate ID" ou seu "ID de Rastreamento de Campanha" exibido em seu perfil.',
      'Cole o código no campo "Shopee ID de Afiliado" no aplicativo.',
    ],
  },
  aliexpress: {
    title: 'AliExpress Affiliate ID',
    platform: 'AliExpress Portals',
    color: 'text-red-400',
    badgeColor: 'bg-red-500/15 border-red-500/30 text-red-400',
    obtainUrl: 'https://portals.aliexpress.com/',
    guideImage: aliexpressGuideImg,
    example: 'aff_12345 ou seu_tracking_id',
    steps: [
      'Acesse o portal global AliExpress Portals.',
      'Faça login com sua conta cadastrada no programa de afiliados do AliExpress.',
      'Acesse o menu "Tracking ID Center" ou "Account Information".',
      'Copie o seu "Tracking ID" ou "Affiliate ID" registrado.',
      'Cole este ID no campo "AliExpress Affiliate ID" em nosso aplicativo.',
    ],
  },
  shein: {
    title: 'Shein Publisher Token',
    platform: 'Shein Publisher',
    color: 'text-stone-300',
    badgeColor: 'bg-stone-500/15 border-stone-500/30 text-stone-300',
    obtainUrl: 'https://www.shein.com/affiliate-a-427.html',
    guideImage: sheinGuideImg,
    example: 'token_shein_123',
    steps: [
      'Acesse o Portal de Afiliados Shein Publisher.',
      'Faça login com seu perfil aprovado como parceiro Shein.',
      'Vá até "Publisher Information" ou "Link Generator" no menu lateral.',
      'Copie o seu "Publisher Token" ou "Code de Afiliado".',
      'Cole no campo da Shein em nosso aplicativo.',
    ],
  },
};

interface AffiliateItemCardProps {
  label: string;
  labelColor: string;
  placeholder: string;
  value: string;
  onSave: (val: string) => void;
  onHowToObtain: () => void;
  hint: string;
  autoCleanUrl?: (raw: string) => string;
  isFullWidth?: boolean;
}

const AffiliateItemCard: React.FC<AffiliateItemCardProps> = ({
  label,
  labelColor,
  placeholder,
  value,
  onSave,
  onHowToObtain,
  hint,
  autoCleanUrl,
  isFullWidth = false,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [showSecret, setShowSecret] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [justSaved, setJustSaved] = useState(false);

  React.useEffect(() => {
    setInputValue(value);
  }, [value]);

  const handleTextChange = (raw: string) => {
    let clean = raw;
    if (autoCleanUrl) {
      clean = autoCleanUrl(raw);
    }
    setInputValue(clean);
  };

  const handleSaveClick = () => {
    onSave(inputValue.trim());
    setIsEditing(false);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 3000);
  };

  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <div className={`p-4 bg-stone-950 border border-stone-800/90 rounded-2xl flex flex-col justify-between gap-3 transition-all hover:border-stone-750 ${isFullWidth ? 'sm:col-span-2' : ''}`}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold ${labelColor}`}>{label}</span>
            {hasValue ? (
              <span className="text-[10px] bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Configurado
              </span>
            ) : (
              <span className="text-[10px] bg-stone-800 text-stone-400 font-semibold px-2 py-0.5 rounded-full">
                Não configurado
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onHowToObtain}
            className="text-[11px] text-violet-400 hover:text-violet-300 font-bold flex items-center gap-0.5 transition-colors underline decoration-dashed"
          >
            Como obter →
          </button>
        </div>

        <div className="relative flex items-center">
          <input
            type={showSecret ? 'text' : 'password'}
            disabled={!isEditing}
            placeholder={placeholder}
            value={inputValue}
            onChange={(e) => handleTextChange(e.target.value)}
            className={`w-full pl-3 pr-28 py-2.5 rounded-xl text-xs font-mono transition-all focus:outline-none ${
              isEditing
                ? 'bg-stone-900 border-2 border-violet-500 text-white placeholder-stone-600 shadow-inner'
                : 'bg-stone-900/60 border border-stone-800/80 text-stone-300 disabled:opacity-90 cursor-not-allowed'
            }`}
          />

          <div className="absolute right-2 flex items-center gap-1">
            {/* Esconder/Mostrar Toggle */}
            <button
              type="button"
              onClick={() => setShowSecret(!showSecret)}
              title={showSecret ? 'Esconder código' : 'Mostrar código'}
              className="p-1.5 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition-colors"
            >
              {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>

            {/* Edit / Save Toggle */}
            {!isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
                className="px-2.5 py-1 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-[11px] font-bold transition-all flex items-center gap-1"
              >
                {hasValue ? <Edit3 className="w-3 h-3 text-violet-400" /> : <Plus className="w-3 h-3 text-emerald-400" />}
                <span>{hasValue ? 'Editar' : 'Adicionar'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveClick}
                className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-stone-950 text-[11px] font-extrabold shadow-md transition-all flex items-center gap-1 animate-fadeIn"
              >
                <Save className="w-3 h-3" />
                <span>Salvar</span>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1 border-t border-stone-900">
        <span>{hint}</span>
        {justSaved && (
          <span className="text-emerald-400 font-bold flex items-center gap-1 animate-fadeIn">
            <CheckCircle2 className="w-3 h-3" /> Salvo com sucesso!
          </span>
        )}
      </div>
    </div>
  );
};

export const SettingsTab: React.FC<SettingsTabProps> = ({
  user,
  apiKeys,
  alarmSettings: initialAlarmSettings,
  commissionRates: initialCommissionRates,
  onSaveAlarmSettings,
  onSaveApiKeys,
  onSaveCommissionRates,
  onUpdateProfile,
}) => {
  const [activeSection, setActiveSection] = useState<'affiliates' | 'commissions' | 'gemini' | 'alarm' | 'profile'>('affiliates');
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || '');
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [scheduleSavedFeedback, setScheduleSavedFeedback] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  // Estado das Configurações de Comissões por Categoria
  const [commRates, setCommRates] = useState<CommissionRatesConfig>(
    initialCommissionRates || DEFAULT_COMMISSION_CONFIG
  );
  const [selectedCommPlatform, setSelectedCommPlatform] = useState<string>('mercadolivre');
  const [newCatName, setNewCatName] = useState('');
  const [newCatRate, setNewCatRate] = useState<number | ''>('');

  const handleUpdateDefaultRate = (platform: string, rate: number) => {
    setCommRates((prev) => {
      const currentPlat = prev[platform] || { default: 5, categories: {} };
      return {
        ...prev,
        [platform]: {
          ...currentPlat,
          default: rate,
        },
      };
    });
  };

  const handleAddCategoryOverride = (platform: string) => {
    if (!newCatName.trim() || newCatRate === '' || isNaN(Number(newCatRate))) return;
    const rateNum = Number(newCatRate);
    setCommRates((prev) => {
      const currentPlat = prev[platform] || { default: 5, categories: {} };
      return {
        ...prev,
        [platform]: {
          ...currentPlat,
          categories: {
            ...(currentPlat.categories || {}),
            [newCatName.trim()]: rateNum,
          },
        },
      };
    });
    setNewCatName('');
    setNewCatRate('');
  };

  const handleRemoveCategoryOverride = (platform: string, categoryName: string) => {
    setCommRates((prev) => {
      const currentPlat = prev[platform];
      if (!currentPlat || !currentPlat.categories) return prev;
      const updatedCategories = { ...currentPlat.categories };
      delete updatedCategories[categoryName];
      return {
        ...prev,
        [platform]: {
          ...currentPlat,
          categories: updatedCategories,
        },
      };
    });
  };

  const handleSaveCommissions = () => {
    if (onSaveCommissionRates) {
      onSaveCommissionRates(commRates);
    }
    setSavedSuccess('Taxas de comissão salvas com sucesso!');
    setTimeout(() => setSavedSuccess(null), 3500);
  };

  const handleResetCommissions = () => {
    setCommRates(DEFAULT_COMMISSION_CONFIG);
    if (onSaveCommissionRates) {
      onSaveCommissionRates(DEFAULT_COMMISSION_CONFIG);
    }
    setSavedSuccess('Taxas de comissão restauradas para os padrões oficiais!');
    setTimeout(() => setSavedSuccess(null), 3500);
  };

  // Estado das Configurações de Alarme & Lembrete
  const [alarm, setAlarm] = useState<AlarmSettings>(
    initialAlarmSettings || getAlarmSettings()
  );
  const [notifPermission, setNotifPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );

  const handleUpdateAlarm = (part: Partial<AlarmSettings>) => {
    const updated = { ...alarm, ...part };
    setAlarm(updated);
    saveAlarmSettings(updated);
    if (onSaveAlarmSettings) {
      onSaveAlarmSettings(updated);
    }
  };

  const handleRequestNotif = async () => {
    const granted = await requestNotificationPermission();
    setNotifPermission(granted ? 'granted' : 'denied');
  };

  // Active Help Modal state
  const [activeHelpModal, setActiveHelpModal] = useState<string | null>(null);

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

      let data: any; const contentType = res.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { data = await res.json(); } else { throw new Error("Resposta inválida (não-JSON) do servidor."); }

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

      let data: any; const contentType = res.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { data = await res.json(); } else { throw new Error("Resposta inválida (não-JSON) do servidor."); }

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

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateProfile({ name, email });
    setSavedSuccess('Dados do perfil atualizados com sucesso!');
    setTimeout(() => setSavedSuccess(null), 3000);
  };

  const currentHelpGuide = activeHelpModal ? AFFILIATE_HELP_GUIDES[activeHelpModal] : null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-10">
      
      {/* Header */}
      <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Configurações do Usuário & APIs</h2>
            <p className="text-xs text-[#93a0b5]">
              Gerencie seus IDs de comissão, chaves do Gemini IA, alarmes de divulgação e perfil.
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

      {/* Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#07090f] border border-[#1e2636] rounded-2xl">
        <button
          type="button"
          onClick={() => setActiveSection('affiliates')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
            activeSection === 'affiliates'
              ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119] border-transparent'
          }`}
        >
          <LinkIcon className="w-4 h-4" />
          <span>IDs de Afiliado</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('commissions')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
            activeSection === 'commissions'
              ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/20'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119] border-transparent'
          }`}
        >
          <Percent className="w-4 h-4" />
          <span>Taxas de Comissão</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('gemini')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
            activeSection === 'gemini'
              ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119] border-transparent'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Chaves Gemini IA</span>
          {geminiKeysList.length > 0 && (
            <span className="text-[10px] bg-emerald-950 px-1.5 py-0.2 rounded-full border border-emerald-400/30 text-emerald-300 font-extrabold">
              {geminiKeysList.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('alarm')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
            activeSection === 'alarm'
              ? 'bg-amber-600 text-white border-amber-500 shadow-md shadow-amber-600/20'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119] border-transparent'
          }`}
        >
          <Bell className="w-4 h-4" />
          <span>Alarme & Alertas</span>
          {alarm.enabled && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveSection('profile')}
          className={`flex-1 min-w-[130px] py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 border ${
            activeSection === 'profile'
              ? 'bg-blue-600 text-white border-blue-500 shadow-md'
              : 'text-[#93a0b5] hover:text-white hover:bg-[#0e1119] border-transparent'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Meu Perfil</span>
        </button>
      </div>

      {/* Commission Rates Management Section */}
      {activeSection === 'commissions' && (
        <div className="bg-[#0e1119] border border-purple-500/30 rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden animate-fadeIn">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e2636] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/15 border border-purple-500/30 text-purple-400 rounded-xl shrink-0">
                <Percent className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Taxas de Comissão por Categoria</h3>
                <p className="text-xs text-[#93a0b5]">
                  Configure as taxas de comissão padronizadas e específicas por categoria de cada marketplace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleResetCommissions}
                className="px-3 py-1.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-bold transition-all flex items-center gap-1.5 border border-stone-700"
                title="Restaurar taxas padrão oficiais"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Restaurar Padrões</span>
              </button>
              <button
                type="button"
                onClick={handleSaveCommissions}
                className="px-4 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-purple-600/20"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Salvar Taxas</span>
              </button>
            </div>
          </div>

          <div className="bg-[#1b1511] border border-amber-500/20 text-amber-200 text-[11px] p-3 rounded-xl flex items-start gap-2.5 animate-fadeIn">
            <Info className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Valores de Referência 2026 (Editáveis)</p>
              <p className="opacity-80">As taxas de comissão abaixo são estimativas oficiais para o ano de 2026. Os valores reais da comissão podem variar dependendo do nível de sua conta de afiliado, campanhas temporárias da plataforma ou categorias específicas do produto.</p>
            </div>
          </div>

          {/* Platform Selector Tabs */}
          <div className="flex flex-wrap gap-2">
            {[
              { id: 'mercadolivre', label: 'Mercado Livre' },
              { id: 'shopee', label: 'Shopee' },
              { id: 'amazon', label: 'Amazon' },
              { id: 'aliexpress', label: 'AliExpress' },
              { id: 'shein', label: 'Shein' },
            ].map((p) => {
              const active = selectedCommPlatform === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedCommPlatform(p.id)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                    active
                      ? 'bg-purple-600 text-white border-purple-400 shadow-md shadow-purple-600/30'
                      : 'bg-[#151a26] text-[#93a0b5] hover:text-white border-[#1e2636]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Platform Settings Box */}
          {(() => {
            const platformConfig = commRates[selectedCommPlatform] || { default: 5, categories: {} };
            const categoriesMap = platformConfig.categories || {};
            const categoryKeys = Object.keys(categoriesMap);

            return (
              <div className="space-y-5 bg-[#07090f] p-4 sm:p-5 rounded-xl border border-[#1e2636]">
                {/* Default Rate */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-[#0e1119] rounded-xl border border-[#1e2636]">
                  <div>
                    <label className="text-xs font-bold text-stone-200 block">Taxa Padrão da Plataforma (%)</label>
                    <p className="text-[11px] text-[#93a0b5]">
                      Usada quando o produto não se encaixar em nenhuma categoria específica abaixo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={platformConfig.default}
                      onChange={(e) => handleUpdateDefaultRate(selectedCommPlatform, parseFloat(e.target.value) || 0)}
                      className="w-24 bg-[#151a26] border border-[#1e2636] rounded-lg px-3 py-1.5 text-xs font-bold text-white text-right focus:outline-none focus:border-purple-500"
                    />
                    <span className="text-xs font-bold text-purple-400">%</span>
                  </div>
                </div>

                {/* Categories Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-stone-300 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-purple-400" />
                      <span>Taxas por Categoria ({categoryKeys.length})</span>
                    </h4>
                  </div>

                  {categoryKeys.length === 0 ? (
                    <p className="text-xs text-stone-500 italic p-3 bg-[#0e1119] rounded-xl border border-[#1e2636]/50">
                      Nenhuma categoria customizada cadastrada para este marketplace. O sistema utilizará a taxa padrão ({platformConfig.default}%).
                    </p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {categoryKeys.map((cat) => (
                        <div
                          key={cat}
                          className="flex items-center justify-between p-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl group hover:border-purple-500/40 transition-all"
                        >
                          <span className="text-xs font-medium text-stone-200 truncate max-w-[180px]" title={cat}>
                            {cat}
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs font-extrabold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg border border-purple-500/20">
                              {categoriesMap[cat]}%
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCategoryOverride(selectedCommPlatform, cat)}
                              className="text-stone-500 hover:text-red-400 p-1 rounded-md transition-colors"
                              title="Remover regra de categoria"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Form for Adding Category */}
                  <div className="pt-2 border-t border-[#1e2636]">
                    <p className="text-[11px] font-bold text-stone-400 mb-2">Adicionar/Sobrescrever Categoria</p>
                    <div className="flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        placeholder="Ex: Eletrônicos, Celulares, Beleza..."
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        className="flex-1 w-full bg-[#0e1119] border border-[#1e2636] rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-purple-500"
                      />
                      <div className="flex items-center gap-2 w-full sm:w-auto">
                        <input
                          type="number"
                          step="0.5"
                          placeholder="Taxa %"
                          value={newCatRate}
                          onChange={(e) => setNewCatRate(e.target.value === '' ? '' : Number(e.target.value))}
                          className="w-24 bg-[#0e1119] border border-[#1e2636] rounded-xl px-3 py-2 text-xs text-white placeholder-stone-600 focus:outline-none focus:border-purple-500 text-right font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddCategoryOverride(selectedCommPlatform)}
                          disabled={!newCatName.trim() || newCatRate === ''}
                          className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Dedicated Google Gemini API Keys Management Section */}
      {activeSection === 'gemini' && (
        <div className="bg-stone-900 border border-emerald-500/30 rounded-2xl p-6 space-y-5 shadow-xl relative overflow-hidden animate-fadeIn">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-stone-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-xl shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Chaves de API do Google Gemini IA</span>
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30 font-bold">
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
              className="px-3.5 py-2 bg-stone-800 hover:bg-stone-750 text-emerald-400 border border-emerald-500/30 hover:border-emerald-500/50 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 self-start sm:self-center shrink-0"
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
      )}

      {/* Seção: Alarme & Lembretes de Divulgação Programada */}
      {activeSection === 'alarm' && (
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 space-y-6 shadow-xl relative overflow-hidden animate-fadeIn">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2636] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-xl shrink-0">
                <Bell className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <span>Alarme & Lembretes de Divulgação</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${
                    alarm.enabled
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                      : 'bg-[#151a26] text-[#93a0b5] border-[#1e2636]'
                  }`}>
                    {alarm.enabled ? '🟢 LIGADO' : '🔴 DESLIGADO'}
                  </span>
                </h3>
                <p className="text-xs text-[#93a0b5]">
                  Programe alertas periódicos para lembrar de divulgar ofertas e manter seu ritmo de vendas diário.
                </p>
              </div>
            </div>

            {/* Master Toggle (Botão Único Ligar / Desligar) */}
            <button
              type="button"
              onClick={() => handleUpdateAlarm({ enabled: !alarm.enabled })}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                alarm.enabled
                  ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20 border border-red-500'
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20 border border-blue-500'
              }`}
            >
              <Bell className="w-4 h-4" />
              <span>{alarm.enabled ? 'Desligar Alarme' : 'Ligar Alarme'}</span>
            </button>
          </div>

          {/* Configurações de Frequência e Janela de Horário */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Intervalo em Minutos */}
            <div className="p-4 bg-[#07090f] border border-[#1e2636] rounded-2xl space-y-3">
              <label className="text-xs font-bold text-[#eef2f9] flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Intervalo entre Lembretes:
              </label>
              <div className="grid grid-cols-5 gap-1.5">
                {[5, 10, 15, 30, 60].map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => handleUpdateAlarm({ intervalMinutes: mins })}
                    className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all border ${
                      alarm.intervalMinutes === mins
                        ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                        : 'bg-[#0e1119] text-[#93a0b5] border-[#1e2636] hover:border-blue-500/50 hover:text-white'
                    }`}
                  >
                    {mins} min
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#93a0b5]">
                O aplicativo emitirá um alerta a cada {alarm.intervalMinutes} minutos.
              </p>
            </div>

            {/* Janela de Horários (Início e Fim com Botão Salvar) */}
            <div className="p-4 bg-[#07090f] border border-[#1e2636] rounded-2xl space-y-3">
              <label className="text-xs font-bold text-[#eef2f9] flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                Janela de Horário Diária (Início e Fim):
              </label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[10px] text-[#93a0b5] font-medium block mb-1">Horário de Início:</span>
                  <input
                    type="time"
                    value={alarm.startHour}
                    onChange={(e) => handleUpdateAlarm({ startHour: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <span className="text-[10px] text-[#93a0b5] font-medium block mb-1">Horário de Término:</span>
                  <input
                    type="time"
                    value={alarm.endHour}
                    onChange={(e) => handleUpdateAlarm({ endHour: e.target.value })}
                    className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[10px] text-[#93a0b5]">
                  Alertas entre {alarm.startHour} e {alarm.endHour}.
                </span>
                <button
                  type="button"
                  onClick={() => {
                    handleUpdateAlarm({ startHour: alarm.startHour, endHour: alarm.endHour });
                    setScheduleSavedFeedback(true);
                    setTimeout(() => setScheduleSavedFeedback(false), 2500);
                  }}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold transition-all shadow-md flex items-center gap-1"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{scheduleSavedFeedback ? 'Horários Salvos ✓' : 'Salvar Horários'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Opções de Sons do Alarme (5 a 10 Tipos) */}
          <div className="p-4 bg-[#07090f] border border-[#1e2636] rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#eef2f9] flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-blue-400" />
                <span>Escolha o Som do Alarme ({ALARM_SOUND_OPTIONS.length} Opções de Toques):</span>
              </label>

              <button
                type="button"
                onClick={() => playAlarmSound(alarm.soundType || 'chime')}
                className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white rounded-xl shadow-md transition-all flex items-center gap-1.5"
              >
                <Volume2 className="w-3.5 h-3.5" />
                <span>Ouvir Som Selecionado</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ALARM_SOUND_OPTIONS.map((snd) => {
                const isSelected = (alarm.soundType || 'chime') === snd.id;
                return (
                  <button
                    key={snd.id}
                    type="button"
                    onClick={() => {
                      handleUpdateAlarm({ soundType: snd.id });
                      playAlarmSound(snd.id);
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-md'
                        : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-[#2a364f]'
                    }`}
                  >
                    <div>
                      <strong className="text-xs block text-white">{snd.label}</strong>
                      <span className="text-[10px] opacity-75">{snd.description}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Som Ativo e Notificações Push */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            {/* Som de Alerta (Habilitado/Desabilitado) */}
            <div className="p-3.5 bg-[#07090f] border border-[#1e2636] rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {alarm.soundEnabled ? (
                  <Volume2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <VolumeX className="w-5 h-5 text-[#93a0b5] shrink-0" />
                )}
                <div>
                  <strong className="text-xs text-white block">Sinal Sonoro</strong>
                  <span className="text-[10px] text-[#93a0b5]">Tocar som ao disparar lembrete</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleUpdateAlarm({ soundEnabled: !alarm.soundEnabled })}
                className={`w-10 h-6 rounded-full transition-colors relative p-1 ${
                  alarm.soundEnabled ? 'bg-blue-600' : 'bg-[#151a26]'
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    alarm.soundEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            {/* Notificação no Celular / Navegador (Permissão de Notificação) */}
            <div className="p-3.5 bg-[#07090f] border border-[#1e2636] rounded-xl flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Smartphone className="w-5 h-5 text-blue-400 shrink-0" />
                <div>
                  <strong className="text-xs text-white block">Permissão de Notificação</strong>
                  <span className="text-[10px] text-[#93a0b5]">
                    {notifPermission === 'granted' ? '🟢 Notificações Ativadas' : 'Clique para solicitar permissão'}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRequestNotif}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  notifPermission === 'granted'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 cursor-default'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-md'
                }`}
              >
                {notifPermission === 'granted' ? 'Concedido ✓' : 'Ativar Permissão'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Seção: IDs de Afiliado por Usuário */}
      {activeSection === 'affiliates' && (
        <div className="bg-stone-900 border border-violet-500/30 rounded-2xl p-6 space-y-5 shadow-xl animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-stone-800 pb-4">
            <div className="p-2.5 rounded-xl bg-violet-500/15 border border-violet-500/30 text-violet-400">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">IDs de Afiliado por Usuário</h3>
              <p className="text-xs text-stone-400">
                Seus links ganharão comissão automaticamente quando alguém comprar
              </p>
            </div>
          </div>

          {/* Alert informativo */}
          <div className="p-3.5 bg-violet-950/40 border border-violet-500/20 rounded-xl text-xs text-violet-300 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">
              ⚡ Com seus IDs configurados abaixo, todos os links gerados pelo app e extensão usarão
              automaticamente <strong>seus</strong> códigos de afiliado — você ganha comissão em 100% das vendas efetuadas!
            </span>
          </div>

          {/* Campos por plataforma com suporte a Adicionar/Editar, Esconder/Mostrar e Limpeza Automática de URL */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            
            {/* Mercado Livre */}
            <AffiliateItemCard
              label="Mercado Livre Tracking ID"
              labelColor="text-amber-300"
              placeholder="ex: sowh5608494"
              value={apiKeys.mercadolivreTrackingId || ''}
              onSave={(newVal) => {
                const clean = extractCleanTrackingId(newVal, 'mercadolivre');
                onSaveApiKeys({ ...apiKeys, mercadolivreTrackingId: clean });
              }}
              onHowToObtain={() => setActiveHelpModal('mercadolivre')}
              hint="Aceita seu ID (ex: sowh5608494) ou a URL do seu perfil no Mercado Livre — extrai automaticamente!"
              autoCleanUrl={(raw) => extractCleanTrackingId(raw, 'mercadolivre')}
            />

            {/* Amazon */}
            <AffiliateItemCard
              label="Amazon Tag de Associado"
              labelColor="text-yellow-300"
              placeholder="ex: suatag-20"
              value={apiKeys.amazonAssociatesTag || apiKeys.amazonKey || ''}
              onSave={(newVal) => {
                const clean = extractCleanTrackingId(newVal, 'amazon');
                onSaveApiKeys({ ...apiKeys, amazonAssociatesTag: clean, amazonKey: clean });
              }}
              onHowToObtain={() => setActiveHelpModal('amazon')}
              hint="Injeta ?tag=XXX nos links da Amazon Brasil"
              autoCleanUrl={(raw) => extractCleanTrackingId(raw, 'amazon')}
            />

            {/* Shopee */}
            <AffiliateItemCard
              label="Shopee ID de Afiliado / Tracking"
              labelColor="text-orange-300"
              placeholder="ex: 12345678"
              value={apiKeys.shopeeTrackingId || apiKeys.shopeeKey || ''}
              onSave={(newVal) => {
                const clean = extractCleanTrackingId(newVal, 'shopee');
                onSaveApiKeys({ ...apiKeys, shopeeTrackingId: clean, shopeeKey: clean });
              }}
              onHowToObtain={() => setActiveHelpModal('shopee')}
              hint="Injeta ?smtt=XXX ou seu parâmetro de rastreio na Shopee"
              autoCleanUrl={(raw) => extractCleanTrackingId(raw, 'shopee')}
            />

            <AffiliateItemCard
              label="Shopee API AppID"
              labelColor="text-orange-300"
              placeholder="ex: 18361171011"
              value={apiKeys.shopeeAppId || ''}
              onSave={(newVal) => onSaveApiKeys({ ...apiKeys, shopeeAppId: newVal.trim() })}
              onHowToObtain={() => setActiveHelpModal('shopee')}
              hint="AppID obtido no console de Afiliados Shopee (Opcional)"
            />

            <AffiliateItemCard
              label="Shopee API Senha / Secret"
              labelColor="text-orange-300"
              placeholder="ex: PQ2FO5P35ONW..."
              value={apiKeys.shopeeSecret || ''}
              onSave={(newVal) => onSaveApiKeys({ ...apiKeys, shopeeSecret: newVal.trim() })}
              onHowToObtain={() => setActiveHelpModal('shopee')}
              hint="Senha de API obtida no console Shopee (Opcional)"
            />

            {/* AliExpress */}
            <AffiliateItemCard
              label="AliExpress Affiliate ID"
              labelColor="text-red-300"
              placeholder="ex: aff_12345"
              value={apiKeys.aliexpressAffiliateId || apiKeys.aliExpressKey || ''}
              onSave={(newVal) => {
                const clean = extractCleanTrackingId(newVal, 'aliexpress');
                onSaveApiKeys({ ...apiKeys, aliexpressAffiliateId: clean, aliExpressKey: clean });
              }}
              onHowToObtain={() => setActiveHelpModal('aliexpress')}
              hint="Injeta ?aff_id=XXX nos links do AliExpress Portals"
              autoCleanUrl={(raw) => extractCleanTrackingId(raw, 'aliexpress')}
            />

            {/* Shein */}
            <AffiliateItemCard
              label="Shein Publisher Token"
              labelColor="text-stone-300"
              placeholder="ex: token_shein_123"
              value={apiKeys.sheinAffiliateToken || apiKeys.sheinKey || ''}
              onSave={(newVal) => {
                const clean = extractCleanTrackingId(newVal, 'shein');
                onSaveApiKeys({ ...apiKeys, sheinAffiliateToken: clean, sheinKey: clean });
              }}
              onHowToObtain={() => setActiveHelpModal('shein')}
              hint="Injeta ?url_from=XXX nos links da Shein Publisher"
              isFullWidth={true}
              autoCleanUrl={(raw) => extractCleanTrackingId(raw, 'shein')}
            />

          </div>
        </div>
      )}

      {/* Profile Data Section */}
      {activeSection === 'profile' && (
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 space-y-6 shadow-xl animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#1e2636] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-blue-600/15 border border-blue-500/30 text-blue-400 rounded-xl shrink-0">
                <User className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Meu Perfil de Usuário</h3>
                <p className="text-xs text-[#93a0b5]">
                  Visualize e atualize suas informações pessoais e foto de perfil.
                </p>
              </div>
            </div>

            {!isEditingProfile && (
              <button
                type="button"
                onClick={() => setIsEditingProfile(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
              >
                <Edit3 className="w-4 h-4" />
                <span>Atualizar Informações</span>
              </button>
            )}
          </div>

          {!isEditingProfile ? (
            /* Modo de Exibição Limpo */
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              {/* Avatar Box */}
              <div className="flex flex-col items-center justify-center p-6 bg-[#07090f] border border-[#1e2636] rounded-2xl text-center space-y-3">
                <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-blue-500/50 shadow-xl shadow-blue-500/10 bg-[#151a26] flex items-center justify-center">
                  {avatarUrl || user.avatarUrl ? (
                    <img
                      src={avatarUrl || user.avatarUrl}
                      alt={name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-2xl font-black text-blue-400 uppercase">
                      {name ? name.slice(0, 2) : 'US'}
                    </span>
                  )}
                </div>

                <div>
                  <h4 className="text-base font-extrabold text-white">{name || 'Usuário Afiliado'}</h4>
                  <span className="inline-block px-2.5 py-0.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-[10px] font-bold uppercase mt-1">
                    {user.role === 'admin' ? '🛡️ Administrador' : '⚡ Afiliado Minerador'}
                  </span>
                </div>
              </div>

              {/* Informações de Cadastro */}
              <div className="md:col-span-2 space-y-4 bg-[#07090f] border border-[#1e2636] rounded-2xl p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-[10px] font-bold text-[#93a0b5] uppercase tracking-wider block mb-1">
                      Nome Completo
                    </span>
                    <p className="text-sm font-semibold text-white bg-[#0e1119] p-3 rounded-xl border border-[#1e2636]">
                      {name || 'Não informado'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#93a0b5] uppercase tracking-wider block mb-1">
                      E-mail Cadastrado
                    </span>
                    <p className="text-sm font-semibold text-white bg-[#0e1119] p-3 rounded-xl border border-[#1e2636] truncate">
                      {email || 'Não informado'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#93a0b5] uppercase tracking-wider block mb-1">
                      ID de Rastreio Padrão
                    </span>
                    <p className="text-sm font-mono font-bold text-blue-400 bg-[#0e1119] p-3 rounded-xl border border-[#1e2636]">
                      {apiKeys.mercadolivreTrackingId || 'Configurar IDs'}
                    </p>
                  </div>

                  <div>
                    <span className="text-[10px] font-bold text-[#93a0b5] uppercase tracking-wider block mb-1">
                      Status da Conta
                    </span>
                    <p className="text-sm font-semibold text-emerald-400 bg-[#0e1119] p-3 rounded-xl border border-[#1e2636] flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      <span>Conta Ativa e Verificada</span>
                    </p>
                  </div>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(true)}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Atualizar Informações</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Modo de Edição */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                onUpdateProfile({ name, email, avatarUrl });
                setIsEditingProfile(false);
                setSavedSuccess('Perfil atualizado com sucesso!');
                setTimeout(() => setSavedSuccess(null), 3000);
              }}
              className="space-y-4 bg-[#07090f] border border-[#1e2636] rounded-2xl p-5 animate-fadeIn"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-[#eef2f9] block mb-1">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full p-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#eef2f9] block mb-1">E-mail Cadastrado</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full p-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-[#eef2f9] block mb-1">
                    URL da Foto de Perfil (Link da imagem)
                  </label>
                  <input
                    type="url"
                    placeholder="https://exemplo.com/sua-foto.jpg"
                    value={avatarUrl}
                    onChange={(e) => setAvatarUrl(e.target.value)}
                    className="w-full p-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-[10px] text-[#93a0b5] mt-1">
                    Cole o link direto para uma imagem na web para personalizar sua foto.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e2636]">
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(false)}
                  className="px-4 py-2 bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white rounded-xl text-xs font-bold transition-all"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  <span>Salvar Informações</span>
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Modal Popup: Como Obter ID de Afiliado */}
      {currentHelpGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-xl max-h-[90vh] bg-stone-900 border border-stone-800 rounded-3xl p-6 shadow-2xl flex flex-col gap-5 text-stone-200 overflow-y-auto">
            
            <button
              onClick={() => setActiveHelpModal(null)}
              className="absolute top-4 right-4 p-2 text-stone-400 hover:text-stone-200 hover:bg-stone-800 rounded-full transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 border-b border-stone-800 pb-4 pr-8">
              <div className="p-3 bg-violet-500/10 border border-violet-500/30 text-violet-400 rounded-2xl shrink-0">
                <BookOpen className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-bold text-white">Como obter seu ID</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentHelpGuide.badgeColor}`}>
                    {currentHelpGuide.platform}
                  </span>
                </div>
                <p className="text-xs text-stone-400 mt-0.5">{currentHelpGuide.title}</p>
              </div>
            </div>

            {/* Imagem Ilustrativa / Diagrama do Local no Painel */}
            {currentHelpGuide.guideImage && (
              <div className="rounded-2xl overflow-hidden border border-violet-500/30 bg-stone-950 shadow-lg relative group">
                <img
                  src={currentHelpGuide.guideImage}
                  alt={`Guia visual para ${currentHelpGuide.platform}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-auto object-cover max-h-56 sm:max-h-64"
                />
                <div className="absolute bottom-2 right-2 bg-stone-950/90 border border-stone-800 text-[10px] font-semibold text-violet-300 px-2.5 py-1 rounded-lg backdrop-blur-sm">
                  📍 Onde localizar e copiar no painel
                </div>
              </div>
            )}

            {/* Passo a Passo */}
            <div className="space-y-3">
              <p className="text-xs font-bold uppercase tracking-wider text-stone-400">Instruções Passo a Passo:</p>
              <div className="space-y-2.5">
                {currentHelpGuide.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-3 p-2.5 bg-stone-950 rounded-xl border border-stone-800/80">
                    <span className="w-5 h-5 rounded-full bg-violet-500/20 text-violet-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <p className="text-xs text-stone-300 leading-relaxed">{step}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Exemplo de formato */}
            <div className="p-3 bg-stone-950 rounded-xl border border-stone-800/80 flex items-center justify-between text-xs">
              <span className="text-stone-500 font-medium">Exemplo de formato válido:</span>
              <code className="text-amber-300 font-mono font-bold bg-stone-900 px-2 py-1 rounded border border-stone-800">
                {currentHelpGuide.example}
              </code>
            </div>

            {/* Ações */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-stone-800 shrink-0">
              <button
                type="button"
                onClick={() => setActiveHelpModal(null)}
                className="px-4 py-2.5 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-semibold transition-colors"
              >
                Fechar
              </button>
              
              <a
                href={currentHelpGuide.obtainUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setActiveHelpModal(null)}
                className="px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-violet-950/50 transition-all"
              >
                <span>Obter meu ID na {currentHelpGuide.platform}</span>
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
