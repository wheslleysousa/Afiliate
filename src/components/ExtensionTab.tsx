import React, { useState } from 'react';
import {
  Download,
  Zap,
  ShoppingBag,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Copy,
  CheckSquare,
  XCircle,
  HelpCircle,
  ChevronDown,
  Layers,
  Filter,
  Bell,
  Smartphone,
  ExternalLink,
  Award,
  BarChart3,
  Globe
} from 'lucide-react';

export const ExtensionTab: React.FC = () => {
  const [activeShowcase, setActiveShowcase] = useState<'amazon' | 'filters' | 'toasts'>('amazon');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const handleDownload = () => {
    window.open('/api/extension/download', '_blank');
  };

  const toggleFaq = (index: number) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  return (
    <div className="space-y-12 max-w-5xl mx-auto animate-fadeIn pb-20 text-slate-200 font-sans">

      {/* ───────────────────────────────────────────────────────────────────────
          1. ATENÇÃO (ATTENTION) - HERO SECTION v2.6.5
         ─────────────────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-[#111625] via-[#0b0f19] to-[#0b0f19] border border-[#1e2638] p-8 sm:p-12 shadow-2xl">
        {/* Subtle Background Glow Accent */}
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-6 max-w-3xl">
          {/* Version Badge & Live Status */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold tracking-wide">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
              <span>AFFILIATE MINER v2.6.5 • EXTENSÃO OFICIAL</span>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span>Atualizada & Pronta</span>
            </div>
          </div>

          {/* High-Impact Headline */}
          <h1 className="text-3xl sm:text-5xl font-black text-white leading-tight tracking-tight">
            Minere Produtos Lucrativos em 3 Segundos e{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-indigo-300 to-emerald-400">
              Nunca Mais Perca Comissões
            </span>
          </h1>

          {/* Direct Sales Copy Subheadline */}
          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            A ferramenta essencial para afiliados que buscam alta produtividade. O <strong className="text-white font-semibold">Affiliate Miner v2.6.5</strong> detecta preços atualizados, descontos, cupons ativos, histórico de vendas e injeta automaticamente seu ID de afiliado na Amazon, Mercado Livre, Shopee, AliExpress e Shein.
          </p>

          {/* Primary & Secondary Call to Action */}
          <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
            <button
              onClick={handleDownload}
              className="px-8 py-4 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-3 shadow-lg shadow-blue-600/30 hover:scale-[1.01] active:scale-[0.99] transition-all group cursor-pointer"
            >
              <Download className="w-5 h-5 group-hover:translate-y-0.5 transition-transform" />
              <span>Baixar Extensão Grátis (.zip) — v2.6.5</span>
            </button>

            <a
              href="#instalacao-passo-a-passo"
              className="px-6 py-4 rounded-xl bg-[#151a26] hover:bg-[#1e2638] border border-[#1e2638] text-slate-300 hover:text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <span>Ver Guia de Instalação</span>
              <ArrowRight className="w-4 h-4 text-blue-400" />
            </a>
          </div>

          {/* Proof Seals */}
          <div className="pt-4 border-t border-[#1e2638] flex flex-wrap items-center gap-6 text-xs text-slate-400 font-medium">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Injeção Nativa no Amazon & ML</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Alertas Toasts de Sucesso</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>Chrome, Edge, Brave & Opera</span>
            </div>
          </div>
        </div>
      </section>


      {/* ───────────────────────────────────────────────────────────────────────
          2. INTERESSE (INTEREST) - NOVIDADES DA VERSÃO v2.6.5 & RECURSOS CHAVE
         ─────────────────────────────────────────────────────────────────────── */}
      <section className="space-y-8">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-blue-400 uppercase tracking-widest">
            Tecnologia de Alta Performance
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            O que torna o Affiliate Miner v2.6.5 imbatível?
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            Projetado para eliminar gargalos operacionais e maximizar a taxa de conversão dos seus links.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-[#111625] border border-[#1e2638] space-y-3 hover:border-blue-500/40 transition-all shadow-md">
            <div className="w-12 h-12 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Botão Integrado no "Comprar Agora"</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Na Amazon, Mercado Livre e Shopee, o botão verde de mineração é injetado diretamente ao lado/abaixo dos botões de compra. Clique e minere sem sair da oferta.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#111625] border border-[#1e2638] space-y-3 hover:border-emerald-500/40 transition-all shadow-md">
            <div className="w-12 h-12 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Bell className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Notificações Flutuantes em Tempo Real</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Confirmação visual instantânea na tela. Veja toasts flutuantes verdes alertando <strong className="text-emerald-300 font-semibold">"✅ Produto minerado com sucesso!"</strong> ou alertas de erro claros.
            </p>
          </div>

          <div className="p-6 rounded-2xl bg-[#111625] border border-[#1e2638] space-y-3 hover:border-indigo-500/40 transition-all shadow-md">
            <div className="w-12 h-12 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <Filter className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-white">Filtros Avançados em Modal Pop-up</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              Ajuste limites de preço, volume mínimo de vendas, cupons e porcentagem de desconto no novo painel Modal limpo, ativado sob demanda.
            </p>
          </div>
        </div>

        {/* Interactive Feature Showcase */}
        <div className="p-6 sm:p-8 rounded-3xl bg-[#0b0f19] border border-[#1e2638] space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[#1e2638] pb-5">
            <div>
              <h3 className="text-lg font-bold text-white">Demonstração Interativa na Prática</h3>
              <p className="text-xs text-slate-400">Selecione uma das funcionalidades abaixo para visualizar a experiência de uso:</p>
            </div>

            {/* Showcase Tabs */}
            <div className="flex bg-[#151a26] p-1 rounded-xl border border-[#1e2638] gap-1">
              <button
                onClick={() => setActiveShowcase('amazon')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeShowcase === 'amazon'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Botão na Amazon & ML
              </button>
              <button
                onClick={() => setActiveShowcase('toasts')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeShowcase === 'toasts'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Alertas Flutuantes
              </button>
              <button
                onClick={() => setActiveShowcase('filters')}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  activeShowcase === 'filters'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3. Modal de Filtros
              </button>
            </div>
          </div>

          {/* Tab Content Display */}
          <div className="bg-[#111625] rounded-2xl p-6 border border-[#1e2638]">
            {activeShowcase === 'amazon' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <span className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-md text-[11px] font-bold border border-amber-500/30">
                    NATIVO NAS PÁGINAS DE PRODUTO
                  </span>
                  <h4 className="text-xl font-bold text-white">Injeção Inteligente no Buy-Box</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Quando você navega em qualquer produto na Amazon ou Mercado Livre, a extensão renderiza um botão verde de destaque estrategicamente localizado abaixo do botão de compra.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Extrai título original, fotos HD e preço com desconto</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Captura volume de vendas ("5mil+ vendidos")</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Sincroniza instantaneamente com seu painel web</span>
                    </li>
                  </ul>
                </div>

                {/* Simulated Product Card UI */}
                <div className="bg-[#0b0f19] p-5 rounded-xl border border-[#1e2638] space-y-3 font-sans">
                  <div className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Exemplo Buy-Box Amazon / Mercado Livre</div>
                  <div className="text-sm font-bold text-white">Smartphone Samsung Galaxy A15 256GB</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-lg font-black text-emerald-400">R$ 899,00</span>
                    <span className="text-xs text-slate-500 line-through">R$ 1.299,00</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/20 text-emerald-300 rounded font-bold">-30%</span>
                  </div>
                  <div className="space-y-2 pt-2">
                    <div className="w-full py-2 bg-[#f0c14b] text-slate-900 font-bold text-xs rounded text-center opacity-70">
                      Adicionar ao Carrinho
                    </div>
                    <div className="w-full py-2 bg-[#e77600] text-white font-bold text-xs rounded text-center opacity-70">
                      Comprar Agora
                    </div>
                    {/* Injected Button Highlight */}
                    <div className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-green-600 text-white font-black text-xs rounded-lg text-center flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/30 ring-2 ring-emerald-400">
                      <Zap className="w-4 h-4 fill-current text-amber-300" />
                      <span>⚡ Minerar Este Produto (v2.6.5)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeShowcase === 'toasts' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-md text-[11px] font-bold border border-emerald-500/30">
                    FEEDBACK EM TEMPO REAL
                  </span>
                  <h4 className="text-xl font-bold text-white">Notificações Toast Claras</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Esqueça dúvidas se a oferta foi gravada ou não. A extensão aciona alertas visuais flutuantes no topo da página indicando o status exato da ação.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span><strong>Sucesso:</strong> Banner verde de confirmação instantânea</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span><strong>Duplicado:</strong> Alerta se o produto já está salvo no seu acervo</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span><strong>Erro:</strong> Notificação vermelha explicativa em falhas</span>
                    </li>
                  </ul>
                </div>

                {/* Simulated Toasts */}
                <div className="bg-[#0b0f19] p-6 rounded-xl border border-[#1e2638] space-y-4 flex flex-col justify-center">
                  <div className="p-3 bg-[#064e3b] border border-[#10b981] text-emerald-100 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg">
                    <span className="text-base">✅</span>
                    <span>Produto minerado com sucesso!</span>
                  </div>
                  <div className="p-3 bg-[#78350f] border border-[#f59e0b] text-amber-100 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg">
                    <span className="text-base">⚠️</span>
                    <span>Produto já está na lista de minerados!</span>
                  </div>
                  <div className="p-3 bg-[#7f1d1d] border border-[#ef4444] text-red-100 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg">
                    <span className="text-base">❌</span>
                    <span>Erro ao extrair produto nesta página.</span>
                  </div>
                </div>
              </div>
            )}

            {activeShowcase === 'filters' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                <div className="space-y-4">
                  <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-md text-[11px] font-bold border border-indigo-500/30">
                    PAINEL POP-UP MODAL
                  </span>
                  <h4 className="text-xl font-bold text-white">Filtros Sem Poluição Visual</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Os filtros avançados foram movidos para um modal moderno que só aparece quando você clica em <strong>⚙️ Filtros Avançados</strong>.
                  </p>
                  <ul className="space-y-2 text-xs text-slate-300">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Filtre por categoria, vendas mínimas (chips de 50, 100, 1k)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Desconto mínimo %, frete grátis e opção sem juros</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>Botão de aplicação rápida e limpeza com 1 clique</span>
                    </li>
                  </ul>
                </div>

                {/* Simulated Modal UI */}
                <div className="bg-[#0b0f19] p-5 rounded-xl border border-blue-600/50 space-y-3 font-sans shadow-2xl">
                  <div className="flex items-center justify-between border-b border-[#1e2638] pb-2">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      ⚙️ Filtros Avançados de Mineração
                    </span>
                    <span className="text-slate-400 text-xs font-bold">&times;</span>
                  </div>
                  <div className="space-y-2 text-[11px] text-slate-300">
                    <div>
                      <div className="text-slate-400 mb-1">Mínimo de Vendas</div>
                      <div className="flex gap-1">
                        <span className="px-2 py-0.5 bg-blue-600 text-white rounded font-bold">100</span>
                        <span className="px-2 py-0.5 bg-[#1e2638] text-slate-400 rounded">250</span>
                        <span className="px-2 py-0.5 bg-[#1e2638] text-slate-400 rounded">500</span>
                        <span className="px-2 py-0.5 bg-[#1e2638] text-slate-400 rounded">1k</span>
                      </div>
                    </div>
                    <div className="pt-2 flex gap-2">
                      <div className="flex-1 py-1.5 bg-blue-600 text-white font-bold rounded text-center text-[11px]">
                        Aplicar Filtros
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>


      {/* ───────────────────────────────────────────────────────────────────────
          3. DESEJO (DESIRE) - AMADOR VS PROFISSIONAL (TRANSFORMAÇÃO)
         ─────────────────────────────────────────────────────────────────────── */}
      <section className="space-y-6">
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">
            A Escolha Estratégica dos Afiliados de Elite
          </span>
          <h2 className="text-2xl sm:text-3xl font-black text-white">
            Trabalhar Manualmente x Usar o Affiliate Miner v2.6.5
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Old Amateur Way */}
          <div className="p-6 rounded-2xl bg-red-950/20 border border-red-500/20 space-y-4">
            <div className="flex items-center gap-2 text-red-400 font-bold text-sm uppercase">
              <XCircle className="w-5 h-5" />
              <span>O Processo Manual e Lento</span>
            </div>

            <ul className="space-y-3 text-xs text-slate-300">
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">•</span>
                <span>Gasta de 5 a 10 minutos por produto copiando link, título e baixando imagem por imagem.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">•</span>
                <span>Risco alto de esquecer de colocar sua tag de comissão e doar vendas para terceiros.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">•</span>
                <span>Fotos de baixa resolução tiradas por print de tela que espantam o comprador.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-400 font-bold">•</span>
                <span>Cupons de desconto expiram antes mesmo de você terminar de formatar a oferta no WhatsApp.</span>
              </li>
            </ul>
          </div>

          {/* New Professional Way */}
          <div className="p-6 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 space-y-4 shadow-xl">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm uppercase">
              <CheckCircle2 className="w-5 h-5" />
              <span>Com o Affiliate Miner v2.6.5</span>
            </div>

            <ul className="space-y-3 text-xs text-slate-200 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Mineração completa e formatação da oferta em apenas 3 segundos com 1 clique.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Injeção automática do seu ID de afiliado garantindo 100% do comissionamento.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Mídia em altíssima resolução original direto do servidor das lojas.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-emerald-400 font-bold">✓</span>
                <span>Disparo e cópia imediata formatada com emojis persuasivos para WhatsApp e Telegram.</span>
              </li>
            </ul>
          </div>
        </div>

        {/* High Perception Metrics Counter */}
        <div className="bg-[#111625] border border-[#1e2638] rounded-2xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl sm:text-3xl font-black text-blue-400">+350%</div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">Ganho de Produtividade</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-emerald-400">100%</div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">Comissões Protegidas</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-indigo-400">5 Lojas</div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">Amazon, ML, Shopee, Ali, Shein</div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400">v2.6.5</div>
            <div className="text-[11px] text-slate-400 mt-1 font-medium">Versão Mais Recente e Estável</div>
          </div>
        </div>
      </section>


      {/* ───────────────────────────────────────────────────────────────────────
          4. AÇÃO (ACTION) - DOWNLOAD FINAL & PASSO A PASSO
         ─────────────────────────────────────────────────────────────────────── */}
      <section id="instalacao-passo-a-passo" className="space-y-8 pt-4">
        {/* Main CTA Download Box */}
        <div className="p-8 sm:p-10 bg-gradient-to-br from-blue-950/40 via-[#111625] to-emerald-950/40 border-2 border-blue-500/40 rounded-3xl text-center space-y-6 shadow-2xl relative overflow-hidden">
          <div className="space-y-2 max-w-xl mx-auto">
            <span className="px-3.5 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-bold inline-block">
              INSTALAÇÃO RÁPIDA GRATUITA
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-white">
              Pronto para Começar a Minerar?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300">
              Faça o download do pacote descompactado da extensão <strong>v2.6.5</strong> e instale em menos de 1 minuto no seu navegador.
            </p>
          </div>

          <div className="flex justify-center">
            <button
              onClick={handleDownload}
              className="px-10 py-5 rounded-2xl bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-700 hover:from-emerald-500 hover:to-green-500 text-white font-black text-base flex items-center justify-center gap-3 shadow-2xl shadow-emerald-600/35 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            >
              <Download className="w-6 h-6" />
              <span>Baixar Extensão (.zip) — v2.6.5</span>
            </button>
          </div>
        </div>

        {/* 5-Step Clear Installation Guide */}
        <div className="p-6 sm:p-8 bg-[#111625] border border-[#1e2638] rounded-3xl space-y-6 shadow-xl">
          <div className="border-b border-[#1e2638] pb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <CheckSquare className="w-5 h-5 text-blue-400" />
              Guia de Instalação Passo a Passo (Chrome, Edge, Brave, Opera)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Siga os 5 passos simples para habilitar a extensão no seu navegador em segundos:
            </p>
          </div>

          <ol className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-slate-300">
            <li className="p-4 bg-[#151a26] border border-[#1e2638] rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0">1</span>
                <span>Faça o Download do .ZIP:</span>
              </div>
              <p className="text-slate-400 pl-8">
                Clique no botão verde <strong className="text-emerald-300">"Baixar Extensão (.zip)"</strong> para salvar o pacote v2.6.5 no seu computador.
              </p>
            </li>

            <li className="p-4 bg-[#151a26] border border-[#1e2638] rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0">2</span>
                <span>Extraia a Pasta:</span>
              </div>
              <p className="text-slate-400 pl-8">
                Clique com o botão direito no arquivo baixado e selecione <strong className="text-white">"Extrair Tudo..."</strong> em uma pasta de sua preferência.
              </p>
            </li>

            <li className="p-4 bg-[#151a26] border border-[#1e2638] rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0">3</span>
                <span>Abra as Extensões:</span>
              </div>
              <p className="text-slate-400 pl-8">
                No Chrome acesse <code className="bg-[#0b0f19] px-2 py-0.5 rounded text-amber-300 font-mono">chrome://extensions</code> ou no Edge <code className="bg-[#0b0f19] px-2 py-0.5 rounded text-amber-300 font-mono">edge://extensions</code>
              </p>
            </li>

            <li className="p-4 bg-[#151a26] border border-[#1e2638] rounded-2xl space-y-1.5">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0">4</span>
                <span>Ative o Modo Desenvolvedor:</span>
              </div>
              <p className="text-slate-400 pl-8">
                No canto superior direito da página de extensões, ative a chave <strong className="text-white font-bold">"Modo do desenvolvedor"</strong>.
              </p>
            </li>

            <li className="p-4 bg-[#151a26] border border-[#1e2638] rounded-2xl space-y-1.5 md:col-span-2">
              <div className="flex items-center gap-2 font-bold text-white">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs shrink-0">5</span>
                <span>Carregue sem Compactar:</span>
              </div>
              <p className="text-slate-400 pl-8">
                Clique no botão <strong className="text-white">"Carregar sem compactar"</strong> (Load Unpacked) e selecione a pasta descompactada do Passo 2. Pronto! O ícone do Affiliate Miner v2.6.5 estará ativo.
              </p>
            </li>
          </ol>
        </div>

        {/* FAQ Section */}
        <div className="p-6 sm:p-8 bg-[#111625] border border-[#1e2638] rounded-3xl space-y-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2 pb-2 border-b border-[#1e2638]">
            <HelpCircle className="w-5 h-5 text-blue-400" />
            Perguntas Frequentes sobre a Extensão
          </h3>

          <div className="space-y-3">
            {[
              {
                q: "A extensão funciona em quais navegadores?",
                a: "Funciona em todos os navegadores baseados em Chromium: Google Chrome, Microsoft Edge, Brave, Opera, Vivaldi e outros."
              },
              {
                q: "Como garanto que minhas comissões vão para o meu ID?",
                a: "Na aba Configurações do seu painel Afiliate, cadastre suas tags/IDs de afiliado (Mercado Livre, Shopee, Amazon, etc). A extensão sincroniza automaticamente e injeta sua tag em todos os links capturados."
              },
              {
                q: "Os produtos minerados aparecem automaticamente no meu painel?",
                a: "Sim! A extensão conecta diretamente com seu banco de dados Firebase em nuvem. Qualquer produto minerado fica salvo instantaneamente na aba 'Produtos Minerados' e no histórico."
              },
              {
                q: "Preciso pagar algo para usar a extensão?",
                a: "Não. A extensão Affiliate Miner v2.6.5 é 100% gratuita para todos os usuários da plataforma."
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-[#151a26] border border-[#1e2638] rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-4 text-left text-xs font-bold text-white flex items-center justify-between gap-4 cursor-pointer hover:bg-[#1e2638]/50 transition-colors"
                >
                  <span>{item.q}</span>
                  <ChevronDown className={`w-4 h-4 text-blue-400 transition-transform ${openFaq === idx ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === idx && (
                  <div className="p-4 pt-0 text-xs text-slate-300 border-t border-[#1e2638]/50 leading-relaxed bg-[#0b0f19]/50">
                    {item.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

    </div>
  );
};
