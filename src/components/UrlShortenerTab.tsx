import React, { useState, useEffect } from 'react';
import { 
  Link2, Copy, Check, Sparkles, ExternalLink, 
  Scissors, RefreshCw, Trash2, Globe
} from 'lucide-react';
import { ApiKeysConfig } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, limit, deleteDoc } from 'firebase/firestore';
import { slugify, buildAffiliateLink } from '../utils/affiliateLink';

interface UrlShortenerTabProps {
  apiKeys: ApiKeysConfig;
  onSaveApiKeys: (keys: ApiKeysConfig) => void;
  uid?: string;
}

export const UrlShortenerTab: React.FC<UrlShortenerTabProps> = ({ apiKeys, uid }) => {
  const [inputUrl, setInputUrl] = useState('');
  
  // Step 1: Customize domain path?
  const [useCustomPath, setUseCustomPath] = useState(false);
  const [customPath, setCustomPath] = useState('');

  // Step 2: Customize code/identifier? (Only active if useCustomPath is true)
  const [useCustomCode, setUseCustomCode] = useState(false);
  const [customCodeInput, setCustomCodeInput] = useState('');

  const [generatedResult, setGeneratedResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Recent short links list
  const [recentLinks, setRecentLinks] = useState<Array<{ id: string; targetUrl: string; title?: string; fullUrl?: string; createdAt: any }>>([]);

  useEffect(() => {
    fetchRecentShortLinks();
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

  // Generate 7 random alphanumeric characters
  const generateRandomCode = (length = 7): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  // Auto detect platform from URL for affiliate tag injection
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
    try {
      const detectedPlatform = autoDetectPlatform(inputUrl.trim());
      const affiliateUrl = buildAffiliateLink(inputUrl.trim(), detectedPlatform, apiKeys);
      
      const domain = 'https://lkrm.site';
      let displayPath = '';
      let docId = '';

      const cleanPath = useCustomPath && customPath.trim() ? slugify(customPath.trim()) : '';

      if (!cleanPath) {
        // Rule 1: No custom path -> domain + 7 random digits
        const randomCode = generateRandomCode(7);
        displayPath = randomCode;
        docId = randomCode;
      } else {
        // Has custom path
        if (useCustomCode && customCodeInput.trim()) {
          // Rule 3: Custom path + Custom code -> domain + customPath + customCode
          const customCode = slugify(customCodeInput.trim());
          displayPath = `${cleanPath}/${customCode}`;
          docId = `${cleanPath}-${customCode}`;
        } else {
          // Rule 2: Custom path + No custom code -> domain + customPath + random code
          const randomCode = generateRandomCode(7);
          displayPath = `${cleanPath}/${randomCode}`;
          docId = `${cleanPath}-${randomCode}`;
        }
      }

      // Check if document already exists, append suffix if so
      let finalDocId = docId;
      const existingSnap = await getDoc(doc(db, 'shortLinks', finalDocId));
      if (existingSnap.exists()) {
        const suffix = generateRandomCode(4);
        finalDocId = `${docId}-${suffix}`;
        displayPath = `${displayPath}-${suffix}`;
      }

      const fullUrl = `${domain}/${displayPath}`;

      // Save to Firestore
      await setDoc(doc(db, 'shortLinks', finalDocId), {
        targetUrl: affiliateUrl,
        originalUrl: inputUrl.trim(),
        title: useCustomCode && customCodeInput ? customCodeInput : `Link (${displayPath})`,
        platform: detectedPlatform,
        fullUrl: fullUrl,
        docId: finalDocId,
        createdBy: uid || 'anonymous',
        createdAt: new Date().toISOString()
      });

      setGeneratedResult(fullUrl);
      fetchRecentShortLinks();
    } catch (err) {
      console.error("Erro ao gerar link:", err);
      alert("Erro ao encurtar link. Verifique sua conexão.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteLink = async (slug: string) => {
    if (!confirm(`Deseja excluir o link "${slug}"?`)) return;
    try {
      await deleteDoc(doc(db, 'shortLinks', slug));
      setRecentLinks(prev => prev.filter(l => l.id !== slug));
    } catch (err) {
      console.error("Erro ao excluir link:", err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-8 animate-fadeIn">
      {/* Top Title */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center justify-center gap-2">
          <Scissors className="w-7 h-7 text-blue-400" /> Encurtador de Links
        </h1>
        <p className="text-sm text-stone-400">
          Transforme seus links de afiliado em URLs limpas e profissionais usando <code className="text-blue-400 font-mono">https://lkrm.site</code>.
        </p>
      </div>

      {/* Main Form Card */}
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

          {/* 2. Customize domain path question */}
          <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-xl space-y-4">
            <div>
              <label className="text-xs font-bold text-stone-300 block mb-1">2. Deseja personalizar o nome após o domínio?</label>
              <p className="text-[11px] text-stone-400">Se marcar <strong>Não</strong>, o link gerará diretamente o domínio + 7 dígitos aleatórios. Se <strong>Sim</strong>, você define o nome principal.</p>
            </div>

            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => {
                  setUseCustomPath(false);
                  setCustomPath('');
                  setUseCustomCode(false);
                  setCustomCodeInput('');
                }}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                  !useCustomPath
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20'
                    : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:text-white'
                }`}
              >
                Não (Apenas domínio + aleatório)
              </button>
              <button
                type="button"
                onClick={() => setUseCustomPath(true)}
                className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                  useCustomPath
                    ? 'bg-blue-600 border-blue-500 text-white shadow-md shadow-blue-600/20'
                    : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:text-white'
                }`}
              >
                Sim (Definir nome personalizado)
              </button>
            </div>

            {useCustomPath && (
              <div className="pt-3 space-y-4 animate-fadeIn border-t border-[#1e2636]">
                <div>
                  <label className="text-xs font-bold text-stone-300 block mb-2">Nome personalizado principal</label>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center bg-[#0e1119] border border-[#1e2636] rounded-xl overflow-hidden focus-within:border-blue-500">
                    <div className="px-4 py-3 bg-[#111622] text-blue-400 font-mono text-xs font-bold border-b sm:border-b-0 sm:border-r border-[#1e2636] flex items-center gap-1.5 select-none">
                      <Globe className="w-4 h-4" /> https://lkrm.site/
                    </div>
                    <input
                      type="text"
                      placeholder="ex: promos ou radardeofertas"
                      value={customPath}
                      onChange={(e) => setCustomPath(e.target.value)}
                      className="flex-1 px-4 py-3 bg-transparent text-xs font-mono text-white focus:outline-none"
                    />
                  </div>
                </div>

                {/* 3. Customize code question (Only enabled if useCustomPath is true) */}
                <div className="pt-2">
                  <label className="text-xs font-bold text-stone-300 block mb-1">3. Deseja personalizar o código do produto?</label>
                  <p className="text-[11px] text-stone-400">Se marcar <strong>Não</strong>, gerará <code className="text-blue-400">lkrm.site/nome/código-aleatório</code>. Se <strong>Sim</strong>, você digita o nome do produto no final.</p>
                </div>

                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => {
                      setUseCustomCode(false);
                      setCustomCodeInput('');
                    }}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                      !useCustomCode
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:text-white'
                    }`}
                  >
                    Não (Código aleatório)
                  </button>
                  <button
                    type="button"
                    onClick={() => setUseCustomCode(true)}
                    className={`flex-1 py-2.5 px-4 rounded-xl text-xs font-bold border transition-all ${
                      useCustomCode
                        ? 'bg-indigo-600 border-indigo-500 text-white shadow-md shadow-indigo-600/20'
                        : 'bg-[#0e1119] border-[#1e2636] text-stone-400 hover:text-white'
                    }`}
                  >
                    Sim (Código/Nome do produto)
                  </button>
                </div>

                {useCustomCode && (
                  <div className="pt-2 animate-fadeIn">
                    <label className="text-xs font-bold text-stone-300 block mb-1.5">Identificador do produto</label>
                    <input
                      type="text"
                      placeholder="ex: fone-bluetooth-gamer"
                      value={customCodeInput}
                      onChange={(e) => setCustomCodeInput(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs font-mono text-white focus:outline-none focus:border-blue-500"
                    />
                    <p className="text-[11px] text-stone-500 mt-1">O link ficará: <code className="text-blue-400">https://lkrm.site/{customPath || 'nome'}/{customCodeInput || 'produto'}</code></p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Submit Button */}
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
                          onClick={() => handleDeleteLink(link.id)}
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
    </div>
  );
};
