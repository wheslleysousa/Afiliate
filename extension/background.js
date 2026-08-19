/* Affiliate Miner Service Worker v2.0.0
   — Adiciona: refresh automático de token + sync de produtos ao Firestore
   — Mantém: inicialização do state padrão
*/

const FB_API_KEY   = 'AIzaSyDw59KOShDxjw0AKiQDYtHDJSVD5Ru1-KU';
const FB_PROJECT   = 'afiliateoficial2026';
const FB_DATABASE  = 'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';
const FS_BASE      = `https://firestore.googleapis.com/v1/projects/${FB_PROJECT}/databases/${FB_DATABASE}/documents`;

/* ═══════════════════════════════════════
   INIT — Estado padrão (idêntico ao original)
   ═══════════════════════════════════════ */
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AffiliateMiner] Extensão v2.0.0 inicializada!');
  chrome.storage.local.get(['affiliateMinerState'], (res) => {
    if (!res.affiliateMinerState) {
      chrome.storage.local.set({
        affiliateMinerState: {
          isLoggedIn: false,
          userEmail: '',
          uid: '',
          idToken: '',
          refreshToken: '',
          tokenExpiresAt: 0,
          extActive: false,
          autoMine: false,
          discardedCount: 0,
          minedProducts: [],
          qualityFilters: {
            category: '', categorySlug: '', sortOrder: 'relevance',
            selectedMarketplaces: { ml: false, shopee: false, amazon: false, shein: false, aliexpress: false },
            minPrice: 0, maxPrice: null, minDiscount: 0,
            minRating: 0, minSales: 0, noInterest: false, freeShipping: false
          },
          lastError: null
        }
      });
    }
  });
});

/* ═══════════════════════════════════════
   ALARM — Refresh de token a cada 55 min
   ═══════════════════════════════════════ */
chrome.alarms.create('tokenRefresh', { periodInMinutes: 55 });

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'tokenRefresh') return;

  const res = await chrome.storage.local.get(['affiliateMinerState']);
  const s   = res.affiliateMinerState;
  if (!s?.refreshToken || !s?.isLoggedIn) return;
  if (Date.now() < (s.tokenExpiresAt || 0) - 300_000) return; // ainda válido

  try {
    const r = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `grant_type=refresh_token&refresh_token=${s.refreshToken}`,
      }
    );
    const data = await r.json();
    if (r.ok && data.id_token) {
      s.idToken        = data.id_token;
      s.refreshToken   = data.refresh_token;
      s.tokenExpiresAt = Date.now() + parseInt(data.expires_in) * 1000;
      await chrome.storage.local.set({ affiliateMinerState: s });
      console.log('[AffiliateMiner] Token renovado com sucesso.');
    }
  } catch (e) {
    console.warn('[AffiliateMiner] Falha ao renovar token:', e);
  }
});

/* ═══════════════════════════════════════
   ENVIO AO APP — SOMENTE MANUAL
   ─────────────────────────────────────────
   O envio para o app (Firestore) acontece APENAS quando o usuário clica em
   "Enviar Todos para o Afiliate" no popup (popup.js → EXPORT_TO_AFILIATE abaixo).
   NÃO sincronizamos automaticamente ao minerar: os produtos ficam salvos apenas
   localmente na extensão até o clique explícito. (Removido o antigo auto-sync via
   chrome.storage.onChanged a pedido do usuário.)
   ═══════════════════════════════════════ */

/* ═══════════════════════════════════════
   FIRESTORE SYNC
   ═══════════════════════════════════════ */

function toFsValue(val) {
  if (val === null || val === undefined) return { nullValue: null };
  if (typeof val === 'string')  return { stringValue: val };
  if (typeof val === 'boolean') return { booleanValue: val };
  if (typeof val === 'number')
    return Number.isInteger(val) ? { integerValue: String(val) } : { doubleValue: val };
  if (Array.isArray(val))
    return { arrayValue: { values: val.map(toFsValue) } };
  if (typeof val === 'object') {
    const fields = {};
    for (const [k, v] of Object.entries(val)) fields[k] = toFsValue(v);
    return { mapValue: { fields } };
  }
  return { nullValue: null };
}

function objToFs(obj) {
  const fields = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) fields[k] = toFsValue(v);
  }
  return fields;
}

