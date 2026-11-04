'use strict';

/**
 * Conservative media payload factory for WhatsApp channels.
 * A channel-media opt-in must never silently fall back to a text-only post.
 * This validates the URL format, not delivery or the remote image bytes.
 */
function normalizeImageUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || !url.hostname) return null;
    const hostname = url.hostname.toLowerCase();
    if (hostname === 'localhost' || hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      /^(?:127|10|0|169\\.254|192\\.168)\\./.test(hostname) ||
      /^172\\.(?:1[6-9]|2\\d|3[01])\\./.test(hostname) ||
      hostname === '[::1]') return null;
    return url.href;
  } catch { return null; }
}

function getProductImageUrl(product = {}) {
  const candidates = [
    product.image_url, product.imageUrl, product.imageURL,
    product.product_image, product.productImage,
    product.thumbnail, product.thumbnail_url,
    ...(Array.isArray(product.images) ? product.images : []),
  ];
  for (const candidate of candidates) {
    const raw = typeof candidate === 'string' ? candidate :
      candidate && typeof candidate === 'object' ?
        candidate.url || candidate.src || candidate.image_url : null;
    const normalized = normalizeImageUrl(raw);
    if (normalized) return normalized;
  }
  return null;
}

function createDispatchPayload({ imageUrl, copyText, isChannel, channelMediaEnabled }) {
  const text = String(copyText || '');
  const validImageUrl = normalizeImageUrl(imageUrl);
  if (isChannel && channelMediaEnabled) {
    if (!validImageUrl) {
      throw new Error('Imagem HTTPS válida não encontrada. Postagem suspensa, sem fallback silencioso para texto.');
    }
    return { kind: 'image', content: { image: { url: validImageUrl }, caption: text } };
  }
  if (validImageUrl && !isChannel) {
    return { kind: 'image', content: { image: { url: validImageUrl }, caption: text } };
  }
  return { kind: 'text', content: { text } };
}

module.exports = { normalizeImageUrl, getProductImageUrl, createDispatchPayload };
