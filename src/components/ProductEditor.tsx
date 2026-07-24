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
          {((product.pictures && product.pictures.length > 0) || (product.videos && product.videos.length > 0) || product.video_url) && (
            <div className="w-full mt-3">
              <span className="text-[11px] font-bold text-stone-300 block mb-1.5">
                Mídias do Produto ({((product.pictures?.length || 0) + (product.videos?.length || (product.video_url ? 1 : 0)))} encontradas - Clique para escolher a principal):
              </span>
              <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
                {/* Render Video Thumbnails first if available */}
                {product.videos && product.videos.length > 0 ? (
                  product.videos.map((vidUrl, idx) => {
                    const isSelected = currentMediaType === 'video' && currentMediaUrl === vidUrl;
                    return (
                      <button
                        key={`vid-${idx}`}
                        type="button"
                        onClick={() => {
                          updateField('selectedMediaUrl', vidUrl);
                          updateField('selectedMediaType', 'video');
                        }}
                        className={`w-12 h-12 rounded-lg border-2 p-0.5 shrink-0 overflow-hidden relative flex flex-col items-center justify-center bg-red-950/40 transition-all ${
                          isSelected
                            ? 'border-red-500 ring-2 ring-red-500/30 scale-105'
                            : 'border-stone-800 hover:border-red-900 opacity-80 hover:opacity-100'
                        }`}
                      >
                        {getYouTubeEmbedUrl(vidUrl) ? (
                          <div className="absolute inset-0 bg-stone-900/60 flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-500 fill-current" viewBox="0 0 24 24">
                              <path d="M23.498 6.163a3.003 3.003 0 0 0-2.11-2.11C19.518 3.545 12 3.545 12 3.545s-7.518 0-9.388.508a3.003 3.003 0 0 0-2.11 2.11C0 8.033 0 12 0 12s0 3.967.502 5.837a3.003 3.003 0 0 0 2.11 2.11c1.87.508 9.388.508 9.388.508s7.518 0 9.388-.508a3.003 3.003 0 0 0 2.11-2.11C24 15.967 24 12 24 12s0-3.967-.502-5.837zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                            </svg>
                          </div>
                        ) : (
                          <span className="text-[10px] text-red-400 font-black">VÍDEO {idx + 1}</span>
                        )}
                        <span className="absolute bottom-0 inset-x-0 bg-red-600 text-[8px] text-white font-bold text-center leading-none py-0.5">
                          VÍDEO {product.videos!.length > 1 ? idx + 1 : ''}
                        </span>
                      </button>
                    );
                  })
                ) : product.video_url ? (
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
                ) : null}

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

        {/* Product Fields (Read-Only Elegant Dashboard) */}
        <div className="md:col-span-7 space-y-4">
          {/* Title Card */}
          <div className="bg-stone-950 border border-stone-850 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-emerald-500" />
              Título do Produto Extraído
            </span>
            <h3 className="text-sm font-bold text-stone-100 leading-relaxed">
              {product.title}
            </h3>
          </div>

          {/* Description Card */}
          <div className="bg-stone-950 border border-stone-850 rounded-xl p-4 shadow-sm">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-blue-400" />
              Descrição Completa / Detalhes
            </span>
            <div className="text-xs text-stone-300 max-h-40 overflow-y-auto pr-1 scrollbar-thin leading-relaxed space-y-1 whitespace-pre-line">
              {product.description ? product.description : (
                <span className="text-stone-600 italic">Nenhuma descrição disponível</span>
              )}
            </div>
          </div>

          {/* Core Prices Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Price To (Pix / À Vista) */}
            <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3.5 shadow-sm">
              <span className="text-[10px] text-emerald-400/80 font-bold uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-emerald-400" />
                Preço À Vista (Pix / 1x)
              </span>
              <p className="text-xl font-black text-emerald-400">
                R$ {product.price_to}
              </p>
              {discountPercent && (
                <span className="text-[10px] font-bold text-red-400 block mt-0.5">
                  🔥 Economia de {discountPercent}% OFF
                </span>
              )}
            </div>

            {/* Price From (Original / Crossed Out) */}
            <div className="bg-stone-950 border border-stone-850 rounded-xl p-3.5 shadow-sm">
              <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-0.5 flex items-center gap-1">
                <DollarSign className="w-3 h-3 text-stone-500" />
                Preço Original (Antes)
              </span>
              <p className="text-lg font-bold text-stone-400 line-through">
                {product.price_from ? `R$ ${product.price_from}` : "Não identificado"}
              </p>
            </div>
          </div>

          {/* Installments & Payment Options */}
          <div className="bg-stone-950 border border-stone-850 rounded-xl p-4 space-y-3 shadow-sm">
            <span className="text-[10px] text-stone-500 font-bold uppercase tracking-wider block mb-0.5 flex items-center gap-1.5">
              <CreditCard className="w-3.5 h-3.5 text-sky-400" />
              Opções de Parcelamento Extraídas
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Total Parcelado / Card Price */}
              <div>
                <span className="text-[10px] text-stone-400 font-medium block mb-0.5">
                  Total Parcelado no Cartão
                </span>
                <p className="text-sm font-semibold text-stone-200">
                  {product.card_price ? `R$ ${product.card_price}` : (product.price_to ? `R$ ${product.price_to}` : "Não informado")}
                </p>
              </div>

              {/* Installments info */}
              <div>
                <span className="text-[10px] text-stone-400 font-medium block mb-0.5">
                  Plano de Parcelas
                </span>
                <p className="text-sm font-semibold text-sky-400">
                  {product.installments ? product.installments : "Apenas à vista"}
                </p>
              </div>

              {/* Max Installments Interest Free */}
              <div>
                <span className="text-[10px] text-stone-400 font-medium block mb-0.5">
                  Parcelas Sem Juros
                </span>
                <p className="text-sm font-bold text-emerald-400">
                  {product.max_installments_interest_free ? product.max_installments_interest_free : "Não informado"}
                </p>
              </div>

              {/* Coupon banner */}
              <div>
                <span className="text-[10px] text-stone-400 font-medium block mb-0.5">
                  Cupom de Desconto Ativo
                </span>
                {product.coupon ? (
                  <span className="inline-flex items-center gap-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold px-2.5 py-0.5 rounded-lg">
                    <Ticket className="w-3 h-3 text-amber-400" />
                    {product.coupon}
                  </span>
                ) : (
                  <p className="text-sm font-semibold text-stone-500 italic">Nenhum cupom detectado</p>
                )}
              </div>
            </div>
          </div>

          {/* Shipping & Delivery */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-stone-950 border border-stone-850 rounded-xl p-3 shadow-sm flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-blue-400" />
                <span className="text-xs text-stone-400 font-medium">Frete</span>
              </div>
              <span className="text-xs font-semibold text-stone-200">
                {product.shipping || "Consulte no link"}
              </span>
            </div>

            <div className="bg-stone-950 border border-stone-850 rounded-xl p-3 shadow-sm flex items-center justify-between">
              <span className="text-xs text-stone-400 font-medium flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-emerald-400" />
                Link do Produto
              </span>
              <a
                href={product.original_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-400 font-bold hover:underline"
              >
                Testar Link ↗
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
