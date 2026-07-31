import React, { useState, useEffect } from 'react';
import type { GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate } from '../types';
import { buildAffiliateLink } from '../utils/affiliateLink';
import { calculateCommission, calculateSalesTrend, normalizeCategoryText, addGlobalProductToUserList } from '../utils/marketplaceUtils';
import { formatPrice } from '../utils/formatPrice';
import { isProductSharedRecently, toggleProductShared } from '../utils/sharingLogUtils';
import {
  X,
  Copy,
  Check,
  Sparkles,
  Share2,
  Video,
  ShoppingBag,
  Star,
  TrendingUp,
  TrendingDown,
  BarChart2,
  ExternalLink,
  MessageSquare,
  Edit3,
  AlertTriangle,
  Clock,
  Film,
  Zap,
  CheckCircle,
  Eye,
  RefreshCw,
  Tag,
  Flame,
  Award,
  RotateCcw,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Ticket,
  Save,
  PlusCircle,
  ArrowRight,
  Loader2
} from 'lucide-react';

interface ProductDetailModalProps {
  product: GlobalProduct;
  currentUserId?: string;
  apiKeys?: ApiKeysConfig;
  commissionRates?: CommissionRatesConfig;
  sharedMap?: Record<string, number>;
  onToggleShared?: (productId: string) => void;
  onUpdateProductCommission?: (productId: string, ratePct: number | null, amountVal: number | null) => void;
  onClose: () => void;
  onNavigateToSettings?: () => void;
  onNavigateToMyProducts?: () => void;
  onAddCustomTemplate?: (template: CopyTemplate) => void;
  isAlreadyInMyProducts?: boolean;
  isFromMarketplace?: boolean;
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
  amazon: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
  aliexpress: 'bg-red-500/20 text-red-300 border-red-500/30',
  shein: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
};

