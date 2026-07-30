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
  let text = template;

  // Calcular % de desconto se não vier do produto
  const discountPct = product.discount_pct ??
    (() => {
      try {
        const from = parseFloat((product.price_from || '').replace(/[R$\s.]/g, '').replace(',', '.'));
        const to   = parseFloat((product.price_to  || '').replace(/[R$\s.]/g, '').replace(',', '.'));
        if (from > 0 && to > 0 && from > to) return Math.round((1 - to / from) * 100);
      } catch { /**/ }
      return null;
    })();

  // Calcular comissão
  const comm = calculateCommission(
    product.price_to,
    product.platform,
    product,
    null,
    null,
    commissionRates
  );

  const replacements: Record<string, string> = {
    '{titulo}':        product.title || '',
    '{preco}':         product.price_to || '',
    '{precoPix}':      product.pix_price || product.price_to || '',
    '{precoCartao}':   product.price_to || '',
    '{precoAntigo}':   product.price_from || '',
    '{desconto}':      discountPct ? `-${discountPct}%` : '',
    '{parcelamento}':  product.installments || '',
    '{cupom}':         product.coupon ? `🎟 Cupom: ${product.coupon}` : (product.coupon_text ? `🎟 Cupom: ${product.coupon_text}` : ''),
    '{frete}':         product.free_shipping ? '🚚 Frete GRÁTIS' : (product.shipping || 'Frete a calcular'),
    '{descricao}':     (product.description || '').slice(0, 200),
    '{linkAfiliado}':  affiliateLink || product.original_link || '',
    '{plataforma}':    product.platform || '',
    '{estrelas}':      product.stars ? `⭐ ${product.stars}` : '',
    '{vendas}':        product.sales_count ? `📦 ${product.sales_count} vendas` : '',
    '{comissao}':      comm ? `R$ ${comm.amount.toFixed(2).replace('.', ',')}` : 'R$ 0,00',
    '{comissaoPct}':   comm ? `${comm.ratePct}%` : '0%',
  };

  // Substituir variáveis simples
  for (const [key, val] of Object.entries(replacements)) {
    text = text.replaceAll(key, val);
  }

  // Remover linhas vazias geradas por variáveis ausentes
  text = text
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');

  return text;
}
