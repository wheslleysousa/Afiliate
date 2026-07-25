import type { CopyTemplate, ProductData } from '../types';

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

export function applyTemplate(template: string, product: ProductData, affiliateLink: string): string {
  let lines = template
    .replace("{precoAntigo ? `De ~~${precoAntigo}~~ por` : 'Por'}", product.price_from ? `De ~~${product.price_from}~~ por` : 'Por')
    .replace("{precoAntigo ? `De R$ ${precoAntigo} por` : ''}", product.price_from ? `De R$ ${product.price_from} por` : '');

  lines = lines
    .replace(/{titulo}/g, product.title || '')
    .replace(/{preco}/g, product.price_to || '')
    .replace(/{precoAntigo}/g, product.price_from ?? '')
    .replace(/{parcelamento}/g, product.installments ?? '')
    .replace(/{cupom}/g, product.coupon ? `🎟 Cupom: ${product.coupon}` : '')
    .replace(/{frete}/g, product.shipping ?? 'Consulte o frete')
    .replace(/{descricao}/g, product.description ?? '')
    .replace(/{linkAfiliado}/g, affiliateLink || product.original_link || '');

  // Remover linhas que ficaram completamente vazias após substituição
  return lines
    .split('\n')
    .filter((line) => line.trim() !== '')
    .join('\n');
}