export const ProductDetailModal: React.FC<ProductDetailModalProps> = ({
  product,
  currentUserId,
  apiKeys,
  commissionRates,
  sharedMap,
  onToggleShared,
  onUpdateProductCommission,
  onClose,
  onNavigateToSettings,
  onNavigateToMyProducts,
  onAddCustomTemplate,
  isAlreadyInMyProducts = false,
  isFromMarketplace = false,
}) => {
  const keys: ApiKeysConfig = apiKeys || {};
  const [activeTab, setActiveTab] = useState<'share' | 'script'>('share');
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMessage, setCopiedMessage] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [showFullDescription, setShowFullDescription] = useState(false);

  // Estado para Adicionar em Meus Produtos
  const [addedToMine, setAddedToMine] = useState(isAlreadyInMyProducts);
  const [addingToMine, setAddingToMine] = useState(false);
  const [addSuccessMessage, setAddSuccessMessage] = useState(false);

  // Sobrescrever comissão manual do produto
  const [isEditingCommOverride, setIsEditingCommOverride] = useState(false);
  const [commOverrideRate, setCommOverrideRate] = useState('');
  const [commOverrideAmount, setCommOverrideAmount] = useState('');

  const [imgError, setImgError] = useState(false);

  // Status de divulgação 24h
  const sharedStatus = isProductSharedRecently(product.id, sharedMap);

  const handleToggleShareStatus = () => {
    if (onToggleShared) {
      onToggleShared(product.id);
    }
  };

  const handleAddToMyProducts = async () => {
    if (!currentUserId) {
      alert('Você precisa estar logado para adicionar produtos à sua lista.');
      return;
    }
    setAddingToMine(true);
    try {
      const ok = await addGlobalProductToUserList(currentUserId, product);
      if (ok) {
        setAddedToMine(true);
        setAddSuccessMessage(true);
        setTimeout(() => setAddSuccessMessage(false), 5000);
      }
    } catch (e) {
      console.error('Erro ao adicionar produto:', e);
    } finally {
      setAddingToMine(false);
    }
  };

  // Link de Afiliado do Usuário
  const affiliateLink = buildAffiliateLink(product.original_link, product.platform, keys);

  // Verificar se o usuário tem o ID da plataforma cadastrado
  const hasUserTag = (() => {
    switch (product.platform) {
      case 'mercadolivre': return Boolean(keys.mercadolivreTrackingId);
      case 'shopee': return Boolean(keys.shopeeTrackingId);
      case 'amazon': return Boolean(keys.amazonAssociatesTag);
      case 'aliexpress': return Boolean(keys.aliexpressAffiliateId);
      case 'shein': return Boolean(keys.sheinAffiliateToken);
      default: return false;
    }
  })();

  // Comissão & Tendência
  const commission = calculateCommission(
    product.price_to,
    product.platform,
    product,
    null,
    null,
    commissionRates
  );
  const trend = calculateSalesTrend(product);

  // Preço antigo e desconto
  const hasFrom = product.price_from && product.price_from !== product.price_to;

  // Mensagem / Copy Editável
  const defaultCopyMessage = `🚨 *OFERTA IMPERDÍVEL NO ${platformLabel[product.platform]?.toUpperCase() || 'MARKETPLACE'}!* 🔥

${product.title}

${hasFrom ? `~De: ${formatPrice(product.price_from!)}~\n` : ''}💰 *Por apenas: ${formatPrice(product.price_to)}!*
${product.installments ? `💳 ${product.installments}\n` : ''}${product.coupon ? `🎟️ Cupom Especial: *${product.coupon}*\n` : ''}🚚 ${product.free_shipping ? 'Frete Grátis disponível!' : 'Confira condições de frete no link'}

👉 *GARANTA O SEU AQUI:*
${affiliateLink}

⏰ *Aproveite antes que esgoste o estoque!*`;

  const [message, setMessage] = useState(defaultCopyMessage);
  const [isEditingMessage, setIsEditingMessage] = useState(false);
  const [generatingCopy, setGeneratingCopy] = useState(false);

  // Atualizar mensagem se o link mudar
  useEffect(() => {
    setMessage(defaultCopyMessage);
  }, [affiliateLink, product]);

  // Roteiro de Vídeo
  const [videoType, setVideoType] = useState<'achadinho' | 'review' | 'problema_solucao' | 'top_motivos' | 'oferta_urgencia'>('achadinho');
  const [videoDuration, setVideoDuration] = useState<'30s' | '1m' | '2m' | '3m'>('1m');
  const [generatingScript, setGeneratingScript] = useState(false);
  const [videoScriptData, setVideoScriptData] = useState<any | null>(null);

  // Copiar link
  const handleCopyLink = () => {
    navigator.clipboard.writeText(affiliateLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Copiar mensagem
  const handleCopyMessage = () => {
    navigator.clipboard.writeText(message);
    setCopiedMessage(true);
    setTimeout(() => setCopiedMessage(false), 2000);
  };

  const escapeRegExp = (str: string) => {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  };

  const handleSaveAsTemplate = () => {
    let templateText = message;

    // 1. Link
    if (affiliateLink) {
      templateText = templateText.replace(new RegExp(escapeRegExp(affiliateLink), 'g'), '{linkAfiliado}');
    } else if (product.original_link) {
      templateText = templateText.replace(new RegExp(escapeRegExp(product.original_link), 'g'), '{linkAfiliado}');
    }

    // 2. Title
    if (product.title) {
      templateText = templateText.replace(new RegExp(escapeRegExp(product.title), 'g'), '{titulo}');
    }

    // 3. Price to
    if (product.price_to) {
      templateText = templateText.replace(new RegExp(escapeRegExp(formatPrice(product.price_to)), 'g'), '{preco}');
      templateText = templateText.replace(new RegExp(escapeRegExp(String(product.price_to)), 'g'), '{preco}');
    }

    // 4. Price from
    if (product.price_from) {
      templateText = templateText.replace(new RegExp(escapeRegExp(formatPrice(product.price_from)), 'g'), '{precoAntigo}');
      templateText = templateText.replace(new RegExp(escapeRegExp(String(product.price_from)), 'g'), '{precoAntigo}');
    }

    // 5. Installments
    if (product.installments) {
      templateText = templateText.replace(new RegExp(escapeRegExp(product.installments), 'g'), '{parcelamento}');
    }

    // 6. Coupon
    if (product.coupon_text) {
      templateText = templateText.replace(new RegExp(escapeRegExp(product.coupon_text), 'g'), '{cupom}');
    }

    const name = prompt('Insira um nome para o seu novo template:', `Template Personalizado - ${product.title.slice(0, 20)}`);
    if (!name) return;

    const newTemplate: CopyTemplate = {
      id: 'custom_' + Date.now(),
      name: '✏️ ' + name,
      category: 'custom',
      description: `Criado a partir da IA para o produto: ${product.title.slice(0, 30)}`,
      template: templateText,
    };

    if (onAddCustomTemplate) {
      onAddCustomTemplate(newTemplate);
      alert('Template de copy personalizado salvo com sucesso!');
    }
  };

  // Gerar Copy com IA Gemini
  const handleGenerateAiCopy = async () => {
    setGeneratingCopy(true);
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

      let data: any; const contentType = res.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { data = await res.json(); } else { throw new Error("Resposta inválida do servidor."); }
      if (data.variations && data.variations.length > 0) {
        const rawCopy = data.variations[0].copy;
        const formattedWithLink = rawCopy.replace(/\{LINK\}/g, affiliateLink);
        setMessage(formattedWithLink);
      }
    } catch (e) {
      console.error('Erro ao gerar copy com IA:', e);
    } finally {
      setGeneratingCopy(false);
    }
  };

  // Gerar Roteiro de Vídeo com IA
  const handleGenerateScript = async () => {
    setGeneratingScript(true);
    try {
      const res = await fetch('/api/gemini/video-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          videoType,
          duration: videoDuration,
          geminiApiKey: apiKeys.geminiApiKey,
          geminiApiKeys: apiKeys.geminiApiKeys,
        }),
      });

      let data: any; const contentType = res.headers.get("content-type"); if (contentType && contentType.includes("application/json")) { data = await res.json(); } else { throw new Error("Resposta inválida do servidor."); }
      setVideoScriptData(data);
    } catch (e) {
      console.error('Erro ao gerar roteiro:', e);
    } finally {
      setGeneratingScript(false);
    }
  };

  const handleCopyScript = () => {
    if (!videoScriptData) return;
    const textToCopy = videoScriptData.fullScriptText || JSON.stringify(videoScriptData, null, 2);
    navigator.clipboard.writeText(textToCopy);
    setCopiedScript(true);
    setTimeout(() => setCopiedScript(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-stone-950/80 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-stone-900 border border-stone-800 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Cabeçalho do Modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-800 bg-stone-900/90 sticky top-0 z-10 backdrop-blur">
          <div className="flex items-center gap-3">
            <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${platformColor[product.platform] ?? 'bg-stone-800 text-stone-300'}`}>
              {platformLabel[product.platform] ?? product.platform}
            </span>
            <h3 className="text-sm sm:text-base font-bold text-white truncate max-w-md">
              Análise do Produto & Inteligência de Mercado
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Conteúdo com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* BANNER DE AÇÃO PRINCIPAL: Adicionar o produto a "Meus Produtos" */}
          {addedToMine && isFromMarketplace && (
            <div className="p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-950/50 border-emerald-500/40 text-emerald-300">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    ✓ Adicionado aos Seus Produtos!
                  </h4>
                  <p className="text-xs text-[#93a0b5] mt-0.5">
                    Este produto foi adicionado à sua lista. Acesse a aba "Meus Produtos" para pegar seu link de afiliado personalizado e gerar roteiros de vídeo ou copies prontas.
                  </p>
                </div>
              </div>
              {onNavigateToMyProducts && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToMyProducts();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20 whitespace-nowrap"
                >
                  <span>Ir para Meus Produtos</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}
            </div>
          )}

          {addedToMine && !isFromMarketplace && (
            <div className="p-4 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-emerald-950/50 border-emerald-500/40 text-emerald-300">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-xl shrink-0 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">
                    ✓ Produto Adicionado aos Seus Produtos!
                  </h4>
                  <p className="text-xs text-stone-300 mt-0.5">
                    Este produto já está disponível na sua aba "Meus Produtos". Você pode usar as ferramentas abaixo para divulgação.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 text-xs">
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 select-none">
                  <Check className="w-3.5 h-3.5" /> Em Meus Produtos
                </span>
                {onNavigateToMyProducts && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToMyProducts();
                    }}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <span>Ir para Meus Produtos</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Toast de Confirmação quando Adicionado */}
          {addSuccessMessage && (
            <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-fadeIn">
              <span className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                Produto importado com sucesso! Agora você pode gerenciá-lo na aba "Meus Produtos".
              </span>
              {onNavigateToMyProducts && (
                <button
                  onClick={() => {
                    onClose();
                    onNavigateToMyProducts();
                  }}
                  className="underline hover:text-white shrink-0 text-xs font-extrabold"
                >
                  Ver Lista ➔
                </button>
              )}
            </div>
          )}

          {/* MÓDULO DE INTELIGÊNCIA DE MERCADO & GRÁFICO DE TENDÊNCIAS */}
          <div className="p-4 rounded-2xl bg-[#0e1119] border border-[#1e2636] space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2636] pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400">
                  <BarChart2 className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-extrabold text-white">Desempenho & Tendência de Vendas</h4>
                  <p className="text-[11px] text-[#93a0b5]">Histórico e métricas de demanda nos últimos dias</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border flex items-center gap-1 ${
                  trend.isUp
                    ? 'bg-emerald-950/80 text-emerald-400 border-emerald-500/40'
                    : 'bg-red-950/80 text-red-400 border-red-500/40'
                }`}>
                  {trend.isUp ? <TrendingUp className="w-3.5 h-3.5 text-emerald-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                  <span>{trend.formatted !== 'Sem informações suficientes' ? `${trend.formatted} em Vendas` : 'Demanda Estável'}</span>
                </span>
              </div>
            </div>

            {/* Métrica Visual do Gráfico em Barras Simuladas de Tendência de 7 Dias */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Card 1: Vendas nos últimos 7 dias */}
              <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-[#93a0b5] uppercase">Vendas Estimadas (7 Dias)</span>
                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-xl font-black text-white">
                    {product.sales_count ? product.sales_count : '350+'} un.
                  </span>
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-md">
                    +{trend.pct || 18}% alta
                  </span>
                </div>
                {/* Gráfico Sparkline de barras para os 7 dias */}
                <div className="flex items-end gap-1.5 h-8 mt-3 pt-1 border-t border-[#1e2636]">
                  {[30, 45, 40, 60, 75, 80, 100].map((h, i) => (
                    <div
                      key={i}
                      className={`flex-1 rounded-t transition-all ${
                        i === 6 ? 'bg-blue-500' : i >= 4 ? 'bg-blue-400/70' : 'bg-[#1e2636]'
                      }`}
                      style={{ height: `${h}%` }}
                      title={`Dia ${i + 1}: ${h}% volume`}
                    />
                  ))}
                </div>
              </div>

              {/* Card 2: Temperatura de Conversão no Grupo */}
              <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-[#93a0b5] uppercase">Potencial de Venda (Grupo)</span>
                <div className="flex items-center gap-2 mt-2">
                  <Flame className="w-6 h-6 text-amber-400 fill-amber-400 animate-bounce" />
                  <div>
                    <span className="text-base font-extrabold text-amber-300 block leading-tight">Produto Aquecido</span>
                    <span className="text-[10px] text-stone-400">Alta conversão para Telegram / WhatsApp</span>
                  </div>
                </div>
                <div className="mt-3 pt-1 border-t border-[#1e2636] text-[10px] text-stone-400 flex items-center justify-between">
                  <span>Pontuação de Oferta:</span>
                  <span className="font-bold text-amber-400">9.4 / 10</span>
                </div>
              </div>

              {/* Card 3: Comissão e Margem Esperada */}
              <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl flex flex-col justify-between">
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Sua Margem por Venda</span>
                <div className="mt-2">
                  <span className="text-2xl font-black text-yellow-300 font-mono">
                    {commission.amountFormatted}
                  </span>
                  <span className="text-xs text-emerald-400 block font-bold mt-0.5">
                    {commission.ratePct}% de comissão cadastrada
                  </span>
                </div>
                <div className="mt-3 pt-1 border-t border-emerald-500/20 text-[10px] text-stone-400 flex items-center justify-between">
                  <span>10 vendas no mês =</span>
                  <span className="font-bold text-yellow-300">R$ {(commission.amount * 10).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Card Principal: Informações do Produto & Métricas de Comissão */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 p-4 rounded-xl bg-stone-950/60 border border-stone-800">
            {/* Foto do Produto */}
            <div className="md:col-span-4 flex flex-col items-center justify-center">
              <div className="relative w-full aspect-square rounded-xl bg-stone-900 overflow-hidden border border-stone-800 flex items-center justify-center">
                {product.image_url && !imgError ? (
                  <img
                    src={product.image_url}
                    alt={product.title || 'Produto'}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-stone-900 text-stone-700">
                    <Tag className="w-12 h-12" />
                  </div>
                )}
                {trend.pct !== null ? (
                  <div className={`absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold border ${trend.isUp ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-red-500/20 text-red-400 border-red-500/30'}`}>
                    {trend.formatted} em vendas
                  </div>
                ) : (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-medium bg-stone-900/90 text-stone-400 border border-stone-800">
                    Tendência: —
                  </div>
                )}
              </div>
            </div>

            {/* Informações detalhadas */}
            <div className="md:col-span-8 flex flex-col justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">
                  {product.title || 'Produto sem título'}
                </h2>
                
                {/* Meta badges: Avaliação, Vendas, Frete e Cupom */}
                <div className="flex items-center gap-2 mt-2 flex-wrap text-xs text-stone-400">
                  <span className="flex items-center gap-1 text-amber-400 font-semibold bg-amber-400/10 px-2 py-0.5 rounded-md border border-amber-400/20">
                    <Star className="w-3.5 h-3.5 fill-amber-400" />
                    {product.stars ? product.stars : '—'}
                  </span>
                  <span className="flex items-center gap-1 bg-stone-800 px-2 py-0.5 rounded-md text-stone-300">
                    <ShoppingBag className="w-3.5 h-3.5 text-stone-400" />
                    {product.sales_count ? `${product.sales_count} vendas` : '—'}
                  </span>
                  {(product.free_shipping || (product.shipping && product.shipping.toLowerCase().includes('grátis'))) ? (
                    <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-md font-medium text-[11px] border border-emerald-500/20">
                      🚚 Frete Grátis
                    </span>
                  ) : product.shipping ? (
                    <span className="bg-stone-800 text-stone-300 px-2 py-0.5 rounded-md text-[11px]">
                      📦 {product.shipping}
                    </span>
                  ) : null}
                  {product.coupon && (
                    <span className="inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 border border-amber-500/40 px-2.5 py-0.5 rounded-md font-bold text-[11px] shadow-sm">
                      <Ticket className="w-3.5 h-3.5 text-amber-400" />
                      Cupom: {product.coupon}
                    </span>
                  )}
                </div>

                {/* Seção Descrição do Produto */}
                {product.description && (
                  <div className="mt-3 p-3 rounded-xl bg-stone-900 border border-stone-800 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400 block flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      Descrição do Produto
                    </span>
                    <p className={`text-stone-300 leading-relaxed whitespace-pre-line ${!showFullDescription ? 'line-clamp-3' : ''}`}>
                      {product.description}
                    </p>
                    {product.description.length > 100 && (
                      <button
                        type="button"
                        onClick={() => setShowFullDescription(!showFullDescription)}
                        className="text-[11px] font-semibold text-blue-400 hover:underline mt-1 focus:outline-none"
                      >
                        {showFullDescription ? 'ver menos' : 'ver mais'}
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Bloco de Preço & Comissão Estimada */}
              <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-stone-900 border border-stone-800">
                {/* Preço do produto */}
                <div className="flex flex-col justify-center">
                  <span className="text-[10px] text-stone-400 font-medium">Preço ao Consumidor</span>
                  <div className="flex items-baseline gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-lg font-extrabold text-white">
                      {formatPrice(product.price_to)}
                    </span>
                    {hasFrom && (
                      <span className="text-xs text-stone-500 line-through">
                        {formatPrice(product.price_from!)}
                      </span>
                    )}
                  </div>
                  {/* Preço à Vista no Pix (Destaque Verde) */}
                  {product.pix_price && product.pix_price !== product.price_to && (
                    <div className="mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs w-fit">
                      <span>⚡ À vista no Pix: {formatPrice(product.pix_price)}</span>
                    </div>
                  )}
                  {product.installments && (
                    <span className="text-[10px] text-stone-400 mt-1 block">💳 {product.installments}</span>
                  )}
                </div>

                {/* Comissão */}
                <div className="flex flex-col bg-emerald-950/40 border border-emerald-500/30 p-3 rounded-xl justify-between relative space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <div className="flex flex-col gap-1.5">
                      <span className="text-xs text-emerald-400 font-extrabold uppercase tracking-wide">
                        Comissão estimada: {commission.ratePct}% = R$ {commission.amount.toFixed(2).replace('.', ',')}
                      </span>
                      {product.category ? (
                        <span className="text-[9px] text-[#93a0b5] bg-[#111622] border border-[#1e2636] px-2 py-0.5 rounded-md w-fit">
                          🏷️ estimativa (categoria: {product.category}{commission.categoryUsed && normalizeCategoryText(product.category) !== commission.categoryUsed ? ` - match: ${commission.categoryUsed}` : ''})
                        </span>
                      ) : (
                        <span className="text-[9px] text-amber-400 bg-amber-950/20 border border-amber-500/30 px-2 py-0.5 rounded-md w-fit">
                          ⚠️ estimativa (categoria ausente - usando padrão)
                        </span>
                      )}
                      {commission.isCustomOverride && (
                        <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-semibold w-fit">
                          ⚡ Personalizada
                        </span>
                      )}
                    </div>

                    {addedToMine && onUpdateProductCommission && !isEditingCommOverride && (
                      <button
                        type="button"
                        onClick={() => {
                          setCommOverrideRate(product.commission_rate ? String(product.commission_rate) : String(commission.ratePct));
                          setCommOverrideAmount(product.commission_amount ? String(product.commission_amount) : '');
                          setIsEditingCommOverride(true);
                        }}
                        className="text-[10px] text-emerald-400 hover:text-white bg-emerald-900/40 border border-emerald-500/40 px-2 py-0.5 rounded-lg flex items-center gap-1 font-bold transition-all"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Ajustar</span>
                      </button>
                    )}
                  </div>

                  <div className="flex items-baseline gap-2">
                    <span className="text-xl sm:text-2xl font-black text-yellow-300 drop-shadow-sm font-mono">
                      {commission.amountFormatted}
                    </span>
                  </div>

                  <p className="text-[10px] text-stone-400 italic leading-tight">
                    * Estimativa baseada na categoria/configuração do aplicativo (não é valor oficial do marketplace).
                  </p>

                  {/* Form de Edição de Comissão Manual para este Produto */}
                  {isEditingCommOverride && (
                    <div className="mt-2 p-3 bg-stone-950 border border-emerald-500/50 rounded-xl space-y-2 animate-fadeIn text-xs">
                      <div className="flex items-center justify-between border-b border-stone-800 pb-1.5">
                        <span className="font-bold text-white text-[11px]">Sobrescrever Comissão do Produto</span>
                        <button
                          type="button"
                          onClick={() => setIsEditingCommOverride(false)}
                          className="text-stone-400 hover:text-white text-xs"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-stone-300 block mb-0.5">Taxa (%)</label>
                          <input
                            type="number"
                            step="0.1"
                            placeholder="Ex: 15"
                            value={commOverrideRate}
                            onChange={(e) => {
                              setCommOverrideRate(e.target.value);
                              setCommOverrideAmount('');
                            }}
                            className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-stone-300 block mb-0.5">Ou Valor Fixo (R$)</label>
                          <input
                            type="number"
                            step="0.01"
                            placeholder="Ex: 25.50"
                            value={commOverrideAmount}
                            onChange={(e) => {
                              setCommOverrideAmount(e.target.value);
                              setCommOverrideRate('');
                            }}
                            className="w-full p-2 bg-stone-900 border border-stone-700 rounded-lg text-xs text-white"
                          />
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            if (onUpdateProductCommission) {
                              onUpdateProductCommission(product.id, null, null);
                            }
                            setIsEditingCommOverride(false);
                          }}
                          className="px-2.5 py-1 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-lg text-[10px] font-semibold"
                        >
                          Resetar Padrão
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const r = commOverrideRate ? parseFloat(commOverrideRate) : null;
                            const a = commOverrideAmount ? parseFloat(commOverrideAmount) : null;
                            if (onUpdateProductCommission) {
                              onUpdateProductCommission(product.id, isNaN(r!) ? null : r, isNaN(a!) ? null : a);
                            }
                            setIsEditingCommOverride(false);
                          }}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[10px] font-bold"
                        >
                          Salvar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Link de Afiliado e Aviso */}
              {addedToMine && !isFromMarketplace && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-stone-300 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-violet-400" />
                      Seu Link de Afiliado Personalizado:
                    </span>
                    {!hasUserTag && onNavigateToSettings && (
                      <button
                        onClick={onNavigateToSettings}
                        className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-medium"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        Cadastrar ID da {platformLabel[product.platform] ?? product.platform}
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      readOnly
                      value={affiliateLink}
                      className="flex-1 px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-300 font-mono truncate focus:outline-none"
                    />
                    <button
                      onClick={handleCopyLink}
                      className="px-3.5 py-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0"
                    >
                      {copiedLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {copiedLink ? 'Copiado!' : 'Copiar Link'}
                    </button>
                  </div>

                  {!hasUserTag && (
                    <p className="text-[10px] text-amber-400/90 bg-amber-950/30 border border-amber-500/20 p-2 rounded-lg">
                      ⚠️ Você ainda não cadastrou seu ID de afiliado da <strong>{platformLabel[product.platform] ?? product.platform}</strong> nas Configurações. Usando link padrão.
                    </p>
                  )}

                  {/* Banner de Controle Anti-Duplicação 24h */}
                  <div className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    sharedStatus.isShared
                      ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                      : 'bg-stone-900 border-stone-800 text-stone-300'
                  }`}>
                    <div className="flex items-center gap-2 text-xs">
                      {sharedStatus.isShared ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Clock className="w-4 h-4 text-stone-400 shrink-0" />
                      )}
                      <div>
                        {sharedStatus.isShared ? (
                          <p className="font-bold text-emerald-300">
                            Divulgado {sharedStatus.hoursAgoFormatted} • <span className="text-emerald-400 font-semibold">Libera em {sharedStatus.remainingFormatted}</span>
                          </p>
                        ) : (
                          <p className="font-medium text-stone-300">
                            Este produto está <strong>disponível</strong> para divulgação.
                          </p>
                        )}
                        <p className="text-[10px] text-stone-400">
                          {sharedStatus.isShared
                            ? 'Marcado para evitar envio repetido. Passadas 24h ele será liberado automaticamente.'
                            : 'Clique abaixo quando divulgar para pausar o produto por 24 horas.'}
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={handleToggleShareStatus}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                        sharedStatus.isShared
                          ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 border border-stone-700'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20'
                      }`}
                    >
                      {sharedStatus.isShared ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
                          Desmarcar (Liberar Agora)
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Marcar como Divulgado
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Abas de Ação: [1] Compartilhar & Copy | [2] Gerador de Roteiro de Vídeo */}
          {addedToMine && !isFromMarketplace && (
            <div className="space-y-4">
            <div className="flex border-b border-stone-800">
              <button
                onClick={() => setActiveTab('share')}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'share'
                    ? 'border-pink-500 text-pink-400 bg-pink-500/5'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Share2 className="w-4 h-4" />
                Mensagem para Compartilhar
              </button>

              <button
                onClick={() => setActiveTab('script')}
                className={`flex items-center gap-2 px-5 py-3 text-xs sm:text-sm font-bold border-b-2 transition-all ${
                  activeTab === 'script'
                    ? 'border-violet-500 text-violet-400 bg-violet-500/5'
                    : 'border-transparent text-stone-400 hover:text-stone-200'
                }`}
              >
                <Video className="w-4 h-4" />
                Gerador de Roteiro de Vídeo (TikTok / Reels)
              </button>
            </div>

            {/* ABA 1: Mensagem para Compartilhar */}
            {activeTab === 'share' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Lado Esquerdo: Editor / Ações */}
                <div className="space-y-3 flex flex-col">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                      <MessageSquare className="w-4 h-4 text-pink-400" />
                      Mensagem de Divulgação
                    </span>
                    <button
                      onClick={handleGenerateAiCopy}
                      disabled={generatingCopy}
                      className="text-xs font-bold text-pink-400 hover:text-pink-300 bg-pink-500/10 hover:bg-pink-500/20 px-2.5 py-1 rounded-lg border border-pink-500/20 transition-all flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Sparkles className={`w-3.5 h-3.5 ${generatingCopy ? 'animate-spin' : ''}`} />
                      {generatingCopy ? 'Criando IA...' : '✨ Gerar Copy com IA'}
                    </button>
                  </div>

                  <textarea
                    rows={8}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 font-mono focus:outline-none focus:border-pink-500 transition-colors resize-none leading-relaxed"
                  />

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      onClick={handleCopyMessage}
                      className="flex-1 py-2.5 bg-pink-600 hover:bg-pink-500 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-pink-600/20"
                    >
                      {copiedMessage ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedMessage ? 'Mensagem Copiada!' : 'Copiar Mensagem Pronta'}
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveAsTemplate}
                      className="py-2.5 px-3 bg-stone-850 hover:bg-stone-800 text-amber-400 rounded-xl text-xs font-bold border border-amber-500/20 hover:border-amber-500/40 transition-all flex items-center justify-center gap-1.5"
                      title="Salvar esta copy como um modelo próprio reutilizável"
                    >
                      <Save className="w-4 h-4" />
                      <span>Salvar como Template</span>
                    </button>
                  </div>
                </div>

                {/* Lado Direito: Prévia Visual WhatsApp */}
                <div className="space-y-2">
                  <span className="text-xs font-bold text-stone-400 flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5" />
                    Prévia de como vai aparecer no WhatsApp
                  </span>

                  <div className="p-4 rounded-2xl bg-[#0b141a] border border-stone-800 font-sans text-stone-100 text-xs shadow-inner min-h-[220px] flex flex-col justify-between">
                    <div className="bg-[#111b21] p-3 rounded-xl border border-stone-800/80 space-y-2 max-w-sm">
                      {product.image_url && (
                        <div className="aspect-video w-full rounded-lg overflow-hidden bg-black/40">
                          <img src={product.image_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="whitespace-pre-wrap text-[11px] leading-relaxed text-stone-200">
                        {message}
                      </div>
                      <div className="text-[9px] text-stone-500 text-right">12:30 ✓✓</div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 2: Gerador de Roteiro de Vídeo */}
            {activeTab === 'script' && (
              <div className="space-y-5">
                {/* Seletores de Tipo e Duração */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-stone-950/60 border border-stone-800">
                  {/* Tipo de Vídeo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                      <Film className="w-3.5 h-3.5 text-violet-400" />
                      Estilo / Formato do Roteiro:
                    </label>
                    <select
                      value={videoType}
                      onChange={(e: any) => setVideoType(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-900 border border-stone-700 rounded-xl text-xs text-white focus:outline-none focus:border-violet-500 cursor-pointer"
                    >
                      <option value="achadinho">🎬 Achadinho Viral / Descoberta UAU</option>
                      <option value="review">📱 Review Honesto / UGC em Primeira Pessoa</option>
                      <option value="problema_solucao">💡 Problema vs. Solução</option>
                      <option value="top_motivos">⭐️ Top Motivos para Comprar</option>
                      <option value="oferta_urgencia">⚡️ Oferta Relâmpago / Urgência Total</option>
                    </select>
                  </div>

                  {/* Duração do Vídeo */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-stone-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-violet-400" />
                      Duração do Vídeo (~140 palavras / min):
                    </label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { id: '30s', label: '30 seg' },
                        { id: '1m', label: '1 min' },
                        { id: '2m', label: '2 min' },
                        { id: '3m', label: '3 min' },
                      ].map((d) => (
                        <button
                          key={d.id}
                          onClick={() => setVideoDuration(d.id as any)}
                          className={`py-2 rounded-xl text-xs font-bold border transition-all ${
                            videoDuration === d.id
                              ? 'bg-violet-600 border-violet-500 text-white'
                              : 'bg-stone-900 border-stone-800 text-stone-400 hover:text-white'
                          }`}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Botão Gerar Roteiro */}
                <button
                  onClick={handleGenerateScript}
                  disabled={generatingScript}
                  className="w-full py-3 bg-gradient-to-r from-violet-600 via-purple-600 to-pink-600 hover:opacity-95 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 shadow-lg shadow-violet-600/25 disabled:opacity-50"
                >
                  <Sparkles className={`w-4 h-4 ${generatingScript ? 'animate-spin' : ''}`} />
                  {generatingScript ? 'Criando Roteiro com Gemini IA...' : '✨ Sugerir Roteiro Viral com Inteligência Artificial'}
                </button>

                {/* Exibição do Roteiro Gerado */}
                {videoScriptData && (
                  <div className="p-4 rounded-2xl bg-stone-950 border border-violet-500/30 space-y-4">
                    <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                          {videoScriptData.title || 'Roteiro Viral Gerado'}
                        </h4>
                        <p className="text-xs text-stone-400 mt-0.5">
                          Duração: <strong>{videoScriptData.targetDuration || videoDuration}</strong>
                        </p>
                      </div>

                      <button
                        onClick={handleCopyScript}
                        className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copiedScript ? 'Copiado!' : 'Copiar Roteiro'}
                      </button>
                    </div>

                    {/* Hook / Gancho */}
                    {videoScriptData.hook && (
                      <div className="p-3 rounded-xl bg-pink-950/30 border border-pink-500/30 text-xs">
                        <span className="font-extrabold text-pink-400 block mb-1">
                          🎯 GANCHO VIRAL (Primeiros 3 segundos):
                        </span>
                        <p className="text-stone-200 font-medium italic">"{videoScriptData.hook}"</p>
                      </div>
                    )}

                    {/* Cenas */}
                    {videoScriptData.scenes && Array.isArray(videoScriptData.scenes) && (
                      <div className="space-y-3">
                        {videoScriptData.scenes.map((scene: any, idx: number) => (
                          <div key={idx} className="p-3 rounded-xl bg-stone-900 border border-stone-800 space-y-1.5 text-xs">
                            <div className="flex items-center justify-between text-stone-400 font-bold">
                              <span className="text-violet-400">Cena {scene.sceneNumber || idx + 1}</span>
                              <span className="text-[10px] bg-stone-800 px-2 py-0.5 rounded-full">{scene.timeRange}</span>
                            </div>
                            <p className="text-stone-300">
                              <strong className="text-stone-400">🎬 Visual / Câmera:</strong> {scene.visualPrompt}
                            </p>
                            <p className="text-stone-100 bg-stone-950/80 p-2 rounded-lg border border-stone-800">
                              <strong className="text-emerald-400">🎙️ Narração:</strong> "{scene.narration}"
                            </p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* CTA */}
                    {videoScriptData.cta && (
                      <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs text-emerald-300">
                        <strong>🛍️ Chamada para Ação (CTA):</strong> {videoScriptData.cta}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          </div>
          )}

          {/* Botão de Divulgar Produto para adicionar a Meus Produtos no final */}
          {!addedToMine ? (
            <div className="pt-6 border-t border-stone-800 flex justify-center">
              <button
                onClick={handleAddToMyProducts}
                disabled={addingToMine}
                className="w-full sm:w-auto px-10 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-500/25 disabled:opacity-50"
              >
                {addingToMine ? (
                  <Loader2 className="w-5 h-5 animate-spin text-stone-950" />
                ) : (
                  <PlusCircle className="w-5 h-5 text-stone-950" />
                )}
                <span>{addingToMine ? 'Adicionando aos Meus Produtos...' : 'Divulgar este Produto (Adicionar a Meus Produtos)'}</span>
              </button>
            </div>
          ) : (
            isFromMarketplace && (
              <div className="pt-6 border-t border-stone-800 flex flex-col sm:flex-row items-center justify-center gap-3 w-full">
                <span className="text-emerald-400 text-xs sm:text-sm font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                  Este produto já está em Meus Produtos!
                </span>
                {onNavigateToMyProducts && (
                  <button
                    onClick={() => {
                      onClose();
                      onNavigateToMyProducts();
                    }}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-1.5 transition-all shadow-md shadow-emerald-600/20"
                  >
                    <span>Ir para Meus Produtos</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            )
          )}

        </div>

      </div>
    </div>
  );
};
