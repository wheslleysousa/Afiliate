import React, { useState, useEffect } from 'react';
import { 
  Link2, Copy, Check, Sparkles, ExternalLink, 
  Scissors, RefreshCw, Trash2, Globe, Settings, Save, AlertCircle
} from 'lucide-react';
import { ApiKeysConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, limit, deleteDoc } from 'firebase/firestore';
import { slugify, buildAffiliateLink } from '../utils/affiliateLink';
import { 
  ShortenerPreferences, 
  getUserShortenerPreferences, 
  saveUserShortenerPreferences, 
  generateRandomCode 
} from '../utils/shortenerHelper';

interface UrlShortenerTabProps {
  apiKeys: ApiKeysConfig;
  onSaveApiKeys: (keys: ApiKeysConfig) => void;
  uid?: string;
}

export const UrlShortenerTab: React.FC<UrlShortenerTabProps> = ({ apiKeys, uid }) => {
  const [activeTab, setActiveTab] = useState<'shortener' | 'settings'>('shortener');

  // Shortener form state
  const [inputUrl, setInputUrl] = useState('');
  const [useCustomPath, setUseCustomPath] = useState(false);
  const [customPath, setCustomPath] = useState('');
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState('');

  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Settings state
  const [prefs, setPrefs] = useState<ShortenerPreferences>({
    shortStyle: 'random',
    defaultCustomPrefix: 'oferta',
    useProductNameAsSlug: false,
    customDomain: 'https://lkrm.site',
  });
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [prefsSavedMessage, setPrefsSavedMessage] = useState(false);

  // Recent short links list
  const [recentLinks, setRecentLinks] = useState<Array<{ id: string; targetUrl: string; title?: string; fullUrl?: string; createdAt: any }>>([]);

  useEffect(() => {
    fetchRecentShortLinks();
    if (uid) {
      getUserShortenerPreferences(uid).then(p => {
        setPrefs(p);
        if (p.defaultCustomPrefix) setCustomPath(p.defaultCustomPrefix);
        if (p.shortStyle === 'custom_random' || p.shortStyle === 'custom_custom') {
          setUseCustomPath(true);
        }
      });
    }
  }, [uid]);

  const fetchRecentShortLinks = async () => {
    try {
      const q = query(collection(db, 'shortLinks'), limit(15));
      const snap = await getDocs(q);
      const list = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as any[];
      setRecentLinks(list);
    } catch (err) {
      console.warn("Erro ao buscar links curtos:", err);
    }
  };

  const autoDetectPlatform = (url: string): string => {
    const lower = url.toLowerCase();
    if (lower.includes('mercadolivre') || lower.includes('meli.la')) return 'mercadolivre';
    if (lower.includes('shopee') || lower.includes('shp.ee')) return 'shopee';
    if (lower.includes('amazon') || lower.includes('amzn.to')) return 'amazon';
    if (lower.includes('aliexpress')) return 'aliexpress';
    if (lower.includes('shein')) return 'shein';
    if (lower.includes('tiktok')) return 'tiktokshop';
    return 'shopee';
  };

  const handleGenerateShortLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const detectedPlatform = autoDetectPlatform(inputUrl.trim());
      const affiliateUrl = buildAffiliateLink(inputUrl.trim(), detectedPlatform, apiKeys);
      
      const domain = prefs.customDomain || 'https://lkrm.site';
      let displayPath = '';
      let docId = '';

      const cleanPath = useCustomPath && customPath.trim() ? slugify(customPath.trim()) : '';

      if (!cleanPath) {
        const randomCode = generateRandomCode(7);
        displayPath = randomCode;
        docId = randomCode;
      } else {
        if (useCustomCode && customCodeInput.trim()) {
          const customCode = slugify(customCodeInput.trim());
          displayPath = `${cleanPath}/${customCode}`;
          docId = `${cleanPath}-${customCode}`;
        } else {
          const randomCode = generateRandomCode(7);
          displayPath = `${cleanPath}/${randomCode}`;
          docId = `${cleanPath}-${randomCode}`;
        }
      }

      // Check uniqueness in Firestore
      const existingSnap = await getDoc(doc(db, 'shortLinks', docId));
      if (existingSnap.exists()) {
        if (useCustomCode && customCodeInput.trim()) {
          setErrorMsg("Nome já em uso. O código ou nome personalizado escolhido já está cadastrado. Por favor, escolha outro.");
          setLoading(false);
          return;
        } else {
          // If random collision, append suffix
          const suffix = generateRandomCode(4);
          docId = `${docId}-${suffix}`;
          displayPath = `${displayPath}-${suffix}`;
        }
      }

      const fullUrl = `${domain}/${displayPath}`;

      await setDoc(doc(db, 'shortLinks', docId), {
        targetUrl: affiliateUrl,
        originalUrl: inputUrl.trim(),
        title: useCustomCode && customCodeInput ? customCodeInput : `Link (${displayPath})`,
        platform: detectedPlatform,
        fullUrl: fullUrl,
        docId: docId,
        createdBy: uid || 'anonymous',
        createdAt: new Date().toISOString()
      });

      setGeneratedResult(fullUrl);
      fetchRecentShortLinks();
    } catch (err) {
      console.error("Erro ao gerar link:", err);
      setErrorMsg("Erro ao encurtar link. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uid) {
      alert("Faça login para salvar suas configurações.");
      return;
    }
    setSavingPrefs(true);
    try {
      await saveUserShortenerPreferences(uid, prefs);
      setPrefsSavedMessage(true);
      setTimeout(() => setPrefsSavedMessage(false), 3000);
    } catch (err) {
      console.error("Erro ao salvar preferências:", err);
      alert("Erro ao salvar configurações.");
    } finally {
      setSavingPrefs(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const confirmDeleteLink = async () => {
    if (!deleteTargetId) return;
    try {
      await deleteDoc(doc(db, 'shortLinks', deleteTargetId));
      setRecentLinks(prev => prev.filter(l => l.id !== deleteTargetId));
      setDeleteTargetId(null);
    } catch (err) {
      console.error("Erro ao excluir link:", err);
      alert("Erro ao excluir link.");
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn">
      {/* Top Title */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <Scissors className="w-7 h-7 text-blue-400" /> Encurtador de Links & Padrões
        </h1>
        <p className="text-sm text-stone-400">
          Gerencie seus links profissionais e configure o estilo padrão de encurtamento em <code className="text-blue-400 font-mono">https://lkrm.site</code>.
        </p>
      </div>

      {/* Sub-tab navigation */}
      <div className="flex gap-2 border-b border-[#1e2636] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('shortener')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'shortener' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50' 
              : 'bg-[#111622] text-stone-400 hover:text-white border border-[#1e2636]'
          }`}
        >
          <Link2 className="w-4 h-4 text-emerald-400" /> Encurtar & Histórico
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
            activeTab === 'settings' 
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/50' 
              : 'bg-[#111622] text-stone-400 hover:text-white border border-[#1e2636]'
          }`}
        >
          <Settings className="w-4 h-4 text-amber-400" /> Configuração de Estilo Padrão
        </button>
      </div>

      {activeTab === 'settings' ? (
        /* Settings Form Card */
        <div className="bg-[#111622] border border-[#1e2636] rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <div className="flex items-center gap-3 border-b border-[#1e2636] pb-4">
            <div className="p-3 bg-amber-500/20 text-amber-400 rounded-xl">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configurar Estilo Padrão de Encurtamento</h2>
              <p className="text-xs text-stone-400">Defina como seus links encurtados devem se comportar automaticamente ao minerar ou criar produtos.</p>
            </div>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-6">
            <div className="space-y-3">
              <label className="text-xs font-bold text-stone-300 block">Estilo Padrão de URL:</label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => setPrefs({ ...prefs, shortStyle: 'random' })}
                  className={`p-4 rounded-xl border text-left transition-all space-y-1 ${
                    prefs.shortStyle === 'random' 
                      ? 'bg-blue-600/10 border-blue-500 text-white' 
                      : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-blue-400">1. Domínio + Código</div>
                  <div className="text-[11px] font-mono text-stone-300">lkrm.site/abc1234</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrefs({ ...prefs, shortStyle: 'custom_random' })}
                  className={`p-4 rounded-xl border text-left transition-all space-y-1 ${
                    prefs.shortStyle === 'custom_random' 
                      ? 'bg-blue-600/10 border-blue-500 text-white' 
                      : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-blue-400">2. Nome + Código</div>
                  <div className="text-[11px] font-mono text-stone-300">lkrm.site/oferta/abc12</div>
                </button>

                <button
                  type="button"
                  onClick={() => setPrefs({ ...prefs, shortStyle: 'custom_custom' })}
                  className={`p-4 rounded-xl border text-left transition-all space-y-1 ${
                    prefs.shortStyle === 'custom_custom' 
                      ? 'bg-blue-600/10 border-blue-500 text-white' 
                      : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:text-white'
                  }`}
                >
                  <div className="font-bold text-xs text-blue-400">3. Nome + Personalizado</div>
                  <div className="text-[11px] font-mono text-stone-300">lkrm.site/oferta/meu-link</div>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-2">Prefixo / Nome Personalizado Padrão</label>
                <input
                  type="text"
                  value={prefs.defaultCustomPrefix}
                  onChange={(e) => setPrefs({ ...prefs, defaultCustomPrefix: e.target.value })}
                  placeholder="Ex: radardeofertas"
                  className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                />
                <p className="text-[10px] text-stone-500 mt-1">Este nome será usado no caminho se o estilo incluir nome personalizado.</p>
              </div>

              <div>
                <label className="text-xs font-bold text-stone-300 block mb-2">Domínio Base</label>
                <input
                  type="text"
                  value={prefs.customDomain}
                  onChange={(e) => setPrefs({ ...prefs, customDomain: e.target.value })}
                  className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-stone-300 focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-xl flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-white">Usar Nome do Produto Minerado Automaticamente</h4>
                <p className="text-[11px] text-stone-400">Quando minerar ou importar um produto, usar o título do produto como slug no link.</p>
              </div>
              <input
                type="checkbox"
                checked={prefs.useProductNameAsSlug}
                onChange={(e) => setPrefs({ ...prefs, useProductNameAsSlug: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              {prefsSavedMessage ? (
                <span className="text-xs text-emerald-400 font-bold flex items-center gap-1 animate-fadeIn">
                  <Check className="w-4 h-4" /> Configurações salvas e definidas como padrão!
                </span>
              ) : <span />}

              <button
                type="submit"
                disabled={savingPrefs}
                className="py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2 ml-auto"
              >
                {savingPrefs ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Salvar e Usar como Padrão
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* Main Encusrtador Form Card */
        <div className="bg-[#111622] border border-[#1e2636] rounded-2xl p-6 md:p-8 shadow-xl space-y-6">
          <form onSubmit={handleGenerateShortLink} className="space-y-6">
            
            {/* 1. Product Link Input */}
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-2">1. Link do produto que vai ser encurtado *</label>
              <input
                type="url"
                required
                placeholder="Cole aqui o link do produto ou afiliado (ex: https://s.shopee.com.br/...)"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-xl text-xs text-red-300 flex items-center gap-2 animate-fadeIn">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 2. Customize domain path question */}
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-xl space-y-4">
              <div>
                <label className="text-xs font-bold text-stone-300 block mb-1">2. Deseja personalizar o nome após o domínio?</label>
                <p className="text-[11px] text-stone-400">Se marcar <strong>Não</strong>, o link gerará diretamente o domínio + código aleatório. Se <strong>Sim</strong>, você define o nome principal.</p>
              </div>

              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => setUseCustomPath(false)}
                  className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                    !useCustomPath 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-950/50' 
                      : 'bg-[#0e1119] text-stone-400 border-[#1e2636] hover:text-white'
                  }`}
                >
                  Não (Usar Padrão)
                </button>
                <button
                  type="button"
                  onClick={() => setUseCustomPath(true)}
                  className={`flex-1 py-3 px-4 rounded-xl border text-xs font-bold transition-all ${
                    useCustomPath 
                      ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-950/50' 
                      : 'bg-[#0e1119] text-stone-400 border-[#1e2636] hover:text-white'
                  }`}
                >
                  Sim (Personalizar)
                </button>
              </div>

              {useCustomPath && (
                <div className="space-y-4 pt-2 border-t border-[#1e2636] animate-fadeIn">
                  <div>
                    <label className="text-xs font-bold text-stone-300 block mb-1.5">Nome Personalizado / Categoria (Slug)</label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono text-stone-500 bg-[#0e1119] px-3 py-3 rounded-xl border border-[#1e2636]">https://lkrm.site/</span>
                      <input
                        type="text"
                        placeholder={prefs.defaultCustomPrefix || "promos"}
                        value={customPath}
                        onChange={(e) => setCustomPath(e.target.value)}
                        className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  </div>

                  {/* Step 3: Customize specific code */}
                  <div className="space-y-3 pt-2">
                    <label className="text-xs font-bold text-stone-300 block">3. Deseja definir um código personalizado específico para o final?</label>
                    <div className="flex gap-4">
                      <button
                        type="button"
                        onClick={() => setUseCustomCode(false)}
                        className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                          !useCustomCode ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#0e1119] text-stone-400 border-[#1e2636]'
                        }`}
                      >
                        Gerar Código Aleatório no Fim
                      </button>
                      <button
                        type="button"
                        onClick={() => setUseCustomCode(true)}
                        className={`flex-1 py-2.5 px-3 rounded-xl border text-xs font-bold transition-all ${
                          useCustomCode ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#0e1119] text-stone-400 border-[#1e2636]'
                        }`}
                      >
                        Digitar Meu Próprio Código
                      </button>
                    </div>

                    {useCustomCode && (
                      <div className="pt-1 animate-fadeIn">
                        <input
                          type="text"
                          placeholder="Ex: oferta-especial-hoje (único)"
                          value={customCodeInput}
                          onChange={(e) => setCustomCodeInput(e.target.value)}
                          className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-[10px] text-stone-500 mt-1">Se o nome já estiver em uso, o sistema avisará para evitar conflitos.</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Encurtar Link
            </button>
          </form>

          {/* Generated Result Display */}
          {generatedResult && (
            <div className="mt-6 p-5 bg-blue-950/40 border border-blue-500/30 rounded-xl space-y-3 animate-fadeIn">
              <div className="text-xs font-bold text-blue-300 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-400" /> Link Encurtado com Sucesso!
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={generatedResult}
                  className="w-full px-4 py-3 bg-[#0e1119] border border-blue-500/40 rounded-xl text-xs font-mono text-emerald-400 select-all"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedResult)}
                  className="px-5 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap shadow-md shadow-emerald-600/20"
                >
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent Links List */}
      <div className="bg-[#111622] border border-[#1e2636] rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#1e2636] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Seus Links Recentes</h3>
              <p className="text-xs text-stone-400">Histórico de links encurtados</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchRecentShortLinks}
            className="p-2 bg-[#0e1119] border border-[#1e2636] hover:border-blue-500 text-stone-300 rounded-xl text-xs transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>

        {recentLinks.length === 0 ? (
          <div className="text-center py-10 text-xs text-stone-500">Nenhum link recente encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-stone-300">
              <thead className="bg-[#0e1119] text-stone-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3">Link Encurtado</th>
                  <th className="p-3">Destino Original</th>
                  <th className="p-3">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2636]">
                {recentLinks.map((link) => {
                  const displayUrl = link.fullUrl || `https://lkrm.site/${link.id}`;
                  return (
                    <tr key={link.id} className="hover:bg-[#161c2b] transition-colors">
                      <td className="p-3 font-mono text-blue-400 font-bold select-all">{displayUrl}</td>
                      <td className="p-3">
                        <div className="font-bold text-white">{link.title || 'Link de Afiliado'}</div>
                        <a href={link.targetUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-stone-500 hover:text-stone-300 truncate max-w-xs block flex items-center gap-1">
                          {link.targetUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="p-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(displayUrl)}
                          className="px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-lg text-xs font-bold transition-all flex items-center gap-1"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(link.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-all"
                          title="Excluir link"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal Popup */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#151a26] border border-[#1e2636] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scaleUp">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-500/20 text-red-400 rounded-xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Confirmar Exclusão</h3>
                <p className="text-xs text-stone-400">Deseja realmente excluir este link encurtado?</p>
              </div>
            </div>
            
            <p className="text-xs font-mono text-stone-300 bg-[#0e1119] p-3 rounded-xl border border-[#1e2636] break-all">
              ID: {deleteTargetId}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-2.5 px-4 bg-[#0e1119] hover:bg-[#1a2235] border border-[#1e2636] text-stone-300 font-bold text-xs rounded-xl transition-all"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteLink}
                className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-red-600/20"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
