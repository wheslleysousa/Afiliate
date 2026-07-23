import React, { useState } from 'react';
import { Code2, Copy, Check, Server, Terminal, Sparkles, CheckCircle } from 'lucide-react';

export const ApiDocsModal: React.FC = () => {
  const [copiedSection, setCopiedSection] = useState<string | null>(null);

  const copySnippet = async (id: string, code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSection(id);
      setTimeout(() => setCopiedSection(null), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  const curlExample = `curl -X POST "https://seu-app.onrender.com/scrape" \\
  -H "Content-Type: application/json" \\
  -d '{"url": "https://www.mercadolivre.com.br/p/MLB28503810"}'`;

  const pythonExample = `import httpx

url = "https://seu-app.onrender.com/scrape"
payload = {"url": "https://s.shopee.com.br/exemplo"}

response = httpx.post(url, json=payload, timeout=20.0)
print(response.json())`;

  const jsExample = `const response = await fetch("https://seu-app.onrender.com/scrape", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://www.amazon.com.br/dp/B09SW1CXGQ" })
});
const data = await response.json();
console.log(data);`;

  return (
    <div className="bg-stone-900 border border-stone-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
      <div className="flex items-center gap-3 pb-4 border-b border-stone-800">
        <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400">
          <Code2 className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-white">Documentação da API de Scraping (/scrape)</h2>
          <p className="text-xs text-stone-400">Integração backend para extração de dados de afiliados</p>
        </div>
      </div>

      {/* Endpoints overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-emerald-500 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded uppercase">
              POST
            </span>
            <code className="text-xs text-emerald-400 font-bold font-mono">/scrape</code>
          </div>
          <p className="text-xs text-stone-300">
            Recebe a URL do produto e retorna os dados extraídos (título, preço, parcelas, cupom e link).
          </p>
        </div>

        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="bg-blue-500 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded uppercase">
              GET
            </span>
            <code className="text-xs text-blue-400 font-bold font-mono">/health</code>
          </div>
          <p className="text-xs text-stone-300">
            Endpoint de health check que retorna <code className="text-stone-400">{`{"status": "ok", "version": "1.0.0"}`}</code>.
          </p>
        </div>
      </div>

      {/* Response Schema */}
      <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-3">
        <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
          <Server className="w-4 h-4 text-emerald-400" />
          Estrutura do JSON de Resposta (HTTP 200)
        </h3>
        <pre className="bg-stone-900 p-3 rounded-lg text-xs text-stone-300 font-mono overflow-x-auto">
{`{
  "platform": "mercadolivre", // mercadolivre | shopee | amazon | aliexpress | shein
  "title": "Nome completo do produto",
  "image_url": "https://url-da-imagem.jpg",
  "price_from": "199.90",
  "price_to": "149.90",
  "installments": "12x de R$ 14,99 sem juros",
  "coupon": "PROMO10",
  "original_link": "https://link-original-colado-pelo-usuario"
}`}
        </pre>
      </div>

      {/* Code Snippets */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold text-stone-200 uppercase tracking-wider flex items-center gap-1.5">
          <Terminal className="w-4 h-4 text-emerald-400" />
          Exemplos de Chamada
        </h3>

        {/* cURL */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">cURL (Terminal)</span>
            <button
              onClick={() => copySnippet('curl', curlExample)}
              className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
            >
              {copiedSection === 'curl' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'curl' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <pre className="bg-stone-900 p-3 rounded-lg text-xs text-amber-200 font-mono overflow-x-auto">
            {curlExample}
          </pre>
        </div>

        {/* Python */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-blue-400">Python (httpx)</span>
            <button
              onClick={() => copySnippet('python', pythonExample)}
              className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
            >
              {copiedSection === 'python' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'python' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <pre className="bg-stone-900 p-3 rounded-lg text-xs text-blue-200 font-mono overflow-x-auto">
            {pythonExample}
          </pre>
        </div>

        {/* JS */}
        <div className="bg-stone-950 border border-stone-800 rounded-xl p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-400">JavaScript / Node.js (fetch)</span>
            <button
              onClick={() => copySnippet('js', jsExample)}
              className="text-xs text-stone-400 hover:text-white flex items-center gap-1"
            >
              {copiedSection === 'js' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedSection === 'js' ? 'Copiado' : 'Copiar'}</span>
            </button>
          </div>
          <pre className="bg-stone-900 p-3 rounded-lg text-xs text-emerald-200 font-mono overflow-x-auto">
            {jsExample}
          </pre>
        </div>
      </div>
    </div>
  );
};
