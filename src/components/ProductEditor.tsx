import React from 'react';
import { PackageCheck, Tag, DollarSign, CreditCard, Ticket, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { ScrapedProduct } from '../types';
import { getPlatformInfo, calculateDiscountPercent } from '../utils/copyHelper';

interface ProductEditorProps {
  product: ScrapedProduct;
  setProduct: React.Dispatch<React.SetStateAction<ScrapedProduct | null>>;
}

export const ProductEditor: React.FC<ProductEditorProps> = ({ product, setProduct }) => {
  const platformInfo = getPlatformInfo(product.platform);
  const discountPercent = calculateDiscountPercent(product.price_from, product.price_to);

  const updateField = (field: keyof ScrapedProduct, value: string) => {
    setProduct((prev) => (prev ? { ...prev, [field]: value } : null));
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <PackageCheck className="w-5 h-5" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">2. Dados do Produto Extraído</h2>
        </div>

        <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${platformInfo.badgeClass}`}>
          {platformInfo.name}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
        {/* Product Image Preview */}
        <div className="md:col-span-4 flex flex-col items-center">
          <div className="w-full aspect-square bg-stone-950 rounded-xl border border-stone-800 p-2 flex items-center justify-center overflow-hidden relative group">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.title}
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center text-stone-600 gap-2">
                <ImageIcon className="w-10 h-10" />
                <span className="text-xs">Sem imagem disponível</span>
              </div>
            )}

            {discountPercent && (
              <div className="absolute top-3 left-3 bg-red-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-md border border-red-500 animate-pulse">
                -{discountPercent}% OFF
              </div>
            )}
          </div>

          <div className="w-full mt-3">
            <label className="text-xs text-stone-400 font-medium mb-1 block">URL da Imagem</label>
            <input
              type="text"
              value={product.image_url || ''}
              onChange={(e) => updateField('image_url', e.target.value)}
              placeholder="https://imagem.jpg"
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-lg text-xs text-stone-300 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {/* Product Fields */}
        <div className="md:col-span-8 space-y-3.5">
          {/* Title */}
          <div>
            <label className="text-xs text-stone-400 font-medium mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-400" />
              Título do Produto
            </label>
            <textarea
              rows={2}
              value={product.title}
              onChange={(e) => updateField('title', e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-sm font-medium focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Prices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 font-medium mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-stone-500" />
                Preço Anterior (R$) <span className="text-stone-500 text-[10px]">(De)</span>
              </label>
              <input
                type="text"
                value={product.price_from || ''}
                onChange={(e) => updateField('price_from', e.target.value)}
                placeholder="Ex: 199,90"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-emerald-400 font-semibold mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                Preço Oferta (R$) <span className="text-emerald-400 text-[10px]">(Por - Obrigatório)</span>
              </label>
              <input
                type="text"
                value={product.price_to}
                onChange={(e) => updateField('price_to', e.target.value)}
                placeholder="Ex: 149,90"
                className="w-full px-3 py-2 bg-stone-950 border border-emerald-500/50 rounded-xl text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Installments & Coupon */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 font-medium mb-1 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-teal-400" />
                Parcelamento
              </label>
              <input
                type="text"
                value={product.installments || ''}
                onChange={(e) => updateField('installments', e.target.value)}
                placeholder="Ex: 12x de R$ 14,99 sem juros"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-stone-400 font-medium mb-1 flex items-center gap-1.5">
                <Ticket className="w-3.5 h-3.5 text-amber-400" />
                Cupom de Desconto
              </label>
              <input
                type="text"
                value={product.coupon || ''}
                onChange={(e) => updateField('coupon', e.target.value)}
                placeholder="Ex: PROMO10"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-amber-300 font-mono text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Link */}
          <div>
            <label className="text-xs text-stone-400 font-medium mb-1 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ExternalLink className="w-3.5 h-3.5 text-blue-400" />
                Link de Afiliado Final
              </span>
              <a
                href={product.original_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline text-[11px] flex items-center gap-1"
              >
                Testar link ↗
              </a>
            </label>
            <input
              type="url"
              value={product.original_link}
              onChange={(e) => updateField('original_link', e.target.value)}
              placeholder="https://..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-blue-400 text-xs focus:outline-none focus:border-emerald-500 truncate"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
