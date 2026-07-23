import React, { useState } from 'react';
import { ProductData } from '../types';

interface ActionButtonsProps {
  product: ProductData;
  copyText: string;
  onNewSearch: () => void;
}

export const ActionButtons: React.FC<ActionButtonsProps> = ({
  copyText,
  onNewSearch,
}) => {
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const handleCopyText = async () => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(copyText);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = copyText;
        textarea.style.position = 'fixed';
        textarea.style.left = '-999999px';
        textarea.style.top = '-999999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
      }
      setCopyState('copied');
      setTimeout(() => setCopyState('idle'), 2500);
    } catch (e) {
      console.error('Failed to copy text:', e);
    }
  };

  const handleShareWhatsApp = () => {
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(copyText)}`;
    window.open(whatsappUrl, '_blank');
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
      <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto flex-1">
        {/* Button 1: Copy Text */}
        <button
          onClick={handleCopyText}
          className="w-full sm:w-auto px-5 py-3 border border-indigo-500 text-indigo-400 hover:bg-indigo-500/10 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
        >
          {copyState === 'copied' ? (
            <>
              <span>✅</span>
              <span>Copiado!</span>
            </>
          ) : (
            <>
              <span>📋</span>
              <span>Copiar Texto</span>
            </>
          )}
        </button>

        {/* Button 2: WhatsApp */}
        <button
          onClick={handleShareWhatsApp}
          className="w-full sm:w-auto px-5 py-3 bg-[#25D366] text-white hover:bg-[#20bd5a] rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-md"
        >
          <span>💬</span>
          <span>Compartilhar no WhatsApp</span>
        </button>
      </div>

      {/* Button 3: New Search */}
      <button
        onClick={onNewSearch}
        className="text-slate-400 hover:text-white underline text-sm font-medium transition-all py-2 px-1"
      >
        🔄 Nova Busca
      </button>
    </div>
  );
};

export default ActionButtons;
