import React, { useState, useEffect } from 'react';
import { ApiKeysConfig, UserProfile, CommissionRatesConfig } from '../types';
import { extractCleanTrackingId } from '../utils/affiliateLink';
import { getApiUrl, apiFetch } from '../utils/apiBase';
import { 
  AlarmSettings, 
  getAlarmSettings, 
  saveAlarmSettings, 
  playAlarmSound, 
  requestNotificationPermission,
  ALARM_SOUND_OPTIONS
} from '../utils/alarmUtils';
import { getTimezoneInfo, formatCurrentTimeInTimezone } from '../utils/timezoneUtils';
import { 
  User, 
  Save, 
  Sparkles, 
  Check, 
  CheckCircle2, 
  Bell, 
  Clock, 
  Volume2, 
  Smartphone, 
  ShieldCheck, 
  Eye, 
  EyeOff, 
  Key, 
  ExternalLink,
  Settings as SettingsIcon,
  X,
  Upload,
  AlertTriangle,
  Puzzle,
  Download,
  ShoppingBag,
  Zap,
  Tag,
  Layers,
  CheckSquare,
  HelpCircle,
  Globe,
  Info,
  Pencil,
  Unlink,
  LogOut
} from 'lucide-react';

interface SettingsTabProps {
  user: UserProfile;
  apiKeys: ApiKeysConfig;
  alarmSettings?: AlarmSettings;
  commissionRates?: CommissionRatesConfig;
  currentTimezone?: string;
  onOpenTimezoneModal?: () => void;
  onSaveAlarmSettings?: (settings: AlarmSettings) => void;
  onSaveApiKeys: (keys: ApiKeysConfig) => void;
  onSaveCommissionRates?: (rates: CommissionRatesConfig) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  user,
  apiKeys: initialApiKeys,
  alarmSettings: initialAlarmSettings,
  currentTimezone = 'America/Sao_Paulo',
  onOpenTimezoneModal,
  onSaveAlarmSettings,
  onSaveApiKeys,
  onUpdateProfile,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'gemini' | 'affiliates' | 'alarm'>('profile');

  // --- 1. Meu Perfil ---
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [profileSavedFeedback, setProfileSavedFeedback] = useState(false);

  const handleSaveProfile = () => {
    onUpdateProfile({ name, email });
    setProfileSavedFeedback(true);
    setTimeout(() => setProfileSavedFeedback(false), 3000);
  };

  // --- 2. Chave Gemini ---
  const [geminiKey, setGeminiKey] = useState(initialApiKeys.geminiApiKey || '');
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [geminiSavedFeedback, setGeminiSavedFeedback] = useState(false);

  const handleSaveGeminiKey = () => {
    onSaveApiKeys({
      ...initialApiKeys,
      geminiApiKey: geminiKey.trim(),
    });
    setGeminiSavedFeedback(true);
    setTimeout(() => setGeminiSavedFeedback(false), 3000);
  };

  // --- 3. Afiliados & Conexões ---
  const [keys, setKeys] = useState<ApiKeysConfig>(initialApiKeys);

  useEffect(() => {
    setKeys(initialApiKeys);
    setShopeeEditId(initialApiKeys.shopeeAppId || '');
    setShopeeEditSecret(initialApiKeys.shopeeSecret || '');
    setIsEditingShopeeApi(!initialApiKeys.shopeeAppId);
  }, [initialApiKeys]);

  const [shopeeEditId, setShopeeEditId] = useState(initialApiKeys.shopeeAppId || '');
  const [shopeeEditSecret, setShopeeEditSecret] = useState(initialApiKeys.shopeeSecret || '');
  const [isEditingShopeeApi, setIsEditingShopeeApi] = useState(!initialApiKeys.shopeeAppId);
  const [shopeeFeedback, setShopeeFeedback] = useState(false);
  const [awinTest, setAwinTest] = useState<{ loading: boolean; ok: boolean | null; msg: string; stores: { id: string; name: string }[] }>({ loading: false, ok: null, msg: '', stores: [] });

  const handleTestAwin = async () => {
    setAwinTest({ loading: true, ok: null, msg: '', stores: [] });
    try {
      const res = await apiFetch('/api/awin/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publisherId: keys.awinPublisherId, apiToken: keys.awinApiToken }),
        action: 'Testar conexão Awin',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setAwinTest({ loading: false, ok: true, msg: `Conectado! ${json.count} loja(s) aprovada(s).`, stores: json.advertisers || [] });
      } else {
        setAwinTest({ loading: false, ok: false, msg: json.error || 'Falha na conexão.', stores: [] });
      }
    } catch (e: any) {
      setAwinTest({ loading: false, ok: false, msg: e?.message || 'Erro ao conectar.', stores: [] });
    }
  };
  const [affiliatesSavedFeedback, setAffiliatesSavedFeedback] = useState(false);
  const [editingPlatforms, setEditingPlatforms] = useState<Record<string, boolean>>({});
  const [revealedPlatforms, setRevealedPlatforms] = useState<Record<string, boolean>>({});
  const [savedPlatformNotice, setSavedPlatformNotice] = useState<string | null>(null);

