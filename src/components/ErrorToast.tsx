import React, { useState, useEffect } from 'react';
import { AlertTriangle, Copy, Check, X, ChevronDown, ChevronUp, Terminal } from 'lucide-react';
import { ReportedErrorInfo, subscribeError, clearError, formatErrorForClipboard } from '../utils/errorReporter';

export const ErrorToast: React.FC = () => {
  const [errorInfo, setErrorInfo] = useState<ReportedErrorInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeError((err) => {
      setErrorInfo(err);
      setCopied(false);
      setShowDetails(false);
    });
    return unsubscribe;
  }, []);

  if (!errorInfo) return null;

  const formattedText = formatErrorForClipboard(errorInfo);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formattedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (e) {
      console.error('Falha ao copiar erro para a área de transferência:', e);
    }
  };

  const titleSuffix = errorInfo.title
    ? errorInfo.title.startsWith('ao ') || errorInfo.title.startsWith('na ') || errorInfo.title.startsWith('no ')
      ? ` ${errorInfo.title}`
      : ` ao ${errorInfo.title}`
    : errorInfo.action
    ? ` em ${errorInfo.action}`
    : '';

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#151a26] border border-red-500/30 rounded-2xl shadow-2xl max-w-lg w-full p-5 text-white space-y-4 relative overflow-hidden">
        {/* Faixa decorativa no topo */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-red-500 via-orange-500 to-red-500" />

        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 shrink-0">
              <AlertTriangle className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                Ocorreu um erro{titleSuffix}
              </h3>
              <p className="text-xs text-[#93a0b5] mt-0.5">
                O sistema encontrou um problema ao executar esta ação.
              </p>
            </div>
          </div>
          <button
            onClick={clearError}
            className="text-[#93a0b5] hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
            title="Fechar aviso de erro"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mensagem amigável */}
        <div className="p-3 rounded-xl bg-[#0e1119] border border-[#1e2636] text-xs text-[#eef2f9] leading-relaxed">
          {errorInfo.message || 'Não foi possível completar a solicitação.'}
        </div>

        {/* Bloco recolhível de Detalhes Técnicos */}
        <div className="border border-[#1e2636] rounded-xl overflow-hidden bg-[#0a0d14]">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-3 text-xs text-[#93a0b5] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2 font-mono">
              <Terminal className="w-4 h-4 text-amber-400" />
              <span>Detalhes técnicos (para suporte)</span>
            </div>
            {showDetails ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showDetails && (
            <div className="p-3 border-t border-[#1e2636] font-mono text-[11px] text-red-300/90 space-y-1.5 overflow-x-auto max-h-48 bg-[#07090f]">
              <div><span className="text-[#93a0b5]">Quando:</span> {errorInfo.timestamp}</div>
              <div><span className="text-[#93a0b5]">Onde/Ação:</span> {errorInfo.action || 'Desconhecida'} (Tela: {errorInfo.screen})</div>
              {errorInfo.endpoint && (
                <div><span className="text-[#93a0b5]">Endpoint:</span> {errorInfo.endpoint}</div>
              )}
              {errorInfo.status !== undefined && (
                <div><span className="text-[#93a0b5]">Status HTTP:</span> {errorInfo.status}</div>
              )}
              {errorInfo.platform && (
                <div><span className="text-[#93a0b5]">Plataforma:</span> {errorInfo.platform}</div>
              )}
              {errorInfo.appVersion && (
                <div><span className="text-[#93a0b5]">Versão App:</span> v{errorInfo.appVersion}</div>
              )}
              <div className="pt-1 text-[#eef2f9] border-t border-[#1e2636]/50 whitespace-pre-wrap break-all">
                <span className="text-[#93a0b5]">Mensagem:</span> {errorInfo.detail || errorInfo.message}
              </div>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={handleCopy}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              copied
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-4 h-4" />
                Copiado!
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                Copiar erro
              </>
            )}
          </button>

          <button
            onClick={clearError}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#0e1119] hover:bg-[#1e2636] text-[#eef2f9] border border-[#1e2636] transition-colors cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ErrorToast;
