import React, { useState, useEffect } from 'react';
import type { GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate, ProductData } from '../types';
import { buildAffiliateLink, buildShareableTrackingLink, slugify } from '../utils/affiliateLink';
import { calculateCommission, calculateSalesTrend } from '../utils/marketplaceUtils';
import { formatPrice } from '../utils/formatPrice';
import { PriceBlock } from './PriceBlock';
import { DEFAULT_TEMPLATES, applyTemplate } from '../data/defaultTemplates';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  X,
  Share2,
  ShoppingBag,
  Sparkles,
  BarChart2,
  ExternalLink,
  MessageSquare,
  Tag,
  CheckCircle2,
  Check,
  TrendingUp,
  Percent,
  Copy,
  Send,
  Loader2,
} from 'lucide-react';

interface ProductDetailModalProps {
  product: GlobalProduct;
  currentUserId?: string;
  apiKeys?: ApiKeysConfig;
  commissionRates?: CommissionRatesConfig;
  onClose: () => void;
  onAddCustomTemplate?: (template: CopyTemplate) => void;
  customTemplates?: CopyTemplate[];
  defaultTemplateId?: string;
  onProductEnriched?: (enriched: GlobalProduct) => void;
}

const platformLabel: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  shein: 'Shein',
  tiktokshop: 'TikTok Shop',
};

