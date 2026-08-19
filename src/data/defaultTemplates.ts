import type { CopyTemplate, ProductData } from '../types';
import { calculateCommission } from '../utils/marketplaceUtils';

export const DEFAULT_TEMPLATES: CopyTemplate[] = [
  // ─── WhatsApp ────────────────────────────────────────────────────────────
  {
    id: 'whatsapp-urgency',
    name: '🔥 WhatsApp — Urgência',
    category: 'urgency',
    description: 'Oferta com senso de urgência para grupos de WhatsApp',
    template: `🔥 *OFERTA IMPERDÍVEL!*

*{titulo}*

💸 ~~{precoAntigo}~~
⚡ *Por apenas {preco}*
{parcelamento}

{cupom}
🚚 {frete}

📌 {descricao}

🔗 Garanta agora 👇
{linkAfiliado}

⏰ _Promoção por tempo limitado!_`,
  },
  {
    id: 'whatsapp-direct',
    name: '✅ WhatsApp — Direto',
    category: 'direct',
    description: 'Template direto e objetivo para WhatsApp',
    template: `✅ *{titulo}*

💰 {precoAntigo ? \`De ~~\${precoAntigo}~~ por\` : 'Por'} *{preco}*
{parcelamento}
{cupom}
🚚 {frete}

🛒 Compre aqui: {linkAfiliado}`,
  },
  {
    id: 'whatsapp-review',
    name: '⭐ WhatsApp — Avaliação',
    category: 'review',
    description: 'Formato baseado em avaliação e credibilidade',
    template: `⭐ *{titulo}*

💬 Um dos produtos mais bem avaliados da categoria!

💰 *{preco}*
{parcelamento}
{cupom}
🚚 {frete}

📦 {descricao}

👉 {linkAfiliado}`,
  },

  // ─── Instagram / Stories ─────────────────────────────────────────────────
  {
    id: 'instagram-stories',
    name: '📸 Instagram Stories',
    category: 'direct',
    description: 'Legenda curta para Stories — link na bio ou sticker',
    template: `💥 {titulo}

De {precoAntigo} por {preco}
{parcelamento}
{cupom}

Link na bio 🔗
{frete}`,
  },
  {
    id: 'instagram-feed',
    name: '📸 Instagram Feed',
    category: 'direct',
    description: 'Legenda completa para post no feed do Instagram',
    template: `{titulo} 🔥

Encontrei essa oferta incrível e precisava compartilhar!

💰 {precoAntigo ? \`De R$ \${precoAntigo} por\` : ''} *R$ {preco}*
{parcelamento}
{cupom}
🚚 {frete}

{descricao}

🛒 Link na BIO para comprar!

.
.
.
#oferta #desconto #achados #promocao #compras`,
  },

  // ─── Telegram ────────────────────────────────────────────────────────────
  {
    id: 'telegram-channel',
    name: '✈️ Telegram — Canal',
    category: 'urgency',
    description: 'Template para canal de ofertas no Telegram (suporta Markdown)',
    template: `🔥 **{titulo}**

💸 ~~{precoAntigo}~~ → **{preco}**
{parcelamento}
{cupom}
📦 {frete}

📌 {descricao}

🛒 [Comprar agora]({linkAfiliado})

⏳ _Aproveite enquanto dura!_`,
  },
  {
    id: 'telegram-group',
    name: '✈️ Telegram — Grupo Simples',
    category: 'minimalist',
    description: 'Versão compacta para grupos de ofertas no Telegram',
    template: `📦 **{titulo}**
💰 **{preco}** {parcelamento}
{cupom}
🚚 {frete}
🔗 {linkAfiliado}`,
  },

  // ─── TikTok / Reels ──────────────────────────────────────────────────────
  {
    id: 'tiktok-caption',
    name: '🎵 TikTok / Reels — Legenda',
    category: 'urgency',
    description: 'Legenda viral para vídeo no TikTok ou Instagram Reels',
    template: `POV: você acabou de encontrar {titulo} por {preco} 😱

{cupom}
{frete}

Link na bio! 🔗

#achados #desconto #oferta #tiktokshop #comprasdotiktok`,
  },

  // ─── Grupos de Ofertas / Genérico ────────────────────────────────────────
  {
    id: 'grupo-ofertas',
    name: '💬 Grupo de Ofertas',
    category: 'group',
    description: 'Template para grupos de promoções no WhatsApp ou Telegram',
    template: `💥 ACHADO DO DIA!

{titulo}

✅ Preço: {preco}
{parcelamento}
{cupom}
🚚 {frete}

🔗 {linkAfiliado}

Corre que pode acabar! ⏰`,
  },
  {
    id: 'whatsapp-pix-focus',
    name: '💸 WhatsApp — Foco no PIX',
    category: 'urgency',
    description: 'Destaca o desconto via PIX com urgência',
    template: `💸 *PAGANDO NO PIX É AINDA MAIS BARATO!*

*{titulo}*

💳 No cartão: ~~{precoAntigo}~~
⚡ *PIX: {precoPix}* {desconto}

{parcelamento}
{cupom}
{frete}

🛒 Garanta agora: {linkAfiliado}

⏰ _Promoção por tempo limitado!_`,
  },
  {
    id: 'telegram-channel-v2',
    name: '✈️ Canal Telegram — Completo',
    category: 'group',
    description: 'Template rico para canais de oferta no Telegram',
    template: `🔥 **OFERTA DO DIA**

📦 **{titulo}**

{estrelas} {vendas}

💰 ~~De {precoAntigo}~~
⚡ **Por: {preco}** {desconto}
{parcelamento}
{cupom}
{frete}

🛒 [👆 CLIQUE AQUI PARA COMPRAR]({linkAfiliado})

_Preços válidos enquanto durar o estoque_`,
  },
  {
    id: 'review-style',
    name: '⭐ Estilo Review',
    category: 'review',
    description: 'Tom de quem testou e recomenda o produto',
    template: `✅ *Acabei de testar e recomendo!*

*{titulo}*

Tá com um preço INCRÍVEL: {preco}
{desconto}
{parcelamento}
{cupom}
{frete}

Sem arrependimento, vale muito a pena!

🔗 {linkAfiliado}`,
  },
  {
    id: 'minimalista',
    name: '✨ Minimalista',
    category: 'minimalist',
    description: 'Versão ultra-enxuta — ideal para testes A/B',
    template: `{titulo}
{preco} {parcelamento}
{cupom}
{linkAfiliado}`,
  },
];

