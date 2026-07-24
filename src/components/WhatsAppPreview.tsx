import React, { useState } from 'react';
import { Copy, Check, Share2, MessageSquare, Image as ImageIcon, Save, CheckCircle2, RefreshCw } from 'lucide-react';
import { ScrapedProduct } from '../types';

interface WhatsAppPreviewProps {
  copyText: string;
  setCopyText: (text: string) => void;
  product: ScrapedProduct;
  onSaveHistory: () => void;
  isSaved: boolean;
}

function getYouTubeId(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
}

export const WhatsAppPreview: React.FC<WhatsAppPreviewProps> = ({
  copyText,
  setCopyText,
  product,
  onSaveHistory,
  isSaved,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  const handleShareWhatsApp = () => {
    const encoded = encodeURIComponent(copyText);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
  };

  // WhatsApp text formatting helper
  const renderFormattedWhatsAppText = (text: string) => {
    const lines = text.split('\n');
    return lines.map((line, lIdx) => {
      let formattedLine: React.ReactNode[] = [line];

      // Bold *text*
      const partsBold = line.split(/(\*[^*]+\*)/g);
      const boldNodes = partsBold.map((part, pIdx) => {
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <strong key={pIdx} className="font-bold text-stone-100">{part.slice(1, -1)}</strong>;
        }
        return part;
      });

      // Strike ~text~
      return (
        <div key={lIdx} className="min-h-[18px]">
          {boldNodes.map((node, nIdx) => {
            if (typeof node === 'string') {
              const strikeParts = node.split(/(~[^~]+~)/g);
              return strikeParts.map((sp, sIdx) => {
                if (sp.startsWith('~') && sp.endsWith('~') && sp.length > 2) {
                  return <span key={sIdx} className="line-through text-stone-400">{sp.slice(1, -1)}</span>;
                }
                return sp;
              });
            }
            return node;
          })}
        </div>
      );
    });
  };

  const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 mb-4 pb-3 border-b border-stone-800">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <MessageSquare className="w-5 h-5" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">4. Prévia no WhatsApp & Copiar</h2>
        </div>

        <button
          onClick={onSaveHistory}
          disabled={isSaved}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
            isSaved
              ? 'bg-stone-800 text-stone-400 border border-stone-700'
              : 'bg-stone-800 hover:bg-stone-700 text-emerald-400 border border-emerald-500/30'
          }`}
        >
          {isSaved ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Salvo</span>
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              <span>Salvar no Histórico</span>
            </>
          )}
        </button>
      </div>

      {/* WhatsApp Chat Container */}
      <div className="bg-[#0b141a] rounded-xl border border-stone-800 p-4 mb-4 flex-1 flex flex-col justify-between relative overflow-hidden shadow-inner min-h-[300px]">
        {/* Chat background wallpaper pattern feel */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(#10b981_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none"></div>

        {/* Message Bubble */}
        <div className="max-w-[92%] sm:max-w-[85%] self-end bg-[#005c4b] text-[#e9edef] rounded-2xl rounded-tr-xs p-3.5 shadow-md relative z-10 text-xs sm:text-sm font-sans space-y-2 border border-[#006e5a]">
          
          {/* Link / Image/Video Card Preview in WhatsApp */}
          {(product.selectedMediaUrl || product.image_url) && (
            <div className="bg-[#024337] rounded-xl overflow-hidden border border-[#006e5a] mb-2 p-1.5 relative group">
              {product.selectedMediaType === 'video' ? (
                <div className="relative w-full h-36 rounded-lg bg-stone-950 overflow-hidden flex items-center justify-center">
                  {product.selectedMediaUrl && getYouTubeId(product.selectedMediaUrl) ? (
                    <img
                      src={`https://img.youtube.com/vi/${getYouTubeId(product.selectedMediaUrl)}/mqdefault.jpg`}
                      alt="Thumbnail do vídeo"
                      className="w-full h-full object-cover opacity-65"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-red-600/20 text-red-500 rounded-full flex items-center justify-center">
                      <svg className="w-8 h-8 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  )}
                  {/* YouTube Overlay badge */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 bg-red-600 text-white rounded-xl shadow-lg flex items-center justify-center hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                        <path d="M8 5v14l11-7z"/>
                      </svg>
                    </div>
                  </div>
                  <span className="absolute bottom-2 left-2 bg-black/60 text-[9px] text-white px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                    VÍDEO YOUTUBE
                  </span>
                </div>
              ) : (
                <img
                  src={product.selectedMediaUrl || product.image_url!}
                  alt="Preview do produto"
                  className="w-full h-36 object-contain rounded-lg bg-stone-900"
                  onError={(e) => {
                    (e.target as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              <div className="p-1.5">
                <p className="font-bold text-[11px] text-white truncate">{product.title}</p>
                <p className="text-[10px] text-emerald-200/70 truncate">{product.original_link}</p>
              </div>
            </div>
          )}

          {/* WhatsApp Rendered Message */}
          <div className="whitespace-pre-wrap leading-relaxed">
            {renderFormattedWhatsAppText(copyText)}
          </div>

          {/* Timestamp & Read Receipts */}
          <div className="flex items-center justify-end gap-1 text-[10px] text-emerald-200/60 pt-1">
            <span>{nowTime}</span>
            <span className="text-emerald-300 font-bold">✓✓</span>
          </div>
        </div>

        <p className="text-center text-[10px] text-stone-500 mt-3 z-10">
          Como a mensagem aparecerá para os clientes no WhatsApp
        </p>
      </div>

      {/* Editable Raw Copy Area */}
      <div className="mb-4">
        <label className="text-xs text-stone-400 font-medium mb-1 flex items-center justify-between">
          <span>Editar Texto Manualmente:</span>
          <span className="text-[10px] text-stone-500">{copyText.length} caracteres</span>
        </label>
        <textarea
          rows={5}
          value={copyText}
          onChange={(e) => setCopyText(e.target.value)}
          className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 font-mono focus:outline-none focus:border-emerald-500"
        />
      </div>

      {/* Primary Action Buttons */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-auto">
        <button
          onClick={handleCopy}
          className={`py-3.5 px-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg ${
            copied
              ? 'bg-emerald-400 text-stone-950 shadow-emerald-400/30 scale-[1.02]'
              : 'bg-emerald-500 hover:bg-emerald-400 text-stone-950 shadow-emerald-500/20'
          }`}
        >
          {copied ? (
            <>
              <Check className="w-5 h-5 text-stone-950 stroke-[3]" />
              <span>Copiado com Sucesso!</span>
            </>
          ) : (
            <>
              <Copy className="w-5 h-5" />
              <span>Copiar Copy Completa</span>
            </>
          )}
        </button>

        <button
          onClick={handleShareWhatsApp}
          className="py-3.5 px-4 bg-stone-800 hover:bg-stone-750 text-emerald-400 font-bold text-sm rounded-xl border border-emerald-500/30 flex items-center justify-center gap-2 transition-all shadow-md"
        >
          <Share2 className="w-5 h-5" />
          <span>Abrir no WhatsApp</span>
        </button>
      </div>
    </div>
  );
};