  const toggleEditPlatform = (platformId: string) => {
    setEditingPlatforms((prev) => ({ ...prev, [platformId]: !prev[platformId] }));
  };

  const toggleRevealPlatform = (platformId: string) => {
    setRevealedPlatforms((prev) => ({ ...prev, [platformId]: !prev[platformId] }));
  };

  const handleSaveAffiliateKeys = () => {
    onSaveApiKeys(keys);
    setAffiliatesSavedFeedback(true);
    setTimeout(() => setAffiliatesSavedFeedback(false), 3000);
  };

  const handleDisconnectOfficialAccount = (platformId: string) => {
    let newKeys = { ...keys };
    if (platformId === 'mercadolivre') {
      newKeys = {
        ...newKeys,
        mercadoLivreKey: '',
        mercadoLivreRefreshToken: '',
        mercadoLivreExpiresAt: 0,
        mercadoLivreUserId: '',
        mercadoLivreNickname: '',
        mercadoLivreEmail: '',
      };
    } else if (platformId === 'shopee') {
      newKeys = {
        ...newKeys,
        shopeeKey: '',
        shopeeAppId: '',
        shopeeSecret: '',
      };
    } else if (platformId === 'amazon') {
      newKeys = {
        ...newKeys,
        amazonKey: '',
      };
    } else if (platformId === 'aliexpress') {
      newKeys = {
        ...newKeys,
        aliExpressKey: '',
      };
    } else if (platformId === 'shein') {
      newKeys = {
        ...newKeys,
        sheinKey: '',
      };
    } else if (platformId === 'tiktokshop') {
      newKeys = {
        ...newKeys,
        tiktokshopKey: '',
        tiktokshopRefreshToken: '',
        tiktokshopExpiresAt: 0,
        tiktokshopUserId: '',
        tiktokshopNickname: '',
        tiktokshopEmail: '',
        tiktokshopAppKey: '',
        tiktokshopSecret: '',
      };
    }
    setKeys(newKeys);
    onSaveApiKeys(newKeys);
  };

  const handleClearAffiliateId = (fieldKey: keyof ApiKeysConfig) => {
    const newKeys = { ...keys, [fieldKey]: '' };
    setKeys(newKeys);
    onSaveApiKeys(newKeys);
  };

  const handleDisconnectPlatform = (platformId: string) => {
    handleDisconnectOfficialAccount(platformId);
    if (platformId === 'mercadolivre') handleClearAffiliateId('mercadolivreTrackingId');
    else if (platformId === 'shopee') handleClearAffiliateId('shopeeTrackingId');
    else if (platformId === 'amazon') handleClearAffiliateId('amazonAssociatesTag');
    else if (platformId === 'aliexpress') handleClearAffiliateId('aliexpressAffiliateId');
    else if (platformId === 'shein') handleClearAffiliateId('sheinAffiliateToken');
    else if (platformId === 'tiktokshop') handleClearAffiliateId('tiktokshopTrackingId');
    setEditingPlatforms((prev) => ({ ...prev, [platformId]: false }));
  };

  // --- 4. Alarmes & Configurações Modal ---
  const [alarm, setAlarm] = useState<AlarmSettings>(
    initialAlarmSettings || getAlarmSettings()
  );
  const [isAlarmModalOpen, setIsAlarmModalOpen] = useState(false);
  const [notifPermission, setNotifPermission] = useState<string>(
    'Notification' in window ? Notification.permission : 'unsupported'
  );
  const [audioUploadError, setAudioUploadError] = useState<string | null>(null);

  const handleToggleAlarm = () => {
    const updated = { ...alarm, enabled: !alarm.enabled };
    setAlarm(updated);
    saveAlarmSettings(updated);
    if (onSaveAlarmSettings) onSaveAlarmSettings(updated);
  };

  const handleUpdateAlarmField = (part: Partial<AlarmSettings>) => {
    const updated = { ...alarm, ...part };
    setAlarm(updated);
    saveAlarmSettings(updated);
    if (onSaveAlarmSettings) onSaveAlarmSettings(updated);
  };

  const handleRequestNotifPermission = async () => {
    const granted = await requestNotificationPermission();
    if ('Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    if (granted) {
      alert('Permissão para Notificações do Android / Navegador concedida com sucesso!');
    } else {
      alert('A permissão foi negada. Para ativar, acesse as Configurações do seu Navegador / Celular Android e permita as Notificações para este site.');
    }
  };

