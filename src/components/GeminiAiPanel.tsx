import React, { useState } from 'react';
import { Bot, Sparkles, Loader2, ArrowRight, Wand2, RefreshCw } from 'lucide-react';
import { ScrapedProduct, GeminiCopyVariation, ApiKeysConfig } from '../types';

interface GeminiAiPanelProps {
  product: ScrapedProduct;
  onSelectVariation: (copyText: string) => void;
  apiKeys?: ApiKeysConfig;
}

export const GeminiAiPanel: React.FC<GeminiAiPanelProps> = ({ product, onSelectVariation, apiKeys }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [angle, setAngle] = useState('Urgência e Estoque Baixo');
  const [targetAudience, setTargetAudience] = useState('Compradores do WhatsApp');
  const [extraPrompt, setExtraPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [variations, setVariations] = useState<GeminiCopyVariation[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleGenerateAiCopy = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const response = await fetch('/api/gemini/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product,
          angle,
          targetAudience,
          extraPrompt,
          apiKeys,
        })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Erro ao comunicar com a IA');
      }

      if (data.variations && Array.isArray(data.variations)) {
        setVariations(data.variations);
      } else {
        throw new Error('Formato de resposta inesperado da IA');
      }
    } catch (err: any) {
      console.error('AI Error:', err);
      const isNetworkError = err.message === 'Failed to fetch' || err.toString().includes('Failed to fetch');
      const msg = isNetworkError
        ? 'Não foi possível conectar ao servidor. O aplicativo está iniciando ou reiniciando. Aguarde alguns segundos e tente novamente.'
        : (err.message || 'Ocorreu um erro ao gerar a copy com IA.');
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-gradient-to-r from-stone-900 via-stone-900 to-emerald-950/40 border border-emerald-500/30 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-inner">
            <Wand2 className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-white">Assistente de Copy IA (Gemini)</h2>
              <span className="bg-emerald-500 text-stone-950 font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase">
                Turbo
              </span>
            </div>
            <p className="text-xs text-stone-400">Gere novos ganchos de vendas persuasivos sob medida</p>
          </div>
        </div>

        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-semibold text-xs rounded-xl transition-all flex items-center gap-1.5"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isOpen ? 'Ocultar IA' : 'Gerar com IA'}</span>
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-stone-800 space-y-4 animate-fadeIn">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-400 font-medium mb-1 block">Ângulo / Gatilho de Venda</label>
              <select
                value={angle}
                onChange={(e) => setAngle(e.target.value)}
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500"
              >
                <option value="Urgência e Estoque Baixo">⚡ Urgência e Oferta Relâmpago</option>
                <option value="Mais Vendido / Tendência">🔥 Mais Vendido do Mês</option>
                <option value="Recomendação de Especialista / Testado e Aprovado">⭐ Recomendação / Review Sincero</option>
                <option value="Custo Benefício / Menor Preço Histórico">💰 Menor Preço do Ano</option>
                <option value="Exclusividade para Membros do Grupo">🔒 Exclusivo para Grupo VIP</option>
              </select>
            </div>

            <div>
              <label className="text-xs text-stone-400 font-medium mb-1 block">Público Alvo / Nicho</label>
              <input
                type="text"
                value={targetAudience}
                onChange={(e) => setTargetAudience(e.target.value)}
                placeholder="Ex: Mães, Gamers, Clientes Tech..."
                className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-400 font-medium mb-1 block">Instrução Adicional para a IA (Opcional)</label>
            <input
              type="text"
              value={extraPrompt}
              onChange={(e) => setExtraPrompt(e.target.value)}
              placeholder="Ex: Mencione frete grátis, use tom animado e emojis de fogo..."
              className="w-full px-3 py-2 bg-stone-950 border border-stone-800 rounded-xl text-xs text-stone-200 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <button
            onClick={handleGenerateAiCopy}
            disabled={isGenerating}
            className="w-full py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-stone-950 font-bold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>IA Gerando Copy Padrão Oficial...</span>
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                <span>Gerar Copy no Padrão Oficial com IA Gemini</span>
              </>
            )}
          </button>

          {error && (
            <p className="text-xs text-red-400 bg-red-950/40 p-2.5 rounded-lg border border-red-800/50">
              {error}
            </p>
          )}

          {/* Display AI Results */}
          {variations.length > 0 && (
            <div className="space-y-3 pt-2">
              <h3 className="text-xs font-bold text-stone-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                Opções Geradas pela IA:
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {variations.map((v) => (
                  <div
                    key={v.id}
                    className="p-3.5 bg-stone-950 border border-stone-800 hover:border-emerald-500/50 rounded-xl space-y-2 transition-all group"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-emerald-400">{v.title}</span>
                      <button
                        onClick={() => onSelectVariation(v.copy)}
                        className="px-2.5 py-1 bg-emerald-500 text-stone-950 font-bold text-[11px] rounded-lg hover:bg-emerald-400 transition-all flex items-center gap-1"
                      >
                        <span>Usar esta copy</span>
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </div>

                    <pre className="text-xs text-stone-300 font-sans whitespace-pre-wrap bg-stone-900/60 p-2.5 rounded-lg border border-stone-800/80">
                      {v.copy}
                    </pre>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
