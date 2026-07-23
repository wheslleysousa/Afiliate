import React from 'react';
import { ProductData } from '../types';
import { formatCopy } from '../utils/formatCopy';

interface CopyPreviewProps {
  product: ProductData;
  formattedText?: string;
}

export const CopyPreview: React.FC<CopyPreviewProps> = ({ product, formattedText }) => {
  const rawCopyText = formattedText || formatCopy(product);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 shadow-xl">
      {/* 1. Visual Styled Preview */}
      <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Prévia Visual</h3>
        
        <p className="font-bold text-white text-sm sm:text-base leading-snug">{product.title}</p>

        <div className="space-y-1 text-xs">
          {product.price_from && (
            <p className="text-slate-400 line-through">de R$ {product.price_from}</p>
          )}

          <p className="text-emerald-400 font-extrabold text-lg">
            por R$ {product.price_to}
          </p>

          {product.installments && (
            <p className="text-slate-300 font-medium">💳 ou {product.installments}</p>
          )}
        </div>

        {product.coupon && (
          <div className="inline-flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 px-3 py-1 rounded-lg">
            <span className="text-amber-400 font-bold text-xs">🎟️ Cupom: {product.coupon}</span>
          </div>
        )}

        <div className="pt-1 text-xs">
          <p className="text-slate-400">🛍️ Compre aqui:</p>
          <a
            href={product.original_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline font-mono truncate block"
          >
            {product.original_link}
          </a>
        </div>

        <p className="text-[11px] text-slate-500 italic pt-1">
          *Promoção sujeita a alteração a qualquer momento
        </p>
      </div>

      {/* 2. Textarea with Pure Text */}
      <div className="space-y-1.5">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400 flex justify-between items-center">
          <span>Texto Puro (formatado para WhatsApp):</span>
          <span className="text-[10px] text-slate-500 font-normal">{rawCopyText.length} caracteres</span>
        </label>
        <textarea
          readOnly
          rows={10}
          value={rawCopyText}
          className="w-full bg-slate-950 border border-slate-700 text-white font-mono text-xs p-3 rounded-xl focus:outline-none select-all leading-relaxed"
        />
      </div>
    </div>
  );
};

export default CopyPreview;