const platformColor: Record<string, string> = {
  mercadolivre: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  shopee: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  amazon: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  aliexpress: 'bg-red-500/20 text-red-300 border-red-500/30',
  shein: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  tiktokshop: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
};

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  currentUserId,
  apiKeys,
  commissionRates,
  onClose,
  customTemplates = [],
  defaultTemplateId,
  onProductEnriched,
}) => {
  const keys: ApiKeysConfig = apiKeys || {};
  const [currentProduct, setCurrentProduct] = useState<GlobalProduct>(product);
  const [enriching, setEnriching] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    defaultTemplateId || 'whatsapp-urgency'
  );
  const [customMessage, setCustomMessage] = useState<string>('');
  const [generatingAiCopy, setGeneratingAiCopy] = useState(false);

  // Auto-enrich when the modal is opened
  useEffect(() => {
    const enrichData = async () => {
      // Run enrichment if any crucial field is missing or to guarantee complete data
      const isMissingDetails =
        !product.description ||
        !product.image_url ||
        product.stars === undefined ||
        product.stars === null ||
        product.sales_count === undefined ||
        product.sales_count === null;

      if (!isMissingDetails && product.description !== 'Aguardando sincronização de detalhes...') return;

      setEnriching(true);
      try {
        const response = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: product.original_link, apiKeys: keys }),
        });

        if (response.ok) {
          const resData = await response.json();
          if (resData.success && resData.data) {
            const scraped = resData.data;
            const updated: GlobalProduct = {
              ...product,
              title: scraped.title || product.title,
              description: scraped.description || product.description || 'Nenhuma descrição fornecida.',
              image_url: scraped.image_url || product.image_url,
              price_to: scraped.price_to || product.price_to,
              price_from: scraped.price_from || product.price_from,
              stars: scraped.stars !== undefined ? scraped.stars : product.stars,
              sales_count: scraped.sales_count !== undefined ? scraped.sales_count : product.sales_count,
              category: scraped.category || product.category,
              lastUpdatedAt: new Date().toLocaleDateString('pt-BR'),
            };

            setCurrentProduct(updated);

            // Persist the enriched data to the global products collection
            try {
              await setDoc(doc(db, 'products', product.id), updated, { merge: true });
            } catch (e) {
              console.error('[ProductDetailModal] Error writing enriched product to DB:', e);
            }

            // Propagate enrichment back to parent components
            if (onProductEnriched) {
              onProductEnriched(updated);
            }
          }
        }
      } catch (err) {
        console.error('[ProductDetailModal] Error enriching product:', err);
      } finally {
        setEnriching(false);
      }
    };

    enrichData();
  }, [product.id, product.original_link]);

  // Sync Short Link to DB whenever title or URL changes
  useEffect(() => {
    if (currentProduct && currentUserId) {
      const targetUrl = buildAffiliateLink(currentProduct.original_link, currentProduct.platform, keys || {});
      const slug = slugify(currentProduct.title) || slugify(currentProduct.id) || 'oferta';
      if (targetUrl) {
        setDoc(doc(db, 'shortLinks', slug), {
          targetUrl,
          userId: currentUserId,
          productId: currentProduct.id || null,
          title: currentProduct.title || null,
          createdAt: new Date().toISOString()
        }, { merge: true }).catch(console.error);
      }
    }
  }, [currentProduct.title, currentProduct.original_link, currentUserId, keys]);

  // Link de Afiliado com Rastreamento de Cliques em Tempo Real para WhatsApp
  const affiliateLink = buildShareableTrackingLink(currentProduct.id, currentProduct.original_link, currentProduct.platform, keys, currentProduct.title);

  // Comissão Estimada com base na tabela interna
  const commission = calculateCommission(
    currentProduct.price_to,
    currentProduct.platform,
    currentProduct,
    null,
    null,
    commissionRates
  );

  const trend = calculateSalesTrend(currentProduct);
  const hasFrom = currentProduct.price_from && currentProduct.price_from !== currentProduct.price_to;

  const allAvailableTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
  const activeTemplate = allAvailableTemplates.find((t) => t.id === activeTemplateId) || DEFAULT_TEMPLATES[0];

  useEffect(() => {
    // Converter GlobalProduct para ProductData
    const prodData: ProductData = {
      title: currentProduct.title,
      description: currentProduct.description || '',
      price_to: currentProduct.price_to,
      price_from: currentProduct.price_from || null,
      installments: currentProduct.installments || null,
      coupon: currentProduct.coupon || null,
      shipping: currentProduct.shipping || null,
      platform: currentProduct.platform,
      original_link: currentProduct.original_link,
      image_url: currentProduct.image_url || '',
    };
    const formatted = applyTemplate(activeTemplate.template, prodData, affiliateLink, commissionRates);
    setCustomMessage(formatted);
  }, [activeTemplateId, currentProduct, affiliateLink, customTemplates, commissionRates]);

  const currentMessage = customMessage;

  // Promover produto (abrir WhatsApp diretamente)
  const handlePromoteWhatsApp = () => {
    const encoded = encodeURIComponent(currentMessage);
    const url = `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Gerar Copy com IA
  const handleGenerateAiCopy = async () => {
    setGeneratingAiCopy(true);
    try {
      const res = await fetch('/api/gemini/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: currentProduct,
          geminiApiKey: keys.geminiApiKey,
          geminiApiKeys: keys.geminiApiKeys,
        }),
      });

      let data: any;
      const contentType = res.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        data = await res.json();
      } else {
        throw new Error('Resposta inválida do servidor.');
      }

      if (data.variations && data.variations.length > 0) {
        const rawCopy = data.variations[0].copy;
        const formattedWithLink = rawCopy.replace(/\{LINK\}/g, affiliateLink);
        setCustomMessage(formattedWithLink);
      }
    } catch (e) {
      console.error('Erro ao gerar copy com IA:', e);
    } finally {
      setGeneratingAiCopy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0e1119] border border-[#1e2636] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col animate-fadeIn">
        
        {/* Top Header Sticky */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1e2636] bg-[#0e1119] sticky top-0 z-20 backdrop-blur">
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-bold px-3 py-1 rounded-full border ${
                platformColor[currentProduct.platform] ?? 'bg-stone-800 text-stone-300'
              }`}
            >
              {platformLabel[currentProduct.platform] ?? currentProduct.platform}
            </span>
            <span className="text-xs font-semibold text-[#93a0b5] truncate max-w-xs sm:max-w-md">
              {currentProduct.category || 'Geral'}
            </span>
            {enriching && (
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Atualizando dados...
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-[#93a0b5] hover:text-white hover:bg-[#151a26] border border-transparent hover:border-[#1e2636] transition-all"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          
          {/* Section 1: Main Product Display */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            
            {/* Left Col: Photo */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="w-full aspect-square bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 flex items-center justify-center overflow-hidden group">
                {!imgError && currentProduct.image_url ? (
                  <img
                    src={currentProduct.image_url}
                    alt={currentProduct.title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <ShoppingBag className="w-16 h-16 text-stone-600" />
                )}
              </div>
            </div>

            {/* Right Col: Details */}
            <div className="md:col-span-7 space-y-4">
              <h2 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                {currentProduct.title}
              </h2>

              {/* Price Block */}
              <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-2">
                <span className="text-[11px] font-bold text-[#93a0b5] uppercase tracking-wider block">
                  Preço do Produto
                </span>
                <PriceBlock
                  product={currentProduct}
                  size="lg"
                />
              </div>

              {/* Commission Highlight Box */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <Percent className="w-4 h-4" /> Comissão Máxima Estimada
                  </span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {commission.ratePct}%
                  </span>
                </div>
                <p className="text-lg font-extrabold text-white">
                  {formatPrice(commission.amount)} <span className="text-xs text-[#93a0b5] font-normal">/ por venda realizada</span>
                </p>
              </div>

              {/* Sales in Last 7 Days & Trend & Rating */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl">
                  <span className="text-[#93a0b5] block text-[11px] font-semibold mb-0.5">Volume de Vendas</span>
                  <span className="text-sm font-extrabold text-white">
                    {currentProduct.sales_count ? currentProduct.sales_count : (currentProduct.sales_7d ? `${currentProduct.sales_7d} unid.` : 'Alta demanda')}
                  </span>
                </div>

                <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl">
                  <span className="text-[#93a0b5] block text-[11px] font-semibold mb-0.5">Avaliação / Nota</span>
                  <span className="text-sm font-extrabold text-yellow-400 flex items-center gap-1">
                    ⭐ {currentProduct.stars ? `${currentProduct.stars} / 5.0` : 'Excelente'}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Product Description */}
          {currentProduct.description && (
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-2">
              <span className="text-xs font-extrabold text-white block">Descrição do Produto</span>
              <p className="text-xs text-[#93a0b5] leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto">
                {currentProduct.description}
              </p>
            </div>
          )}

          {/* Section 2: Promover Produto (WhatsApp) */}
          <div className="p-5 bg-[#151a26] border border-emerald-500/40 rounded-2xl space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e2636] pb-3">
              <div>
                <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <Send className="w-4 h-4 text-emerald-400" /> Promover Produto no WhatsApp
                </h3>
                <p className="text-xs text-[#93a0b5]">
                  Envie diretamente para seus contatos e grupos do WhatsApp com o seu link de afiliado rastreado.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateAiCopy}
                disabled={generatingAiCopy}
                className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-bold text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto shrink-0"
              >
                {generatingAiCopy ? <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" /> : <Sparkles className="w-3.5 h-3.5 text-blue-400" />}
                <span>Melhorar com IA</span>
              </button>
            </div>

            {/* Message Preview Box */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                <label className="text-xs font-bold text-stone-300">
                  Mensagem Formatada para WhatsApp:
                </label>
                
                {/* Subtle Template Active Indicator and Selector */}
                <div className="flex items-center gap-1.5 text-[11px] text-[#93a0b5]">
                  <span>Template ativo:</span>
                  <span className="font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    {activeTemplate?.name || 'Padrão'}
                  </span>
                  
                  <select
                    value={activeTemplateId}
                    onChange={(e) => setActiveTemplateId(e.target.value)}
                    className="bg-[#0e1119] border border-[#1e2636] text-amber-300 hover:text-amber-200 text-[11px] font-bold rounded-lg px-2 py-1 focus:outline-none focus:border-amber-500 cursor-pointer transition-colors"
                  >
                    <optgroup label="Modelos Predefinidos">
                      {DEFAULT_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                    {customTemplates && customTemplates.length > 0 && (
                      <optgroup label="Meus Modelos e IA">
                        {customTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              </div>

              <textarea
                rows={6}
                value={currentMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                className="w-full p-3 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-stone-200 font-mono leading-relaxed focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Main Action Button */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
              <button
                onClick={handlePromoteWhatsApp}
                className="w-full py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-extrabold text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/20"
              >
                <Send className="w-5 h-5" />
                <span>Promover Produto no WhatsApp</span>
              </button>
              
              <a
                href={affiliateLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto px-4 py-3.5 rounded-xl bg-[#0e1119] hover:bg-stone-800 text-stone-300 border border-[#1e2636] font-bold text-xs flex items-center justify-center gap-2 shrink-0 transition-all"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Abrir Encurtado</span>
              </a>
            </div>

            {keys && (
              <div className="mt-4 pt-4 border-t border-[#1e2636]">
                <span className="text-[10px] text-blue-400 font-bold flex items-center gap-1 mb-1">
                  Seu Link de Afiliado Oficial (Bruto)
                </span>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-[#0e1119] border border-blue-500/20 rounded p-2 overflow-hidden text-[10px] text-blue-200/80 font-mono truncate">
                    {buildAffiliateLink(currentProduct.original_link, currentProduct.platform, keys)}
                  </div>
                  <a
                    href={buildAffiliateLink(currentProduct.original_link, currentProduct.platform, keys)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] bg-blue-600 hover:bg-blue-500 text-white px-2 py-1.5 rounded font-bold whitespace-nowrap transition-colors"
                  >
                    Testar
                  </a>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};
