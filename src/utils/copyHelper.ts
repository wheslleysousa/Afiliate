import { ScrapedProduct } from '../types';

export function calculateDiscountPercent(priceFromStr?: string | null, priceToStr?: string | null): number | null {
  if (!priceFromStr || !priceToStr) return null;
  const numFrom = parseFloat(priceFromStr.replace(/\./g, '').replace(',', '.'));
  const numTo = parseFloat(priceToStr.replace(/\./g, '').replace(',', '.'));
  if (isNaN(numFrom) || isNaN(numTo) || numFrom <= numTo || numFrom <= 0) return null;
  const discount = Math.round(((numFrom - numTo) / numFrom) * 100);
  return discount > 0 ? discount : null;
}

export function generateFormattedCopy(templateStr: string, product: ScrapedProduct): string {
  let result = templateStr;

  const discount = calculateDiscountPercent(product.price_from, product.price_to);
  const discountStr = discount ? `${discount}% OFF` : '';

  // Standard tags
  result = result.replace(/{TITLE}/g, product.title || 'Produto');
  result = result.replace(/{PRICE_TO}/g, product.price_to || '0,00');
  result = result.replace(/{LINK}/g, product.original_link || '');

  // Conditional or optional tags handling
  if (product.price_from) {
    result = result.replace(/{PRICE_FROM}/g, product.price_from);
  } else {
    // Remove lines containing {PRICE_FROM} or ~R$ {PRICE_FROM}~ if null
    result = result.split('\n').filter(line => !line.includes('{PRICE_FROM}')).join('\n');
  }

  if (product.installments) {
    result = result.replace(/{INSTALLMENTS}/g, product.installments);
  } else {
    result = result.split('\n').filter(line => !line.includes('{INSTALLMENTS}')).join('\n');
  }

  if (product.coupon) {
    result = result.replace(/{COUPON}/g, product.coupon);
  } else {
    result = result.split('\n').filter(line => !line.includes('{COUPON}')).join('\n');
  }

  if (discountStr) {
    result = result.replace(/{DISCOUNT_PERCENT}/g, discountStr);
  } else {
    result = result.split('\n').filter(line => !line.includes('{DISCOUNT_PERCENT}')).join('\n');
  }

  // Clean double blank lines
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
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
      badgeClass: 'bg-stone-900 text-pink-300 border-stone-800',
      colorHex: '#000000',
      logoText: 'Shein'
    };
  }
  return {
    name: platformStr || 'Afiliados',
    badgeClass: 'bg-emerald-600 text-white border-emerald-700',
    colorHex: '#059669',
    logoText: 'Loja'
  };
}
