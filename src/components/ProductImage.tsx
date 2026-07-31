import React, { useState } from 'react';
import { getPlatformLabel } from '../utils/platformLabel';

interface ProductImageProps {
  imageUrl: string | null;
  title: string;
  platform: string;
  onDownload: () => void;
}

export const ProductImage: React.FC<ProductImageProps> = ({
  imageUrl,
  title,
  platform,
  onDownload,
}) => {
  const [imageError, setImageError] = useState(false);
  const [isImgLoading, setIsImgLoading] = useState(true);

  return (
    <div className="bg-[#0e1119] border border-[#1e2636] rounded-2xl p-4 flex flex-col items-center justify-between space-y-4 shadow-xl relative overflow-hidden h-full">
      {/* Platform badge */}
      <div className="absolute top-3 left-3 z-10 bg-[#07090f]/90 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-full border border-[#1e2636] shadow-md">
        {getPlatformLabel(platform)}
      </div>

      <div className="w-full flex-1 flex items-center justify-center min-h-[220px] max-h-64 md:max-h-80 bg-[#151a26] rounded-xl p-2 relative border border-[#1e2636]">
        {imageUrl && !imageError ? (
          <>
            {isImgLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#0e1119]/80 rounded-xl">
                <span className="w-8 h-8 border-2 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></span>
              </div>
            )}
            <img
              src={imageUrl}
              alt={title}
              onLoad={() => setIsImgLoading(false)}
              onError={() => setImageError(true)}
              className={`max-h-64 md:max-h-80 w-full object-contain rounded-lg transition-opacity duration-300 ${
                isImgLoading ? 'opacity-0' : 'opacity-100'
              }`}
            />
          </>
        ) : (
          <div className="bg-[#0e1119] text-stone-400 p-8 rounded-xl flex flex-col items-center justify-center text-center space-y-2 w-full h-full">
            <span className="text-4xl">📦</span>
            <span className="text-xs font-semibold text-stone-300">Imagem não disponível</span>
          </div>
        )}
      </div>

      <button
        onClick={onDownload}
        className="w-full py-2.5 px-4 border border-[#1e2636] text-stone-300 hover:border-blue-500 hover:text-blue-400 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2"
      >
        <span>⬇️ Baixar Imagem</span>
      </button>
    </div>
  );
};

export default ProductImage;
