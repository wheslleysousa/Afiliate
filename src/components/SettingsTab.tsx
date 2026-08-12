import React, { useState } from 'react';
import { ApiKeysConfig, UserProfile, CommissionRatesConfig } from '../types';
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
  Globe
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
  const [affiliatesSavedFeedback, setAffiliatesSavedFeedback] = useState(false);

  const handleSaveAffiliateKeys = () => {
    onSaveApiKeys(keys);
    setAffiliatesSavedFeedback(true);
    setTimeout(() => setAffiliatesSavedFeedback(false), 3000);
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
    window.open('/api/extension/download', '_blank');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Sub-navegação do Menu de Configurações */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-[#1e2636]">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap ${
            activeTab === 'profile'
              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Meu Perfil</span>
        </button>

        <button
          onClick={() => setActiveTab('gemini')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap ${
            activeTab === 'gemini'
              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-400" />
          <span>Chave Gemini</span>
        </button>

        <button
          onClick={() => setActiveTab('affiliates')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap ${
            activeTab === 'affiliates'
              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <Key className="w-4 h-4 text-emerald-400" />
          <span>Contas e Afiliados</span>
        </button>

        <button
          onClick={() => setActiveTab('alarm')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border whitespace-nowrap ${
            activeTab === 'alarm'
              ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-600/20'
              : 'bg-[#0e1119] text-[#93a0b5] hover:text-white border-[#1e2636]'
          }`}
        >
          <Bell className="w-4 h-4 text-amber-400" />
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
              <label className="text-xs font-bold text-stone-300 block mb-1">Nome Completo</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#151a26] border border-[#1e2636] rounded-xl text-xs text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">E-mail Cadastrado</label>
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
              <label className="text-xs font-bold text-stone-300 block mb-1">Digite sua chave API</label>
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-white"
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
                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20"
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
                Insira seus IDs e Tokens oficiais para rastreio automático de comissões
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mercado Livre */}
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-yellow-400 block">Mercado Livre Oficial & Afiliados</span>
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-400/10 text-yellow-300 border border-yellow-400/20">
                  OAuth 2.0
                </span>
              </div>
              
              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  Tracking ID / Link de Afiliado
                </label>
                <input
                  type="text"
                  placeholder="Cole seu Tracking ID (ex: sowh5608494) ou link de afiliado"
                  value={keys.mercadolivreTrackingId || ''}
                  onChange={(e) => {
                    let val = e.target.value.trim();
                    if (val.includes('tracking_id=')) {
                      try {
                        const match = val.match(/[?&]tracking_id=([^&]+)/);
                        if (match && match[1]) {
                          val = match[1];
                        }
                      } catch (err) {}
                    }
                    setKeys({ ...keys, mercadolivreTrackingId: val });
                  }}
                  className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-yellow-500"
                />
                <p className="text-[9px] text-[#93a0b5] mt-1">
                  Se você colar um link de afiliado do Mercado Livre, nós extrairemos seu Tracking ID automaticamente.
                </p>
              </div>

              <div className="pt-2 border-t border-[#1e2636]">
                <a
                  href="/api/auth/mercadolivre/connect"
                  className="w-full py-2.5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-[#0e1119] font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-lg shadow-yellow-500/10"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Conectar Conta Oficial Mercado Livre</span>
                </a>
              </div>
            </div>

            {/* Shopee */}
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-3">
              <span className="text-xs font-bold text-orange-400 block">Shopee Afiliados</span>
              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  Shopee ID de Afiliado / Tracking
                </label>
                <input
                  type="text"
                  placeholder="ex: 12345678"
                  value={keys.shopeeTrackingId || ''}
                  onChange={(e) => setKeys({ ...keys, shopeeTrackingId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-orange-500"
                />
              </div>
            </div>

            {/* Amazon */}
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-3">
              <span className="text-xs font-bold text-blue-400 block">Amazon Associados</span>
              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  Tag de Associado Amazon
                </label>
                <input
                  type="text"
                  placeholder="ex: suatag-20"
                  value={keys.amazonAssociatesTag || ''}
                  onChange={(e) => setKeys({ ...keys, amazonAssociatesTag: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            {/* AliExpress / Trakkin ID */}
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-3">
              <span className="text-xs font-bold text-red-400 block">AliExpress / Trakkin ID</span>
              <div>
                <label className="text-[11px] font-semibold text-stone-300 block mb-1">
                  AliExpress Affiliate / Trakkin ID
                </label>
                <input
                  type="text"
                  placeholder="ex: aff_12345"
                  value={keys.aliexpressAffiliateId || ''}
                  onChange={(e) => setKeys({ ...keys, aliexpressAffiliateId: e.target.value })}
                  className="w-full px-3 py-2 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-red-500"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-[#1e2636]">
            {affiliatesSavedFeedback ? (
              <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" /> IDs de afiliados salvos com sucesso!
              </span>
            ) : (
              <span />
            )}

            <button
              onClick={handleSaveAffiliateKeys}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Configurações</span>
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
              className="p-2.5 rounded-xl bg-[#151a26] hover:bg-stone-800 text-amber-400 border border-[#1e2636] transition-all flex items-center gap-1.5 font-bold text-xs"
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
                  ? 'bg-emerald-500 text-stone-950 shadow-md shadow-emerald-500/20'
                  : 'bg-stone-800 text-stone-400'
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
                <label className="font-bold text-stone-300 block mb-1.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" /> Intervalo de Repetição
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {[5, 10, 15, 30, 60].map((m) => (
                    <button
                      key={m}
                      onClick={() => handleUpdateAlarmField({ intervalMinutes: m })}
                      className={`py-2 rounded-xl font-bold border text-center transition-all ${
                        alarm.intervalMinutes === m
                          ? 'bg-amber-500 text-stone-950 border-amber-400 font-extrabold'
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
                  <label className="font-bold text-stone-300 block mb-1">Horário Inicial</label>
                  <input
                    type="time"
                    value={alarm.startHour}
                    onChange={(e) => handleUpdateAlarmField({ startHour: e.target.value })}
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-xl text-white font-mono focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="font-bold text-stone-300 block mb-1">Horário Final</label>
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
                <label className="font-bold text-stone-300 block flex items-center gap-1.5">
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
                      className="text-xs text-stone-300 file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-amber-500 file:text-stone-950 hover:file:bg-amber-400"
                    />
                    {audioUploadError && (
                      <p className="text-[11px] text-red-400 font-bold">{audioUploadError}</p>
                    )}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => playAlarmSound(alarm.soundType)}
                  className="px-3 py-1.5 bg-[#151a26] hover:bg-stone-800 text-amber-400 font-bold rounded-lg border border-[#1e2636] transition-all flex items-center gap-1.5"
                >
                  <Volume2 className="w-3.5 h-3.5" />
                  <span>Testar Som</span>
                </button>
              </div>

              {/* 4. Permissões Notificações Android / Navegador */}
              <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-xl space-y-2 pt-2 border-t border-[#1e2636]">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-200 flex items-center gap-1.5">
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
                    className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold rounded-xl transition-all shadow-md shadow-emerald-500/20"
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
                className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-extrabold text-xs shadow-md shadow-amber-500/20"
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
