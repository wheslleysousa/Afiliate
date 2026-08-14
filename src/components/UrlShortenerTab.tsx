import React, { useState, useEffect } from 'react';
import { 
  Link2, Copy, Check, Sparkles, ExternalLink, 
  RefreshCw, Trash2, Settings, Save, AlertCircle, CheckCircle2,
  HelpCircle, Eye, ShieldCheck, Tag, ArrowRight, CheckSquare, Square,
  Layers, Zap
} from 'lucide-react';
import { ApiKeysConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, limit, deleteDoc } from 'firebase/firestore';
import { slugify, buildAffiliateLink } from '../utils/affiliateLink';
import { 
  ShortenerPreferences, 
  ShortStyleType,
  getUserShortenerPreferences, 
  saveUserShortenerPreferences, 
  generateRandomCode,
  checkSlugAvailability 
} from '../utils/shortenerHelper';

interface UrlShortenerTabProps {
  apiKeys: ApiKeysConfig;
  onSaveApiKeys: (keys: ApiKeysConfig) => void;
  uid?: string;
}

export const UrlShortenerTab: React.FC<UrlShortenerTabProps> = ({ apiKeys, onSaveApiKeys, uid }) => {
  const [activeTab, setActiveTab] = useState<'shortener' | 'settings'>('shortener');

  // Shortener form state
  const [inputUrl, setInputUrl] = useState('');
  // Mode: 'random_end' | 'custom_code' | 'only_name'
  const [codeMode, setCodeMode] = useState<'random_end' | 'custom_code' | 'only_name'>('random_end');
  const [customStoreName, setCustomStoreName] = useState('oferta');
  const [customSpecificCode, setCustomSpecificCode] = useState('');
  const [onlyCustomName, setOnlyCustomName] = useState('');

  // Live availability check
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [availabilityMessage, setAvailabilityMessage] = useState<string | null>(null);

  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Settings state (Premium & Didático)
  const [prefs, setPrefs] = useState<ShortenerPreferences>({
    shortStyle: 'custom_random',
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
        // Sync with apiKeys if present
        const merged: ShortenerPreferences = {
          ...p,
          defaultCustomPrefix: apiKeys.customShortPrefix || p.defaultCustomPrefix || 'oferta',
          shortStyle: (apiKeys.shortStyle as ShortStyleType) || p.shortStyle || 'custom_random',
          useProductNameAsSlug: apiKeys.useProductNameInShortLink !== undefined ? apiKeys.useProductNameInShortLink : p.useProductNameAsSlug
        };
        setPrefs(merged);

        if (merged.defaultCustomPrefix) {
          setCustomStoreName(merged.defaultCustomPrefix);
          setOnlyCustomName(merged.defaultCustomPrefix);
        }
        if (merged.shortStyle === 'custom_only') {
          setCodeMode('only_name');
        } else if (merged.shortStyle === 'custom_custom') {
          setCodeMode('custom_code');
        } else {
          setCodeMode('random_end');
        }
      });
    }
  }, [uid, apiKeys]);

  const fetchRecentShortLinks = async () => {
    try {
      const q = query(collection(db, 'shortLinks'), limit(20));
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

  // Checagem em tempo real de disponibilidade quando o modo for 'only_name' ou 'custom_code'
  useEffect(() => {
    let active = true;
    const targetToCheck = codeMode === 'only_name' 
      ? onlyCustomName 
      : (codeMode === 'custom_code' && customSpecificCode ? `${customStoreName}-${customSpecificCode}` : '');

    if (!targetToCheck || targetToCheck.trim().length < 2) {
      setIsAvailable(null);
      setAvailabilityMessage(null);
      return;
    }

    setIsCheckingAvailability(true);
    const timer = setTimeout(async () => {
      const available = await checkSlugAvailability(targetToCheck);
      if (active) {
        setIsCheckingAvailability(false);
        setIsAvailable(available);
        if (available) {
          setAvailabilityMessage('✓ Este nome está disponível para uso!');
        } else {
          setAvailabilityMessage('❌ Este nome não está disponível. Já está em uso, escolha outro.');
        }
      }
    }, 400);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [codeMode, onlyCustomName, customStoreName, customSpecificCode]);

  // Prévia do link em tempo real
  const getLivePreviewUrl = (): string => {
    const domain = 'lkrm.site';
    if (codeMode === 'only_name') {
      const clean = slugify(onlyCustomName) || 'seu-nome';
      return `https://${domain}/${clean}`;
    }
    if (codeMode === 'custom_code') {
      const store = slugify(customStoreName) || 'loja';
      const code = slugify(customSpecificCode) || 'meu-codigo';
      return `https://${domain}/${store}/${code}`;
    }
    // random_end
    const store = slugify(customStoreName) || 'loja';
    return `https://${domain}/${store}/x7k9ab`;
  };

  const handleGenerateShortLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    try {
      const detectedPlatform = autoDetectPlatform(inputUrl.trim());
      const affiliateUrl = buildAffiliateLink(inputUrl.trim(), detectedPlatform, apiKeys);
      const domain = 'https://lkrm.site';

      let displayPath = '';
      let docId = '';

      if (codeMode === 'only_name') {
        const cleanName = slugify(onlyCustomName.trim());
        if (!cleanName) {
          setErrorMsg("Por favor, digite o nome personalizado desejado.");
          setLoading(false);
          return;
        }

        displayPath = cleanName;
        docId = cleanName;

        // Validar unicidade rigorosa para modo 'only_name'
        const isFree = await checkSlugAvailability(docId);
        if (!isFree) {
          setErrorMsg(`❌ O nome "${cleanName}" não está disponível no lkrm.site. Já está em uso, por favor escolha outro nome.`);
          setLoading(false);
          return;
        }
      } else if (codeMode === 'custom_code') {
        const store = slugify(customStoreName.trim()) || 'oferta';
        const specific = slugify(customSpecificCode.trim());
        if (!specific) {
          setErrorMsg("Por favor, digite seu código personalizado para o final do link.");
          setLoading(false);
          return;
        }

        displayPath = `${store}/${specific}`;
        docId = `${store}-${specific}`;

        const isFree = await checkSlugAvailability(docId);
        if (!isFree) {
          setErrorMsg(`❌ O código "${specific}" para "${store}" não está disponível. Já está cadastrado, por favor tente outro.`);
          setLoading(false);
          return;
        }
      } else {
        // random_end
        const store = slugify(customStoreName.trim()) || 'oferta';
        const randomCode = generateRandomCode(6);
        displayPath = `${store}/${randomCode}`;
        docId = `${store}-${randomCode}`;

        // Tratar colisão aleatória rara
        let attempts = 0;
        while (attempts < 5) {
          const exists = !(await checkSlugAvailability(docId));
          if (!exists) break;
          const suffix = generateRandomCode(4);
          docId = `${store}-${randomCode}-${suffix}`;
          displayPath = `${store}/${randomCode}-${suffix}`;
          attempts++;
        }
      }

      const fullUrl = `${domain}/${displayPath}`;

      await setDoc(doc(db, 'shortLinks', docId), {
        targetUrl: affiliateUrl,
        originalUrl: inputUrl.trim(),
        title: codeMode === 'only_name' ? onlyCustomName : (customSpecificCode || `Oferta (${displayPath})`),
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
      
      // Sincronizar com ApiKeysConfig para persistência global em todo o aplicativo
      onSaveApiKeys({
        ...apiKeys,
        customShortPrefix: prefs.defaultCustomPrefix,
        customShortDomain: 'https://lkrm.site',
        shortStyle: prefs.shortStyle,
        useProductNameInShortLink: prefs.useProductNameAsSlug,
      });

      setPrefsSavedMessage(true);
      setTimeout(() => setPrefsSavedMessage(false), 3500);
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
    <div className="max-w-5xl mx-auto space-y-6 animate-fadeIn pb-12">
      {/* Header Padronizado e Didático */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2636] pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-blue-600/15 border border-blue-500/30 rounded-xl text-blue-400">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                Encurtador de Links Profissional
              </h1>
              <p className="text-xs text-[#93a0b5]">
                Gere links de alta conversão no domínio oficial <span className="text-blue-400 font-mono font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">lkrm.site</span>
              </p>
            </div>
          </div>
        </div>

        {/* Sub-tab Switcher Moderno */}
        <div className="flex items-center gap-1.5 bg-[#0e1119] p-1.5 rounded-2xl border border-[#1e2636] self-start sm:self-auto shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('shortener')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'shortener' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.02]' 
                : 'text-[#93a0b5] hover:text-white hover:bg-[#151a26]'
            }`}
          >
            <Zap className="w-4 h-4 text-emerald-400" /> Encurtar Link
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'settings' 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 scale-[1.02]' 
                : 'text-[#93a0b5] hover:text-white hover:bg-[#151a26]'
            }`}
          >
            <Settings className="w-4 h-4 text-amber-400" /> Configurações de Estilo
          </button>
        </div>
      </div>

      {activeTab === 'settings' ? (
        /* ============================================================ */
        /* SUB-ABA: CONFIGURAÇÃO DE ESTILO PREMIUM, INTUITIVA E DIDÁTICA*/
        /* ============================================================ */
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl space-y-8 animate-fadeIn">
          
          {/* Header da Seção de Configuração */}
          <div className="flex items-start sm:items-center gap-4 pb-6 border-b border-[#1e2636]">
            <div className="p-3.5 bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/30 text-amber-400 rounded-2xl shrink-0 shadow-lg shadow-amber-500/5">
              <Settings className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-black text-white">Como você quer formatar seus links por padrão?</h2>
              <p className="text-xs sm:text-sm text-[#93a0b5] mt-1">
                Configure a regra visual que será aplicada automaticamente em <strong className="text-white">Meus Produtos</strong>, <strong className="text-white">Novo Produto</strong> e <strong className="text-white">Automações</strong>.
              </p>
            </div>
          </div>

          <form onSubmit={handleSavePreferences} className="space-y-8">
            
            {/* 1. Escolha Visual dos Cards Grandes de Estilo */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="text-sm font-black text-white tracking-wide flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">1</span>
                  Selecione o Formato Principal do Link:
                </label>
                <span className="text-xs text-[#93a0b5] hidden sm:inline">Clique no modelo desejado</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Opção 1: Somente Código */}
                <div
                  onClick={() => setPrefs({ ...prefs, shortStyle: 'random' })}
                  className={`p-5 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 space-y-3 relative flex flex-col justify-between ${
                    prefs.shortStyle === 'random' 
                      ? 'bg-blue-950/30 border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.01]' 
                      : 'bg-[#151a26]/60 border-[#1e2636] text-[#93a0b5] hover:border-blue-500/40 hover:bg-[#151a26]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-white flex items-center gap-2">
                        🎲 Código Curto
                      </span>
                      {prefs.shortStyle === 'random' ? (
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-[#2b3548]" />
                      )}
                    </div>
                    <p className="text-xs text-[#93a0b5]">
                      Link direto e super compacto, ideal para quem busca URLs curtas sem identificador.
                    </p>
                  </div>

                  <div className="text-xs font-mono text-emerald-400 bg-[#0e1119] p-3 rounded-xl border border-[#1e2636] font-bold break-all shadow-inner">
                    lkrm.site/x7k9ab
                  </div>
                </div>

                {/* Opção 2: Nome da Loja + Código (Recomendado) */}
                <div
                  onClick={() => setPrefs({ ...prefs, shortStyle: 'custom_random' })}
                  className={`p-5 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 space-y-3 relative flex flex-col justify-between ${
                    prefs.shortStyle === 'custom_random' 
                      ? 'bg-blue-950/30 border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.01]' 
                      : 'bg-[#151a26]/60 border-[#1e2636] text-[#93a0b5] hover:border-blue-500/40 hover:bg-[#151a26]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-white flex items-center gap-2">
                        🏷️ Marca + Código
                      </span>
                      {prefs.shortStyle === 'custom_random' ? (
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-[#2b3548]" />
                      )}
                    </div>
                    <p className="text-xs text-[#93a0b5]">
                      <strong className="text-blue-400">Recomendado!</strong> Associa sua marca a cada oferta com código único.
                    </p>
                  </div>

                  <div className="text-xs font-mono text-emerald-400 bg-[#0e1119] p-3 rounded-xl border border-[#1e2636] font-bold break-all shadow-inner">
                    lkrm.site/{slugify(prefs.defaultCustomPrefix) || 'minhaloja'}/x7k9ab
                  </div>
                </div>

                {/* Opção 3: Somente Nome */}
                <div
                  onClick={() => setPrefs({ ...prefs, shortStyle: 'custom_only' })}
                  className={`p-5 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 space-y-3 relative flex flex-col justify-between ${
                    prefs.shortStyle === 'custom_only' 
                      ? 'bg-blue-950/30 border-blue-500 shadow-xl shadow-blue-500/10 scale-[1.01]' 
                      : 'bg-[#151a26]/60 border-[#1e2636] text-[#93a0b5] hover:border-blue-500/40 hover:bg-[#151a26]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-extrabold text-sm text-white flex items-center gap-2">
                        ✨ Somente o Nome
                      </span>
                      {prefs.shortStyle === 'custom_only' ? (
                        <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-[#2b3548]" />
                      )}
                    </div>
                    <p className="text-xs text-[#93a0b5]">
                      URL limpa e fixa direto após o domínio, ideal para links institucionais ou grupos.
                    </p>
                  </div>

                  <div className="text-xs font-mono text-emerald-400 bg-[#0e1119] p-3 rounded-xl border border-[#1e2636] font-bold break-all shadow-inner">
                    lkrm.site/{slugify(prefs.defaultCustomPrefix) || 'minhaloja'}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. Campo do Nome / Prefixo da Loja */}
            <div className="bg-[#151a26]/80 p-6 sm:p-7 rounded-3xl border border-[#1e2636] space-y-4 shadow-xl">
              <div className="space-y-1">
                <label className="text-sm font-black text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">2</span>
                  Nome ou Prefixo da sua Loja / Canal:
                </label>
                <p className="text-xs text-[#93a0b5]">
                  Este nome aparecerá logo após o domínio <code className="text-blue-400 font-bold">https://lkrm.site/</code> nos seus links.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <div className="flex items-center px-4 py-3.5 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-blue-400 font-mono text-xs sm:text-sm font-black select-none shrink-0 shadow-inner">
                  https://lkrm.site/
                </div>
                <input
                  type="text"
                  value={prefs.defaultCustomPrefix}
                  onChange={(e) => setPrefs({ ...prefs, defaultCustomPrefix: e.target.value })}
                  placeholder="Ex: achadinhos, promos, radardeofertas"
                  className="w-full px-4 py-3.5 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-xs sm:text-sm font-mono text-white placeholder-[#64708a] focus:outline-none focus:border-blue-500 font-bold shadow-inner"
                />
              </div>
              <p className="text-[11px] text-[#93a0b5] flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                Dica: Escolha um termo curto e marcante (ex: <code>promos-top</code>, <code>achadinhos-vip</code>).
              </p>
            </div>

            {/* 3. Opção de incluir o nome do produto no final do link (NOVA CONFIGURAÇÃO SOLICITADA) */}
            <div className="bg-[#151a26]/80 p-6 sm:p-7 rounded-3xl border border-[#1e2636] space-y-4 shadow-xl">
              <div className="space-y-1">
                <label className="text-sm font-black text-white flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">3</span>
                  Usar o Nome do Produto no final do Link Encurtado?
                </label>
                <p className="text-xs text-[#93a0b5]">
                  Escolha se deseja que o título resumido do produto apareça no final da URL ao divulgar na aba Meus Produtos ou ao extrair na aba Novo Produto.
                </p>
              </div>

              {/* Botão de Alternância Visual em Card */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                {/* Opção NÃO (Padrão limpo com ID / Código) */}
                <div
                  onClick={() => setPrefs({ ...prefs, useProductNameAsSlug: false })}
                  className={`p-5 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 space-y-2 relative flex flex-col justify-between ${
                    !prefs.useProductNameAsSlug 
                      ? 'bg-blue-950/30 border-blue-500 shadow-xl shadow-blue-500/10' 
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:border-blue-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-2">
                      🚫 Não usar o nome do produto
                    </span>
                    {!prefs.useProductNameAsSlug ? (
                      <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[#2b3548]" />
                    )}
                  </div>
                  <p className="text-xs text-[#93a0b5]">
                    Usa código curto ou ID. Deixa o link mais compacto e limpo.
                  </p>
                  <div className="text-[11px] font-mono text-[#eef2f9] bg-[#151a26] p-2.5 rounded-xl border border-[#1e2636]">
                    lkrm.site/{slugify(prefs.defaultCustomPrefix) || 'loja'}/x7k9ab
                  </div>
                </div>

                {/* Opção SIM (Incluir nome do produto no slug) */}
                <div
                  onClick={() => setPrefs({ ...prefs, useProductNameAsSlug: true })}
                  className={`p-5 rounded-2xl border-2 text-left cursor-pointer transition-all duration-200 space-y-2 relative flex flex-col justify-between ${
                    prefs.useProductNameAsSlug 
                      ? 'bg-blue-950/30 border-blue-500 shadow-xl shadow-blue-500/10' 
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:border-blue-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-extrabold text-xs sm:text-sm text-white flex items-center gap-2">
                      ✨ Sim, usar o nome do produto
                    </span>
                    {prefs.useProductNameAsSlug ? (
                      <div className="w-5 h-5 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[#2b3548]" />
                    )}
                  </div>
                  <p className="text-xs text-[#93a0b5]">
                    Converte o título do produto em texto legível no final da URL.
                  </p>
                  <div className="text-[11px] font-mono text-emerald-400 bg-[#151a26] p-2.5 rounded-xl border border-[#1e2636]">
                    lkrm.site/{slugify(prefs.defaultCustomPrefix) || 'loja'}/fone-bluetooth-redmi
                  </div>
                </div>
              </div>
            </div>

            {/* 4. Domínio Fixo Informativo */}
            <div className="p-5 bg-gradient-to-r from-blue-950/40 via-blue-900/20 to-transparent border border-blue-500/30 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-500/20 rounded-xl text-blue-400">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-blue-400">Domínio Oficial e Seguro</div>
                  <div className="text-sm font-mono font-black text-white">https://lkrm.site</div>
                  <p className="text-[11px] text-[#93a0b5] mt-0.5">
                    Todos os links gerados começam com este endereço profissional de alta autoridade.
                  </p>
                </div>
              </div>
            </div>

            {/* Prévia em tempo real de Alta Percepção de Valor */}
            <div className="p-6 bg-gradient-to-br from-[#151a26] to-[#0e1119] border-2 border-emerald-500/40 rounded-3xl space-y-3 shadow-2xl">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Eye className="w-4 h-4" /> Prévia Visual do Link Final nos Seus Produtos:
                </div>
                <span className="text-[10px] text-emerald-400/80 font-mono font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  Tempo Real
                </span>
              </div>

              <div className="text-sm sm:text-base font-mono text-emerald-300 bg-[#0e1119] p-4 rounded-2xl border border-[#1e2636] font-extrabold select-all break-all shadow-inner">
                {prefs.shortStyle === 'random' && `https://lkrm.site/${prefs.useProductNameAsSlug ? 'fone-bluetooth-redmi' : 'x7k9ab'}`}
                {prefs.shortStyle === 'custom_random' && `https://lkrm.site/${slugify(prefs.defaultCustomPrefix) || 'minhaloja'}/${prefs.useProductNameAsSlug ? 'fone-bluetooth-redmi' : 'x7k9ab'}`}
                {prefs.shortStyle === 'custom_only' && `https://lkrm.site/${slugify(prefs.defaultCustomPrefix) || 'minhaloja'}`}
              </div>
              <p className="text-[11px] text-[#93a0b5]">
                Esta é a estrutura exata que será usada nas suas mensagens de WhatsApp e redes sociais.
              </p>
            </div>

            {/* Ação de Salvar - Botão Grande e Chamativo */}
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#1e2636]">
              {prefsSavedMessage ? (
                <div className="text-xs sm:text-sm text-emerald-400 font-bold flex items-center gap-2 animate-fadeIn bg-emerald-500/10 px-4 py-2.5 rounded-xl border border-emerald-500/20">
                  <Check className="w-4 h-4 shrink-0" /> Configurações salvas e aplicadas em todos os produtos!
                </div>
              ) : <span />}

              <button
                type="submit"
                disabled={savingPrefs}
                className="w-full sm:w-auto py-4 px-8 bg-blue-600 hover:bg-blue-500 active:scale-[0.98] text-white font-black text-sm rounded-2xl transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center gap-2.5 ml-auto cursor-pointer"
              >
                {savingPrefs ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                Salvar Regras de Link
              </button>
            </div>
          </form>
        </div>
      ) : (
        /* ============================================================ */
        /* SUB-ABA PRINCIPAL: ENCURTADOR DE LINKS DIRETO E DIDÁTICO    */
        /* ============================================================ */
        <div className="bg-[#0e1119] border border-[#1e2636] rounded-3xl p-6 sm:p-8 lg:p-10 shadow-2xl space-y-8 animate-fadeIn">
          <form onSubmit={handleGenerateShortLink} className="space-y-8">
            
            {/* 1. Campo de Link do Produto */}
            <div className="space-y-3">
              <label className="text-sm font-black text-white flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">1</span>
                Cole o link longo do produto que deseja encurtar:
              </label>
              <input
                type="url"
                required
                placeholder="Cole o link (Mercado Livre, Shopee, Amazon, AliExpress, Shein, TikTok...)"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                className="w-full px-5 py-4 bg-[#151a26] border border-[#1e2636] rounded-2xl text-xs sm:text-sm font-mono text-white placeholder-[#64708a] focus:outline-none focus:border-blue-500 transition-all shadow-inner"
              />
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-4 bg-red-950/40 border border-red-500/40 rounded-2xl text-xs sm:text-sm text-red-300 flex items-center gap-3 animate-fadeIn">
                <AlertCircle className="w-5 h-5 shrink-0 text-red-400" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 2. Escolha de Modalidade de Código */}
            <div className="p-6 sm:p-7 bg-[#151a26]/80 border border-[#1e2636] rounded-3xl space-y-5 shadow-xl">
              <div>
                <label className="text-sm font-black text-white flex items-center gap-2 mb-1">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600/20 text-blue-400 text-xs font-mono font-bold border border-blue-500/30">2</span>
                  Como você quer personalizar este link avulso?
                </label>
                <p className="text-xs text-[#93a0b5]">
                  Escolha se deseja um código aleatório, seu código próprio ou somente o nome personalizado.
                </p>
              </div>

              {/* 3 Opções Claras em Grid com Cards Grandes */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Opção A: Gerar código aleatório no fim */}
                <button
                  type="button"
                  onClick={() => setCodeMode('random_end')}
                  className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer space-y-2 flex flex-col justify-between ${
                    codeMode === 'random_end'
                      ? 'bg-blue-950/30 border-blue-500 text-white shadow-xl shadow-blue-500/10 scale-[1.01]'
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500/30'
                  }`}
                >
                  <div className="font-black text-xs sm:text-sm text-white flex items-center justify-between">
                    <span>🎲 Código Aleatório</span>
                    {codeMode === 'random_end' ? (
                      <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-[#2b3548]" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 bg-[#151a26] p-2 rounded-xl border border-[#1e2636]">
                    lkrm.site/loja/x7k9ab
                  </div>
                </button>

                {/* Opção B: Digitar meu código completo */}
                <button
                  type="button"
                  onClick={() => setCodeMode('custom_code')}
                  className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer space-y-2 flex flex-col justify-between ${
                    codeMode === 'custom_code'
                      ? 'bg-blue-950/30 border-blue-500 text-white shadow-xl shadow-blue-500/10 scale-[1.01]'
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500/30'
                  }`}
                >
                  <div className="font-black text-xs sm:text-sm text-white flex items-center justify-between">
                    <span>✍️ Meu Próprio Código</span>
                    {codeMode === 'custom_code' ? (
                      <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-[#2b3548]" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 bg-[#151a26] p-2 rounded-xl border border-[#1e2636]">
                    lkrm.site/loja/cupom-10
                  </div>
                </button>

                {/* Opção C: Usar somente o nome personalizado */}
                <button
                  type="button"
                  onClick={() => setCodeMode('only_name')}
                  className={`p-5 rounded-2xl border-2 text-left transition-all duration-200 cursor-pointer space-y-2 flex flex-col justify-between ${
                    codeMode === 'only_name'
                      ? 'bg-blue-950/30 border-blue-500 text-white shadow-xl shadow-blue-500/10 scale-[1.01]'
                      : 'bg-[#0e1119] border-[#1e2636] text-[#93a0b5] hover:text-white hover:border-blue-500/30'
                  }`}
                >
                  <div className="font-black text-xs sm:text-sm text-white flex items-center justify-between">
                    <span>✨ Somente o Nome</span>
                    {codeMode === 'only_name' ? (
                      <div className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-[#2b3548]" />
                    )}
                  </div>
                  <div className="text-[11px] font-mono text-emerald-400 bg-[#151a26] p-2 rounded-xl border border-[#1e2636]">
                    lkrm.site/promocao-hoje
                  </div>
                </button>
              </div>

              {/* Campos dinâmicos baseados no modo selecionado */}
              <div className="pt-3 border-t border-[#1e2636] space-y-4">
                {codeMode === 'only_name' && (
                  <div className="space-y-2.5 animate-fadeIn">
                    <label className="text-xs sm:text-sm font-bold text-white flex items-center justify-between">
                      <span>Nome Personalizado Único (Slug Direto):</span>
                      {isCheckingAvailability && (
                        <span className="text-xs text-blue-400 flex items-center gap-1.5">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Verificando disponibilidade...
                        </span>
                      )}
                    </label>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-blue-400 font-mono text-xs sm:text-sm font-black select-none shrink-0 shadow-inner">
                        https://lkrm.site/
                      </div>
                      <input
                        type="text"
                        required
                        value={onlyCustomName}
                        onChange={(e) => setOnlyCustomName(e.target.value)}
                        placeholder="Ex: super-promo-fone (sem espaços)"
                        className={`w-full px-4 py-3 bg-[#0e1119] border rounded-2xl text-xs sm:text-sm font-mono text-white focus:outline-none transition-all shadow-inner ${
                          isAvailable === false 
                            ? 'border-red-500 bg-red-950/20' 
                            : isAvailable === true 
                            ? 'border-emerald-500 bg-emerald-950/10' 
                            : 'border-[#1e2636] focus:border-blue-500'
                        }`}
                      />
                    </div>

                    {/* Alerta de Disponibilidade do Nome */}
                    {availabilityMessage && (
                      <div className={`p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 font-bold ${
                        isAvailable === true 
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                          : 'bg-red-500/10 border border-red-500/30 text-red-400'
                      }`}>
                        {isAvailable === true ? (
                          <Check className="w-4 h-4 shrink-0" />
                        ) : (
                          <AlertCircle className="w-4 h-4 shrink-0" />
                        )}
                        <span>{availabilityMessage}</span>
                      </div>
                    )}
                  </div>
                )}

                {codeMode === 'random_end' && (
                  <div className="space-y-2.5 animate-fadeIn">
                    <label className="text-xs sm:text-sm font-bold text-white block">
                      Nome / Prefixo da Loja ou Canal:
                    </label>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex items-center px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-blue-400 font-mono text-xs sm:text-sm font-black select-none shrink-0 shadow-inner">
                        https://lkrm.site/
                      </div>
                      <input
                        type="text"
                        value={customStoreName}
                        onChange={(e) => setCustomStoreName(e.target.value)}
                        placeholder="Ex: ofertas, achadinhos, minhaloja"
                        className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-blue-500 shadow-inner"
                      />
                      <div className="flex items-center px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-[#93a0b5] font-mono text-xs sm:text-sm font-black select-none shrink-0 shadow-inner">
                        /x7k9ab
                      </div>
                    </div>
                  </div>
                )}

                {codeMode === 'custom_code' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs sm:text-sm font-bold text-white block mb-1.5">
                          Nome da Loja (Prefixo):
                        </label>
                        <input
                          type="text"
                          value={customStoreName}
                          onChange={(e) => setCustomStoreName(e.target.value)}
                          placeholder="Ex: achadinhos"
                          className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-blue-500 shadow-inner"
                        />
                      </div>
                      <div>
                        <label className="text-xs sm:text-sm font-bold text-white block mb-1.5">
                          Código Específico do Produto:
                        </label>
                        <input
                          type="text"
                          required
                          value={customSpecificCode}
                          onChange={(e) => setCustomSpecificCode(e.target.value)}
                          placeholder="Ex: fone-lenovo-50off"
                          className="w-full px-4 py-3 bg-[#0e1119] border border-[#1e2636] rounded-2xl text-xs sm:text-sm font-mono text-white focus:outline-none focus:border-blue-500 shadow-inner"
                        />
                      </div>
                    </div>

                    {availabilityMessage && (
                      <div className={`p-3 rounded-2xl text-xs sm:text-sm flex items-center gap-2.5 font-bold ${
                        isAvailable === true 
                          ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' 
                          : 'bg-red-500/10 border border-red-500/30 text-red-400'
                      }`}>
                        {isAvailable === true ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                        <span>{availabilityMessage}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Prévia em tempo real do link a ser gerado */}
                <div className="p-4 bg-[#0e1119] border border-[#1e2636] rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs">
                  <span className="text-[#93a0b5] font-bold">Prévia do link final:</span>
                  <span className="font-mono text-emerald-400 font-black break-all text-xs sm:text-sm">
                    {getLivePreviewUrl()}
                  </span>
                </div>
              </div>
            </div>

            {/* Botão Encurtar Grande e de Alta Conversão */}
            <button
              type="submit"
              disabled={loading || (codeMode === 'only_name' && isAvailable === false)}
              className="w-full py-4 px-8 bg-blue-600 hover:bg-blue-500 active:scale-[0.99] text-white font-black text-sm sm:text-base rounded-2xl transition-all shadow-xl shadow-blue-500/25 flex items-center justify-center gap-3 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
              Encurtar e Gerar Link Agora
            </button>
          </form>

          {/* Resultado Gerado com Destaque */}
          {generatedResult && (
            <div className="mt-8 p-6 sm:p-8 bg-gradient-to-br from-blue-950/60 to-emerald-950/40 border-2 border-emerald-500/40 rounded-3xl space-y-4 animate-scaleUp shadow-2xl">
              <div className="text-xs sm:text-sm font-black text-emerald-400 flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-400" /> Link Encurtado Pronto para Divulgação!
                </span>
                <span className="text-xs text-blue-400 font-mono font-bold">lkrm.site</span>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                <input
                  type="text"
                  readOnly
                  value={generatedResult}
                  className="w-full px-5 py-4 bg-[#151a26] border border-emerald-500/40 rounded-2xl text-xs sm:text-sm font-mono text-emerald-300 font-black select-all shadow-inner"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedResult)}
                  className="px-8 py-4 bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-black text-xs sm:text-sm rounded-2xl transition-all flex items-center justify-center gap-2 whitespace-nowrap shadow-lg shadow-emerald-600/30 cursor-pointer"
                >
                  {copied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                  {copied ? "Copiado!" : "Copiar Link"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tabela de Links Recentes */}
      <div className="bg-[#0e1119] border border-[#1e2636] rounded-3xl p-6 sm:p-8 shadow-xl space-y-5">
        <div className="flex items-center justify-between border-b border-[#1e2636] pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-600/20 text-emerald-400 rounded-xl">
              <Link2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-white">Seus Links Encurtados Recentes</h3>
              <p className="text-xs text-[#93a0b5]">Histórico de links criados em lkrm.site</p>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchRecentShortLinks}
            className="p-2.5 bg-[#151a26] border border-[#1e2636] hover:border-blue-500 text-[#eef2f9] rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Atualizar
          </button>
        </div>

        {recentLinks.length === 0 ? (
          <div className="text-center py-12 text-xs sm:text-sm text-[#93a0b5]">
            Nenhum link recente encontrado. Encurte seu primeiro produto acima!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#eef2f9]">
              <thead className="bg-[#151a26] text-[#93a0b5] uppercase font-mono text-[10px]">
                <tr>
                  <th className="p-3.5 rounded-l-xl">Link Encurtado (lkrm.site)</th>
                  <th className="p-3.5">Destino Original</th>
                  <th className="p-3.5 rounded-r-xl">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1e2636]">
                {recentLinks.map((link) => {
                  const displayUrl = link.fullUrl || `https://lkrm.site/${link.id}`;
                  return (
                    <tr key={link.id} className="hover:bg-[#151a26]/50 transition-colors">
                      <td className="p-3.5 font-mono text-blue-400 font-extrabold select-all">
                        {displayUrl}
                      </td>
                      <td className="p-3.5">
                        <div className="font-bold text-white truncate max-w-xs">{link.title || 'Oferta'}</div>
                        <a 
                          href={link.targetUrl} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="text-[11px] text-[#93a0b5] hover:text-white truncate max-w-xs flex items-center gap-1"
                        >
                          {link.targetUrl} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>
                      <td className="p-3.5 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(displayUrl)}
                          className="px-3.5 py-2 bg-blue-600/20 hover:bg-blue-600/40 text-blue-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Copy className="w-3.5 h-3.5" /> Copiar
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteTargetId(link.id)}
                          className="p-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-xl transition-all cursor-pointer"
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

      {/* Modal de Confirmação para Excluir Link */}
      {deleteTargetId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#151a26] border border-[#1e2636] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl space-y-6 animate-scaleUp">
            <div className="flex items-center gap-3.5">
              <div className="p-3.5 bg-red-500/20 text-red-400 rounded-2xl">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-white">Confirmar Exclusão</h3>
                <p className="text-xs text-[#93a0b5]">Deseja realmente remover este link encurtado?</p>
              </div>
            </div>
            
            <p className="text-xs font-mono text-[#eef2f9] bg-[#0e1119] p-3.5 rounded-2xl border border-[#1e2636] break-all shadow-inner">
              ID: {deleteTargetId}
            </p>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTargetId(null)}
                className="flex-1 py-3 px-4 bg-[#0e1119] hover:bg-[#1e2636] border border-[#1e2636] text-[#eef2f9] font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteLink}
                className="flex-1 py-3 px-4 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl transition-all shadow-lg shadow-red-600/25 cursor-pointer"
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
