import React from 'react';
import { PackageCheck, Tag, DollarSign, CreditCard, Ticket, Image as ImageIcon, ExternalLink, FileText, Truck } from 'lucide-react';
import { ScrapedProduct } from '../types';
import { getPlatformInfo, calculateDiscountPercent } from '../utils/copyHelper';

interface ProductEditorProps {
  product: ScrapedProduct;
  setProduct: React.Dispatch<React.SetStateAction<ScrapedProduct | null>>;
  onUpdateField?: (field: keyof ScrapedProduct, value: any) => void;
}

function getYouTubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

export const ProductEditor: React.FC<ProductEditorProps> = ({ product, setProduct, onUpdateField }) => {
  const platformInfo = getPlatformInfo(product.platform);
  const discountPercent = calculateDiscountPercent(product.price_from, product.price_to);

  const currentMediaUrl = product.selectedMediaUrl !== undefined ? product.selectedMediaUrl : (product.image_url || null);
  const currentMediaType = product.selectedMediaType !== undefined ? product.selectedMediaType : (product.image_url ? 'image' : null);

  const updateField = (field: keyof ScrapedProduct, value: any) => {
    setProduct((prev) => (prev ? { ...prev, [field]: value } : null));
    if (onUpdateField) {
      onUpdateField(field, value);
    }
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
        {/* Product Image Preview & Gallery */}
        <div className="md:col-span-5 flex flex-col items-center">
          <div className="w-full aspect-square bg-stone-950 rounded-xl border border-stone-800 p-2 flex items-center justify-center overflow-hidden relative group shadow-inner">
            {currentMediaType === 'video' && getYouTubeEmbedUrl(currentMediaUrl) ? (
              <iframe
                src={getYouTubeEmbedUrl(currentMediaUrl)!}
                title="Vídeo do Produto"
                className="w-full h-full rounded-lg"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : currentMediaUrl || product.image_url ? (
              <img
                src={currentMediaUrl || product.image_url!}
                alt={product.title}
                className="w-full h-full object-contain rounded-lg"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="flex flex-col items-center text-stone-600 gap-2">
                <ImageIcon className="w-10 h-10" />
                <span className="text-xs">Sem mídia disponível</span>
              </div>
            )}

            {discountPercent && (
              <div className="absolute top-3 left-3 bg-red-600 text-white font-extrabold text-xs px-2.5 py-1 rounded-lg shadow-md border border-red-500 animate-pulse">
                -{discountPercent}% OFF
              </div>
            )}

            {currentMediaType === 'video' && (
              <div className="absolute top-3 right-3 bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-md shadow-md border border-red-500 flex items-center gap-1">
                <span>VÍDEO SELECIONADO</span>
              </div>
            )}
          </div>

          {/* Media Selector (Pictures + Video) */}
          {((product.pictures && product.pictures.length > 0) || product.video_url) && (
            <div className="w-full mt-3">
              <span className="text-[11px] font-bold text-stone-300 block mb-1.5">
                Mídias do Produto ({((product.pictures?.length || 0) + (product.video_url ? 1 : 0))} encontradas - Clique para escolher a principal):
              </span>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {/* Render Video Thumbnail first if available */}
                {product.video_url && (
                  <button
                    type="button"
                    onClick={() => {
                      updateField('selectedMediaUrl', product.video_url!);
                      updateField('selectedMediaType', 'video');
                    }}
                    className={`w-12 h-12 rounded-lg border-2 p-0.5 shrink-0 overflow-hidden relative flex flex-col items-center justify-center bg-red-950/40 transition-all ${
                      currentMediaType === 'video'
                        ? 'border-red-500 ring-2 ring-red-500/30 scale-105'
                        : 'border-stone-800 hover:border-red-900 opacity-80 hover:opacity-100'
                    }`}
                  >
                    {getYouTubeEmbedUrl(product.video_url) ? (
                      <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center">
                        <svg className="w-6 h-6 text-red-500 fill-current" viewBox="0 0 24 24">
                          <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                      </div>
                    ) : (
                      <span className="text-[10px] text-red-400 font-black">VÍDEO</span>
                    )}
                    <span className="absolute bottom-0 inset-x-0 bg-red-600 text-[8px] text-white font-bold text-center leading-none py-0.5">
                      VÍDEO
                    </span>
                  </button>
                )}

                {/* Render Image Thumbnails */}
                {product.pictures && product.pictures.map((picUrl, idx) => {
                  const isSelected = currentMediaType === 'image' && currentMediaUrl === picUrl;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        updateField('selectedMediaUrl', picUrl);
                        updateField('selectedMediaType', 'image');
                        updateField('image_url', picUrl);
                      }}
                      className={`w-12 h-12 rounded-lg border-2 p-0.5 shrink-0 overflow-hidden transition-all ${
                        isSelected
                          ? 'border-emerald-500 ring-2 ring-emerald-500/30 scale-105'
                          : 'border-stone-800 hover:border-stone-600 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={picUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover rounded" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-full mt-2 flex items-center justify-between gap-2">
            <div className="flex-1">
              <label className="text-[10px] text-stone-400 font-medium mb-1 block">URL da Mídia Selecionada</label>
              <input
                type="text"
                value={currentMediaUrl || product.image_url || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  updateField('selectedMediaUrl', val);
                  const isVid = val.includes('youtube.com') || val.includes('youtu.be');
                  updateField('selectedMediaType', isVid ? 'video' : 'image');
                }}
                placeholder="https://imagem.jpg ou link do YouTube"
                className="w-full px-2.5 py-1.5 bg-stone-950 border border-stone-800 rounded-lg text-[11px] text-stone-300 focus:outline-none focus:border-emerald-500"
              />
            </div>
            {(currentMediaUrl || product.image_url) && (
              <div className="mt-4 flex gap-1.5 shrink-0">
                <a
                  href={`/api/download?url=${encodeURIComponent(currentMediaUrl || product.image_url!)}`}
                  className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-stone-950 text-[11px] font-bold rounded-lg flex items-center gap-1"
                  title="Baixar esta imagem/mídia para o dispositivo"
                  download
                >
                  <span>⬇️ Baixar Mídia</span>
                </a>
                <a
                  href={currentMediaUrl || product.image_url!}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-200 text-[11px] font-semibold rounded-lg border border-stone-700 flex items-center gap-1"
                  title="Abrir mídia em uma nova aba"
                >
                  <ExternalLink className="w-3 h-3 text-emerald-400" />
                  <span>Abrir</span>
                </a>
              </div>
            )}
          </div>
        </div>

        {/* Product Fields */}
        <div className="md:col-span-7 space-y-3.5">
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

          {/* Description */}
          <div>
            <label className="text-xs text-stone-400 font-medium mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              Descrição / Resumo do Anúncio
            </label>
            <textarea
              rows={2}
              value={product.description || ''}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="Resumo ou destaques do produto..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>

          {/* Prices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
                Preço À Vista (R$) <span className="text-emerald-400 text-[10px]">(Pix/Boleto)</span>
              </label>
              <input
                type="text"
                value={product.price_to}
                onChange={(e) => updateField('price_to', e.target.value)}
                placeholder="Ex: 149,90"
                className="w-full px-3 py-2 bg-stone-950 border border-emerald-500/50 rounded-xl text-emerald-400 font-bold text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs text-sky-400 font-semibold mb-1 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-sky-400" />
                Preço no Cartão (R$) <span className="text-sky-400 text-[10px]">(Se diferente)</span>
              </label>
              <input
                type="text"
                value={product.card_price || ''}
                onChange={(e) => updateField('card_price', e.target.value)}
                placeholder="Ex: 169,90"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-sky-400 text-sm focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Installments, Coupon & Shipping */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

            <div>
              <label className="text-xs text-stone-400 font-medium mb-1 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-blue-400" />
                Frete
              </label>
              <input
                type="text"
                value={product.shipping || ''}
                onChange={(e) => updateField('shipping', e.target.value)}
                placeholder="Ex: Frete grátis"
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-stone-300 text-sm focus:outline-none focus:border-emerald-500"
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