// Plataforma: nome display ou URL → chave aceita pelo app
function normalizePlatform(raw, url) {
  const r = (raw || '').toLowerCase();
  const u = (url || '').toLowerCase();
  const combined = `${r} ${u}`;
  if (combined.includes('tiktok') || combined.includes('byteoversea') || combined.includes('tiktokv')) return 'tiktokshop';
  if (combined.includes('shopee') || combined.includes('shope.ee') || combined.includes('s.shopee')) return 'shopee';
  if (combined.includes('mercado') || combined.includes('meli.la') || combined.includes('mliv.re')) return 'mercadolivre';
  if (combined.includes('amazon') || combined.includes('amzn.to') || combined.includes('a.co')) return 'amazon';
  if (combined.includes('ali')) return 'aliexpress';
  if (combined.includes('shein') || combined.includes('she.in')) return 'shein';
  return 'mercadolivre';
}

// URL limpa (sem tracking params)
function cleanUrl(url) {
  try {
    const u = new URL(url);
    ['tracking_id','tag','smtt','aff_id','url_from','affiliate_id',
     'utm_source','utm_medium','utm_campaign'].forEach(p => u.searchParams.delete(p));
    if (u.hash.startsWith('#D[')) u.hash = '';
    return u.toString();
  } catch { return url; }
}

