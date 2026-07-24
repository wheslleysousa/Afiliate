import React, { useState, useEffect } from 'react';
import { ProductData, GeminiCopyVariation, ApiKeysConfig } from '../types';
import { Link2, Sparkles, Loader2, Copy, Check, Share2, Save, ShoppingBag, Tag, CheckCircle2, AlertCircle, ArrowRight, RefreshCw, Wand2, Eye, TrendingDown } from 'lucide-react';
import { getPlatformLabel } from '../utils/platformLabel';
import { calculateDiscountPercent } from '../utils/copyHelper';
import { ProductEditor } from './ProductEditor';
import { GeminiAiPanel } from './GeminiAiPanel';

interface NewProductTabProps {
  onSaveProduct: (product: ProductData, variations: GeminiCopyVariation[], selectedIndex: number) => void;
  savedCount: number;
  apiKeys?: ApiKeysConfig;
}

export const NewProductTab: React.FC<NewProductTabProps> = ({ onSaveProduct, savedCount, apiKeys }) => {
  const [urlInput, setUrlInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Extracted product state
  const [extractedProduct, setExtractedProduct] = useState<ProductData | null>(null);

  // 3 Copy Variations
  const [variations, setVariations] = useState<GeminiCopyVariation[]>([]);
  const [selectedVariationIndex, setSelectedVariationIndex] = useState<number>(0);
  const [editedCopyText, setEditedCopyText] = useState<string>('');
  
  const [copied, setCopied] = useState(false);
  const [isSaved, setIsSaved] = useState(false);

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const handleUpdateProductField = (field: keyof ProductData, value: any) => {
    if (!extractedProduct) return;
    const oldValue = extractedProduct[field];

    // 1. Update the product state
    setExtractedProduct((prev) => (prev ? { ...prev, [field]: value } : null));

    // 2. Handle variation updates cleanly without nesting state updaters
    if (oldValue !== undefined && oldValue !== null && oldValue !== "") {
      const oldStr = String(oldValue).trim();
      const newStr = String(value).trim();
      if (oldStr && newStr && oldStr !== newStr) {
        setVariations((prevVars) => {
          const updatedVars = prevVars.map((v) => {
            try {
              return { ...v, copy: v.copy.replace(new RegExp(escapeRegExp(oldStr), 'g'), newStr) };
            } catch (e) {
              return v;
            }
          });
          setEditedCopyText(updatedVars[selectedVariationIndex]?.copy || '');
          return updatedVars;
        });
      }
    }
  };
  const generateVariationsForProduct = (prod: ProductData): GeminiCopyVariation[] => {
    const couponLine = prod.coupon ? `\n🎟️ Cupom de Desconto: ${prod.coupon}` : '';
    const descLine = prod.description ? `\n\n📝 ${prod.description}` : '';

    const discountNum = calculateDiscountPercent(prod.price_from, prod.price_to);
    const discountBadge = discountNum ? ` (-${discountNum}% OFF)` : '';

    let installmentText = '';
    if (prod.installments) {
      installmentText = prod.installments;
    } else {
      const baseForInstallment = prod.card_price || prod.price_to;
      if (baseForInstallment) {
        const pNum = parseFloat(baseForInstallment.replace(/\./g, '').replace(',', '.'));
        if (!isNaN(pNum) && pNum > 0) {
          const val12 = (pNum / 12).toFixed(2).replace('.', ',');
          installmentText = `12x de R$ ${val12} sem juros`;
        }
      }
    }

    const priceTextUrgency = prod.price_from && prod.price_from !== prod.price_to
      ? `❌ De: ~R$ ${prod.price_from}~\n💵 À vista no Pix ou Boleto: *R$ ${prod.price_to}*${discountBadge}\n💳 Ou em até *${installmentText || '12x de R$ 0,00'}*`
      : `💵 À vista no Pix ou Boleto: *R$ ${prod.price_to}*\n💳 Ou em até *${installmentText || '12x de R$ 0,00'}*`;

    const priceTextDirect = prod.price_from && prod.price_from !== prod.price_to
      ? `❌ Estava por: R$ ${prod.price_from}\n✅ Agora por apenas: *R$ ${prod.price_to}* à vista${discountBadge}\n💳 Parcelas: *${installmentText || '12x de R$ 0,00'}*`
      : `✅ Por apenas: *R$ ${prod.price_to}* à vista\n💳 Parcelas: *${installmentText || '12x de R$ 0,00'}*`;

    const priceTextReview = prod.price_from && prod.price_from !== prod.price_to
      ? `Antes custava R$ ${prod.price_from}, mas comprando à vista sai por apenas *R$ ${prod.price_to}*!${discountBadge}\nOu se preferir, pode parcelar em até *${installmentText || '12x de R$ 0,00'}*!`
      : `Comprando à vista sai por apenas *R$ ${prod.price_to}*!\nOu parcelado em até *${installmentText || '12x de R$ 0,00'}*!`;

    return [
      {
        id: 'var_urgency_' + Date.now(),
        title: '⚡ 1. Urgência & Oferta Relâmpago',
        copy: `🚨 *OFERTA RELÂMPAGO DO DIA!* 🚨\n\n*${prod.title}*${descLine}\n\n${priceTextUrgency}${couponLine}\n\n⚠️ Preço de oportunidade com estoque limitado!\n\n🛍️ *Compre aqui antes que acabe:* \n${prod.original_link}\n\n*Promoção por tempo limitado!`,
      },
      {
        id: 'var_direct_' + Date.now(),
        title: '🎯 2. Direta & Foco no Preço',
        copy: `🔥 *MENOR PREÇO ENCONTRADO!*\n\n*${prod.title}*${descLine}\n\n${priceTextDirect}${couponLine}\n\n🛍️ *Link direto com desconto:*\n${prod.original_link}`,
      },
      {
        id: 'var_review_' + Date.now(),
        title: '⭐ 3. Indicação & Review Sincero',
        copy: `Gente, dá uma olhada nesse achado! ⭐⭐⭐⭐⭐\n\n*${prod.title}*${descLine}\n\n${priceTextReview}${couponLine}\n\n📲 *Garanta o seu aqui:* \n${prod.original_link}`,
      },
    ];
  };

  const handleScrapeProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!urlInput.trim()) return;

    setIsLoading(true);
    setIsAiGenerating(false);
    setErrorMsg(null);
    setExtractedProduct(null);
    setIsSaved(false);

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput.trim(), apiKeys }),
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
        pictures: Array.isArray(data.pictures) && data.pictures.length > 0 ? data.pictures : (data.image_url ? [data.image_url] : []),
        video_url: data.video_url || null,
        selectedMediaUrl: data.image_url || null,
        selectedMediaType: data.image_url ? 'image' : null,
        selectedImageIndex: 0,
        price_from: data.price_from ? String(data.price_from).trim() : null,
        price_to: data.price_to || 'Consulte no link',
        card_price: data.card_price ? String(data.card_price).trim() : null,
        installments: data.installments ? String(data.installments).trim() : null,
        coupon: data.coupon ? String(data.coupon).trim() : null,
        original_link: data.original_link || urlInput.trim(),
        extractedAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        priceUncertain: !!data.price_uncertain,
        shipping: data.shipping || null,
      };

      setExtractedProduct(prod);
      if (prod.priceUncertain) {
        setErrorMsg('⚠️ Não consegui confirmar o preço com segurança nessa loja. Confira o valor manualmente antes de enviar a copy.');
      }

      // Generate initial 3 local variations immediately
      const defaultVars = generateVariationsForProduct(prod);
      setVariations(defaultVars);
      setSelectedVariationIndex(0);
      setEditedCopyText(defaultVars[0].copy);

      // Attempt background Gemini AI enhancement automatically
      setIsAiGenerating(true);
      try {
        const aiResponse = await fetch('/api/gemini/copy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product: prod,
            apiKeys,
          }),
        });
        const aiData = await aiResponse.json();
        if (aiResponse.ok) {
          if (aiData.variations && Array.isArray(aiData.variations) && aiData.variations.length > 0) {
            const formattedAiVars = aiData.variations.map((v: any, i: number) => ({
              id: v.id || `ai_var_${i}_` + Date.now(),
              title: v.title || `Variação IA ${i + 1}`,
              copy: (v.copy || '').replace(/\{LINK\}/g, prod.original_link),
            }));
            setVariations(formattedAiVars);
            setEditedCopyText(formattedAiVars[0].copy);
          } else {
            throw new Error('Retorno da IA vazio ou com formato inválido.');
          }
        } else {
          throw new Error(aiData.error || 'Erro desconhecido na geração.');
        }
      } catch (aiErr: any) {
        console.error('[Auto Gemini Copy Error]', aiErr);
        setErrorMsg(`⚠️ Produto extraído com sucesso, mas a Inteligência Artificial falhou ao gerar as copies: ${aiErr.message || 'Erro desconhecido'}. Usando as 3 copies padrão locais.`);
      } finally {
        setIsAiGenerating(false);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(`❌ Erro ao extrair dados do produto: ${err.message || 'Não foi possível extrair as informações deste link.'}`);
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
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Editable Extracted Product */}
            <div className="lg:col-span-6 space-y-4">
              <ProductEditor
                product={extractedProduct}
                setProduct={setExtractedProduct}
                onUpdateField={handleUpdateProductField}
              />

              {/* Save to Dashboard Button */}
              <button
                onClick={handleSaveToDashboard}
                disabled={isSaved}
                className={`w-full py-3 px-4 rounded-2xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
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
            <div className="lg:col-span-6 bg-stone-900 border border-stone-800 rounded-2xl p-5 space-y-4 shadow-xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-stone-800 pb-3 gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <h3 className="text-base font-bold text-white">3 Variações de Copy Geradas</h3>
                </div>
                <div className="flex items-center gap-2 self-start sm:self-auto">
                  {isAiGenerating && (
                    <div className="flex items-center gap-1 text-[10px] bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold px-2 py-0.5 rounded-full animate-pulse">
                      <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      <span>Gerando com IA...</span>
                    </div>
                  )}
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-300 font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase">
                    Prontas para WhatsApp
                  </span>
                </div>
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

        </div>
      )}

    </div>
  );
};
