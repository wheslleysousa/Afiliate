import React from 'react';
import type { GlobalProduct, ProductData } from '../types';
import { formatPrice } from '../utils/formatPrice';
import { parsePriceNumber } from '../utils/marketplaceUtils';

interface PriceBlockProps {
  product?: Partial<ProductData> | Partial<GlobalProduct>;
  price_to?: string | null;
  priceTo?: string | null;
  price_from?: string | null;
  priceFrom?: string | null;
  pix_price?: string | null;
  discount_pct?: number | null;
  installments?: string | null;
  installments_interest_free?: boolean;
  coupon?: string | null;
  freeShipping?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PriceBlock: React.FC<PriceBlockProps> = ({
  product,
  price_to: rawPriceTo,
  priceTo,
  price_from: rawPriceFrom,
  priceFrom,
  pix_price: rawPixPrice,
  discount_pct: rawDiscountPct,
  installments: rawInstallments,
  installments_interest_free: rawSemJuros,
  coupon: rawCoupon,
  freeShipping,
  className = '',
  size = 'md',
}) => {
  const rawTo = product?.price_to || rawPriceTo || priceTo || null;
  const rawFrom = product?.price_from || rawPriceFrom || priceFrom || null;
  const rawPix = product?.pix_price || rawPixPrice || null;
  const rawDiscount = product?.discount_pct ?? rawDiscountPct ?? null;
  const installments = product?.installments || rawInstallments || null;
  const installments_interest_free = product?.installments_interest_free ?? rawSemJuros ?? false;
  const coupon = product?.coupon || rawCoupon || null;
  const isFreeShipping = Boolean(
    freeShipping ||
      product?.free_shipping === true ||
      (product?.shipping && /gr[áa]tis/i.test(product.shipping))
  );

  const numTo = parsePriceNumber(rawTo);
  const numPix = parsePriceNumber(rawPix);
  const numFrom = parsePriceNumber(rawFrom);

  const hasValidMainPrice = numPix > 0 || numTo > 0;
  const mainPriceValue = numPix > 0 ? (rawPix || numPix) : (rawTo || numTo);
  const effectiveCurrentNum = numPix > 0 ? numPix : numTo;

  // Checar se preço original "De" é estritamente maior que o preço atual
  const hasFrom = numFrom > 0 && effectiveCurrentNum > 0 && numFrom > effectiveCurrentNum;

  // Calcular % de desconto garantindo limite entre 1% e 99% (sem valores negativos ou irreais)
  let computedDiscount: number | null = null;
  if (rawDiscount != null && rawDiscount > 0 && rawDiscount <= 99) {
    computedDiscount = Math.round(rawDiscount);
  } else if (hasFrom && numFrom > effectiveCurrentNum) {
    const calc = Math.round(((numFrom - effectiveCurrentNum) / numFrom) * 100);
    if (calc > 0 && calc <= 99) {
      computedDiscount = calc;
    }
  }

  // Checar se as parcelas são sem juros
  const isSemJuros = Boolean(
    installments_interest_free === true ||
      (installments && /sem juros/i.test(installments))
  );

  const mainPriceClasses =
    size === 'lg'
      ? 'text-lg sm:text-2xl font-black text-white'
      : size === 'sm'
      ? 'text-xs sm:text-sm font-extrabold text-white'
      : 'text-sm sm:text-base font-extrabold text-white';

  const subTextClasses =
    size === 'lg'
      ? 'text-xs sm:text-sm'
      : 'text-[10px] sm:text-xs';

  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      {/* 1) De {price_from} riscado + badge "-{discount_pct}%" */}
      {hasFrom && rawFrom && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${subTextClasses} text-[#93a0b5] line-through`}>
            De {formatPrice(rawFrom)}
          </span>
          {computedDiscount != null && (
            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
              -{computedDiscount}%
            </span>
          )}
        </div>
      )}

      {/* 2) Preço atual ou Fallback Neutro "Consulte no link" */}
      {hasValidMainPrice ? (
        <div className="flex items-baseline gap-1.5 flex-wrap my-0.5">
          <span className={mainPriceClasses}>
            {formatPrice(mainPriceValue)}
          </span>
          {numPix > 0 && (
            <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
              à vista/Pix
            </span>
          )}
        </div>
      ) : (
        <div className="my-0.5">
          <span className="text-xs sm:text-sm font-bold text-[#93a0b5] italic">
            Consulte no link
          </span>
        </div>
      )}

      {/* 3) Parcelas: se installments existir, SEMPRE mostrar com segurança */}
      {installments && installments.trim() !== '' && installments !== '—' && (
        <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
          <span
            className={`${subTextClasses} font-medium ${
              isSemJuros ? 'text-emerald-400 font-bold' : 'text-[#93a0b5]'
            }`}
          >
            💳 {installments}
          </span>
          {isSemJuros && (
            <span className="text-[9px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-1.5 py-0.2 rounded uppercase tracking-wider">
              SEM JUROS
            </span>
          )}
        </div>
      )}

      {/* 4) Frete Grátis e Cupom: badges visuais */}
      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
        {isFreeShipping && (
          <span className="inline-flex items-center gap-1 bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <span>🚚</span>
            <span>Frete grátis</span>
          </span>
        )}

        {coupon && coupon.trim() !== '' && coupon !== '—' && (
          <div className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md">
            <span>🎟</span>
            <span className="truncate">Cupom: {coupon}</span>
          </div>
        )}
      </div>
    </div>
  );
};