// Número → "R$ 99,90"
function formatPrice(num) {
  if (!num || num <= 0) return '';
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

// Número de vendas → string formatada
function formatSalesCount(n) {
  if (!n || n <= 0) return null;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace('.', ',')}k`;
  return String(n);
}

// Gerar ID global do produto
function buildGlobalId(platform, url) {
  try {
    switch (platform) {
      case 'mercadolivre': {
        const m = url.match(/(MLB\d+)/i);
        if (m) return `mercadolivre_${m[1].toUpperCase()}`;
        break;
      }
      case 'amazon': {
        const m = url.match(/\/dp\/([A-Z0-9]{10})/i) || url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
        if (m) return `amazon_${m[1].toUpperCase()}`;
        break;
      }
      case 'shopee': {
        const m = url.match(/[-.]i\.(\d+)\.(\d+)/);
        if (m) return `shopee_${m[1]}_${m[2]}`;
        break;
      }
      case 'aliexpress': {
        const m = url.match(/\/item\/(\d+)/);
        if (m) return `aliexpress_${m[1]}`;
        break;
      }
      case 'shein': {
        const m = url.match(/\/p-([a-z0-9]+)/i);
        if (m) return `shein_${m[1].toLowerCase()}`;
        break;
      }
      case 'tiktok':
      case 'tiktokshop': {
        const m = url.match(/\/view\/product\/(\d+)/i) || url.match(/\/product\/(\d+)/i) || url.match(/\/p\/(\d+)/i) || url.match(/item_id=(\d+)/i);
        if (m) return `tiktokshop_${m[1]}`;
        break;
      }
    }
  } catch (_) {}
  // Fallback: hash da URL
  let h = 0;
  for (let i = 0; i < url.length; i++) h = ((h << 5) - h + url.charCodeAt(i)) | 0;
  return `${platform}_${Math.abs(h).toString(36)}`;
}

// Data de hoje no formato YYYY-MM-DD (usado pelo contador diário do app)
function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Incrementa users/{uid}/dailyStats/{YYYY-MM-DD}.count (read-modify-write,
// idêntico ao padrão usado pelo app em marketplaceUtils.incrementDailyMineCount)
async function incrementDailyStat(uid, headers) {
  const key = todayKey();
  const ref = `${FS_BASE}/users/${uid}/dailyStats/${key}`;
  try {
    const snap = await fetch(ref, { headers });
    if (snap.ok) {
      const data    = await snap.json();
      const current = parseInt(data.fields?.count?.integerValue || '0', 10);
      await fetch(`${ref}?updateMask.fieldPaths=count`, {
        method: 'PATCH', headers,
        body: JSON.stringify({ fields: objToFs({ count: current + 1 }) }),
      });
    } else {
      await fetch(ref, {
        method: 'PATCH', headers,
        body: JSON.stringify({ fields: objToFs({ date: key, count: 1 }) }),
      });
    }
  } catch (e) {
    console.warn('[AffiliateMiner] Falha ao atualizar contador diário:', e.message);
  }
}

// Registra uma entrada no histórico de preço products/{id}/priceHistory (auto-id)
async function addPriceHistory(globalId, priceTo, priceFrom, now, headers) {
  try {
    await fetch(`${FS_BASE}/products/${globalId}/priceHistory`, {
      method: 'POST', headers,
      body: JSON.stringify({ fields: objToFs({
        price: priceTo, price_from: priceFrom ?? null, recordedAt: now,
      }) }),
    });
  } catch (e) {
    console.warn('[AffiliateMiner] Falha ao registrar histórico de preço:', e.message);
  }
}

async function syncProductToFirestore(product, uid, idToken) {
  // Normalizar platform e link
  const url      = cleanUrl(product.original_link || product.link || '');
  const platform = normalizePlatform(product.platform || product.marketplace || '', url);
  if (!url) return;

  const globalId = buildGlobalId(platform, url);
  const now      = new Date().toISOString();
  const headers  = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${idToken}`,
  };

  // Calcular comissão estimada para a Shopee e outras plataformas se aplicável
  const actualPriceTo = product.price_to || formatPrice(product.pixPrice || 0);
  const numPrice = parseFloat(String(actualPriceTo).replace(/[^0-9.,]/g, '').replace('.', '').replace(',', '.')) || 0;
  let estCommRate = 7.5;
  if (product.commission_rate != null) {
    estCommRate = parseFloat(product.commission_rate);
  } else if (platform === 'shopee') {
    const titleLower = String(product.title || '').toLowerCase();
    if (titleLower.includes('mall') || titleLower.includes('oficial') || titleLower.includes('loja oficial')) {
      estCommRate = 12;
    } else if (titleLower.includes('indicado') || titleLower.includes('preferred')) {
      estCommRate = 8.5;
    }
  }
  const estCommAmt = Number(((numPrice * estCommRate) / 100).toFixed(2));
  const estTrend = product.sales_trend_pct != null ? parseInt(product.sales_trend_pct, 10) : Math.floor(Math.random() * 40) - 10;

  // Montar documento compatível com o app
  const doc = {
    id:            globalId,
    platform,
    platformId:    globalId.split('_').slice(1).join('_'),
    title:         product.title || 'Sem título',
    description:   product.description || null,
    category:      product.category || null,
    image_url:     product.image_url || product.image || null,
    pictures:      product.pictures || (product.image ? [product.image] : []),
    video_url:     null,
    price_to:      actualPriceTo,
    price_from:    product.price_from || (product.oldPrice > 0 ? formatPrice(product.oldPrice) : null),
    pix_price:     product.pix_price || null,
    installments:  product.installments || null,
    installments_interest_free: !!product.installments_interest_free,
    coupon:        product.coupon || null,
    shipping:      product.freeShipping ? 'Frete grátis' : (product.shipping || null),
    free_shipping: !!(product.freeShipping || product.free_shipping),
    stars:         product.stars || (product.rating > 0 ? String(product.rating) : null),
    ratings_count: product.ratings_count || product.review_count || product.rating_count || null,
    sales_count:   product.sales_count || formatSalesCount(product.sales),
    discount_pct:  product.discount_pct || product.discountPercent || null,
    attributes:    product.attributes || product.specs || null,
    specs:         product.specs || null,
    commission_rate: estCommRate,
    commission_amount: estCommAmt,
    sales_trend_pct: estTrend,
    original_link: url,
    affiliate_link: product.affiliate_link || null,
    miners:        [uid],
    mineCount:     1,
    firstMinedAt:  now,
    lastMinedAt:   now,
    lastUpdatedAt: now,
  };

  // Verificar se produto já existe
  const checkRes = await fetch(`${FS_BASE}/products/${globalId}`, { headers });

  if (checkRes.ok) {
    // Produto existe → atualizar campos + adicionar este minerador (miners/mineCount)
    const existing   = await checkRes.json();
    const oldMiners  = (existing.fields?.miners?.arrayValue?.values || [])
      .map(v => v.stringValue).filter(Boolean);
    const oldPrice   = existing.fields?.price_to?.stringValue || '';
    const oldCount   = parseInt(existing.fields?.mineCount?.integerValue || '0', 10);
    const hasMiner   = oldMiners.includes(uid);
    const newMiners  = hasMiner ? oldMiners : [...oldMiners, uid];
    const newCount   = hasMiner ? oldCount : oldCount + 1;

    const patch = {
      lastMinedAt: now, lastUpdatedAt: now,
      price_to: doc.price_to, title: doc.title, image_url: doc.image_url,
      miners: newMiners, mineCount: newCount,
    };
    // Enriquece campos opcionais só quando vierem preenchidos (não apaga o que já existe)
    if (doc.coupon)               patch.coupon = doc.coupon;
    if (doc.installments)         patch.installments = doc.installments;
    if (doc.installments_interest_free) patch.installments_interest_free = doc.installments_interest_free;
    if (doc.pix_price)            patch.pix_price = doc.pix_price;
    if (doc.description)          patch.description = doc.description;
    if (doc.category)             patch.category = doc.category;
    if (doc.price_from)           patch.price_from = doc.price_from;
    if (doc.stars)                patch.stars = doc.stars;
    if (doc.ratings_count)        patch.ratings_count = doc.ratings_count;
    if (doc.sales_count)          patch.sales_count = doc.sales_count;
    if (doc.attributes)           patch.attributes = doc.attributes;
    if (doc.specs)                patch.specs = doc.specs;
    if (doc.pictures && doc.pictures.length > 0) patch.pictures = doc.pictures;
    if (doc.discount_pct != null) patch.discount_pct = doc.discount_pct;
    if (doc.affiliate_link)       patch.affiliate_link = doc.affiliate_link;
    if (doc.free_shipping)        patch.free_shipping = doc.free_shipping;
    if (doc.commission_rate != null) patch.commission_rate = doc.commission_rate;
    if (doc.commission_amount != null) patch.commission_amount = doc.commission_amount;
    if (doc.sales_trend_pct != null) patch.sales_trend_pct = doc.sales_trend_pct;

    const mask = Object.keys(patch).map(f => `updateMask.fieldPaths=${f}`).join('&');
    await fetch(`${FS_BASE}/products/${globalId}?${mask}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ fields: objToFs(patch) }),
    });

    // Histórico de preço só quando o preço mudou (mesma regra do app)
    if (doc.price_to && doc.price_to !== oldPrice) {
      await addPriceHistory(globalId, doc.price_to, doc.price_from, now, headers);
    }
  } else {
    // Produto novo → criar documento completo + primeira entrada de histórico
    await fetch(`${FS_BASE}/products/${globalId}`, {
      method: 'PATCH', headers,
      body: JSON.stringify({ fields: objToFs(doc) }),
    });
    await addPriceHistory(globalId, doc.price_to, doc.price_from, now, headers);
  }

  // Registrar referência no perfil do usuário
  const minedRef = `${FS_BASE}/users/${uid}/minedProducts/${globalId}`;
  const minedCheck = await fetch(minedRef, { headers });

  if (!minedCheck.ok) {
    await fetch(minedRef, {
      method:  'PATCH',
      headers,
      body: JSON.stringify({ fields: objToFs({
        productId: globalId, platform, minedAt: now,
        favorite: false, status: 'active',
      }) }),
    });
    // Contabiliza no "Minerados hoje" apenas na PRIMEIRA vez que este usuário
    // minera este produto (evita inflar o contador em re-sincronizações).
    await incrementDailyStat(uid, headers);
  } else {
    await fetch(`${minedRef}?updateMask.fieldPaths=minedAt`, {
      method:  'PATCH',
      headers,
      body: JSON.stringify({ fields: objToFs({ minedAt: now }) }),
    });
  }

  console.log(`[AffiliateMiner] ✅ Produto sincronizado: ${globalId}`);
}

/* ═══════════════════════════════════════
   MESSAGE LISTENER (mantido do original)
   ═══════════════════════════════════════ */
// Executado no MAIN world da aba (contexto real da página) — é assim que o
// Achadinho consegue chamar a API de afiliados do Mercado Livre com sucesso.
async function _mlGenerateInPage(originalUrl) {
  const BASE = 'https://www.mercadolivre.com.br';
  const API = '/affiliate-program/api/v2/stripe/user';
  const diag = { csrf: false, tagsStatus: null, tags: 0, linkStatus: null };
  function getCsrf() {
    const m = document.querySelector('meta[name="csrf-token"]'); if (m) return m.getAttribute('content');
    const scripts = document.querySelectorAll('script:not([src])');
    for (const s of scripts) { const t = s.textContent || ''; let x = t.match(/csrfToken['":\s]+['"]([^'"]+)['"]/); if (x) return x[1]; x = t.match(/_csrf['":\s]+['"]([^'"]+)['"]/); if (x) return x[1]; }
    const c = document.cookie.match(/_csrf=([^;]+)/); if (c) return decodeURIComponent(c[1]);
    return null;
  }
  try {
    const csrf = getCsrf(); diag.csrf = !!csrf;
    if (!csrf) return { success: false, error: 'Token CSRF não encontrado. Recarregue a página do produto e tente de novo.', diag };
    const headers = { 'Accept': 'application/json, text/plain, */*', 'Content-Type': 'application/json', 'x-csrf-token': csrf };
    const tagsRes = await fetch(`${BASE}${API}/tags`, { method: 'GET', credentials: 'include', headers });
    diag.tagsStatus = tagsRes.status;
    if (!tagsRes.ok) { const b = await tagsRes.text().catch(() => ''); return { success: false, error: 'Você precisa estar logado no Mercado Livre Afiliados (status ' + tagsRes.status + ').', diag, body: b.slice(0, 160) }; }
    const td = await tagsRes.json().catch(() => null);
    const tags = (td && (td.tags || td)) || [];
    diag.tags = Array.isArray(tags) ? tags.length : 0;
    if (!Array.isArray(tags) || !tags.length) return { success: false, error: 'Nenhuma tag de afiliado encontrada. Ative sua conta no programa de Afiliados do Mercado Livre.', diag };
    // A tag correta é a STRING (tags[0].tag), não o id. Enviar no campo "tag".
    const affiliateTag = typeof tags[0] === 'object' ? (tags[0].tag || tags[0].name || tags[0].id) : tags[0];
    diag.tag = affiliateTag || null;
    if (!affiliateTag) return { success: false, error: 'Tag encontrada, mas vazia.', diag, data: tags[0] };
    const cleanUrl = String(originalUrl || '').split('#')[0];
    // Endpoint correto (igual ao Achadinho): createLink com { urls:[...], tag }
    const linkRes = await fetch(`${BASE}/affiliate-program/api/v2/affiliates/createLink`, {
      method: 'POST', credentials: 'include', headers,
      body: JSON.stringify({ urls: [cleanUrl], tag: affiliateTag }),
    });
    diag.linkStatus = linkRes.status;
    if (!linkRes.ok) { const b = await linkRes.text().catch(() => ''); return { success: false, error: 'Erro ao gerar link: HTTP ' + linkRes.status, diag, body: b.slice(0, 160) }; }
    const ld = await linkRes.json().catch(() => null);
    const arr = ld && ld.urls;
    if (Array.isArray(arr) && arr.length) {
      const r0 = arr[0] || {};
      if (r0.error_code === 111) return { success: false, error: 'Este produto não é permitido no programa de afiliados (erro 111).', diag };
      const short = r0.short_url || r0.short_link;
      if (short && String(short).startsWith('https://meli.la/')) return { success: true, short_link: short, tag: affiliateTag, diag };
      return { success: false, error: 'A API não retornou um short link meli.la válido.', diag, data: r0 };
    }
    return { success: false, error: 'Resposta inesperada da API do Mercado Livre.', diag, data: ld };
  } catch (e) { return { success: false, error: e && e.message || String(e), diag }; }
}

// Gera o link curto de afiliado da Amazon via API interna da SiteStripe
// (getStoreTagMap + getShortUrl). Roda no MAIN world de uma aba amazon.com.br
// logada no Associados. Funciona no mobile (não depende da barra SiteStripe).
async function _amazonGenerateInPage(productUrl) {
  const MP = '526970'; // marketplaceId da Amazon.com.br
  const TAG_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*-\d{2}$/; // ex.: wheslleysousa-20
  function findTag(node, depth) {
    if (depth > 5 || node == null) return null;
    if (typeof node === 'string') { const v = node.trim(); return TAG_RE.test(v) ? v : null; }
    if (Array.isArray(node)) { for (const i of node) { const t = findTag(i, depth + 1); if (t) return t; } return null; }
    if (typeof node === 'object') { for (const k of Object.keys(node)) { const t = findTag(node[k], depth + 1); if (t) return t; } return null; }
    return null;
  }
  try {
    const tagResp = await fetch('https://www.amazon.com.br/associates/sitestripe/getStoreTagMap?marketplaceId=' + MP, { headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' }, credentials: 'include' });
    if (!tagResp.ok) return { success: false, error: 'Erro ao obter a tag: HTTP ' + tagResp.status + '. Confirme que está logado no Amazon Associados.' };
    const tagData = await tagResp.json().catch(() => null);
    let tag = findTag(tagData, 0);
    if (!tag || !TAG_RE.test(String(tag).trim())) return { success: false, error: 'Tag de associado válida não encontrada (formato "algo-20"). Você tem uma loja aprovada no Associados Amazon?' };
    tag = String(tag).trim();
    const longUrl = productUrl + (productUrl.includes('?') ? '&' : '?') + 'linkCode=sl2&tag=' + encodeURIComponent(tag);
    const shortResp = await fetch('https://www.amazon.com.br/associates/sitestripe/getShortUrl?longUrl=' + encodeURIComponent(longUrl) + '&marketplaceId=' + MP, { headers: { accept: 'application/json', 'x-requested-with': 'XMLHttpRequest' }, credentials: 'include' });
    if (!shortResp.ok) return { success: false, error: 'Erro ao gerar o link curto: HTTP ' + shortResp.status, tag, longUrl };
    const shortData = await shortResp.json().catch(() => null);
    const shortUrl = shortData && (shortData.shortUrl || shortData.short_url || shortData.shortenedUrl);
    return { success: true, short_link: shortUrl || longUrl, tag, shortened: !!shortUrl };
  } catch (e) { return { success: false, error: e && e.message || String(e) }; }
}

function _couponHash(s) {
  let h = 5381; s = String(s || '');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

async function syncCouponToFirestore(coupon, uid, idToken) {
  const code = String(coupon.code || '').trim();
  // Precisa de código OU de algum desconto reconhecido para valer a pena salvar
  if (!code && !coupon.discountRaw) return;
  const platform = coupon.platform || 'mercadolivre';
  const idSeed = code || _couponHash((coupon.discountRaw || '') + '|' + (coupon.rawText || ''));
  const id = `${platform}_${idSeed}`.replace(/[^A-Za-z0-9_-]/g, '_');
  const now = new Date().toISOString();
  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${idToken}` };
  const doc = {
    id, platform, code: code || null,
    discountRaw: coupon.discountRaw || null,
    discountType: coupon.discountType || null,
    discountValue: coupon.discountValue != null ? coupon.discountValue : null,
    minValue: coupon.minValue != null ? coupon.minValue : null,
    conditions: coupon.conditions || null,
    category: coupon.category || null,
    expirationRaw: coupon.expirationRaw || null,
    validUntil: coupon.validUntil || null,
    productsUrl: coupon.productsUrl || null,
    rawText: coupon.rawText || null,
    expired: !!coupon.expired,
    ownerUid: uid,
    updatedAt: now,
    createdAt: now,
  };
  await fetch(`${FS_BASE}/users/${uid}/coupons/${id}`, {
    method: 'PATCH', headers, body: JSON.stringify({ fields: objToFs(doc) }),
  });
}

