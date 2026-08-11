import React, { useState } from 'react';
import type { GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate } from '../types';
import { buildAffiliateLink } from '../utils/affiliateLink';
import { calculateCommission, calculateSalesTrend } from '../utils/marketplaceUtils';
import { formatPrice } from '../utils/formatPrice';
import { PriceBlock } from './PriceBlock';
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
}

const platformLabel: Record<string, string> = {
  mercadolivre: 'Mercado Livre',
  shopee: 'Shopee',
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
  shein: 'Shein',
};

const platformColor: Record<string, string> = {
  mercadolivre: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  shopee: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  amazon: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  aliexpress: 'bg-red-500/20 text-red-300 border-red-500/30',
  shein: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
};

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  apiKeys,
  commissionRates,
  onClose,
}) => {
  const keys: ApiKeysConfig = apiKeys || {};
  const [imgError, setImgError] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('default');
  const [customMessage, setCustomMessage] = useState<string>('');
  const [generatingAiCopy, setGeneratingAiCopy] = useState(false);

  // Link de Afiliado
  const affiliateLink = buildAffiliateLink(product.original_link, product.platform, keys);

  // Comissão Estimada com base na tabela interna
  const commission = calculateCommission(
    product.price_to,
    product.platform,
    product,
    null,
    null,
    commissionRates
  );

  const trend = calculateSalesTrend(product);
  const hasFrom = product.price_from && product.price_from !== product.price_to;

  // Template padrão de mensagem
  const defaultMessage = `🚨 *OFERTA IMPERDÍVEL!* 🔥\n\n${product.title}\n\n${hasFrom ? `~De: ${formatPrice(product.price_from!)}~\n` : ''}💰 *Por apenas: ${formatPrice(product.price_to)}!*\n${product.installments ? `💳 ${product.installments}\n` : ''}\n👉 *GARANTA O SEU AQUI:* \n${affiliateLink}`;

  const currentMessage = customMessage || defaultMessage;

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
          product,
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
                platformColor[product.platform] ?? 'bg-stone-800 text-stone-300'
              }`}
            >
              {platformLabel[product.platform] ?? product.platform}
            </span>
            <span className="text-xs font-semibold text-[#93a0b5] truncate max-w-xs sm:max-w-md">
              {product.category || 'Geral'}
            </span>
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
                {!imgError && product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.title}
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
                {product.title}
              </h2>

              {/* Price Block */}
              <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-2">
                <span className="text-[11px] font-bold text-[#93a0b5] uppercase tracking-wider block">
                  Preço do Produto
                </span>
                <PriceBlock
                  product={product}
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

              {/* Sales in Last 7 Days & Trend */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl">
                  <span className="text-[#93a0b5] block text-[11px] font-semibold mb-0.5">Vendas nos últimos 7 dias</span>
                  <span className="text-sm font-extrabold text-white">
                    {product.sales_7d ? `${product.sales_7d} unidades` : 'Alta demanda'}
                  </span>
                </div>

                <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl">
                  <span className="text-[#93a0b5] block text-[11px] font-semibold mb-0.5">Tendência de Mercado</span>
                  <span className="text-sm font-extrabold text-emerald-400 flex items-center gap-1">
                    <TrendingUp className="w-4 h-4" /> +{trend.pct}% em alta
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Product Description */}
          {product.description && (
            <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-2">
              <span className="text-xs font-extrabold text-white block">Descrição do Produto</span>
              <p className="text-xs text-[#93a0b5] leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto">
                {product.description}
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
              <label className="text-xs font-bold text-stone-300 block mb-1">
                Mensagem Formatada para WhatsApp:
              </label>
              <textarea
                rows={5}
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
                <span>Abrir Link Oficial</span>
              </a>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