export function applyTemplate(
  template: string,
  product: ProductData,
  affiliateLink: string,
  commissionRates?: any
): string {
  let text = template || '';

  // 1. Calcular % de desconto se não vier explicitamente
  const discountPct = product.discount_pct ??
    (() => {
      try {
        const fromStr = (product.price_from || '').replace(/[R$\s.]/g, '').replace(',', '.');
        const toStr = (product.price_to || '').replace(/[R$\s.]/g, '').replace(',', '.');
        const from = parseFloat(fromStr);
        const to = parseFloat(toStr);
        if (from > 0 && to > 0 && from > to) return Math.round((1 - to / from) * 100);
      } catch { /**/ }
      return null;
    })();

  const discountText = discountPct ? `${discountPct}% OFF` : '';
  const discountSign = discountPct ? `-${discountPct}%` : '';

  // 2. Calcular comissão
  const comm = calculateCommission(
    product.price_to,
    product.platform,
    product,
    null,
    null,
    commissionRates
  );

  // 3. Preços formatados com R$ se necessário
  const rawPriceFrom = (product.price_from || '').trim();
  const rawPriceTo = (product.price_to || '').trim();
  const rawPixPrice = (product.pix_price || product.price_to || '').trim();
  const rawCardPrice = (product.card_price || product.price_to || '').trim();

  const formatPrice = (val: string) => {
    if (!val) return '';
    if (/^R\$/i.test(val)) return val;
    return `R$ ${val}`;
  };

  const precoNovoStr = formatPrice(rawPriceTo);
  const precoAntigoStr = formatPrice(rawPriceFrom);
  const precoPixStr = formatPrice(rawPixPrice);
  const precoCartaoStr = formatPrice(rawCardPrice);

  // 4. Parcelamento
  const rawInst = (product.installments || '').trim();
  const isSemJuros = Boolean(
    product.installments_interest_free === true ||
    (rawInst && /sem juros/i.test(rawInst)) ||
    (product.max_installments_interest_free && /sem juros/i.test(product.max_installments_interest_free))
  );

  let parcelasSemJurosStr = '';
  let parcelasComJurosStr = '';

  if (rawInst) {
    if (/sem juros/i.test(rawInst) || isSemJuros) {
      parcelasSemJurosStr = rawInst;
      if (!/sem juros/i.test(parcelasSemJurosStr)) {
        parcelasSemJurosStr += ' sem juros';
      }
    } else if (/com juros/i.test(rawInst)) {
      parcelasComJurosStr = rawInst;
    } else {
      parcelasSemJurosStr = `${rawInst} sem juros`;
      parcelasComJurosStr = `${rawInst} com juros`;
    }
  }

  const parcelamentoGeneral = rawInst
    ? (isSemJuros && !/sem juros/i.test(rawInst) ? `${rawInst} sem juros` : rawInst)
    : (product.max_installments_interest_free ? `${product.max_installments_interest_free}` : '');

  // 5. Frete
  let freteStr = '';
  if (product.free_shipping || (product.shipping && /grátis|gratis/i.test(product.shipping))) {
    freteStr = '🚚 Frete GRÁTIS';
  } else if (product.shipping && product.shipping.trim()) {
    freteStr = `🚚 Frete: ${product.shipping.trim()}`;
  } else {
    freteStr = '🚚 Frete a calcular';
  }

  // 6. Cupom
  const couponCode = (product.coupon || product.coupon_text || '').trim();
  const cupomStr = couponCode ? `🎟️ Cupom: ${couponCode}` : '';

  // 7. Loja / Plataforma
  const rawPlatform = (product.platform || '').toLowerCase();
  let storeName = 'Loja Oficial';
  if (rawPlatform.includes('mercadolivre') || rawPlatform.includes('ml')) storeName = 'Mercado Livre';
  else if (rawPlatform.includes('shopee')) storeName = 'Shopee';
  else if (rawPlatform.includes('amazon')) storeName = 'Amazon';
  else if (rawPlatform.includes('aliexpress')) storeName = 'AliExpress';
  else if (rawPlatform.includes('shein')) storeName = 'Shein';

  // 8. Link — prioriza o link de afiliado CURTO já salvo no produto (meli.la,
  // amzn.to, s.shopee gerado pela extensão) sobre o link reconstruído.
  const savedShort = (product.affiliate_link || '').trim();
  const isRealAffiliateShort = /^https?:\/\//i.test(savedShort) && /(meli\.la|amzn\.to|link\.amazon|shope\.ee|s\.shopee|shp\.ee|awin1\.com)/i.test(savedShort);
  const targetLink = (isRealAffiliateShort ? savedShort : '') || affiliateLink || savedShort || product.original_link || '';

  // 9. Estrelas e Vendas
  const starsStr = product.stars ? `⭐ ${product.stars}` : '';
  const salesStr = product.sales_count ? `📦 ${product.sales_count} vendas` : '';

  // 10. Comissão
  const commAmountStr = comm ? `R$ ${comm.amount.toFixed(2).replace('.', ',')}` : 'R$ 0,00';
  const commPctStr = comm ? `${comm.ratePct}%` : '0%';

  // Mapeamento de tags simples e duplas
  const replacements: Record<string, string> = {
    // Título / Produto
    '{titulo}': product.title || '',
    '{produto}': product.title || '',
    '{nome}': product.title || '',
    '{product_name}': product.title || '',
    '{{titulo}}': product.title || '',
    '{{produto}}': product.title || '',
    '{{nome}}': product.title || '',
    '{{product_name}}': product.title || '',

    // Preço Novo / Preço Atual
    '{preco}': precoNovoStr,
    '{precoNovo}': precoNovoStr,
    '{preco_novo}': precoNovoStr,
    '{precoAtual}': precoNovoStr,
    '{{preco}}': precoNovoStr,
    '{{preco_novo}}': precoNovoStr,
    '{{preco_atual}}': precoNovoStr,

    // Preço Antigo / Riscado
    '{precoAntigo}': precoAntigoStr,
    '{preco_antigo}': precoAntigoStr,
    '{precoRiscado}': precoAntigoStr,
    '{preco_riscado}': precoAntigoStr,
    '{{precoAntigo}}': precoAntigoStr,
    '{{preco_antigo}}': precoAntigoStr,
    '{{preco_riscado}}': precoAntigoStr,

    // Preço Pix
    '{precoPix}': precoPixStr,
    '{preco_pix}': precoPixStr,
    '{{precoPix}}': precoPixStr,
    '{{preco_pix}}': precoPixStr,

    // Preço Cartão
    '{precoCartao}': precoCartaoStr,
    '{preco_cartao}': precoCartaoStr,
    '{{precoCartao}}': precoCartaoStr,
    '{{preco_cartao}}': precoCartaoStr,

    // Desconto
    '{desconto}': discountSign || discountText,
    '{descontoPct}': discountSign,
    '{porcentagemDesconto}': discountText,
    '{porcentagem_desconto}': discountText,
    '{{desconto}}': discountSign || discountText,
    '{{porcentagem_desconto}}': discountText,

    // Parcelamento
    '{parcelamento}': parcelamentoGeneral,
    '{parcelas}': parcelamentoGeneral,
    '{{parcelamento}}': parcelamentoGeneral,
    '{{parcelas}}': parcelamentoGeneral,

    // Parcelas sem juros
    '{parcelaSemJuros}': parcelasSemJurosStr,
    '{parcelasSemJuros}': parcelasSemJurosStr,
    '{parcelas_sem_juros}': parcelasSemJurosStr,
    '{{parcela_sem_juros}}': parcelasSemJurosStr,
    '{{parcelas_sem_juros}}': parcelasSemJurosStr,

    // Parcelas com juros
    '{parcelaComJuros}': parcelasComJurosStr,
    '{parcelasComJuros}': parcelasComJurosStr,
    '{parcelas_com_juros}': parcelasComJurosStr,
    '{{parcela_com_juros}}': parcelasComJurosStr,
    '{{parcelas_com_juros}}': parcelasComJurosStr,

    // Frete
    '{frete}': freteStr,
    '{freteGratis}': freteStr,
    '{frete_gratis}': freteStr,
    '{{frete}}': freteStr,
    '{{frete_gratis}}': freteStr,

    // Cupom
    '{cupom}': cupomStr,
    '{cupomDesconto}': cupomStr,
    '{{cupom}}': cupomStr,
    '{{cupom_desconto}}': cupomStr,

    // Link de Afiliado
    '{linkAfiliado}': targetLink,
    '{link}': targetLink,
    '{link_afiliado}': targetLink,
    '{{linkAfiliado}}': targetLink,
    '{{link}}': targetLink,
    '{{link_afiliado}}': targetLink,

    // Plataforma / Loja
    '{plataforma}': storeName,
    '{loja}': storeName,
    '{{plataforma}}': storeName,
    '{{loja}}': storeName,

    // Descrição
    '{descricao}': (product.description || '').slice(0, 200),
    '{{descricao}}': (product.description || '').slice(0, 200),

    // Estrelas e Vendas
    '{estrelas}': starsStr,
    '{{estrelas}}': starsStr,
    '{vendas}': salesStr,
    '{{vendas}}': salesStr,

    // Comissão
    '{comissao}': commAmountStr,
    '{{comissao}}': commAmountStr,
    '{comissaoPct}': commPctStr,
    '{{comissao_pct}}': commPctStr,

    // Tags legadas em maiúsculas:
    '{TITLE}': product.title || '',
    '{PRICE_TO}': precoNovoStr,
    '{PRICE_FROM}': precoAntigoStr,
    '{LINK}': targetLink,
    '{INSTALLMENTS}': parcelamentoGeneral,
    '{COUPON}': cupomStr,
    '{DISCOUNT_PERCENT}': discountText,
  };

  // Substituir variáveis — chaves mais longas primeiro (ex.: {{titulo}} antes de
  // {titulo}), senão a chave simples come o miolo e sobra {valor} com as chaves duplas.
  const orderedKeys = Object.keys(replacements).sort((a, b) => b.length - a.length);
  for (const key of orderedKeys) {
    text = text.replaceAll(key, replacements[key]);
  }

  // Limpar linhas onde variáveis vazias deixaram símbolos órfãos
  text = text
    .split('\n')
    .map((line) => {
      let cleanLine = line.replace(/~~\s*~~/g, '').trim();
      if (cleanLine === 'De  por' || cleanLine === 'De por' || cleanLine === '🎟️' || cleanLine === '💳' || cleanLine === '🚚') {
        return '';
      }
      return cleanLine;
    })
    .filter((line) => line !== '')
    .join('\n');

  // Colapsa "R$ R$" duplicado (quando o template já tem "R$" antes do valor formatado)
  text = text.replace(/R\$\s*R\$/g, 'R$');

  return text;
}
