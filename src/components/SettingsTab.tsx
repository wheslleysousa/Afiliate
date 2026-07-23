import React, { useState } from 'react';
import { ApiKeysConfig, UserProfile } from '../types';
import { Settings, Key, User, Shield, Check, Save, Lock, AlertCircle, Sparkles } from 'lucide-react';

interface SettingsTabProps {
  user: UserProfile;
  apiKeys: ApiKeysConfig;
  onSaveApiKeys: (keys: ApiKeysConfig) => void;
  onUpdateProfile: (updated: Partial<UserProfile>) => void;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  user,
  apiKeys,
  onSaveApiKeys,
  onUpdateProfile,
}) => {
  const [keysForm, setKeysForm] = useState<ApiKeysConfig>({
    mercadoLivreKey: apiKeys.mercadoLivreKey || '',
    shopeeKey: apiKeys.shopeeKey || '',
    amazonKey: apiKeys.amazonKey || '',
    aliExpressKey: apiKeys.aliExpressKey || '',
    sheinKey: apiKeys.sheinKey || '',
    geminiApiKey: apiKeys.geminiApiKey || '',
  });

  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKeys(keysForm);
    onUpdateProfile({ name, email });
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      
      {/* Header */}
      <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 border border-blue-500/30 text-blue-400 rounded-xl">
            <Settings className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-extrabold text-white">Configurações do Perfil e APIs</h2>
            <p className="text-xs text-stone-400">
              Gerencie suas chaves de API das plataformas de afiliados e dados da conta
            </p>
          </div>
        </div>

        {savedSuccess && (
          <div className="px-3 py-1.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center gap-1.5 animate-fadeIn">
            <Check className="w-4 h-4 text-emerald-400" />
            <span>Salvo com sucesso!</span>
          </div>
        )}
      </div>

      <form onSubmit={handleSaveAll} className="space-y-6">
        
        {/* User Profile Section */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <h3 className="text-sm font-bold text-white flex items-center gap-2 border-b border-stone-800 pb-3">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Dados da Sua Conta</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          </div>
        </div>

        {/* Affiliate API Credentials Section */}
        <div className="bg-stone-900 border border-stone-800 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="border-b border-stone-800 pb-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span>Chaves de API das Plataformas de Afiliados</span>
            </h3>
            <p className="text-[11px] text-stone-400 mt-1">
              Caso você possua Tokens ou App Keys de Afiliado oficiais para automatizar extrações avançadas, insira-as abaixo:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Mercado Livre */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Mercado Livre (App ID / Key)</label>
              <input
                type="password"
                placeholder="Ex: 84739201928471"
                value={keysForm.mercadoLivreKey}
                onChange={(e) => setKeysForm({ ...keysForm, mercadoLivreKey: e.target.value })}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Shopee */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Shopee Affiliate API Key</label>
              <input
                type="password"
                placeholder="Ex: shopee_aff_sec_..."
                value={keysForm.shopeeKey}
                onChange={(e) => setKeysForm({ ...keysForm, shopeeKey: e.target.value })}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Amazon */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Amazon Associates Tracking ID</label>
              <input
                type="text"
                placeholder="Ex: seunome-20"
                value={keysForm.amazonKey}
                onChange={(e) => setKeysForm({ ...keysForm, amazonKey: e.target.value })}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* AliExpress */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">AliExpress App Key / Secret</label>
              <input
                type="password"
                placeholder="Ex: ali_app_key_..."
                value={keysForm.aliExpressKey}
                onChange={(e) => setKeysForm({ ...keysForm, aliExpressKey: e.target.value })}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Shein */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Shein Publisher Token</label>
              <input
                type="password"
                placeholder="Ex: shein_tok_..."
                value={keysForm.sheinKey}
                onChange={(e) => setKeysForm({ ...keysForm, sheinKey: e.target.value })}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* Gemini Custom API Key */}
            <div>
              <label className="text-xs font-semibold text-stone-300 block mb-1">Gemini AI API Key (Opcional)</label>
              <input
                type="password"
                placeholder="Ex: AIzaSy..."
                value={keysForm.geminiApiKey}
                onChange={(e) => setKeysForm({ ...keysForm, geminiApiKey: e.target.value })}
                className="w-full p-2.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
              />
            </div>

          </div>
        </div>

        <button
          type="submit"
          className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-xs sm:text-sm rounded-xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Salvar Configurações</span>
        </button>

      </form>

    </div>
  );
};
