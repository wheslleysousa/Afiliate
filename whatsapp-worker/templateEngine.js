'use strict';

/**
 * Template simples compatível com a configuração de campanhas do Afiliate.
 * Nunca avalia JavaScript de templates; só substitui variáveis conhecidas.
 */
const BUILTIN_TEMPLATES = {
  'whatsapp-urgency': `🔥 *OFERTA IMPERDÍVEL!*

*{titulo}*

{precoAntigo}
⚡ *Por {preco}*
{parcelamento}
{cupom}
{frete}

🔗 Garanta agora 👇
{linkAfiliado}`,
  'whatsapp-direct': `✅ *{titulo}*

{precoAntigo}
💰 *{preco}*
{parcelamento}
{cupom}
{frete}

🛒 Compre aqui: {linkAfiliado}`,
  'whatsapp-review': `⭐ *{titulo}*

{estrelas}
{vendas}

💰 *{preco}*
{parcelamento}
{cupom}

👉 {linkAfiliado}`,
  'whatsapp-pix-focus': `💸 *OFERTA PARA PAGAR NO PIX*

*{titulo}*

{precoAntigo}
⚡ *PIX: {precoPix}* {desconto}

{parcelamento}
{cupom}
{frete}

🛒 {linkAfiliado}`,
  'grupo-ofertas': `💥 *ACHADO DO DIA!*

*{titulo}*

✅ Preço: *{preco}*
{parcelamento}
{cupom}
{frete}

🔗 {linkAfiliado}`,
  'minimalista': `*{titulo}*
💰 *{preco}*
{parcelamento}
{cupom}
{linkAfiliado}`
};

function formattedPrice(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  return /^R\$/i.test(raw) ? raw : 'R$ ' + raw;
}

function renderTemplate(template, product, affiliateLink) {
  if (typeof template !== 'string' || !template.trim()) return null;
  const link = affiliateLink || product.affiliate_link || product.original_link || '';
  if (!/^https?:\/\//i.test(link)) return null;
  const pct = Number.parseFloat(String(product.discount_pct || '').replace(',', '.'));
  const vars = {
    titulo: product.title || '',
    produto: product.title || '',
    nome: product.title || '',
    descricao: String(product.description || '').slice(0, 250),
    preco: formattedPrice(product.price_to),
    precoNovo: formattedPrice(product.price_to),
    precoAtual: formattedPrice(product.price_to),
    precoAntigo: product.price_from ? '❌ De: ~' + formattedPrice(product.price_from) + '~' : '',
    precoPix: formattedPrice(product.pix_price || product.price_to),
    precoCartao: formattedPrice(product.card_price || product.price_to),
    parcelamento: product.installments || '',
    parcelas: product.installments || '',
    cupom: product.coupon_text || product.coupon ? '🎟️ Cupom: ' + (product.coupon_text || product.coupon) : '',
    codigo: product.coupon_text || product.coupon || '',
    frete: product.free_shipping ? '🚚 Frete grátis' : '',
    estrelas: product.stars ? '⭐ ' + product.stars : '',
    vendas: product.sales_count ? '📦 ' + product.sales_count + ' vendas' : '',
    desconto: Number.isFinite(pct) && pct > 0 ? pct + '% OFF' : '',
    linkAfiliado: link,
    link: link,
    plataforma: product.platform || '',
    loja: product.platform || ''
  };
  // Ordem não importa: duas e uma chaves são reconhecidas isoladamente.
  let output = template.replace(/\{\{?([a-zA-Z_]+)\}?\}/g, (whole, key) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key]) : whole);
  // Templates com variáveis/expressões desconhecidas não podem ser enviados
  // literalmente; chamar o fallback padrão nesses casos.
  if (/\{[a-zA-Z_][^}]*\}/.test(output)) return null;
  output = output.split('\n').map(line => line.trim()).filter((line, index, array) =>
    line !== '' || (index > 0 && array[index - 1] !== '')
  ).join('\n').trim();
  return output.length >= 8 && output.includes(link) ? output : null;
}

// Aceita tanto "1.299,90" quanto "1299.90" ou "R$ 1.299,90".
function parseProductPrice(value) {
  const raw = String(value || '').replace(/[^\d,.]/g, '');
  if (!raw) return NaN;
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  const decimalPos = Math.max(lastComma, lastDot);
  if (decimalPos < 0) return Number(raw);
  const decimals = raw.length - decimalPos - 1;
  // Um separador com 3 dígitos finais indica milhares; com 1-2, centavos.
  const decimal = decimals >= 1 && decimals <= 2;
  const whole = (decimal ? raw.slice(0, decimalPos) : raw).replace(/[^\d]/g, '');
  const cents = decimal ? raw.slice(decimalPos + 1).replace(/[^\d]/g, '') : '';
  const num = Number(whole + (decimal ? '.' + cents : ''));
  return Number.isFinite(num) ? num : NaN;
}

module.exports = { BUILTIN_TEMPLATES, formattedPrice, renderTemplate, parseProductPrice };
