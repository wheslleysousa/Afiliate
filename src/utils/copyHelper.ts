import { ScrapedProduct } from '../types';
import { applyTemplate } from '../data/defaultTemplates';

export function calculateDiscountPercent(priceFromStr?: string | null, priceToStr?: string | null): number | null {
  if (!priceFromStr || !priceToStr) return null;
  const numFrom = parseFloat(priceFromStr.replace(/\./g, '').replace(',', '.'));
  const numTo = parseFloat(priceToStr.replace(/\./g, '').replace(',', '.'));
  if (isNaN(numFrom) || isNaN(numTo) || numFrom <= numTo || numFrom <= 0) return null;
  const discount = Math.round(((numFrom - numTo) / numFrom) * 100);
  return discount > 0 ? discount : null;
}

export function generateFormattedCopy(templateStr: string, product: ScrapedProduct): string {
  const link = product.affiliate_link || product.original_link || '';
  return applyTemplate(templateStr, product, link);
}

export function getPlatformInfo(platformStr: string) {
  const p = platformStr.toLowerCase();
  if (p.includes('mercadolivre') || p.includes('ml')) {
    return {
      name: 'Mercado Livre',
      badgeClass: 'bg-yellow-400 text-yellow-950 border-yellow-500',
      colorHex: '#FFF159',
      logoText: 'ML'
    };
  } else if (p.includes('shopee')) {
    return {
      name: 'Shopee',
      badgeClass: 'bg-orange-500 text-white border-orange-600',
      colorHex: '#EE4D2D',
      logoText: 'Shopee'
    };
  } else if (p.includes('amazon')) {
    return {
      name: 'Amazon',
      badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
      colorHex: '#FF9900',
      logoText: 'Amazon'
    };
  } else if (p.includes('aliexpress')) {
    return {
      name: 'AliExpress',
      badgeClass: 'bg-red-600 text-white border-red-700',
      colorHex: '#FF4747',
      logoText: 'AliExpress'
    };
  } else if (p.includes('shein')) {
    return {
      name: 'Shein',
      badgeClass: 'bg-stone-900 text-blue-300 border-stone-800',
      colorHex: '#000000',
      logoText: 'Shein'
    };
  } else if (p.includes('tiktok') || p.includes('tiktokshop')) {
    return {
      name: 'TikTok Shop',
      badgeClass: 'bg-stone-950 text-white border-pink-500/50 shadow-[0_0_10px_rgba(236,72,153,0.3)]',
      colorHex: '#000000',
      logoText: 'TikTok'
    };
  }
  return {
    name: platformStr || 'Afiliados',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700',
    colorHex: '#059669',
    logoText: 'Loja'
  };
}
