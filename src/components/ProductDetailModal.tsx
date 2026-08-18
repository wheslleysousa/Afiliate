import React, { useState, useEffect } from 'react';
import type { GlobalProduct, ApiKeysConfig, CommissionRatesConfig, CopyTemplate, ProductData } from '../types';
import { buildAffiliateLink, buildShareableTrackingLink, slugify, getShortCodeForProduct } from '../utils/affiliateLink';
import { apiFetch } from '../utils/apiBase';
import { calculateCommission, calculateSalesTrend } from '../utils/marketplaceUtils';
import { formatPrice } from '../utils/formatPrice';
import { PriceBlock } from './PriceBlock';
import { ProductCharts } from './ProductCharts';
import { DEFAULT_TEMPLATES, applyTemplate } from '../data/defaultTemplates';
import { db } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';
import {
  X,
  ShoppingBag,
  Sparkles,
  ExternalLink,
  Tag,
  CheckCircle2,
  Check,
  TrendingUp,
  Percent,
  Copy,
  Send,
  Loader2,
  Film,
  ChevronDown,
  ChevronUp,
  Plus,
  Star,
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
  mode?: 'marketplace' | 'my-products';
  isAlreadyMined?: boolean;
  onAddToMyProducts?: (product: GlobalProduct) => void;
  onGenerateVideoScript?: (product: GlobalProduct) => void;
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
  mode = 'marketplace',
  isAlreadyMined = false,
  onAddToMyProducts,
  onGenerateVideoScript,
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
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const [addedSuccess, setAddedSuccess] = useState(isAlreadyMined);

  // Auto-enriquecer se faltar detalhes importantes
  useEffect(() => {
    const enrichData = async () => {
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
        const response = await apiFetch('/api/scrape', {
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
              pictures: scraped.pictures || product.pictures,
              price_to: scraped.price_to || product.price_to,
              price_from: scraped.price_from || product.price_from,
              stars: scraped.stars !== undefined ? scraped.stars : product.stars,
              sales_count: scraped.sales_count !== undefined ? scraped.sales_count : product.sales_count,
              category: scraped.category || product.category,
              lastUpdatedAt: new Date().toLocaleDateString('pt-BR'),
            };

            setCurrentProduct(updated);

            try {
              await setDoc(doc(db, 'products', product.id), updated, { merge: true });
            } catch (e) {
              console.error('[ProductDetailModal] Erro ao salvar enriquecimento no DB:', e);
            }

            if (onProductEnriched) {
              onProductEnriched(updated);
            }
          }
        }
      } catch (err) {
        console.error('[ProductDetailModal] Erro ao enriquecer produto:', err);
      } finally {
        setEnriching(false);
      }
    };

    enrichData();
  }, [product.id, product.original_link]);

  // Link de afiliado Shopee gerado com as credenciais DO USUÁRIO ATUAL (não do minerador).
  const [myShopeeLink, setMyShopeeLink] = useState('');
  useEffect(() => {
    setMyShopeeLink('');
    const p = currentProduct;
    const plat = (p.platform || '').toLowerCase();
    if (plat !== 'shopee' || !p.original_link) return;
    if (!(keys.shopeeAppId && keys.shopeeSecret)) return; // sem credenciais, usa link direto
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch('/api/shopee/affiliate-link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: p.original_link, apiKeys: keys, subId: keys.shopeeTrackingId }),
          action: 'Gerar link de afiliado Shopee',
        });
        const json = await res.json();
        if (!cancelled && json?.success && json.link) setMyShopeeLink(json.link);
      } catch { /* silencioso */ }
    })();
    return () => { cancelled = true; };
  }, [currentProduct.id, currentProduct.platform, currentProduct.original_link, keys.shopeeAppId, keys.shopeeSecret]);

  // Link de Afiliado com Rastreamento (usado para compartilhar/copy — formato curto)
  const affiliateLink = buildShareableTrackingLink(
    currentProduct.id,
    currentProduct.original_link,
    currentProduct.platform,
    keys,
    currentProduct.title
  );

  // Link direto para ABRIR o produto, SEMPRE com o link de afiliado DO USUÁRIO ATUAL.
  // - Shopee: link gerado agora com as credenciais do usuário (myShopeeLink).
  // - Em "Meus Produtos" (produto do próprio usuário): usa o affiliate_link salvo dele.
  // - No Marketplace Global: NÃO usa o affiliate_link do minerador; gera do zero com as
  //   chaves do usuário atual (ou cai para a URL original).
  const isMine = mode === 'my-products';
  const directLink =
    (myShopeeLink && /^https?:\/\//i.test(myShopeeLink) ? myShopeeLink : '') ||
    (isMine && currentProduct.affiliate_link && /^https?:\/\//i.test(currentProduct.affiliate_link) ? currentProduct.affiliate_link : '') ||
    buildAffiliateLink(currentProduct.original_link, currentProduct.platform, keys) ||
    currentProduct.original_link ||
    '';

  // Link usado para DIVULGAR (copy/WhatsApp). Padrão = link de afiliado nativo (directLink).
  // Se o usuário ativou "link personalizado" no encurtador, usa o lkrm.site (affiliateLink).
  const useCustomShort = keys.useCustomShortLink === true;
  const shareLink = useCustomShort && affiliateLink ? affiliateLink : directLink;

  // Quando usa link personalizado (lkrm.site), registra o doc para que ele resolva de fato.
  useEffect(() => {
    if (!useCustomShort || !affiliateLink || !directLink) return;
    const slug = affiliateLink.split('?')[0].replace(/\/+$/, '').split('/').pop();
    if (!slug) return;
    const uid = currentUserId;
    (async () => {
      try {
        await setDoc(doc(db, 'shortLinks', slug), {
          targetUrl: directLink,
          originalUrl: currentProduct.original_link || '',
          title: currentProduct.title || '',
          platform: currentProduct.platform || '',
          fullUrl: affiliateLink,
          docId: slug,
          ownerUid: uid || 'anonymous',
          userId: uid || 'anonymous',
          createdBy: uid || 'anonymous',
          createdAt: new Date().toISOString(),
        }, { merge: true });
      } catch (e) { console.error('[Bio/Short] Falha ao registrar link personalizado:', e); }
    })();
  }, [useCustomShort, affiliateLink, directLink, currentUserId, currentProduct.original_link, currentProduct.title, currentProduct.platform]);

  // Comissão Estimada com base na categoria e tabela
  const commission = calculateCommission(
    currentProduct.price_to,
    currentProduct.platform,
    currentProduct,
    null,
    null,
    commissionRates
  );

  const allAvailableTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];
  const activeTemplate =
    allAvailableTemplates.find((t) => t.id === activeTemplateId) || DEFAULT_TEMPLATES[0];

  useEffect(() => {
    if (mode === 'my-products') {
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
      const formatted = applyTemplate(activeTemplate.template, prodData, shareLink, commissionRates);
      setCustomMessage(formatted);
    }
  }, [activeTemplateId, currentProduct, affiliateLink, customTemplates, commissionRates, mode]);

  // Divulgar Produto (Abrir no WhatsApp)
  const handlePromoteWhatsApp = () => {
    const encoded = encodeURIComponent(customMessage);
    const url = `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  // Gerar Copy com IA
  const handleGenerateAiCopy = async () => {
    setGeneratingAiCopy(true);
    try {
      const res = await apiFetch('/api/gemini/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: currentProduct,
          geminiApiKey: keys.geminiApiKey,
          geminiApiKeys: keys.geminiApiKeys,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.variations && data.variations.length > 0) {
          const rawCopy = data.variations[0].copy;
          const formattedWithLink = rawCopy.replace(/\{LINK\}/g, shareLink);
          setCustomMessage(formattedWithLink);
        }
      }
    } catch (e) {
      console.error('Erro ao gerar copy com IA:', e);
    } finally {
      setGeneratingAiCopy(false);
    }
  };

  // Adicionar a Meus Produtos
  const handleAddProduct = () => {
    if (onAddToMyProducts) {
      onAddToMyProducts(currentProduct);
      setAddedSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md overflow-y-auto animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#0e1119] border border-[#1e2636] rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[94vh] flex flex-col">
        {/* Header Superior Fixo */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[#1e2636] bg-[#0e1119] sticky top-0 z-20">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                platformColor[currentProduct.platform] ??
                'bg-[#151a26] text-[#eef2f9] border-[#1e2636]'
              }`}
            >
              {platformLabel[currentProduct.platform] ?? currentProduct.platform}
            </span>
            {currentProduct.category && (
              <span className="text-xs font-semibold text-[#93a0b5] truncate max-w-[180px] sm:max-w-xs">
                {currentProduct.category}
              </span>
            )}
            {enriching && (
              <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full flex items-center gap-1 font-bold animate-pulse">
                <Loader2 className="w-3 h-3 animate-spin" />
                Atualizando dados...
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-[#93a0b5] hover:text-white hover:bg-[#151a26] border border-transparent hover:border-[#1e2636] transition-all cursor-pointer"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Scroll */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Bloco Superior: Informações Principais & Imagem */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Coluna Esquerda: Imagem e Galeria */}
            <div className="md:col-span-5 space-y-3.5">
              <div className="w-full aspect-square bg-[#151a26] border border-[#1e2636] rounded-2xl p-4 flex items-center justify-center overflow-hidden group shadow-inner">
                {!imgError && currentProduct.image_url ? (
                  <img
                    src={currentProduct.image_url}
                    alt={currentProduct.title}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <ShoppingBag className="w-16 h-16 text-[#93a0b5]/40" />
                )}
              </div>

              {/* Galeria de Fotos */}
              {currentProduct.pictures && currentProduct.pictures.length > 1 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] font-extrabold text-[#93a0b5] block">
                    Galeria de Fotos ({currentProduct.pictures.length})
                  </span>
                  <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                    {currentProduct.pictures.map((pic, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          setCurrentProduct((prev) => ({ ...prev, image_url: pic }));
                          setImgError(false);
                        }}
                        className={`w-12 h-12 rounded-xl border flex-shrink-0 overflow-hidden transition-all cursor-pointer ${
                          currentProduct.image_url === pic
                            ? 'border-blue-500 ring-2 ring-blue-500/30 scale-105'
                            : 'border-[#1e2636] opacity-60 hover:opacity-100'
                        }`}
                      >
                        <img
                          src={pic}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Bloco de Preços */}
              <div className="p-3.5 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-2">
                <PriceBlock product={currentProduct} size="md" />
              </div>

              {/* Bloco de Comissão Estimada Detalhado */}
              <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <Percent className="w-4 h-4" /> Comissão Estimada
                  </span>
                  <span className="text-xs font-black px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    {commission.ratePct}%
                  </span>
                </div>
                <p className="text-lg font-black text-white">
                  {formatPrice(commission.amount)}{' '}
                  <span className="text-xs text-[#93a0b5] font-normal">/ por venda realizada</span>
                </p>
                <p className="text-[11px] text-[#93a0b5]">
                  {commission.isCategoryBased && commission.categoryUsed
                    ? `Calculado com base na categoria: ${commission.categoryUsed}`
                    : `Taxa de comissão estimada para a plataforma`}
                </p>
              </div>

              {/* Vendas & Avaliação */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl">
                  <span className="text-[#93a0b5] block text-[10px] font-semibold">
                    Volume de Vendas
                  </span>
                  <span className="text-xs font-bold text-white truncate block mt-0.5">
                    {currentProduct.sales_count || 'Vendas ativas'}
                  </span>
                </div>

                <div className="p-3 bg-[#151a26] border border-[#1e2636] rounded-xl">
                  <span className="text-[#93a0b5] block text-[10px] font-semibold">
                    Avaliação Média
                  </span>
                  <span className="text-xs font-bold text-amber-400 flex items-center gap-1 mt-0.5">
                    {currentProduct.stars ? (
                      <>
                        <Star className="w-3.5 h-3.5 fill-amber-400" />
                        <span>{currentProduct.stars} / 5</span>
                      </>
                    ) : (
                      '⭐ 4.8 / 5'
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Coluna Direita: Título, Descrição (se My Products), Características e Ações */}
            <div className="md:col-span-7 space-y-4">
              <div>
                <h2 className="text-base sm:text-lg font-extrabold text-white leading-snug">
                  {currentProduct.title}
                </h2>
              </div>

              {/* Se estiver em Meus Produtos: Descrição logo abaixo do nome */}
              {mode === 'my-products' && currentProduct.description && (
                <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-white">Descrição do Produto</span>
                    <button
                      type="button"
                      onClick={() => setIsDescriptionExpanded(!isDescriptionExpanded)}
                      className="text-[11px] font-bold text-blue-400 hover:text-blue-300 flex items-center gap-1 cursor-pointer"
                    >
                      <span>{isDescriptionExpanded ? 'Recolher' : 'Ver descrição completa'}</span>
                      {isDescriptionExpanded ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <p
                    className={`text-xs text-[#93a0b5] leading-relaxed whitespace-pre-line ${
                      isDescriptionExpanded ? '' : 'line-clamp-3'
                    }`}
                  >
                    {currentProduct.description}
                  </p>
                </div>
              )}

              {/* Se for Marketplace: Botão de Adicionar a Meus Produtos e Abrir Link */}
              {mode === 'marketplace' && (
                <div className="p-4 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-3">
                  <div className="flex flex-col sm:flex-row items-center gap-2.5">
                    <button
                      type="button"
                      onClick={handleAddProduct}
                      className={`w-full py-3 rounded-xl font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer ${
                        addedSuccess
                          ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                      }`}
                    >
                      {addedSuccess ? (
                        <>
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          <span>Adicionado a Meus Produtos ✓</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4" />
                          <span>Adicionar a Meus Produtos</span>
                        </>
                      )}
                    </button>

                    <a
                      href={directLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#0e1119] hover:bg-[#1e2636] text-[#eef2f9] border border-[#1e2636] font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                      <span>Abrir Link</span>
                    </a>
                  </div>
                </div>
              )}

              {/* Características e Atributos Técnicos */}
              {currentProduct.attributes && (
                <div className="p-3.5 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-2">
                  <span className="text-xs font-extrabold text-white block flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-blue-400" /> Detalhes & Especificações
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                    {Array.isArray(currentProduct.attributes) ? (
                      currentProduct.attributes.map((attr: any, idx: number) => {
                        const name = typeof attr === 'object' ? attr.name || attr.key || '' : '';
                        const val =
                          typeof attr === 'object' ? attr.value || attr.val || '' : String(attr);
                        return (
                          <div
                            key={idx}
                            className="bg-[#0e1119] p-2 rounded-xl border border-[#1e2636]/60"
                          >
                            {name && (
                              <span className="text-[#93a0b5] text-[10px] block font-medium">
                                {name}
                              </span>
                            )}
                            <span className="font-semibold text-[#eef2f9] text-[11px]">{val}</span>
                          </div>
                        );
                      })
                    ) : typeof currentProduct.attributes === 'object' ? (
                      Object.entries(currentProduct.attributes).map(([k, v], idx) => (
                        <div
                          key={idx}
                          className="bg-[#0e1119] p-2 rounded-xl border border-[#1e2636]/60"
                        >
                          <span className="text-[#93a0b5] text-[10px] block font-medium">{k}</span>
                          <span className="font-semibold text-[#eef2f9] text-[11px]">
                            {String(v)}
                          </span>
                        </div>
                      ))
                    ) : null}
                  </div>
                </div>
              )}

              {/* Se for Marketplace: Descrição do produto recolhida */}
              {mode === 'marketplace' && currentProduct.description && (
                <div className="p-3.5 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-1.5">
                  <span className="text-xs font-extrabold text-white block">Descrição</span>
                  <p className="text-xs text-[#93a0b5] leading-relaxed whitespace-pre-line max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                    {currentProduct.description}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ─── SEÇÃO DE GRÁFICOS: VENDAS E HISTÓRICO DE PREÇOS ─── */}
          <div className="pt-2 border-t border-[#1e2636]">
            <ProductCharts product={currentProduct} />
          </div>

          {/* ─── SEÇÃO EXCLUSIVA DE MEUS PRODUTOS: WHATSAPP E ROTEIRO DE VÍDEO ─── */}
          {mode === 'my-products' && (
            <div className="pt-4 border-t border-[#1e2636] space-y-4">
              {/* Card de Mensagem para WhatsApp */}
              <div className="p-4 sm:p-5 bg-[#151a26] border border-[#1e2636] rounded-2xl space-y-3.5 shadow-lg">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1e2636] pb-3">
                  <h3 className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-2">
                    <Send className="w-4 h-4 text-emerald-400" /> Mensagem para WhatsApp
                  </h3>

                  <button
                    type="button"
                    onClick={handleGenerateAiCopy}
                    disabled={generatingAiCopy}
                    className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 font-extrabold text-xs flex items-center gap-1.5 transition-all self-start sm:self-auto cursor-pointer disabled:opacity-50"
                  >
                    {generatingAiCopy ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-400" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                    )}
                    <span>Gerar Copy com IA</span>
                  </button>
                </div>

                {/* Seleção de Template Padrão vs Outros Salvos */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-[#93a0b5] font-bold">Template de Mensagem:</span>
                  <select
                    value={activeTemplateId}
                    onChange={(e) => setActiveTemplateId(e.target.value)}
                    className="bg-[#0e1119] border border-[#1e2636] text-amber-300 text-xs font-bold rounded-xl px-3 py-1.5 focus:outline-none focus:border-amber-500 cursor-pointer"
                  >
                    <optgroup label="Modelos Padrão">
                      {DEFAULT_TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                    {customTemplates && customTemplates.length > 0 && (
                      <optgroup label="Meus Modelos Salvos">
                        {customTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>

                {/* Textarea da Mensagem preenchida */}
                <textarea
                  rows={6}
                  value={customMessage}
                  onChange={(e) => setCustomMessage(e.target.value)}
                  className="w-full p-3.5 bg-[#0e1119] border border-[#1e2636] rounded-xl text-xs text-[#eef2f9] font-mono leading-relaxed focus:outline-none focus:border-emerald-500 resize-none shadow-inner"
                />

                {/* Botões: Divulgar Produto + Abrir Link */}
                <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-1">
                  <button
                    onClick={handlePromoteWhatsApp}
                    className="w-full py-3 rounded-xl bg-[#25D366] hover:bg-[#20bd5a] text-stone-950 font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Divulgar Produto</span>
                  </button>

                  <a
                    href={directLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto px-4 py-3 rounded-xl bg-[#0e1119] hover:bg-[#1e2636] text-[#eef2f9] border border-[#1e2636] font-bold text-xs flex items-center justify-center gap-1.5 shrink-0 transition-all cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                    <span>Abrir Link</span>
                  </a>
                </div>
              </div>

              {/* Botão Destaque: Gerar Roteiro pra Vídeo */}
              <div className="p-4 bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3">
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-blue-400" /> Criar Vídeo para TikTok / Reels / Shorts
                  </h4>
                  <p className="text-[11px] text-[#93a0b5]">
                    Gere roteiros com 15 opções de estilo e ganchos de alta retenção prontos para gravar.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (onGenerateVideoScript) {
                      onGenerateVideoScript(currentProduct);
                      onClose();
                    }
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all cursor-pointer shrink-0"
                >
                  <Film className="w-4 h-4" />
                  <span>Gerar Roteiro pra Vídeo</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
