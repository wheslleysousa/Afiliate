import React, { useState, useEffect } from 'react';
import { collection, getDocs, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import type { WaCampaign, WaGroup, GlobalProduct, MinedProductRef, ApiKeysConfig } from '../../types';
import { formatCopy } from '../../utils/formatCopy';
import { buildAffiliateLink, buildShareableTrackingLink, slugify } from '../../utils/affiliateLink';
import { isProductSharedRecently } from '../../utils/sharingLogUtils';
import {
  X,
  Sparkles,
  Clock,
  Send,
  Users,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
} from 'lucide-react';

interface CampaignPreviewModalProps {
  campaign: WaCampaign;
  uid: string;
  waGroups: WaGroup[];
  apiKeys?: ApiKeysConfig;
  isOpen: boolean;
  onClose: () => void;
}

interface PreviewItem {
  product: GlobalProduct;
  copyText: string;
  affiliateLink: string;
  targetGroupNames: string[];
  estimatedTime: string;
}

export const CampaignPreviewModal: React.FC<CampaignPreviewModalProps> = ({
  campaign,
  uid,
  waGroups,
  apiKeys,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<PreviewItem[]>([]);
  const [totalCandidates, setTotalCandidates] = useState(0);
  const [excluded24h, setExcluded24h] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const loadPreview = async () => {
    if (!uid || !campaign) return;
    setLoading(true);

    try {
      // 1. Fetch user mined products references
      const snap = await getDocs(
        query(collection(db, 'users', uid, 'minedProducts'), orderBy('minedAt', 'desc'))
      );
      const minedRefs = snap.docs.map((d) => d.data() as MinedProductRef);

      // 2. Fetch full product objects from /products
      const fullProductsPromises = minedRefs.map(async (ref) => {
        try {
          const productSnap = await getDoc(doc(db, 'products', ref.productId));
          if (productSnap.exists()) {
            return {
              ref,
              product: { id: productSnap.id, ...productSnap.data() } as GlobalProduct,
            };
          }
        } catch (e) {
          console.error('Error fetching product:', e);
        }
        return null;
      });

      const fullResults = (await Promise.all(fullProductsPromises)).filter(Boolean) as {
        ref: MinedProductRef;
        product: GlobalProduct;
      }[];

      // 3. Apply campaign filters
      const filters = campaign.filters || {};
      let candidates = fullResults.map((item) => item.product);

      // Filter: Platforms
      if (filters.platforms && filters.platforms.length > 0) {
        const platSet = new Set(filters.platforms.map((p) => p.toLowerCase()));
        candidates = candidates.filter((p) => platSet.has((p.platform || '').toLowerCase()));
      }

      // Filter: Min Sales
      if (filters.minSales && filters.minSales > 0) {
        candidates = candidates.filter((p) => {
          if (!p.sales_count) return false;
          let countNum = 0;
          const s = String(p.sales_count).toLowerCase().replace(',', '.');
          if (s.includes('k')) {
            countNum = parseFloat(s.replace('k', '')) * 1000;
          } else {
            countNum = parseFloat(s) || 0;
          }
          return countNum >= (filters.minSales || 0);
        });
      }

      // Filter: Min Discount
      if (filters.minDiscount && filters.minDiscount > 0) {
        candidates = candidates.filter((p) => (p.discount_pct || 0) >= (filters.minDiscount || 0));
      }

      // Filter: Max Price
      if (filters.maxPrice && filters.maxPrice > 0) {
        candidates = candidates.filter((p) => {
          const numPrice = parseFloat((p.price_to || '0').replace(/\./g, '').replace(',', '.'));
          return numPrice > 0 && numPrice <= (filters.maxPrice || 0);
        });
      }

      // Filter: Categories
      if (filters.categories && filters.categories.length > 0) {
        const catSet = new Set(filters.categories.map((c) => c.toLowerCase().trim()));
        candidates = candidates.filter((p) => {
          if (!p.category) return false;
          return catSet.has(p.category.toLowerCase().trim());
        });
      }

      setTotalCandidates(candidates.length);

      // 4. Exclude products sent / shared in the last 24 hours
      let countEx24h = 0;
      const filtered24h = candidates.filter((p) => {
        const sharedStatus = isProductSharedRecently(p.id);
        if (sharedStatus.isShared) {
          countEx24h++;
          return false;
        }
        return true;
      });
      setExcluded24h(countEx24h);

      // 5. Sort by Objective
      const sorted = [...filtered24h].sort((a, b) => {
        if (campaign.objective === 'mais_vendidos') {
          const parseSales = (sc?: string | null) => {
            if (!sc) return 0;
            const s = String(sc).toLowerCase().replace(',', '.');
            if (s.includes('k')) return parseFloat(s.replace('k', '')) * 1000;
            return parseFloat(s) || 0;
          };
          return parseSales(b.sales_count) - parseSales(a.sales_count);
        } else if (campaign.objective === 'maior_desconto') {
          return (b.discount_pct || 0) - (a.discount_pct || 0);
        } else if (campaign.objective === 'maior_comissao') {
          return (b.commission_amount || 0) - (a.commission_amount || 0);
        } else {
          // 'mais_recentes'
          return (b.firstMinedAt || '').localeCompare(a.firstMinedAt || '');
        }
      });

      // 6. Slice to campaign quantity
      const finalProducts = sorted.slice(0, campaign.quantity || 30);

      // Target groups names
      const targetGroupMap = new Map(waGroups.map((g) => [g.groupId, g.name]));
      const targetGroupNames = (campaign.targetGroupIds || [])
        .map((id) => targetGroupMap.get(id) || id);

      // 7. Calculate estimated timestamps and format copy
      let currentEst = new Date();
      // Start at campaign schedule start hour if specified
      if (campaign.schedule?.startHour) {
        const [sh, sm] = campaign.schedule.startHour.split(':').map(Number);
        if (!isNaN(sh)) {
          currentEst.setHours(sh, sm || 0, 0, 0);
          if (currentEst.getTime() < Date.now()) {
            currentEst = new Date(Date.now() + 2 * 60 * 1000); // 2 mins from now
          }
        }
      }

      const previewList: PreviewItem[] = finalProducts.map((product, idx) => {
        // Calculate gap based on pacing
        let gapMs = 60 * 1000; // default 1 min
        if (campaign.pacing === 'aleatorio') {
          const minG = campaign.minGapSec || 30;
          const maxG = campaign.maxGapSec || 120;
          const randomSec = Math.floor(Math.random() * (maxG - minG + 1)) + minG;
          gapMs = randomSec * 1000;
        } else {
          // Uniform
          const totalMin = campaign.windowMinutes || 30;
          const stepSec = Math.max(10, Math.floor((totalMin * 60) / (campaign.quantity || 1)));
          gapMs = stepSec * 1000;
        }

        if (idx > 0) {
          currentEst = new Date(currentEst.getTime() + gapMs);
        }

        let affLink = '';
        if (campaign.shortStyle === 'random') {
          affLink = `https://lkrm.site/${slugify(product.id || 'prod')}`;
        } else if (campaign.shortStyle === 'custom_only' && campaign.customShortSlug) {
          affLink = `https://lkrm.site/${slugify(campaign.customShortSlug)}`;
        } else if (campaign.shortStyle === 'custom_random') {
          const pref = campaign.customShortSlug ? slugify(campaign.customShortSlug) : (apiKeys.customShortPrefix ? slugify(apiKeys.customShortPrefix) : 'oferta');
          affLink = `https://lkrm.site/${pref}/${slugify(product.title || product.id || 'prod')}`;
        } else {
          affLink = buildShareableTrackingLink(product.id, product.original_link || '', product.platform || '', apiKeys || {}, product.title);
        }
        const copyText = formatCopy({
          ...product,
          original_link: affLink,
          price_to: product.price_to || 'Consulte no link',
          coupon: product.coupon || null,
        } as any);

        return {
          product,
          copyText,
          affiliateLink: affLink,
          targetGroupNames,
          estimatedTime: currentEst.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        };
      });

      setItems(previewList);
    } catch (err) {
      console.error('Erro ao gerar prévia da campanha:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadPreview();
    }
  }, [isOpen, campaign]);

  if (!isOpen) return null;

  const handleCopyText = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0e1119] border border-[#1e2636] w-full max-w-4xl rounded-2xl p-6 space-y-5 animate-fadeIn relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#1e2636] pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl">
              <Eye className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Prévia de Disparos: <span className="text-emerald-400">{campaign.name}</span>
              </h3>
              <p className="text-xs text-stone-400">
                Simulação em tempo real dos produtos que o worker selecionará para envio neste ciclo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadPreview}
              disabled={loading}
              className="p-2 bg-[#151a26] hover:bg-stone-800 text-stone-300 rounded-xl border border-[#1e2636] text-xs font-bold flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
              Recalcular
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-[#151a26] text-stone-400 hover:text-white border border-[#1e2636]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Campaign Metrics Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#151a26]/60 p-3 rounded-xl border border-[#1e2636] text-xs shrink-0">
          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase">Objetivo</span>
            <span className="text-white font-bold capitalize">
              {campaign.objective.replace('_', ' ')}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase">Grupos Alvo</span>
            <span className="text-emerald-300 font-bold truncate block">
              {campaign.targetGroupIds.length} grupo(s)
            </span>
          </div>
          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase">Ritmo (Pacing)</span>
            <span className="text-amber-300 font-bold capitalize">
              {campaign.pacing} ({campaign.minGapSec}s-{campaign.maxGapSec}s)
            </span>
          </div>
          <div>
            <span className="text-[10px] text-stone-400 block font-bold uppercase">Filtro 24h Anti-Dup</span>
            <span className="text-blue-300 font-bold">
              {excluded24h} removidos (enviados em 24h)
            </span>
          </div>
        </div>

        {/* List Content */}
        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
          {loading && (
            <div className="p-12 text-center text-stone-400 space-y-3">
              <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
              <p className="text-xs font-bold">Analisando catálogo e gerando prévia de envios...</p>
            </div>
          )}

          {!loading && items.length === 0 && (
            <div className="p-10 bg-[#151a26]/30 border border-[#1e2636] rounded-2xl text-center space-y-3">
              <AlertCircle className="w-8 h-8 text-amber-400 mx-auto" />
              <h4 className="text-sm font-bold text-white">Nenhum produto qualificado no momento</h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto">
                Todos os produtos minerados foram divulgados nas últimas 24h ou não atendem aos filtros configurados nesta campanha (vendas mínimas, preço ou desconto).
              </p>
            </div>
          )}

          {!loading &&
            items.map((item, idx) => (
              <div
                key={`prev-item-${item.product.id || idx}-${idx}`}
                className="bg-[#151a26] border border-[#1e2636] p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-start hover:border-emerald-500/40 transition-all"
              >
                {/* Product Thumbnail */}
                <div className="relative shrink-0">
                  {item.product.image_url ? (
                    <img
                      src={item.product.image_url}
                      alt={item.product.title}
                      className="w-20 h-20 rounded-xl object-cover border border-[#1e2636]"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-stone-800 flex items-center justify-center text-stone-500 text-xs">
                      Sem foto
                    </div>
                  )}
                  <span className="absolute -top-2 -left-2 bg-emerald-600 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                    #{idx + 1}
                  </span>
                </div>

                {/* Product Details & Copy */}
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-white line-clamp-2">
                      {item.product.title}
                    </h4>
                    <span className="shrink-0 text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 border border-blue-500/30">
                      <Clock className="w-3 h-3 text-blue-400" />
                      Previsto: {item.estimatedTime}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-stone-400">
                    <span className="text-emerald-400 font-extrabold text-xs">
                      R$ {item.product.price_to}
                    </span>
                    {item.product.discount_pct && (
                      <span className="bg-emerald-500/20 text-emerald-300 font-bold px-1.5 py-0.2 rounded text-[10px]">
                        -{item.product.discount_pct}% OFF
                      </span>
                    )}
                    {item.product.sales_count && (
                      <span className="text-amber-400 font-medium">
                        🔥 {item.product.sales_count} vendas
                      </span>
                    )}
                  </div>

                  {/* Formatted Copy Snippet */}
                  <div className="bg-[#0e1119] p-3 rounded-xl border border-[#1e2636] font-mono text-[11px] text-stone-300 whitespace-pre-wrap leading-relaxed max-h-28 overflow-y-auto">
                    {item.copyText}
                  </div>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <div className="text-stone-400 truncate max-w-[280px]">
                      <strong>Grupos:</strong> {item.targetGroupNames.join(', ')}
                    </div>
                    <button
                      onClick={() => handleCopyText(item.copyText, idx)}
                      className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
                    >
                      {copiedIndex === idx ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Copiado!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5" /> Copiar Copy
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {/* Footer info */}
        <div className="border-t border-[#1e2636] pt-3 flex items-center justify-between text-xs text-stone-400 shrink-0">
          <span>
            Mostrando <strong>{items.length}</strong> de {totalCandidates} produtos elegíveis
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#151a26] hover:bg-stone-800 text-stone-200 font-bold rounded-xl border border-[#1e2636]"
          >
            Fechar Prévia
          </button>
        </div>
      </div>
    </div>
  );
};
