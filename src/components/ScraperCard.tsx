import React, { useState } from 'react';
import { Link2, Search, Loader2, Sparkles, AlertCircle, ShoppingBag } from 'lucide-react';
import { ScrapedProduct } from '../types';
import { getPlatformInfo } from '../utils/copyHelper';

interface ScraperCardProps {
  onScrapeSuccess: (product: ScrapedProduct) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

const SAMPLE_LINKS = [
  {
    name: 'Mercado Livre',
    url: 'https://www.mercadolivre.com.br/smartphone-samsung-galaxy-a15-4g-256gb-8gb-ram-azul-escuro/p/MLB28503810',
    platform: 'mercadolivre'
  },
  {
    name: 'Shopee',
    url: 'https://shopee.com.br/Fone-De-Ouvido-Bluetooth-Sem-Fio-Tws-P9-Pro-Max-Sombra-i.389201928.21980392810',
    platform: 'shopee'
  },
  {
    name: 'Amazon',
    url: 'https://www.amazon.com.br/dp/B09SW1CXGQ',
    platform: 'amazon'
  },
  {
    name: 'AliExpress',
    url: 'https://pt.aliexpress.com/item/1005006123456789.html',
    platform: 'aliexpress'
  },
  {
    name: 'Shein',
    url: 'https://br.shein.com/pd-p-18928301.html',
    platform: 'shein'
  }
];

export const ScraperCard: React.FC<ScraperCardProps> = ({
  onScrapeSuccess,
  isLoading,
  setIsLoading
}) => {
  const [url, setUrl] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const detectedPlatform = url.trim() ? detectPlatformFromUrl(url) : null;
  const platformInfo = detectedPlatform ? getPlatformInfo(detectedPlatform) : null;

  function detectPlatformFromUrl(inputUrl: string): string | null {
    const u = inputUrl.toLowerCase();
    if (u.includes('mercadolivre') || u.includes('mercadolibre') || u.includes('mliv.re')) return 'mercadolivre';
    if (u.includes('shopee') || u.includes('shope.ee') || u.includes('s.shopee')) return 'shopee';
    if (u.includes('amazon') || u.includes('amzn.to') || u.includes('amzn.br') || u.includes('a.co')) return 'amazon';
    if (u.includes('aliexpress') || u.includes('ali.ski') || u.includes('s.click.aliexpress') || u.includes('a.aliexpress')) return 'aliexpress';
    if (u.includes('shein') || u.includes('she.in')) return 'shein';
    if (u.includes('tiktok') || u.includes('vt.tiktok') || u.includes('vm.tiktok')) return 'tiktokshop';
    return null;
  }

  const handleScrape = async (targetUrl?: string) => {
    const finalUrl = (targetUrl || url).trim();
    if (!finalUrl) {
      setErrorMsg('Cole o link do produto antes de extrair.');
      return;
    }

    if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
      setErrorMsg('Link inválido. O link deve começar com http:// ou https://');
      return;
    }

    setErrorMsg(null);
    setIsLoading(true);

    try {
      const response = await fetch('/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: finalUrl })
      });

      let data: any;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`O servidor retornou uma resposta inválida (Status ${response.status}). Pode ser um problema temporário de conexão ou timeout.`);
      }

      if (!response.ok) {
        throw new Error(data?.error || data?.detail || 'Falha ao extrair dados do produto.');
      }

      onScrapeSuccess(data);
    } catch (err: any) {
      console.error('Error scraping:', err);
      const isNetworkError = err.message === 'Failed to fetch' || err.toString().includes('Failed to fetch');
      const msg = isNetworkError
        ? 'Não foi possível conectar ao servidor. O aplicativo está iniciando ou reiniciando. Aguarde alguns segundos e tente novamente.'
        : (err.message || 'Não foi possível conectar ao servidor de extração.');
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl relative overflow-hidden">
      {/* Decorative gradient glow */}
      <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Link2 className="w-5 h-5" />
          </div>
          <h2 className="text-base sm:text-lg font-semibold text-white">1. Link do Produto ou Afiliado</h2>
        </div>

        {platformInfo && (
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${platformInfo.badgeClass}`}>
            {platformInfo.name}
          </span>
        )}
      </div>

      <p className="text-stone-400 text-xs sm:text-sm mb-4">
        Cole o link de afiliado gerado no <span className="text-stone-200 font-medium">Mercado Livre, Shopee, Amazon, AliExpress ou Shein</span>.
      </p>

      {/* Input box */}
      <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-3">
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="url"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              if (errorMsg) setErrorMsg(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleScrape();
            }}
            placeholder="https://www.mercadolivre.com.br/p/MLB... ou https://s.shopee.com.br/..."
            className="w-full pl-10 pr-4 py-3 bg-stone-950 border border-stone-800 rounded-xl text-stone-100 text-sm placeholder-stone-500 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all"
          />
        </div>

        <button
          onClick={() => handleScrape()}
          disabled={isLoading}
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 text-stone-950 font-bold text-sm rounded-xl shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Extraindo...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              <span>Extrair Dados</span>
            </>
          )}
        </button>
      </div>

      {/* Error Banner */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-950/50 border border-red-800/60 rounded-xl flex items-start gap-2.5 text-red-300 text-xs sm:text-sm animate-fadeIn">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Sample Links */}
      <div className="pt-2 border-t border-stone-800/60 flex items-center flex-wrap gap-2 text-xs">
        <span className="text-stone-500 font-medium flex items-center gap-1">
          <ShoppingBag className="w-3.5 h-3.5 text-stone-400" />
          Exemplos para testar:
        </span>
        {SAMPLE_LINKS.map((sample) => (
          <button
            key={sample.name}
            onClick={() => {
              setUrl(sample.url);
              handleScrape(sample.url);
            }}
            disabled={isLoading}
            className="px-2.5 py-1 bg-stone-800/80 hover:bg-stone-750 hover:text-white text-stone-300 rounded-lg border border-stone-700/60 transition-all"
          >
            {sample.name}
          </button>
        ))}
      </div>
    </div>
  );
};
