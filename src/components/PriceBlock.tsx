import React from 'react';
import type { GlobalProduct, ProductData } from '../types';
import { formatPrice } from '../utils/formatPrice';

interface PriceBlockProps {
  product: Partial<ProductData> | Partial<GlobalProduct>;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const PriceBlock: React.FC<PriceBlockProps> = ({
  product,
  className = '',
  size = 'md',
}) => {
  const {
    price_to,
    price_from,
    pix_price,
    discount_pct,
    installments,
    installments_interest_free,
    coupon,
  } = product;

  // Checar se preço antigo existe e é diferente do preço atual
  const hasFrom = Boolean(
    price_from &&
      price_from.trim() !== '' &&
      price_from !== price_to
  );

  // Calcular % de desconto caso não tenha vindo preenchido
  const computedDiscount =
    discount_pct ??
    (() => {
      if (!hasFrom || !price_from || !price_to) return null;
      try {
        const from = parseFloat(
          price_from.replace(/[R$\s.]/g, '').replace(',', '.')
        );
        const to = parseFloat(
          price_to.replace(/[R$\s.]/g, '').replace(',', '.')
        );
        if (from > 0 && to > 0 && from > to) {
          return Math.round((1 - to / from) * 100);
        }
      } catch {
        return null;
      }
      return null;
    })();

  // Preço principal destacado (Pix se houver, senão price_to)
  const mainPrice = pix_price || price_to;

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
      {hasFrom && price_from && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`${subTextClasses} text-[#93a0b5] line-through`}>
            De {formatPrice(price_from)}
          </span>
          {computedDiscount != null && computedDiscount > 0 && (
            <span className="text-[9px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded">
              -{computedDiscount}%
            </span>
          )}
        </div>
      )}

      {/* 2) Preço atual em destaque: {pix_price || price_to} + rótulo "à vista/Pix" */}
      {mainPrice && (
        <div className="flex items-baseline gap-1.5 flex-wrap my-0.5">
          <span className={mainPriceClasses}>
            {formatPrice(mainPrice)}
          </span>
          <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-md">
            à vista/Pix
          </span>
        </div>
      )}

      {/* 3) Parcelas: se installments existir, SEMPRE mostrar */}
      {installments && installments.trim() !== '' && (
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

      {/* 4) Cupom: se coupon existir, mostrar um selo "🎟 Cupom: {coupon}" */}
      {coupon && coupon.trim() !== '' && (
        <div className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-bold px-2 py-0.5 rounded-md w-fit mt-1">
          <span>🎟</span>
          <span className="truncate">Cupom: {coupon}</span>
        </div>
      )}
    </div>
  );
};