  // Upload de Som Personalizado
  const handleCustomAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAudioUploadError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('audio/')) {
      setAudioUploadError('Por favor selecione um arquivo de áudio válido (.mp3, .wav, .ogg).');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setAudioUploadError('O arquivo de áudio deve ter menos de 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        handleUpdateAlarmField({
          soundType: 'custom',
          customSoundUrl: dataUrl,
        });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDownloadExtension = () => {
    window.open(getApiUrl('/api/extension/download'), '_blank');
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto animate-fadeIn">
      {/* Header Padronizado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e2636] pb-3">
        <div>
          <h1 className="text-lg font-extrabold text-white">Configurações</h1>
          <p className="text-xs text-[#93a0b5]">
            Perfil, chaves de IA, IDs de afiliados e preferências de alertas.
          </p>
        </div>
      </div>

      {/* Sub-navegação do Menu de Configurações */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <User className="w-3.5 h-3.5" />
          <span>Meu Perfil</span>
        </button>

        <button
          onClick={() => setActiveTab('gemini')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
            activeTab === 'gemini'
              ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          <span>Chave Gemini</span>
        </button>

        <button
          onClick={() => setActiveTab('affiliates')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
            activeTab === 'affiliates'
              ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <Key className="w-3.5 h-3.5 text-emerald-400" />
          <span>Contas e Afiliados</span>
        </button>

        <button
          onClick={() => setActiveTab('alarm')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border whitespace-nowrap cursor-pointer ${
            activeTab === 'alarm'
              ? 'bg-blue-600 text-white border-blue-400 shadow-sm shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <Bell className="w-3.5 h-3.5 text-amber-400" />
          <span>Alarmes</span>
        </button>
      </div>

      {/* --- SECTION 1: MEU PERFIL --- */}
      {activeTab === 'profile' && (
        <div className="p-6 bg-[#0e1119] border border-[#1e2636] rounded-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-[#1e2636] pb-4">
            <div className="p-3 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Meu Perfil</h2>
              <p className="text-xs text-[#93a0b5]">Gerencie suas informações de conta de afiliado</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#eef2f9] block mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-[#eef2f9] block mb-1">E-mail Cadastrado</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Fuso Horário Card */}
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{getTimezoneInfo(currentTimezone).flag}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-extrabold text-white">
                      Fuso Horário: {getTimezoneInfo(currentTimezone).name}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                      {getTimezoneInfo(currentTimezone).offset}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#93a0b5] mt-0.5">
                    {getTimezoneInfo(currentTimezone).location} • Hora Atual:{' '}
                    <strong className="text-emerald-400 font-mono">
                      {formatCurrentTimeInTimezone(currentTimezone)}
                    </strong>
                  </p>
                </div>
              </div>

              {onOpenTimezoneModal && (
                <button
                  type="button"
                  onClick={onOpenTimezoneModal}
                  className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all shrink-0"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Mudar Fuso Horário</span>
                </button>
              )}
            </div>

            <div className="flex items-center justify-between pt-2">
              {profileSavedFeedback ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Perfil atualizado com sucesso!
                </span>
              ) : (
                <span />
              )}

              <button
                onClick={handleSaveProfile}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/20"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Perfil</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SECTION 2: CHAVE GEMINI --- */}
      {activeTab === 'gemini' && (
        <div className="p-6 bg-[#0e1119] border border-[#1e2636] rounded-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-[#1e2636] pb-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Chave Gemini</h2>
              <p className="text-xs text-[#93a0b5]">
                Utilizada para geração de copies inteligentes, variações de gatilhos e roteiros
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-[#eef2f9] block mb-1">Digite sua chave API</label>
              <div className="relative">
                <input
                  type={showGeminiKey ? 'text' : 'password'}
                  placeholder="AIzaSy..."
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="button"
                  onClick={() => setShowGeminiKey(!showGeminiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#93a0b5] hover:text-white"
                >
                  {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              {geminiSavedFeedback ? (
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-4 h-4" /> Chave Gemini salva com sucesso!
                </span>
              ) : (
                <span />
              )}

              <button
                onClick={handleSaveGeminiKey}
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
              >
                <Save className="w-4 h-4" />
                <span>Salvar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- SECTION 3: AFILIADOS & CONEXÕES --- */}
      {activeTab === 'affiliates' && (
        <div className="p-6 bg-[#0e1119] border border-[#1e2636] rounded-2xl space-y-5 animate-fadeIn">
          <div className="flex items-center gap-3 border-b border-[#1e2636] pb-4">
            <div className="p-3 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded-xl">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white">Conexão com Plataformas de Afiliados</h2>
              <p className="text-xs text-[#93a0b5]">
                Configure seu link de afiliado ou ID para rastreamento automático de vendas e comissões.
              </p>
            </div>
          </div>



          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              {
                id: 'mercadolivre',
                title: 'Mercado Livre',
                emoji: '🛒',
                badge: 'OAuth 2.0 / Afiliados',
                fieldKey: 'mercadolivreTrackingId' as keyof ApiKeysConfig,
                apiKeyField: 'mercadoLivreKey' as keyof ApiKeysConfig,
                placeholder: 'Cole seu link de afiliado ou Tracking ID (ex: sowh5608494)',
                colorBorder: 'border-yellow-500/30 focus:border-yellow-500',
                colorBadge: 'bg-yellow-400/10 text-yellow-300 border-yellow-400/20',
                colorTitle: 'text-yellow-400',
                oauthUrl: getApiUrl('/api/auth/mercadolivre/connect'),
                connectButtonText: 'Conectar Conta Oficial Mercado Livre'
              },
              {
                id: 'shopee',
                title: 'Shopee Afiliados',
                emoji: '🧡',
                badge: 'API Open Platform',
                fieldKey: 'shopeeTrackingId' as keyof ApiKeysConfig,
                apiKeyField: 'shopeeAppId' as keyof ApiKeysConfig,
                placeholder: 'Ex: meu_subid_ou_link (opcional se configurou AppID abaixo)',
                colorBorder: 'border-orange-500/30 focus:border-orange-500',
                colorBadge: 'bg-orange-400/10 text-orange-300 border-orange-400/20',
                colorTitle: 'text-orange-400',
              },
              {
                id: 'amazon',
                title: 'Amazon Associados',
                emoji: '📦',
                badge: 'Tag de Associado',
                fieldKey: 'amazonAssociatesTag' as keyof ApiKeysConfig,
                apiKeyField: 'amazonKey' as keyof ApiKeysConfig,
                placeholder: 'Cole sua Tag da Amazon (ex: suatag-20 ou link de associado)',
                colorBorder: 'border-blue-500/30 focus:border-blue-500',
                colorBadge: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
                colorTitle: 'text-blue-400',
              },
              {
                id: 'awin',
                title: 'Awin (Kabum, Natura, Boticário...)',
                emoji: '🟣',
                badge: 'Publisher ID + API Token',
                fieldKey: 'awinPublisherId' as keyof ApiKeysConfig,
                apiKeyField: 'awinApiToken' as keyof ApiKeysConfig,
                placeholder: 'Seu Publisher ID da Awin (ex: 1234567)',
                colorBorder: 'border-purple-500/30 focus:border-purple-500',
                colorBadge: 'bg-purple-400/10 text-purple-300 border-purple-400/20',
                colorTitle: 'text-purple-400',
              },
              {
                id: 'aliexpress',
                title: 'AliExpress Afiliados',
                emoji: '🌐',
                badge: 'Affiliate ID',
                fieldKey: 'aliexpressAffiliateId' as keyof ApiKeysConfig,
                apiKeyField: 'aliExpressKey' as keyof ApiKeysConfig,
                placeholder: 'Cole seu ID de Afiliado AliExpress (ex: aff_12345 ou link)',
                colorBorder: 'border-red-500/30 focus:border-red-500',
                colorBadge: 'bg-red-400/10 text-red-300 border-red-400/20',
                colorTitle: 'text-red-400',
              },
              {
                id: 'shein',
                title: 'Shein Afiliados',
                emoji: '👗',
                badge: 'Token / Link',
                fieldKey: 'sheinAffiliateToken' as keyof ApiKeysConfig,
                apiKeyField: 'sheinKey' as keyof ApiKeysConfig,
                placeholder: 'Cole seu Token Shein ou link de indicação',
                colorBorder: 'border-blue-500/30 focus:border-blue-500',
                colorBadge: 'bg-blue-400/10 text-blue-300 border-blue-400/20',
                colorTitle: 'text-blue-400',
              },
              {
                id: 'tiktokshop',
                title: 'TikTok Shop Afiliados',
                emoji: '🎵',
                badge: 'ID de Criador / Afiliado',
                fieldKey: 'tiktokshopTrackingId' as keyof ApiKeysConfig,
                apiKeyField: 'tiktokshopKey' as keyof ApiKeysConfig,
                placeholder: 'Cole seu ID TikTok Shop, @usuario ou link de criador (ex: https://vt.tiktok.com/...)',
                colorBorder: 'border-blue-600/30 focus:border-blue-600',
                colorBadge: 'bg-blue-600/10 text-blue-300 border-blue-600/20',
                colorTitle: 'text-blue-400',
              },
            ].map((plat) => {
              const isOfficialConnected = Boolean(plat.apiKeyField && (keys[plat.apiKeyField] as string)?.trim());
              const trackingIdVal = (keys[plat.fieldKey] as string) || '';
              const isIdConfigured = Boolean(trackingIdVal.trim());

              const isEditing = Boolean(editingPlatforms[plat.id]);
              const isRevealed = Boolean(revealedPlatforms[plat.id]);

              return (
                <div key={plat.id} className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-4 relative">
                  {/* Header */}
                  <div className="flex items-center justify-between border-b border-[#1e2636] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{plat.emoji}</span>
                      <span className={`text-xs font-bold ${plat.colorTitle}`}>{plat.title}</span>
                    </div>
                    {plat.badge && (
                      <span className={`px-2 py-0.5 rounded text-[9px] font-bold border ${plat.colorBadge}`}>
                        {plat.badge}
                      </span>
                    )}
                  </div>

                  {/* SEÇÃO 1: ID DE AFILIADO / TRACKING ID (OUTRAS PLATAFORMAS) */}
                  {plat.id !== 'mercadolivre' && plat.id !== 'shopee' && (
                    <div className="p-3 bg-[#0e1119] border border-[#1e2636] rounded-xl space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                          <Tag className="w-3.5 h-3.5" /> 1. ID de Afiliado (Rastreamento)
                        </span>
                        {isIdConfigured ? (
                          <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            ID Configurado
                          </span>
                        ) : (
                          <span className="text-[9px] text-[#93a0b5] bg-[#1e2636] px-2 py-0.5 rounded">
                            Não Inserido
                          </span>
                        )}
                      </div>

                      {isEditing ? (
                        <div className="space-y-2 pt-1 animate-fadeIn">
                          <input
                            type="text"
                            autoFocus
                            placeholder={plat.placeholder}
                            value={trackingIdVal}
                            onChange={(e) => {
                              const clean = extractCleanTrackingId(e.target.value, plat.id);
                              setKeys({ ...keys, [plat.fieldKey]: clean });
                            }}
                            className={`w-full px-3 py-2 bg-[#151a26] border rounded-xl text-xs font-mono text-white focus:outline-none ${plat.colorBorder}`}
                          />
                          <p className="text-[9px] text-[#93a0b5] leading-normal">
                            💡 Cole seu ID ou link de afiliado completo (extraímos o ID automaticamente).
                          </p>
                          <div className="flex items-center gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleSaveAffiliateKeys();
                                toggleEditPlatform(plat.id);
                                setSavedPlatformNotice(plat.id);
                                setTimeout(() => setSavedPlatformNotice(null), 2500);
                              }}
                              className="px-4 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-xs flex items-center gap-1 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
                            >
                              <Check className="w-3.5 h-3.5" />
                              <span>Salvar ID</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleEditPlatform(plat.id)}
                              className="px-3 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white border border-[#1e2636] text-xs font-medium transition-all cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2 pt-1">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-mono font-bold text-white tracking-wide truncate block">
                              {isIdConfigured ? (
                                isRevealed ? trackingIdVal : '••••••••••••••••'
                              ) : (
                                <span className="text-[#93a0b5]/60 italic font-sans text-xs">Nenhum ID inserido</span>
                              )}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {isIdConfigured && (
                              <button
                                type="button"
                                onClick={() => toggleRevealPlatform(plat.id)}
                                className="p-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white border border-[#1e2636] transition-all cursor-pointer"
                                title={isRevealed ? "Esconder ID" : "Mostrar ID"}
                              >
                                {isRevealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => toggleEditPlatform(plat.id)}
                              className="px-2.5 py-1.5 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-amber-400 border border-[#1e2636] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>{isIdConfigured ? 'Editar ID' : 'Inserir ID'}</span>
                            </button>

                            {isIdConfigured && (
                              <button
                                type="button"
                                onClick={() => handleClearAffiliateId(plat.fieldKey)}
                                className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 transition-all cursor-pointer"
                                title="Limpar ID"
                              >
                                <Unlink className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SEÇÃO CONTA OFICIAL / API */}
                  <div className={`p-3 rounded-xl border space-y-2 transition-all ${
                    plat.id === 'shopee'
                      ? (!isEditingShopeeApi ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-[#0e1119] border-[#1e2636]')
                      : (isOfficialConnected ? 'bg-emerald-950/20 border-emerald-500/30' : 'bg-[#0e1119] border-[#1e2636]')
                  }`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-[#eef2f9] flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5 text-blue-400" /> {plat.id === 'shopee' ? 'Configuração da API Shopee' : 'Autenticação Oficial (Login / API)'}
                      </span>
                      {plat.id === 'shopee' ? (
                        !isEditingShopeeApi ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> API Configurada
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-[#151a26] text-[#93a0b5] border border-[#1e2636]">
                            Pendente de Configuração
                          </span>
                        )
                      ) : isOfficialConnected ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" /> Conta Oficial Conectada
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[9px] font-semibold bg-[#151a26] text-[#93a0b5] border border-[#1e2636]">
                          Conta Oficial Não Conectada
                        </span>
                      )}
                    </div>

                    {plat.id === 'shopee' ? (
                      <div className="space-y-3 pt-1 animate-fadeIn">
                        {!isEditingShopeeApi ? (
                          <div className="space-y-2.5">
                            <p className="text-[10px] text-emerald-300/80 leading-relaxed">
                              Sua API Oficial de Afiliados Shopee está ativa e configurada no aplicativo.
                            </p>

                            <div className="p-2.5 bg-[#0e1119] border border-orange-500/30 rounded-xl space-y-1.5">
                              <div className="text-[11px] font-bold text-orange-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <Key className="w-3.5 h-3.5 text-orange-400" />
                                  <span>App ID:</span>
                                </span>
                                <strong className="text-white font-mono">{keys.shopeeAppId}</strong>
                              </div>
                              <div className="text-[11px] font-bold text-orange-300 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                  <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                                  <span>App Secret:</span>
                                </span>
                                <span className="text-[#eef2f9] font-mono">
                                  {isRevealed ? keys.shopeeSecret : '••••••••••••••••'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-emerald-500/20">
                              <button
                                type="button"
                                onClick={() => toggleRevealPlatform('shopee')}
                                className="text-[10px] text-[#93a0b5] hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                {isRevealed ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                <span>{isRevealed ? "Esconder Secret" : "Mostrar Secret"}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setIsEditingShopeeApi(true)}
                                className="px-2.5 py-1 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-amber-400 border border-[#1e2636] text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                              >
                                <Pencil className="w-3 h-3" />
                                <span>Editar</span>
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-[10px] text-[#eef2f9] leading-relaxed">
                              Informe seu <strong>App ID</strong> e <strong>Senha (App Secret)</strong> gerados na sua conta de afiliado da Shopee.
                            </p>

                            <div className="space-y-2">
                              <div>
                                <label className="block text-[10px] font-bold text-[#93a0b5] uppercase mb-1">
                                  App ID (Shopee Open API)
                                </label>
                                <input
                                  type="text"
                                  placeholder="Ex: 18361171011"
                                  value={shopeeEditId}
                                  onChange={(e) => setShopeeEditId(e.target.value.trim())}
                                  className="w-full px-3 py-2 bg-[#151a26] border border-orange-500/30 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-[#93a0b5] uppercase mb-1">
                                  App Secret / Senha (Shopee Open API)
                                </label>
                                <input
                                  type={isRevealed ? "text" : "password"}
                                  placeholder="Ex: PQ2FO5P35ONWVQS2L5YEYWGLPKJFEHDS"
                                  value={shopeeEditSecret}
                                  onChange={(e) => setShopeeEditSecret(e.target.value.trim())}
                                  className="w-full px-3 py-2 bg-[#151a26] border border-orange-500/30 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                                />
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const updated = { ...keys, shopeeAppId: shopeeEditId, shopeeSecret: shopeeEditSecret };
                                  setKeys(updated);
                                  onSaveApiKeys(updated);
                                  setIsEditingShopeeApi(false);
                                  setShopeeFeedback(true);
                                  setTimeout(() => setShopeeFeedback(false), 3000);
                                }}
                                className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1 transition-all cursor-pointer"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Salvar API Shopee</span>
                              </button>
                              {keys.shopeeAppId && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShopeeEditId(keys.shopeeAppId || '');
                                    setShopeeEditSecret(keys.shopeeSecret || '');
                                    setIsEditingShopeeApi(false);
                                  }}
                                  className="py-1.5 px-3 rounded-lg bg-[#151a26] hover:bg-[#1e2636] text-[#93a0b5] hover:text-white font-bold text-xs transition-all cursor-pointer"
                                >
                                  Cancelar
                                </button>
                              )}
                            </div>

                            {shopeeFeedback && (
                              <p className="text-[10px] text-emerald-400 font-bold animate-fadeIn">
                                ✓ API Shopee configurada e salva com sucesso!
                              </p>
                            )}

                            <a
                              href="https://affiliate.shopee.com.br/open_api"
                              target="_blank"
                              rel="noopener noreferrer"
                              className="w-full py-1.5 px-3 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 text-orange-300 border border-orange-500/30 font-bold text-[10px] flex items-center justify-center gap-1 transition-all cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3 text-orange-400" />
                              <span>Abrir Painel Shopee Open API</span>
                            </a>

                            <div className="p-2 bg-[#0e1119] border border-orange-500/10 rounded-xl space-y-0.5 text-[9px] text-[#eef2f9]">
                              <span className="font-bold text-orange-400 flex items-center gap-1">
                                <HelpCircle className="w-3 h-3" /> Onde encontrar na Shopee:
                              </span>
                              <ol className="list-decimal list-inside space-y-0.5 text-[#93a0b5] pt-0.5">
                                <li>Clique no link acima para abrir o painel de afiliados.</li>
                                <li>Copie o seu <strong>AppID</strong> e cole no campo acima.</li>
                                <li>Copie o seu <strong>App Secret (Senha)</strong> e cole no campo acima.</li>
                                <li>Clique no botão <strong>Salvar API Shopee</strong>.</li>
                              </ol>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : isOfficialConnected ? (
                      <div className="space-y-2 pt-1 animate-fadeIn">
                        <p className="text-[10px] text-emerald-300/80 leading-relaxed">
                          Sua conta oficial no {plat.title} está autenticada e autorizada no aplicativo.
                        </p>

                        {plat.id === 'mercadolivre' && (keys.mercadoLivreNickname || keys.mercadoLivreUserId) && (
                          <div className="p-2.5 bg-[#0e1119] border border-emerald-500/30 rounded-xl space-y-1 my-1.5">
                            <div className="text-[11px] font-bold text-emerald-300 flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-emerald-400" />
                              <span>Conta Mercado Livre: <strong className="text-white">@{keys.mercadoLivreNickname || 'Autenticado'}</strong></span>
                            </div>
                            {keys.mercadoLivreUserId && (
                              <div className="text-[10px] text-[#eef2f9] font-mono pl-5">
                                ID do Usuário: {keys.mercadoLivreUserId}
                              </div>
                            )}
                            {keys.mercadoLivreEmail && (
                              <div className="text-[10px] text-[#eef2f9] pl-5">
                                Email: {keys.mercadoLivreEmail}
                              </div>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-emerald-500/20">
                          <span className="text-[10px] text-[#93a0b5] font-mono truncate">
                            {isRevealed
                              ? ((keys[plat.apiKeyField!] as string) || 'Token de Acesso Ativo')
                              : '•••••••••••••••• (Autenticado)'}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDisconnectOfficialAccount(plat.id)}
                            className="px-2.5 py-1 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer"
                          >
                            <Unlink className="w-3 h-3" />
                            <span>Desconectar Conta Oficial</span>
                          </button>
                        </div>
                      </div>
                    ) : plat.id === 'tiktokshop' ? (
                      <div className="p-2.5 bg-[#07090f] border border-blue-600/20 rounded-xl space-y-2">
                        <div className="flex items-center gap-1.5 text-blue-400 font-bold text-[11px]">
                          <Info className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span>Integração Simplificada de Criadores</span>
                        </div>
                        <p className="text-[10px] text-[#eef2f9] leading-relaxed">
                          Como Criador/Afiliado do TikTok Shop, você não precisa de CNPJ corporativo nem de API de vendedor.
                        </p>
                        <div className="p-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-[9px] text-[#eef2f9] space-y-1">
                          <p className="text-emerald-400 font-bold">✓ Como Funciona:</p>
                          <p>1. Pegue seu ID/Usuário ou link de vitrine no app do TikTok (Central do Criador).</p>
                          <p>2. Insira no campo acima (Seção 1) e clique em <strong>Salvar ID</strong>.</p>
                          <p>3. Pronto! O app adicionará automaticamente seu código de afiliado em todos os produtos gerados.</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2 pt-1">
                        {plat.oauthUrl ? (
                          <a
                            href={plat.oauthUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => {
                              if (window.self !== window.top) {
                                e.preventDefault();
                                try {
                                  const popup = window.open(plat.oauthUrl!, '_blank');
                                  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
                                    window.top ? (window.top.location.href = plat.oauthUrl!) : (window.location.href = plat.oauthUrl!);
                                  }
                                } catch {
                                  if (window.top) {
                                    window.top.location.href = plat.oauthUrl!;
                                  } else {
                                    window.location.href = plat.oauthUrl!;
                                  }
                                }
                              }
                            }}
                            className="w-full py-2 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-[#0e1119] font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-yellow-500/10 cursor-pointer"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>{plat.connectButtonText || `Conectar Conta Oficial ${plat.title}`}</span>
                          </a>
                        ) : plat.id === 'awin' ? (
                          <div className="space-y-2">
                            <label className="block text-[10px] font-bold text-[#93a0b5] uppercase">API Token da Awin</label>
                            <input
                              type={isRevealed ? 'text' : 'password'}
                              placeholder="Cole o API Token do painel Awin"
                              value={(keys.awinApiToken as string) || ''}
                              onChange={(e) => setKeys({ ...keys, awinApiToken: e.target.value.trim() })}
                              className="w-full px-3 py-2 bg-[#151a26] border border-purple-500/30 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-purple-500"
                            />
                            <button
                              type="button"
                              onClick={handleTestAwin}
                              disabled={awinTest.loading || !keys.awinPublisherId || !keys.awinApiToken}
                              className="w-full py-2 rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all"
                            >
                              {awinTest.loading ? 'Testando...' : 'Testar conexão Awin'}
                            </button>
                            {awinTest.ok === true && (
                              <div className="text-[10px] text-emerald-400 font-bold">
                                ✓ {awinTest.msg}
                                {awinTest.stores.length > 0 && (
                                  <div className="mt-1 max-h-28 overflow-y-auto text-[#93a0b5] font-normal">
                                    {awinTest.stores.map((s) => <div key={s.id}>• {s.name} <span className="text-[#4b5872]">(#{s.id})</span></div>)}
                                  </div>
                                )}
                              </div>
                            )}
                            {awinTest.ok === false && <p className="text-[10px] text-red-400 font-bold">✗ {awinTest.msg}</p>}
                            <p className="text-[9px] text-[#4b5872]">Salve as configurações depois de testar. Lojas "Pendente" na Awin só pagam comissão após aprovadas.</p>
                          </div>
                        ) : (
                          <p className="text-[10px] text-[#93a0b5] italic">
                            Conexão de conta oficial indisponível para esta plataforma.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1e2636]">
            {affiliatesSavedFeedback ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> Configurações de afiliados salvas com sucesso!
              </span>
            ) : (
              <span className="text-[11px] text-[#93a0b5]">
                Suas comissões serão atreladas automaticamente aos links gerados na plataforma.
              </span>
            )}

            <button
              onClick={handleSaveAffiliateKeys}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Todas</span>
            </button>
          </div>
        </div>
      )}

      {/* --- SECTION 4: ALARMES & NOTIFICAÇÕES --- */}
      {activeTab === 'alarm' && (
        <div className="p-6 bg-[#0e1119] border border-[#1e2636] rounded-2xl space-y-6 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-[#1e2636] pb-4">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-xl">
                <Bell className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-base font-extrabold text-white">Alarmes e Notificações de Divulgação</h2>
                <p className="text-xs text-[#93a0b5]">
                  Lembretes periódicos automáticos para você manter a frequência de disparos
                </p>
              </div>
            </div>

            {/* Ícone de Engrenagem Configurações */}
            <button
              onClick={() => setIsAlarmModalOpen(true)}
              className="p-2.5 rounded-xl bg-[#151a26] hover:bg-[#1e2636] text-amber-400 border border-[#1e2636] transition-all flex items-center gap-1.5 font-bold text-xs"
              title="Configurações do Alarme"
            >
              <SettingsIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Configurações</span>
            </button>
          </div>

          {/* Ativação Simples do Alarme */}
          <div className="p-5 bg-[#151a26] border border-[#1e2636] rounded-2xl flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-white">Status do Alarme Lembrete</h3>
              <p className="text-xs text-[#93a0b5] mt-0.5">
                {alarm.enabled
                  ? `Alarme ATIVADO a cada ${alarm.intervalMinutes} min (${alarm.startHour} às ${alarm.endHour})`
                  : 'Alarme DESATIVADO'}
              </p>
            </div>

            <button
              onClick={handleToggleAlarm}
              className={`px-5 py-2.5 rounded-xl font-extrabold text-xs transition-all ${
                alarm.enabled
                  ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/20'
                  : 'bg-[#151a26] text-[#93a0b5]'
              }`}
            >
              {alarm.enabled ? 'Alarme Ativado ✓' : 'Alarme Desativado'}
            </button>
          </div>
        </div>
      )}

      {/* --- POPUP MODAL DE CONFIGURAÇÕES DO ALARME --- */}
      {isAlarmModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-lg bg-[#0e1119] border border-[#1e2636] rounded-2xl p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                <SettingsIcon className="w-4 h-4 text-amber-400" /> Configurações do Alarme
              </h3>
              <button onClick={() => setIsAlarmModalOpen(false)} className="text-[#93a0b5] hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* 1. Intervalo */}
              <div>
                <label className="font-bold text-[#eef2f9] block mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Intervalo de Repetição
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[5, 10, 15, 30, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleUpdateAlarmField({ intervalMinutes: m })}
                      className={`py-2 rounded-xl font-bold border text-center transition-all ${
                        alarm.intervalMinutes === m
                          ? 'bg-amber-500 text-white border-amber-400 font-extrabold'
                          : 'bg-[#151a26] text-[#93a0b5] border-[#1e2636] hover:text-white'
                      }`}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Janela de Horário */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#1e2636]">
                <div>
                  <label className="font-bold text-[#eef2f9] block mb-1">Horário Inicial</label>
                  <input
                    type="time"
                    value={alarm.startHour}
                    onChange={(e) => handleUpdateAlarmField({ startHour: e.target.value })}
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#eef2f9] block mb-1">Horário Final</label>
                  <input
                    type="time"
                    value={alarm.endHour}
                    onChange={(e) => handleUpdateAlarmField({ endHour: e.target.value })}
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              {/* 3. Som do Alarme & Upload Personalizado */}
              <div className="space-y-2 pt-2 border-t border-[#1e2636]">
                <label className="font-bold text-[#eef2f9] block flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-amber-400" /> Som do Alarme
                </label>

                <select
                  value={alarm.soundType || 'chime'}
                  onChange={(e) => handleUpdateAlarmField({ soundType: e.target.value })}
                  className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-xl text-white font-semibold focus:outline-none focus:border-amber-500"
                >
                  {ALARM_SOUND_OPTIONS.map((snd) => (
                    <option key={snd.id} value={snd.id}>
                      {snd.label}
                    </option>
                  ))}
                  <option value="custom">🎵 Som Personalizado (.mp3, .wav)</option>
                </select>

                {/* Upload de Som Personalizado */}
                {alarm.soundType === 'custom' && (
                  <div className="p-3 bg-[#151a26] border border-amber-500/40 rounded-xl space-y-2">
                    <span className="font-bold text-amber-300 block">Enviar Arquivo de Áudio</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleCustomAudioUpload}
                      className="text-xs text-[#eef2f9] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-white hover:file:bg-amber-400"
                    />
                    {audioUploadError && (
                      <p className="text-[11px] text-red-400 font-bold">{audioUploadError}</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => playAlarmSound(alarm.soundType)}
                  className="px-3 py-1.5 bg-[#151a26] hover:bg-[#1e2636] text-amber-400 font-bold rounded-lg border border-[#1e2636] transition-all flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Testar Som</span>
                </button>
              </div>

              {/* 4. Permissões Notificações Android / Navegador */}
              <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-xl space-y-2 pt-2 border-t border-[#1e2636]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" /> Notificações Android / Navegador
                  </span>

                  {notifPermission === 'granted' ? (
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold px-2 py-0.5 rounded-full">
                      Permitido ✓
                    </span>
                  ) : (
                    <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold px-2 py-0.5 rounded-full">
                      Pendente
                    </span>
                  )}
                </div>

                {notifPermission !== 'granted' && (
                  <button
                    onClick={handleRequestNotifPermission}
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-white font-extrabold rounded-xl transition-all shadow-md shadow-emerald-500/20"
                  >
                    Solicitar Permissão de Notificação
                  </button>
                )}
              </div>
            </div>

            {/* Ação do Modal */}
            <div className="flex justify-end pt-3 border-t border-[#1e2636]">
              <button
                onClick={() => setIsAlarmModalOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-white font-extrabold text-xs shadow-md shadow-amber-500/20"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
