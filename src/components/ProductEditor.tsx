import React, { useState } from 'react';
import { 
  PackageCheck, 
  Tag, 
  DollarSign, 
  CreditCard, 
  Ticket, 
  Image as ImageIcon, 
  ExternalLink, 
  FileText, 
  Truck, 
  Star, 
  ShoppingBag, 
  CheckCircle2, 
  Link2,
  ChevronDown,
  ChevronUp,
  Layers,
  Info
} from 'lucide-react';
import { ScrapedProduct } from '../types';
import { getPlatformInfo, calculateDiscountPercent } from '../utils/copyHelper';
import { formatPrice } from '../utils/formatPrice';
import { PriceBlock } from './PriceBlock';

interface ProductEditorProps {
  product: ScrapedProduct;
  setProduct: React.Dispatch<React.SetStateAction<ScrapedProduct | null>>;
  onUpdateField?: (field: keyof ScrapedProduct, value: any) => void;
  rawAffiliateLink?: string;
}

function getYouTubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? `https://www.youtube.com/embed/${match[2]}` : null;
}

export const ProductEditor: React.FC<ProductEditorProps> = ({ 
  product, 
  setProduct, 
  onUpdateField, 
  rawAffiliateLink 
}) => {
  const platformInfo = getPlatformInfo(product.platform);
  const discountPercent = calculateDiscountPercent(product.price_from, product.price_to);

  const [activeSection, setActiveSection] = useState<'price' | 'media' | 'details' | null>('price');

  const currentMediaUrl = product.selectedMediaUrl !== undefined ? product.selectedMediaUrl : (product.image_url || null);
  const currentMediaType = product.selectedMediaType !== undefined ? product.selectedMediaType : (product.image_url ? 'image' : null);

  const updateField = (field: keyof ScrapedProduct, value: any) => {
    setProduct((prev) => (prev ? { ...prev, [field]: value } : null));
    if (onUpdateField) {
      onUpdateField(field, value);
    }
  };

  const toggleSection = (section: 'price' | 'media' | 'details') => {
    setActiveSection(prev => prev === section ? null : section);
  };

  return (
    <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
      {/* Header Padronizado */}
      <div className="flex items-center justify-between gap-3 border-b border-[#1e2636] pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-600/15 text-blue-400 border border-blue-500/20">
            <PackageCheck className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-white">Produto Extraído</h2>
            <p className="text-[11px] text-[#93a0b5]">Dados identificados automaticamente</p>
          </div>
        </div>

        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${platformInfo.badgeClass}`}>
          {platformInfo.name}
        </span>
      </div>

      {/* Card Resumo do Produto (Herói com Imagem + Preço Principal) */}
      <div className="flex flex-col sm:flex-row gap-4 bg-[#151a26] border border-[#1e2636] rounded-xl p-3.5">
        {/* Thumbnail da Mídia Principal */}
        <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#07090f] rounded-lg border border-[#1e2636] p-1.5 flex items-center justify-center shrink-0 overflow-hidden relative">
          {currentMediaType === 'video' && getYouTubeEmbedUrl(currentMediaUrl) ? (
            <iframe
              src={getYouTubeEmbedUrl(currentMediaUrl)!}
              title="Vídeo do Produto"
              className="w-full h-full rounded"
              allowFullScreen
            />
          ) : currentMediaUrl || product.image_url ? (
            <img
              src={currentMediaUrl || product.image_url!}
              alt={product.title}
              className="w-full h-full object-contain rounded"
              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
            />
          ) : (
            <ImageIcon className="w-8 h-8 text-[#93a0b5]/40" />
          )}

          {discountPercent && (
            <span className="absolute top-1.5 left-1.5 bg-red-600 text-white font-black text-[9px] px-1.5 py-0.2 rounded">
              -{discountPercent}%
            </span>
          )}
        </div>

        {/* Título & PriceBlock */}
        <div className="flex-1 min-w-0 flex flex-col justify-between gap-2">
          <div>
            <h3 className="text-xs sm:text-sm font-bold text-white line-clamp-2 leading-snug">
              {product.title}
            </h3>
            {product.category && (
              <span className="text-[10px] text-[#93a0b5] font-medium block mt-0.5">
                Categoria: {product.category}
              </span>
            )}
          </div>

          <PriceBlock
            product={product}
            size="md"
          />
        </div>
      </div>

      {/* Seções Colapsáveis para Edição e Ajustes */}
      <div className="space-y-2 pt-1">
        
        {/* 1. Preço & Pagamento */}
        <div className="border border-[#1e2636] rounded-xl overflow-hidden bg-[#07090f]">
          <button
            type="button"
            onClick={() => toggleSection('price')}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-extrabold text-[#eef2f9] hover:bg-[#151a26] transition-colors"
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              Preços e Pagamento
            </span>
            {activeSection === 'price' ? <ChevronUp className="w-4 h-4 text-[#93a0b5]" /> : <ChevronDown className="w-4 h-4 text-[#93a0b5]" />}
          </button>

          {activeSection === 'price' && (
            <div className="p-3.5 border-t border-[#1e2636] space-y-3 bg-[#0e1119]">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Preço Atual (À vista/Pix)</label>
                  <input
                    type="text"
                    value={product.price_to || ''}
                    onChange={(e) => updateField('price_to', e.target.value)}
                    placeholder="Ex: 99,90"
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Preço Original (De / Riscado)</label>
                  <input
                    type="text"
                    value={product.price_from || ''}
                    onChange={(e) => updateField('price_from', e.target.value)}
                    placeholder="Ex: 149,90"
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Plano de Parcelamento</label>
                  <input
                    type="text"
                    value={product.installments || ''}
                    onChange={(e) => updateField('installments', e.target.value)}
                    placeholder="Ex: 10x de R$ 9,99 sem juros"
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Cupom de Desconto</label>
                  <input
                    type="text"
                    value={product.coupon || ''}
                    onChange={(e) => updateField('coupon', e.target.value)}
                    placeholder="Ex: CUPOM10"
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 2. Mídias & Fotos */}
        <div className="border border-[#1e2636] rounded-xl overflow-hidden bg-[#07090f]">
          <button
            type="button"
            onClick={() => toggleSection('media')}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-extrabold text-[#eef2f9] hover:bg-[#151a26] transition-colors"
          >
            <span className="flex items-center gap-2">
              <ImageIcon className="w-3.5 h-3.5 text-blue-400" />
              Mídias do Produto ({((product.pictures?.length || (product.image_url ? 1 : 0)) + (product.videos?.length || (product.video_url ? 1 : 0)))})
            </span>
            {activeSection === 'media' ? <ChevronUp className="w-4 h-4 text-[#93a0b5]" /> : <ChevronDown className="w-4 h-4 text-[#93a0b5]" />}
          </button>

          {activeSection === 'media' && (
            <div className="p-3.5 border-t border-[#1e2636] space-y-3 bg-[#0e1119]">
              {/* Thumbnails list */}
              {((product.pictures && product.pictures.length > 0) || (product.videos && product.videos.length > 0)) && (
                <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
                  {product.videos && product.videos.map((vidUrl, idx) => {
                    const isSelected = currentMediaType === 'video' && currentMediaUrl === vidUrl;
                    return (
                      <button
                        key={`vid-${idx}`}
                        type="button"
                        onClick={() => {
                          updateField('selectedMediaUrl', vidUrl);
                          updateField('selectedMediaType', 'video');
                        }}
                        className={`w-11 h-11 rounded-lg border-2 p-0.5 shrink-0 flex items-center justify-center bg-red-950/40 text-[9px] font-bold text-red-400 transition-all ${
                          isSelected ? 'border-red-500 scale-105' : 'border-[#1e2636] opacity-70 hover:opacity-100'
                        }`}
                      >
                        VÍDEO
                      </button>
                    );
                  })}
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
                        className={`w-11 h-11 rounded-lg border-2 p-0.5 shrink-0 overflow-hidden transition-all ${
                          isSelected ? 'border-blue-500 scale-105' : 'border-[#1e2636] opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={picUrl} alt={`Foto ${idx + 1}`} className="w-full h-full object-cover rounded" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Custom Media URL Input */}
              <div>
                <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">URL da Imagem / Vídeo</label>
                <input
                  type="text"
                  value={currentMediaUrl || product.image_url || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField('selectedMediaUrl', val);
                    const isVid = val.includes('youtube.com') || val.includes('youtu.be');
                    updateField('selectedMediaType', isVid ? 'video' : 'image');
                  }}
                  placeholder="https://..."
                  className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* 3. Detalhes & Frete */}
        <div className="border border-[#1e2636] rounded-xl overflow-hidden bg-[#07090f]">
          <button
            type="button"
            onClick={() => toggleSection('details')}
            className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-extrabold text-[#eef2f9] hover:bg-[#151a26] transition-colors"
          >
            <span className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-amber-400" />
              Título, Descrição & Frete
            </span>
            {activeSection === 'details' ? <ChevronUp className="w-4 h-4 text-[#93a0b5]" /> : <ChevronDown className="w-4 h-4 text-[#93a0b5]" />}
          </button>

          {activeSection === 'details' && (
            <div className="p-3.5 border-t border-[#1e2636] space-y-3 bg-[#0e1119]">
              <div>
                <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Título</label>
                <input
                  type="text"
                  value={product.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Informação de Frete</label>
                  <input
                    type="text"
                    value={product.free_shipping ? 'Frete Grátis' : (product.shipping || '')}
                    onChange={(e) => updateField('shipping', e.target.value)}
                    placeholder="Ex: Frete Grátis ou R$ 15,90"
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Avaliação / Estrelas</label>
                  <input
                    type="text"
                    value={product.stars ? String(product.stars) : ''}
                    onChange={(e) => updateField('stars', e.target.value)}
                    placeholder="Ex: 4.8"
                    className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-[#93a0b5] block mb-1">Descrição</label>
                <textarea
                  rows={3}
                  value={product.description || ''}
                  onChange={(e) => updateField('description', e.target.value)}
                  className="w-full px-3 py-2 bg-[#151a26] border border-[#1e2636] rounded-lg text-xs text-white focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

