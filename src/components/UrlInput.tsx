import React, { useState, forwardRef } from 'react';

interface UrlInputProps {
  onSubmit: (url: string) => void;
  isLoading: boolean;
}

export const UrlInput = forwardRef<HTMLInputElement, UrlInputProps>(({ onSubmit, isLoading }, ref) => {
  const [url, setUrl] = useState('');
  const [validationError, setValidationError] = useState('');

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      setValidationError('Por favor, insira o link do produto.');
      return;
    }
    if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
      setValidationError('URL inválida. A URL deve começar com http:// ou https://');
      return;
    }
    setValidationError('');
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleFormSubmit} className="w-full space-y-2">
      <div className="flex flex-col sm:flex-row items-stretch gap-2">
        <input
          ref={ref}
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (validationError) setValidationError('');
          }}
          placeholder="Cole aqui o link de afiliado (ML, Shopee, Amazon, AliExpress, Shein)"
          className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500 text-sm transition-all"
        />
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-3 bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
              <span>Buscando...</span>
            </>
          ) : (
            <span>Gerar Copy →</span>
          )}
        </button>
      </div>

      {validationError && (
        <p className="text-xs text-red-400 pl-1 font-medium">{validationError}</p>
      )}
    </form>
  );
});

UrlInput.displayName = 'UrlInput';
export default UrlInput;
