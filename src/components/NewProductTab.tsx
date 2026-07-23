import React, { useState } from 'react';
import { ProductData, GeminiCopyVariation } from '../types';
import { Link2, Sparkles, Loader2, Copy, Check, Share2, Save, ShoppingBag, Tag, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Wand2, Eye } from 'lucide-react';
import { getPlatformLabel } from '../utils/platformLabel';

interface NewProductTabProps {
  onSaveProduct: (product: ProductData, variations: GeminiCopyVariation[], selectedIndex: number) => void;
  savedCount: number;
}

export const NewProductTab: React.FC<NewProductTabProps> = ({ onSaveProduct, savedCount }) => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extracted product state
  const [extractedProduct, setExtractedProduct] = useState<ProductData | null>(null);

  // 3 Copy Variations
  const [variations, setVariations] = useState<GeminiCopyVariation[]>([]);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);
  const [editedCopyText, setEditedCopyText] = useState<string>('');
  
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  // Generate 3 standard copy variations from extracted product
  const generateVariationsForProduct = (prod: ProductData): GeminiCopyVariation[] => {
    const couponLine = prod.coupon ? `\n🎟️ Cupom de Desconto: ${prod.coupon}` : '';
    const descLine = prod.description ? `\n\n📝 ${prod.description}` : '';

    return [
      {
        id: 'var_urgency_' + Date.now(),
        title: '⚡ 1. Urgência & Oferta Relâmpago',
        copy: `🚨 *OFERTA RELÂMPAGO DO DIA!* 🚨\n\n*${prod.title}*${descLine}\n\n💰 por apenas *R$ ${prod.price_to}*${couponLine}\n\n⚠️ Preço baixou muito! Estoque limitado!\n\n🛍️ *Compre aqui antes que acabe:* \n${prod.original_link}\n\n*Promoção por tempo limitado!`,
      },
      {
        id: 'var_direct_' + Date.now(),
        title: '🎯 2. Direta & Foco no Preço',
        copy: `🔥 *MENOR PREÇO ENCONTRADO!*\n\n*${prod.title}*${descLine}\n\n✅ Preço atual: *R$ ${prod.price_to}*${couponLine}\n\n🛍️ *Link direto com desconto:*\n${prod.original_link}`,
      },
      {
        id: 'var_review_' + Date.now(),
        title: '⭐ 3. Indicação & Review Sincero',
        copy: `Gente, dá uma olhada nesse achado! ⭐⭐⭐⭐⭐\n\n*${prod.title}*${descLine}\n\nMuito bem avaliado e está saindo por apenas *R$ ${prod.price_to}*!${couponLine}\n\n📲 *Garanta o seu aqui:* \n${prod.original_link}`,
      },
    ];
  };

  const handleScrapeProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsLoading(true);
    setErrorMsg(null);
    setExtractedProduct(null);
    setIsSaved(false);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.detail || 'Não foi possível extrair as informações deste link.');
      }

      const prod: ProductData = {
        id: 'prod_' + Date.now(),
        platform: data.platform || 'mercadolivre',
        title: data.title || 'Produto Extraído',
        description: data.description || '',
        image_url: data.image_url || null,
        price_to: data.price_to || 'Consulte no link',
        coupon: data.coupon ? String(data.coupon).trim() : null, // strictly only if present
        original_link: data.original_link || urlInput.trim(),
        extractedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setExtractedProduct(prod);

      // Generate 3 variations
      const vars = generateVariationsForProduct(prod);
      setVariations(vars);
      setSelectedVariationIndex(0);
      setEditedCopyText(vars[0].copy);

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Erro ao conectar ao serviço de extração.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectVariation = (index: number) => {
    setSelectedVariationIndex(index);
    setEditedCopyText(variations[index].copy);
    setCopied(false);
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(editedCopyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(editedCopyText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  const handleSaveToDashboard = () => {
    if (!extractedProduct) return;
    onSaveProduct(extractedProduct, variations, selectedVariationIndex);
    setIsSaved(true);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-stone-900 via-stone-900 to-emerald-950/50 border border-emerald-500/30 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Extrator Automático de Afiliados</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white">Cadastrar Novo Produto</h2>
            <p className="text-xs text-stone-400">
              Insira o link de produto do Mercado Livre, Shopee, Amazon, AliExpress ou Shein
            </p>
          </div>
        </div>

        {/* Link Input Form */}
        <form onSubmit={handleScrapeProduct} className="mt-5 flex flex-col sm:flex-row gap-2.5">
          <div className="relative flex-1">
            <Link2 className="w-4 h-4 absolute left-4 top-3.5 text-stone-500" />
            <input
              type="url"
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="Cole o link do produto aqui (ex: https://www.mercadolivre.com.br/...)"
              className="w-full pl-11 pr-4 py-3 bg-stone-950 border border-stone-800 focus:border-emerald-500 text-stone-100 placeholder-stone-500 rounded-2xl text-xs sm:text-sm focus:outline-none transition-all shadow-inner"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !urlInput.trim()}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-xs sm:text-sm rounded-2xl transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extraindo Dados...</span>
              </>
            ) : (
              <>
                <Wand2 className="w-4 h-4" />
                <span>Extrair & Gerar Copies</span>
              </>
            )}
          </button>
        </form>

        {errorMsg && (
          <div className="mt-3 p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-red-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
      </div>

      {/* EXTRACTED PRODUCT & 3 COPY VARIATIONS SECTION */}
      {extractedProduct && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start animate-fadeIn">
          
          {/* Left Column: Extracted Product Info */}
          <div className="lg:col-span-5 bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full uppercase">
                {getPlatformLabel(extractedProduct.platform)}
              </span>
              <span className="text-[10px] text-stone-500">Extraído às {extractedProduct.extractedAt}</span>
            </div>

            {/* Image */}
            {extractedProduct.image_url ? (
              <div className="w-full h-48 bg-stone-950 rounded-xl overflow-hidden p-2 flex items-center justify-center border border-stone-800">
                <img
                  src={extractedProduct.image_url}
                  alt={extractedProduct.title}
                  className="max-h-full max-w-full object-contain rounded-lg"
                />
              </div>
            ) : (
              <div className="w-full h-36 bg-stone-950 rounded-xl flex items-center justify-center text-stone-500 text-xs border border-stone-800">
                Sem Imagem Disponível
              </div>
            )}

            {/* Details */}
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-white leading-snug">{extractedProduct.title}</h3>

              {extractedProduct.description && (
                <p className="text-xs text-stone-400 line-clamp-3 bg-stone-950 p-2.5 rounded-xl border border-stone-800/80 italic">
                  "{extractedProduct.description}"
                </p>
              )}

              {/* Price extracted */}
              <div className="pt-1 flex items-center justify-between bg-stone-950 p-3 rounded-xl border border-stone-800">
                <span className="text-xs text-stone-400 font-medium">Preço Extraído:</span>
                <span className="text-base font-extrabold text-emerald-400">R$ {extractedProduct.price_to}</span>
              </div>

              {/* Coupon - Only rendered if present */}
              {extractedProduct.coupon ? (
                <div className="flex items-center gap-2 p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-300 text-xs">
                  <Tag className="w-4 h-4 text-amber-400" />
                  <span className="font-bold">Cupom Ativo:</span>
                  <span className="font-mono bg-stone-950 px-2 py-0.5 rounded text-amber-200 border border-amber-500/20">{extractedProduct.coupon}</span>
                </div>
              ) : (
                <p className="text-[11px] text-stone-500 italic pl-1">Sem cupom ativo detectado no link</p>
              )}

              {/* Original Link */}
              <div className="pt-1">
                <a
                  href={extractedProduct.original_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-emerald-400 hover:underline font-mono truncate block"
                >
                  🔗 {extractedProduct.original_link}
                </a>
              </div>
            </div>

            {/* Save to Dashboard Button */}
            <button
              onClick={handleSaveToDashboard}
              disabled={isSaved}
              className={`w-full py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-all ${
                isSaved
                  ? 'bg-stone-800 text-stone-400 border border-stone-700'
                  : 'bg-stone-800 hover:bg-stone-750 text-amber-400 border border-amber-500/30'
              }`}
            >
              {isSaved ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Cadastrado no Painel!</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Salvar em Produtos Cadastrados</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: 3 Copy Variations Generator */}
          <div className="lg:col-span-7 bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between border-b border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-base font-bold text-white">3 Variações de Copy Geradas</h3>
              </div>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                Prontas para WhatsApp
              </span>
            </div>

            {/* Variation Selection Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {variations.map((v, idx) => (
                <button
                  key={v.id}
                  onClick={() => handleSelectVariation(idx)}
                  className={`p-2.5 rounded-xl text-xs font-bold text-left transition-all border ${
                    selectedVariationIndex === idx
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/60 shadow-md'
                      : 'bg-stone-950 text-stone-400 border-stone-800 hover:bg-stone-800 hover:text-stone-200'
                  }`}
                >
                  <p className="truncate">{v.title}</p>
                </button>
              ))}
            </div>

            {/* Editable Copy Textarea */}
            <div>
              <label className="text-xs text-stone-400 font-medium mb-1 block">
                Texto para Envio (pode editar se quiser):
              </label>
              <textarea
                rows={9}
                value={editedCopyText}
                onChange={(e) => setEditedCopyText(e.target.value)}
                className="w-full p-3.5 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-100 font-mono focus:outline-none focus:border-emerald-500 leading-relaxed"
              />
            </div>

            {/* Primary Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={handleCopyText}
                className={`py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
                  copied
                    ? 'bg-emerald-400 text-stone-950 scale-[1.01]'
                    : 'bg-stone-800 hover:bg-stone-750 text-emerald-400 border border-emerald-500/40'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Copiado com Sucesso!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copiar Esta Copy</span>
                  </>
                )}
              </button>

              <button
                onClick={handleShareWhatsApp}
                className="py-3 px-4 bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-extrabold text-xs sm:text-sm rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg"
              >
                <Share2 className="w-4 h-4" />
                <span>Compartilhar no WhatsApp</span>
              </button>
            </div>

          </div>

        </div>
      )}

    </div>
  );
};
