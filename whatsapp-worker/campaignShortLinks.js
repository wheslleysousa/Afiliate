'use strict';
const crypto = require('node:crypto');

// O encurtador do Afiliate resolve /prefix/codigo consultando shortLinks/prefix-codigo.
const slug = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-').slice(0, 32);

function validTarget(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname &&
      !['localhost', '127.0.0.1'].includes(url.hostname);
  } catch { return false; }
}

function replaceProductUrl(copy, originalUrl, shortUrl, otherUrls = []) {
  let text = String(copy || '').trim();
  const originals = [originalUrl, ...otherUrls].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const url of originals) text = text.split(url).join(shortUrl);
  if (!text.includes(shortUrl)) {
    // Templates legados podem ter recebido um endereço diferente do objeto da fila.
    // Um link de produto no final da copy é substituído, nunca enviado em paralelo.
    const links = [...text.matchAll(/https?:\/\/[^\s<>]+/g)];
    const last = links[links.length - 1];
    if (last) text = text.slice(0, last.index) + shortUrl + text.slice(last.index + last[0].length);
    else text += '\n\n🔗 ' + shortUrl;
  }
  return text;
}

async function ensureCampaignShortLink({ db, uid, product, campaign = {}, affiliateLink, domain = 'https://lkrm.site' }) {
  if (!uid || !product?.id || !validTarget(affiliateLink)) {
    throw new Error('Produto ou link de afiliado inválido. Não será enviado link bruto.');
  }
  if (new URL(domain).protocol !== 'https:') throw new Error('Encurtador exige HTTPS.');
  let prefs = {};
  try {
    const settings = await db.collection('users').doc(uid).collection('settings').doc('shortener').get();
    prefs = settings.data() || {};
  } catch (err) {
    // Falha de rede/Firestore não deve criar um link com configuração potencialmente errada.
    throw new Error('Preferências do encurtador indisponíveis: ' + (err.message || err));
  }
  const style = campaign.shortStyle && campaign.shortStyle !== 'default' ? campaign.shortStyle : (prefs.shortStyle || 'custom_random');
  const prefix = slug(campaign.customShortSlug || prefs.defaultCustomPrefix || 'oferta') || 'oferta';
  const digest = crypto.createHash('sha256')
    .update(uid + '\0' + product.id + '\0' + affiliateLink).digest('hex').slice(0, 14);
  // Um slug igual para todos os produtos (custom_only) colidiria; mantemos um código por produto.
  const path = style === 'random' ? 'af' + digest : prefix + '/' + digest;
  const docId = path.replace(/\//g, '-');
  const shortUrl = domain.replace(/\/+$/, '') + '/' + path;
  const ref = db.collection('shortLinks').doc(docId);
  const payload = {
    targetUrl: affiliateLink, originalUrl: product.original_link || affiliateLink,
    title: product.title || 'Produto', platform: product.platform || '',
    fullUrl: shortUrl, docId, ownerUid: uid, userId: uid, createdBy: uid,
    createdAt: new Date().toISOString(),
  };
  try {
    await ref.create(payload); // criação atômica; nunca sobrescreve o destino de outro produto
  } catch (err) {
    const existing = await ref.get();
    const stored = existing.exists ? existing.data() : null;
    if (!stored || stored.ownerUid !== uid || stored.targetUrl !== affiliateLink) {
      throw new Error('Falha ao registrar link curto sem colisão: ' + (err.message || err));
    }
  }
  return { shortUrl, docId, targetUrl: affiliateLink };
}
module.exports = { ensureCampaignShortLink, replaceProductUrl, validTarget, slug };