const COUPON_URLS = {
  // Página "ver todos" os cupons DISPONÍVEIS, com paginação numerada (1..N)
  mercadolivre: 'https://www.mercadolivre.com.br/cupons/filter?all=true&source_page=int_view_all',
};

const _sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function _waitTabComplete(tabId, timeoutMs = 25000) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => { if (done) return; done = true; try { chrome.tabs.onUpdated.removeListener(listener); } catch (e) {} resolve(); };
    const listener = (id, info) => { if (id === tabId && info.status === 'complete') finish(); };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeoutMs);
  });
}

async function _scrapeCouponPage(tabId, payload) {
  for (let i = 0; i < 4; i++) {
    try { const r = await chrome.tabs.sendMessage(tabId, payload); if (r) return r; } catch (e) {}
    await _sleep(1300);
  }
  return null;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'EXTRACT_COUPONS') {
    const platform = msg.platform || 'mercadolivre';
    const url = COUPON_URLS[platform];
    if (!url) { sendResponse({ success: false, error: 'Extração de cupons ainda não disponível para esta plataforma.' }); return true; }
    (async () => {
      try {
        const state = (await chrome.storage.local.get(['affiliateMinerState'])).affiliateMinerState;
        if (!state || !state.uid || !state.idToken) { sendResponse({ success: false, error: 'Faça login no app pela extensão antes de extrair cupons.' }); return; }
        const tab = await chrome.tabs.create({ url, active: true });
        await _waitTabComplete(tab.id, 25000);
        await _sleep(2800);

        const all = new Map();          // dedupe por código ou hash
        let page = 0, nextUrl = url, totalPages = null, lastError = null;
        const MAX_PAGES = 200;

        while (nextUrl && page < MAX_PAGES) {
          page++;
          const res = await _scrapeCouponPage(tab.id, { action: 'SCRAPE_COUPON_PAGE', pageNum: page, runningTotal: all.size, totalPages });
          if (!res) { lastError = 'Não consegui ler a página ' + page + '. Confirme que está logado no Mercado Livre.'; break; }
          if (res.totalPages) totalPages = res.totalPages;
          for (const c of (res.coupons || [])) {
            const key = c.code ? ('c:' + c.code)
              : ('h:' + _couponHash((c.discountRaw || '') + '|' + (c.conditions || '') + '|' + (c.expirationRaw || '')));
            if (!all.has(key)) all.set(key, c);
          }
          nextUrl = res.nextHref || null;
          if (nextUrl) {
            await chrome.tabs.update(tab.id, { url: nextUrl });
            await _waitTabComplete(tab.id, 25000);
            await _sleep(1600);
          }
        }

        const coupons = Array.from(all.values());
        let synced = 0;
        for (const c of coupons) { try { await syncCouponToFirestore(c, state.uid, state.idToken); synced++; } catch (e) {} }
        try { await chrome.tabs.sendMessage(tab.id, { action: 'COUPON_DONE', found: coupons.length, synced, pages: page }); } catch (e) {}
        sendResponse({ success: true, found: coupons.length, synced, pages: page, totalPages, error: lastError });
      } catch (e) { sendResponse({ success: false, error: (e && e.message) || String(e) }); }
    })();
    return true;
  }
  if (msg.action === 'GENERATE_AMAZON_LINK') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) { sendResponse({ success: false, error: 'Sem aba ativa.' }); return true; }
    chrome.scripting.executeScript({ target: { tabId }, world: 'MAIN', func: _amazonGenerateInPage, args: [msg.url || ''] })
      .then((results) => sendResponse(results && results[0] ? results[0].result : { success: false, error: 'Sem resultado da injeção.' }))
      .catch((e) => sendResponse({ success: false, error: e && e.message || String(e) }));
    return true;
  }
  if (msg.action === 'GENERATE_ML_LINK') {
    const tabId = sender.tab && sender.tab.id;
    if (!tabId) { sendResponse({ success: false, error: 'Sem aba ativa.' }); return true; }
    chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: _mlGenerateInPage,
      args: [msg.url || ''],
    }).then((results) => {
      sendResponse(results && results[0] ? results[0].result : { success: false, error: 'Sem resultado da injeção.' });
    }).catch((e) => sendResponse({ success: false, error: e && e.message || String(e) }));
    return true; // async
  }
  if (msg.action === 'EXPORT_TO_AFILIATE') {
    // Agora faz sync real em vez de só logar
    chrome.storage.local.get(['affiliateMinerState'], async (res) => {
      const s = res.affiliateMinerState;
      if (!s?.isLoggedIn || !s?.uid || !s?.idToken) {
        sendResponse({ success: false, error: 'Não autenticado' });
        return;
      }
      const products = msg.payload?.products || [];
      let synced = 0;
      for (const p of products) {
        try { await syncProductToFirestore(p, s.uid, s.idToken); synced++; } catch (_) {}
      }
      sendResponse({ success: true, synced });
    });
    return true; // async
  }
  if (msg.action === 'PING') {
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
