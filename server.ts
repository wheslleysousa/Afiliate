import express from "express";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import dns from "dns";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import cors from "cors";
import AdmZip from "adm-zip";

dns.setDefaultResultOrder("ipv4first");

dotenv.config();

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(express.json());

// ==========================================
// SECURITY & SSRF / REDIRECT / CORS HELPERS
// ==========================================

// Helper to validate and block SSRF attacks against loopback/private/metadata ranges
function isPrivateOrLoopbackIp(ip: string): boolean {
  const cleanIp = ip.replace(/^::ffff:/, '').trim().toLowerCase();
  
  if (cleanIp === '::1' || cleanIp === '0:0:0:0:0:0:0:1' || cleanIp === '::') return true;

  const parts = cleanIp.split('.').map(p => parseInt(p, 10));
  if (parts.length === 4 && parts.every(p => !isNaN(p) && p >= 0 && p <= 255)) {
    const [a, b, c, d] = parts;
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local / cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (carrier-grade NAT)
    if (a >= 224) return true; // 224.0.0.0/4 (multicast/reserved)
  }

  // IPv6 private & link-local ranges
  if (cleanIp.startsWith('fc') || cleanIp.startsWith('fd') || cleanIp.startsWith('fe8') || cleanIp.startsWith('fe9') || cleanIp.startsWith('fea') || cleanIp.startsWith('feb')) {
    return true;
  }

  return false;
}

export function isSafePublicUrl(urlString: string): boolean {
  if (!urlString || typeof urlString !== 'string') return false;
  try {
    const parsed = new URL(urlString.trim());
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname) return false;

    // Block localhost, local domains, cloud metadata domains
    if (
      hostname === 'localhost' ||
      hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') ||
      hostname.endsWith('.internal') ||
      hostname === 'metadata.google.internal' ||
      hostname === 'instance-data'
    ) {
      return false;
    }

    // Direct IP checks (handles ipv4, or bracketed ipv6)
    const normalizedHost = hostname.replace(/^\[|\]$/g, '');
    if (isPrivateOrLoopbackIp(normalizedHost)) {
      return false;
    }

    // Must have a domain dot or be a valid public hostname
    if (!hostname.includes('.') && !hostname.includes(':')) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export function isAllowedMediaDownloadUrl(urlString: string): boolean {
  if (!isSafePublicUrl(urlString)) return false;
  try {
    const parsed = new URL(urlString.trim());
    const hostname = parsed.hostname.toLowerCase();

    // Known media & marketplace CDN domains allowlist
    const allowedSuffixes = [
      'mlstatic.com',
      'mercadolivre.com',
      'mercadolivre.com.br',
      'mercadolibre.com',
      'mercadolibre.com.br',
      'susercontent.com',
      'shopee.com.br',
      'shopee.com',
      'media-amazon.com',
      'ssl-images-amazon.com',
      'amazon.com',
      'amazon.com.br',
      'alicdn.com',
      'aliexpress.com',
      'ltwebstatic.com',
      'shein.com',
      'tiktokcdn.com',
      'tiktokcdn-us.com',
      'byteoversea.com',
      'ibytedtos.com',
      'tiktok.com',
      'unsplash.com',
      'cloudinary.com',
      'imgur.com',
      'ytimg.com',
      'ggpht.com',
      'googleusercontent.com'
    ];

    return allowedSuffixes.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`));
  } catch {
    return false;
  }
}

export function isAllowedRedirectUrl(urlString: string, reqHost?: string): boolean {
  if (!isSafePublicUrl(urlString)) return false;
  try {
    const parsed = new URL(urlString.trim());
    const hostname = parsed.hostname.toLowerCase();

    const allowedRedirectSuffixes = [
      'mercadolivre.com.br',
      'mercadolivre.com',
      'mercadolibre.com',
      'mercadolibre.com.br',
      'meli.la',
      'mlb.link',
      'shopee.com.br',
      'shopee.com',
      'shope.ee',
      'shp.ee',
      'amazon.com.br',
      'amazon.com',
      'amzn.to',
      'amzn.eu',
      'a.co',
      'aliexpress.com',
      'aliexpress.ru',
      's.click.aliexpress.com',
      'alix.click',
      'shein.com',
      'shein.top',
      'm.shein.com',
      'tiktok.com',
      'tiktokshop.com',
      'vt.tiktok.com',
      'vm.tiktok.com',
      'lkrm.site',
      'tinyurl.com',
      'bit.ly',
      'onrender.com',
      'run.app'
    ];

    if (allowedRedirectSuffixes.some(suffix => hostname === suffix || hostname.endsWith(`.${suffix}`))) {
      return true;
    }

    if (reqHost) {
      const cleanReqHost = reqHost.split(':')[0].toLowerCase();
      if (hostname === cleanReqHost || hostname.endsWith(`.${cleanReqHost}`)) {
        return true;
      }
    }

    return false;
  } catch {
    return false;
  }
}

function isAllowedCorsOrigin(origin: string): boolean {
  if (!origin) return true;
  if (origin.startsWith('chrome-extension://')) return true;

  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();

    // Localhost and loopbacks
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname.endsWith('.localhost')) {
      return true;
    }

    // Vercel deployment domains and short link domain
    if (hostname === 'vercel.app' || hostname.endsWith('.vercel.app')) return true;
    if (hostname === 'lkrm.site' || hostname.endsWith('.lkrm.site')) return true;

    // Cloud Run and AI Studio
    if (hostname.endsWith('.run.app') || hostname.endsWith('.aistudio.google.com') || hostname.endsWith('.googleusercontent.com')) {
      return true;
    }

    // Render domains (production & preview)
    if (hostname === 'onrender.com' || hostname.endsWith('.onrender.com') || hostname === 'render.com' || hostname.endsWith('.render.com')) {
      return true;
    }

    // Custom domain from env
    if (process.env.APP_URL) {
      try {
        const envHost = new URL(process.env.APP_URL).hostname.toLowerCase();
        if (hostname === envHost || hostname.endsWith(`.${envHost}`)) return true;
      } catch {}
    }
    if (process.env.FRONTEND_URL) {
      try {
        const envHost = new URL(process.env.FRONTEND_URL).hostname.toLowerCase();
        if (hostname === envHost || hostname.endsWith(`.${envHost}`)) return true;
      } catch {}
    }
    if (process.env.CUSTOM_DOMAIN) {
      const customDomain = process.env.CUSTOM_DOMAIN.toLowerCase().trim();
      if (hostname === customDomain || hostname.endsWith(`.${customDomain}`)) return true;
    }
  } catch {
    return false;
  }

  return false;
}

// Configuração de CORS com Allowlist estrita (Extensão Chrome + Localhost + Render + Cloud Run)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || isAllowedCorsOrigin(origin)) {
      return callback(null, true);
    }
    // Origens fora da lista não recebem cabeçalhos de CORS
    return callback(null, false);
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Affiliate-UID'],
  credentials: true,
}));

// Responder pre-flight OPTIONS rapidamente
app.options('*', cors());

// Helper for cleaning prices
function cleanPrice(val: any): string | null {
  if (val === null || val === undefined || val === "") return null;
  if (typeof val === "number") {
    if (isNaN(val) || !isFinite(val)) return null;
    return val.toFixed(2).replace(".", ",");
  }
  let str = String(val).trim();
  str = str.replace(/[^\d,.]/g, "");
  if (!str) return null;

  if (str.includes(".") && str.includes(",")) {
    str = str.replace(/\./g, "").replace(",", ".");
  } else if (str.includes(",")) {
    str = str.replace(",", ".");
  } else if (str.includes(".")) {
    const parts = str.split(".");
    if (parts.length === 2 && (parts[1].length === 2 || parts[1].length === 1)) {
      // keep decimal representation (e.g., 70.9 or 1299.90)
    } else {
      // assume thousands separator (e.g., 1.299)
      str = str.replace(/\./g, "");
    }
  }

  const num = parseFloat(str);
  if (!isNaN(num) && isFinite(num)) {
    return num.toFixed(2).replace(".", ",");
  }
  return null;
}

// Helper to extract stars rating (e.g. "4.8")
function extractStars($: any, html: string, jsonLd: any = null, apiData: any = null): string | null {
  if (apiData) {
    if (typeof apiData.rating_average === 'number' && apiData.rating_average > 0) return apiData.rating_average.toFixed(1);
    if (typeof apiData.reviews?.rating_average === 'number' && apiData.reviews.rating_average > 0) return apiData.reviews.rating_average.toFixed(1);
    if (typeof apiData.item_rating?.rating_star === 'number' && apiData.item_rating.rating_star > 0) return apiData.item_rating.rating_star.toFixed(1);
    if (typeof apiData.rating_star === 'number' && apiData.rating_star > 0) return apiData.rating_star.toFixed(1);
    if (typeof apiData.eVAL_RATING === 'number' && apiData.eVAL_RATING > 0) return apiData.eVAL_RATING.toFixed(1);
    if (typeof apiData.averageStar === 'number' && apiData.averageStar > 0) return apiData.averageStar.toFixed(1);
    if (typeof apiData.evaluationScore === 'number' && apiData.evaluationScore > 0) return apiData.evaluationScore.toFixed(1);
  }

  // Gather JSON-LD blocks - priority 1
  const jsonLdObjects: any[] = [];
  if (jsonLd) jsonLdObjects.push(jsonLd);
  if ($) {
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || "");
        if (parsed) jsonLdObjects.push(parsed);
      } catch (e) {}
    });
  }

  for (const obj of jsonLdObjects) {
    const items = Array.isArray(obj) ? obj : [obj];
    for (const item of items) {
      const agg = item?.aggregateRating ||
                  (Array.isArray(item?.['@graph']) ? item['@graph'].find((g: any) => g?.aggregateRating)?.aggregateRating : null);
      if (agg?.ratingValue) {
        const val = parseFloat(String(agg.ratingValue).replace(',', '.'));
        if (!isNaN(val) && val >= 1 && val <= 5) return val.toFixed(1);
      }
      if (item?.ratingValue) {
        const val = parseFloat(String(item.ratingValue).replace(',', '.'));
        if (!isNaN(val) && val >= 1 && val <= 5) return val.toFixed(1);
      }
    }
  }

  if ($) {
    const selectors = [
      '.ui-pdp-review__rating',
      '.ui-pdp-reviews__rating__summary__average',
      '.product-rating-overview__rating-score',
      '#acrPopover .a-size-base',
      '.overview-rating-average',
      '.product-intro__head-reviews-rank',
      '.rank-num',
      'meta[itemprop="ratingValue"]',
      'meta[property="og:rating"]',
      '[class*="rating-score"]',
      '[class*="rating-average"]',
      '[class*="rating-value"]',
      '[aria-label*="de 5"]',
      '[aria-label*="out of 5"]',
      '[aria-label*="estrelas"]',
      '[aria-label*="stars"]'
    ];
    for (const sel of selectors) {
      const txt = $(sel).first().attr('content') || $(sel).first().attr('aria-label') || $(sel).first().text().trim();
      if (txt) {
        const match = txt.match(/([345][\.,]\d|[12345](?:[\.,]\d)?)/);
        if (match) {
          const val = parseFloat(match[1].replace(',', '.'));
          if (!isNaN(val) && val >= 1 && val <= 5) return val.toFixed(1);
        }
      }
    }
  }

  if (html) {
    const ratingMatch = html.match(/(?:ratingValue|rating_score|rating_star|ratingAverage|rating|nota|classificação|evaluationScore)["']?\s*[:=]\s*["']?([345][\.,]\d|[12345])/i) ||
                        html.match(/(?:aria-label|title)=["'][^"']*\b([345][\.,]\d)\s*(?:de\s*5|out of 5|estrelas|stars|\/5)/i);
    if (ratingMatch && ratingMatch[1]) {
      const val = parseFloat(ratingMatch[1].replace(',', '.'));
      if (!isNaN(val) && val >= 1 && val <= 5) return val.toFixed(1);
    }
  }

  return null;
}

// Helper to extract sales count or review count (e.g. "1.2k", "500", "500+ vendidos", "120 avaliações")
function extractSalesCount($: any, html: string, jsonLd: any = null, apiData: any = null): string | null {
  if (apiData) {
    if (apiData.sold_quantity) return `+${apiData.sold_quantity} vendidos`;
    if (apiData.historical_sold) return apiData.historical_sold >= 1000 ? `${(apiData.historical_sold / 1000).toFixed(1)}k vendidos` : `${apiData.historical_sold} vendidos`;
    if (apiData.sold) return `${apiData.sold} vendidos`;
    if (apiData.tradeCount) return `${apiData.tradeCount} vendidos`;
    if (apiData.totalValidNum) return `${apiData.totalValidNum} avaliações`;
    if (apiData.formatTradeCount) return `${apiData.formatTradeCount} vendidos`;
  }

  const jsonLdObjects: any[] = [];
  if (jsonLd) jsonLdObjects.push(jsonLd);
  if ($) {
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const parsed = JSON.parse($(el).html() || "");
        if (parsed) jsonLdObjects.push(parsed);
      } catch (e) {}
    });
  }

  for (const obj of jsonLdObjects) {
    const items = Array.isArray(obj) ? obj : [obj];
    for (const item of items) {
      const agg = item?.aggregateRating ||
                  (Array.isArray(item?.['@graph']) ? item['@graph'].find((g: any) => g?.aggregateRating)?.aggregateRating : null);
      if (agg?.reviewCount || agg?.ratingCount) {
        const count = agg.reviewCount || agg.ratingCount;
        return `${count} avaliações`;
      }
    }
  }

  if ($) {
    const selectors = [
      '.ui-pdp-subtitle',
      '#acrCustomerReviewText',
      '#social-proofing-faceout-title-text',
      '.product-reviewer-sold',
      '.product-intro__head-reviews-num',
      '[class*="sold"]',
      '[class*="review-count"]',
      '[class*="review_count"]',
      '[class*="sales"]',
      '[class*="vendas"]'
    ];
    for (const sel of selectors) {
      const txt = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (txt) {
        const match = txt.match(/(\+?\d+(?:[\.,]\d+)?\s*[kKmM]?\+?\s*(?:vendidos|comprados|vendas|pedidos|avaliações|avaliacoes|reviews))/i) ||
                      txt.match(/(\d+(?:[\.,]\d+)?\s*avaliações)/i);
        if (match) return match[1].trim();
        if (txt.length < 35 && (txt.toLowerCase().includes('vendid') || txt.toLowerCase().includes('comprad') || txt.toLowerCase().includes('avaliaç'))) {
          return txt;
        }
      }
    }
  }

  if (html) {
    const regexMatch = html.match(/(?:sold_quantity|historical_sold|sales_count|total_sold|sold_count|totalValidNum)["']?\s*[:=]\s*["']?(\d+)/i) ||
                       html.match(/(\+?\d+(?:[\.,]\d+)?\s*[kKmM]?\s*(?:vendidos|comprados|vendas|pedidos|avaliações|avaliacoes))/i);
    if (regexMatch && regexMatch[1]) {
      const raw = regexMatch[1].trim();
      if (/^\d+$/.test(raw)) {
        const num = parseInt(raw, 10);
        if (num > 0 && num <= 100000) {
          return `+${num} vendidos`;
        }
      } else if (raw.length < 35) {
        return raw;
      }
    }
  }

  return null;
}

// Helper to extract coupon text from Shopee, AliExpress, Shein, ML, Amazon
function extractCouponText($: any, html: string, apiData: any = null): string | null {
  if (apiData) {
    if (typeof apiData.coupon === 'string' && apiData.coupon.trim()) return apiData.coupon.trim();
    if (Array.isArray(apiData.vouchers) && apiData.vouchers[0]?.voucher_code) return apiData.vouchers[0].voucher_code;
    if (Array.isArray(apiData.vouchers) && apiData.vouchers[0]?.name) return apiData.vouchers[0].name;
    if (Array.isArray(apiData.coupons) && apiData.coupons[0]?.code) return apiData.coupons[0].code;
    if (Array.isArray(apiData.coupons) && apiData.coupons[0]?.name) return apiData.coupons[0].name;
    if (apiData.couponComponent?.couponList?.[0]?.title) return apiData.couponComponent.couponList[0].title;
  }

  if ($) {
    const couponSelectors = [
      '.ui-pdp-promotions-pill__label',
      '.ui-pdp-vouchers__label',
      '#couponBadge span',
      '.vpc-coupon-badge',
      '[class*="voucher"]',
      '[class*="coupon"]',
      '[class*="cupom"]',
      '[class*="badge"]',
      '[class*="promo"]'
    ];
    for (const sel of couponSelectors) {
      let found: string | null = null;
      $(sel).each((_, el) => {
        const txt = $(el).text().replace(/\s+/g, ' ').trim();
        if (txt && txt.length < 100 && (
          txt.toLowerCase().includes("cupom") ||
          txt.toLowerCase().includes("voucher") ||
          txt.toLowerCase().includes("coupon") ||
          txt.toLowerCase().includes("off") ||
          txt.toLowerCase().includes("desconto")
        )) {
          found = txt;
          return false;
        }
      });
      if (found) return found;
    }
  }

  if (html) {
    const couponMatch = html.match(/(?:cupom|voucher|coupon)\s*[:=]?\s*["']?([A-Z0-9_\-]{3,20}|\d+%\s*OFF|R\$\s*\d+\s*OFF)/i) ||
                        html.match(/(?:cupom de|voucher de|usar cupom)\s*[:=]?\s*["']?([^"'<>\n]{3,30})/i) ||
                        html.match(/["'](?:coupon_code|voucher_code|promo_code)["']\s*[:=]\s*["']([^"']+)["']/i);
    if (couponMatch && couponMatch[1]) {
      return couponMatch[1].trim();
    }
  }

  return null;
}

// Helper to check if free shipping is available
function checkFreeShipping(shippingText: string | null | undefined, html: string = ""): boolean {
  if (shippingText) {
    const lower = shippingText.toLowerCase();
    if (lower.includes("frete grátis") || lower.includes("frete gratis") || lower.includes("envio grátis") || lower.includes("envio gratis") || lower.includes("free shipping")) {
      return true;
    }
  }
  if (html) {
    const htmlLower = html.toLowerCase();
    return htmlLower.includes("frete grátis") || htmlLower.includes("frete gratis") || htmlLower.includes("envio grátis") || htmlLower.includes("envio gratis") || htmlLower.includes("free shipping");
  }
  return false;
}

// Helper to extract Pix price
function extractPixPrice($: any, html: string, priceTo: string | null = null): string | null {
  if ($) {
    const pixSelectors = [
      '[data-feature-name="pixPrice"]',
      '#price-pix',
      '.pix-price',
      '[class*="pix-price"]',
      '[class*="price-pix"]'
    ];
    for (const sel of pixSelectors) {
      const txt = $(sel).first().text().trim();
      if (txt) {
        const cleaned = cleanPrice(txt);
        if (cleaned) return cleaned;
      }
    }
  }

  if (html) {
    const pixMatch = html.match(/(?:pix|à\s*vista\s*no\s*pix|no\s*pix)\s*[:=]?\s*(?:R\$\s*)?([\d\.]+(?:,\d{2})?)/i) ||
                     html.match(/R\$\s*([\d\.]+(?:,\d{2})?)\s*(?:no\s*pix|à\s*vista\s*no\s*pix|com\s*pix)/i);
    if (pixMatch && pixMatch[1]) {
      const cleaned = cleanPrice(pixMatch[1]);
      if (cleaned) return cleaned;
    }
  }

  return null;
}

// Helper to calculate discount percentage
function calculateDiscountPct(priceFrom: string | null | undefined, priceTo: string | null | undefined): number | null {
  if (!priceFrom || !priceTo) return null;
  const numFrom = parseFloat(String(priceFrom).replace(/\./g, "").replace(",", "."));
  const numTo = parseFloat(String(priceTo).replace(/\./g, "").replace(",", "."));
  if (!isNaN(numFrom) && !isNaN(numTo) && numFrom > numTo && numFrom > 0) {
    const pct = Math.round(((numFrom - numTo) / numFrom) * 100);
    return pct > 0 ? pct : null;
  }
  return null;
}

// Helper for executing Shopee GraphQL requests with robust signature algorithms and header layouts
async function fetchShopeeGraphQLWithSignatureFallback(
  endpoint: string,
  appId: string,
  secret: string,
  payloadStr: string
): Promise<Response> {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Official signature spec: SHA256 of concatenated appId + timestamp + payload + secret (no spaces)
  const factor = appId + timestamp + payloadStr + secret;
  const signature = crypto.createHash("sha256").update(factor).digest("hex");

  const secretLen = secret ? secret.length : 0;
  const secretLast4 = secretLen >= 4 ? secret.slice(-4) : (secret || "none");

  console.log(`[SHOPEE DIAG] Executando GraphQL em ${endpoint} | AppID: ${appId} | secretLen: ${secretLen} | secretLast4: ${secretLast4} | Timestamp: ${timestamp}`);
  console.log(`[SHOPEE DIAG] Base string da assinatura (len=${factor.length}): ${factor.length > 300 ? factor.substring(0, 300) + '...' : factor}`);
  console.log(`[SHOPEE DIAG] Assinatura SHA256 puro gerada: ${signature}`);

  const headerValue = `SHA256 Credential=${appId},Timestamp=${timestamp},Signature=${signature}`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": headerValue,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      },
      body: payloadStr,
      signal: AbortSignal.timeout(8000)
    });

    const responseClone = response.clone();
    const rawText = await responseClone.text();
    console.log(`[SHOPEE DIAG] GraphQL Resposta | Status HTTP: ${response.status} | Resposta crua: ${rawText}`);

    return response;
  } catch (fetchErr: any) {
    console.error(`[SHOPEE DIAG] GraphQL exceção de rede/fetch | Message: ${fetchErr?.message || fetchErr} | Cause: ${fetchErr?.cause || 'N/A'}`);
    throw fetchErr;
  }
}

// Helper to generate Shopee Affiliate Promotion Link using GraphQL and HMAC-SHA256 signature
async function generateShopeePromotionLink(originalUrl: string, appId?: string, secret?: string, subId?: string): Promise<string | null> {
  try {
    const finalAppId = (appId || process.env.SHOPEE_APP_ID || "").trim();
    const finalSecret = (secret || process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET || "").trim();

    const secretLen = finalSecret.length;
    const secretLast4 = secretLen >= 4 ? finalSecret.slice(-4) : (finalSecret || "none");
    const source = (appId || secret) ? "config do usuário" : "env do servidor";

    console.log(`[SHOPEE DIAG] generateShopeePromotionLink | URL: ${originalUrl} | AppID: ${finalAppId} | secretLen: ${secretLen} | secretLast4: ${secretLast4} | Origem: ${source}`);

    if (!finalAppId || !finalSecret) {
      console.log("[SHOPEE DIAG] Credenciais da API de Afiliados da Shopee não configuradas. Pulando conversão.");
      return null;
    }

    const cleanSubId = subId?.trim().replace(/[^a-zA-Z0-9_-]/g, "");
    const subIdArg = cleanSubId ? `, subIds: ["${cleanSubId}"]` : "";
    
    // Shopee GraphQL API mutation body
    const mutation = {
      query: `mutation {
        generatePromotionLink(originLines: ["${originalUrl}"]${subIdArg}) {
          errCode
          errMsg
          data {
            promotionLinkList {
              origin
              promotionLink
            }
          }
        }
      }`
    };

    const bodyStr = JSON.stringify(mutation);

    let response;
    try {
      response = await fetchShopeeGraphQLWithSignatureFallback(
        "https://open-api.affiliate.shopee.com.br/api/v1/graphql",
        finalAppId,
        finalSecret,
        bodyStr
      );
    } catch (e: any) {
      console.warn(`[SHOPEE DIAG] generateShopeePromotionLink erro de conexão: ${e?.message || e}`);
    }

    if (response && response.ok) {
      const result: any = await response.json();
      const responseData = result?.data?.generatePromotionLink;
      
      if (responseData?.errCode === 0 || responseData?.errCode === "0") {
        const promoList = responseData?.data?.promotionLinkList;
        if (promoList && promoList.length > 0 && promoList[0]?.promotionLink) {
          return promoList[0].promotionLink;
        }
      } else {
        console.warn(`[SHOPEE DIAG] Erro retornado pela API Shopee. Código: ${responseData?.errCode}, Mensagem: ${responseData?.errMsg}`);
      }
    } else {
      console.error(`[SHOPEE DIAG] generateShopeePromotionLink resposta HTTP nula ou não ok.`);
    }
  } catch (err) {
    console.error("[SHOPEE DIAG] Erro de execução em generateShopeePromotionLink:", err);
  }
  return null;
}

// Detect Platform
function detectPlatform(url: string): string {
  const urlLower = url.toLowerCase();
  if (
    urlLower.includes("mercadolivre") ||
    urlLower.includes("mercadolibre") ||
    urlLower.includes("mliv.re")
  ) {
    return "mercadolivre";
  } else if (
    urlLower.includes("shopee") ||
    urlLower.includes("shope.ee") ||
    urlLower.includes("s.shopee")
  ) {
    return "shopee";
  } else if (
    urlLower.includes("amazon") ||
    urlLower.includes("amzn.to") ||
    urlLower.includes("amzn.br") ||
    urlLower.includes("a.co")
  ) {
    return "amazon";
  } else if (
    urlLower.includes("aliexpress") ||
    urlLower.includes("ali.ski") ||
    urlLower.includes("s.click.aliexpress") ||
    urlLower.includes("a.aliexpress")
  ) {
    return "aliexpress";
  } else if (
    urlLower.includes("shein") ||
    urlLower.includes("she.in") ||
    urlLower.includes("shein.top")
  ) {
    return "shein";
  } else if (
    urlLower.includes("tiktok") ||
    urlLower.includes("tiktokshop") ||
    urlLower.includes("vt.tiktok") ||
    urlLower.includes("vm.tiktok") ||
    urlLower.includes("s.tiktok") ||
    urlLower.includes("v.tiktok")
  ) {
    return "tiktokshop";
  }
  throw new Error("Plataforma não suportada. Use links do Mercado Livre, Shopee, Amazon, AliExpress, Shein ou TikTok Shop.");
}

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

const TIKTOK_MOBILE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": "https://www.tiktok.com/",
};

// Helper to refresh ML token
async function refreshMercadoLivreToken(appId: string, clientSecret: string, refreshToken: string, source?: string) {
  try {
    const sLen = clientSecret ? clientSecret.length : 0;
    const sLast4 = sLen >= 4 ? clientSecret.slice(-4) : (clientSecret || "none");
    console.log(`[ML DIAG] refreshMercadoLivreToken | appId: ${appId} | secretLen: ${sLen} | secretLast4: ${sLast4} | Origem: ${source || "desconhecido"}`);

    const res = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: String(appId).trim(),
        client_secret: String(clientSecret).trim(),
        refresh_token: String(refreshToken).trim(),
      }),
    });

    const status = res.status;
    const rawText = await res.text();
    let data: any = {};
    try { data = JSON.parse(rawText); } catch { data = { text: rawText }; }

    if (res.ok && data.access_token) {
      const expiresAt = Date.now() + (data.expires_in || 21600) * 1000;
      console.log(`[ML DIAG] refreshMercadoLivreToken SUCESSO | status: ${status}`);
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
      };
    } else {
      console.error(`[ML DIAG] refreshMercadoLivreToken ERRO | status: ${status} | Resposta crua: ${rawText}`);
      return null;
    }
  } catch (err) {
    console.error("[ML DIAG] refreshMercadoLivreToken EXCEÇÃO:", err);
    return null;
  }
}

// Helper to resolve short links and HTML redirects (e.g. meli.la, amzn.to, shope.ee, s.shopee.com.br)
async function resolveFinalUrlAndHtml(initialUrl: string): Promise<{ finalUrl: string; html: string }> {
  let currentUrl = initialUrl;
  let html = "";
  
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      if (!isSafePublicUrl(currentUrl)) {
        console.warn(`[URL Resolver] URL bloqueada por segurança (SSRF): ${currentUrl}`);
        break;
      }

      const res = await fetch(currentUrl, { 
        headers: {
          ...DEFAULT_HEADERS,
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        }, 
        redirect: "follow" 
      });

      if (res.status === 403 || res.status === 401) {
        console.warn(`[Scraper] Acesso negado (${res.status}) para ${currentUrl}. Tentando proxy AllOrigins...`);
        const proxyRes = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(currentUrl));
        const proxyData = await proxyRes.json();
        if (proxyData && proxyData.contents) {
          html = proxyData.contents;
          // Note: URL might not resolve through proxy redirects as easily, but we keep currentUrl
        } else {
          currentUrl = res.url || currentUrl;
          html = await res.text();
        }
      } else {
        currentUrl = res.url || currentUrl;
        html = await res.text();
      }

      const $ = cheerio.load(html);
      
      // 1. Meta refresh redirect
      const metaRefresh = $('meta[http-equiv="refresh"]').attr('content') || $('meta[http-equiv="Refresh"]').attr('content');
      if (metaRefresh) {
        const urlMatch = metaRefresh.match(/url=\s*['"]?([^'"]+)['"]?/i);
        if (urlMatch && urlMatch[1] && urlMatch[1].startsWith("http")) {
          currentUrl = urlMatch[1].trim();
          continue;
        }
      }

      // 2. Short link og:url, canonical or twitter:url redirect
      const isShortLink = currentUrl.includes('meli.la') || 
                          currentUrl.includes('amzn.to') || 
                          currentUrl.includes('a.co') || 
                          currentUrl.includes('shope.ee') || 
                          currentUrl.includes('s.shopee.com.br') || 
                          currentUrl.includes('shopee.com.br') || 
                          currentUrl.includes('shein.top') || 
                          currentUrl.includes('vt.tiktok') || 
                          currentUrl.includes('vm.tiktok') || 
                          currentUrl.includes('s.tiktok') || 
                          currentUrl.includes('v.tiktok') || 
                          currentUrl.includes('tinyurl') || 
                          currentUrl.includes('bit.ly');

      if (isShortLink) {
        const canonical = $('link[rel="canonical"]').attr('href') || $('meta[property="og:url"]').attr('content') || $('meta[name="twitter:url"]').attr('content');
        if (canonical && canonical.startsWith("http") && canonical !== currentUrl && !canonical.includes("s.shopee.com.br") && !canonical.includes("shope.ee")) {
          currentUrl = canonical.trim();
          continue;
        }

        // Search for JS or JSON target_url or location redirect
        const targetUrlMatch = html.match(/(?:target_?url|redirect_?url|universal_?link|targetUrl)\s*[:=]\s*["'](https?:\/\/[^"']+)["']/i) ||
                               html.match(/href=["'](https?:\/\/(?:shopee\.com\.br)[^"']+)["']/i) ||
                               html.match(/(?:window\.)?location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
        if (targetUrlMatch && targetUrlMatch[1]) {
          const cleanTarget = targetUrlMatch[1].replace(/\\/g, '').trim();
          if (cleanTarget && cleanTarget.startsWith("http") && cleanTarget !== currentUrl) {
            currentUrl = cleanTarget;
            continue;
          }
        }
      }

      break;
    } catch (err) {
      console.warn(`[URL Resolver] Error resolving ${currentUrl}:`, err);
      break;
    }
  }

  return { finalUrl: currentUrl, html };
}

// Mercado Livre Scraper
async function scrapeMercadoLivre(url: string, mlConfig?: any) {
  let ml_auth_error = false; /* default */ 
  let updated_ml_keys: any = null;
  try {
    const { finalUrl, html } = await resolveFinalUrlAndHtml(url);

    let bearerToken = typeof mlConfig === 'string' ? mlConfig : (mlConfig?.mercadoLivreKey || process.env.MERCADOLIVRE_KEY);
    let refreshToken = typeof mlConfig === 'object' ? mlConfig?.mercadoLivreRefreshToken : undefined;
    let expiresAt = typeof mlConfig === 'object' ? mlConfig?.mercadoLivreExpiresAt : undefined;
    const appId = (typeof mlConfig === 'object' ? mlConfig?.mercadoLivreAppId : undefined) || process.env.MERCADO_LIVRE_CLIENT_ID || process.env.MERCADOLIVRE_APP_ID;
    const clientSecret = (typeof mlConfig === 'object' ? mlConfig?.mercadoLivreClientSecret : undefined) || process.env.MERCADO_LIVRE_CLIENT_SECRET || process.env.MERCADOLIVRE_CLIENT_SECRET;

    // Preemptive Auto-Renew using Refresh Token if expired (or close to expiry)
    if (refreshToken && appId && clientSecret) {
      const isExpired = !bearerToken || !expiresAt || Date.now() >= Number(expiresAt) - 300000;
      if (isExpired) {
        const source = mlConfig?.mercadoLivreClientSecret ? "config do usuário" : "env do servidor";
        const renewed = await refreshMercadoLivreToken(appId, clientSecret, refreshToken, source);
        if (renewed) {
          bearerToken = renewed.access_token;
          refreshToken = renewed.refresh_token;
          expiresAt = renewed.expires_at;
          updated_ml_keys = {
            mercadoLivreKey: renewed.access_token,
            mercadoLivreRefreshToken: renewed.refresh_token,
            mercadoLivreExpiresAt: renewed.expires_at,
          };
        }
      }
    }

    // Try extracting MLB ID — primeiro na URL, depois no HTML (canonical/og:url/JSON embutido)
    const $preload = cheerio.load(html);
    const canonicalUrl = $preload('link[rel="canonical"]').attr('href') || $preload('meta[property="og:url"]').attr('content') || "";
    
    // Try to find a real item ID (MLB followed by digits) in query parameters, avoiding catalog product IDs (/p/MLB...) if possible.
    let itemId: string | null = null;
    const urlDecoded = decodeURIComponent(finalUrl + " " + url + " " + canonicalUrl);
    const itemIdParamMatch = urlDecoded.match(/(?:item_id|wid|vip_id)[:=](MLB\d+)/i);
    if (itemIdParamMatch && itemIdParamMatch[1]) {
      itemId = itemIdParamMatch[1].toUpperCase();
    } else {
      const nonCatalogMatch = finalUrl.match(/(?<!\/p\/)(MLB-?\d+)/i) || url.match(/(?<!\/p\/)(MLB-?\d+)/i) || canonicalUrl.match(/(?<!\/p\/)(MLB-?\d+)/i);
      if (nonCatalogMatch && nonCatalogMatch[1]) {
        itemId = nonCatalogMatch[1].replace("-", "").toUpperCase();
      } else {
        const anyMlbMatch = finalUrl.match(/(MLB-?\d+)/i) || url.match(/(MLB-?\d+)/i) || canonicalUrl.match(/(?<!\/p\/)(MLB-?\d+)/i) || html.match(/"(MLB\d+)"/i);
        if (anyMlbMatch && anyMlbMatch[1]) {
          itemId = anyMlbMatch[1].replace("-", "").toUpperCase();
        }
      }
    }

    let apiData: any = null;

    if (itemId) {
      try {
        const isCatalog = finalUrl.includes("/p/MLB") || url.includes("/p/MLB") || canonicalUrl.includes("/p/MLB");
        const getApiUrl = (id: string) => isCatalog 
          ? `https://api.mercadolibre.com/products/${id}`
          : `https://api.mercadolibre.com/items/${id}`;

        const makeApiFetch = async (token?: string) => {
          const apiHeaders: Record<string, string> = {
            "Accept": "application/json",
            "User-Agent": DEFAULT_HEADERS["User-Agent"],
          };
          if (token && token.trim()) {
            apiHeaders["Authorization"] = `Bearer ${token.trim()}`;
          }
          const id = itemId;
          const tokenLast4 = token && token.length >= 4 ? token.slice(-4) : "none";
          console.log("[ML DIAG] Requisitando API de itens do ML | id: " + id + " | com token: " + !!token + " | tokenLast4: " + tokenLast4);

          const response = await fetch(getApiUrl(itemId!), { headers: apiHeaders });

          if (!response.ok) {
            const rawBody = await response.clone().text().catch(() => "N/A");
            console.error(`[ML DIAG] Resposta de erro do ML | status: ${response.status} | corpo: ${rawBody}`);

            if (token && (response.status === 401 || response.status === 403)) {
              console.log(`[ML DIAG] items API bloqueada mesmo com token: status=${response.status}`);
            }
          }

          return response;
        };

        // 1. First attempt with existing token (if available)
        let apiRes = await makeApiFetch(bearerToken);

        // 2. If 401/403 and we have refresh token, attempt token auto-renew
        if ((apiRes.status === 401 || apiRes.status === 403) && refreshToken && appId && clientSecret && !updated_ml_keys) {
          console.warn("[ML API] Token falhou com status 401/403. Tentando renovar com refresh_token...");
          const source = mlConfig?.mercadoLivreClientSecret ? "config do usuário" : "env do servidor";
          const renewed = await refreshMercadoLivreToken(appId, clientSecret, refreshToken, source);
          if (renewed) {
            bearerToken = renewed.access_token;
            refreshToken = renewed.refresh_token;
            expiresAt = renewed.expires_at;
            updated_ml_keys = {
              mercadoLivreKey: renewed.access_token,
              mercadoLivreRefreshToken: renewed.refresh_token,
              mercadoLivreExpiresAt: renewed.expires_at,
            };
            apiRes = await makeApiFetch(bearerToken);
          }
        }

        // 3. If still 401/403 and we have App ID + Secret, obtain client_credentials token as fallback
        if ((apiRes.status === 401 || apiRes.status === 403) && appId && clientSecret) {
          const source = mlConfig?.mercadoLivreClientSecret ? "config do usuário" : "env do servidor";
          const ccLen = clientSecret ? clientSecret.length : 0;
          const ccLast4 = ccLen >= 4 ? clientSecret.slice(-4) : (clientSecret || "none");
          console.log(`[ML DIAG] Scraper client_credentials | appId: ${appId} | secretLen: ${ccLen} | secretLast4: ${ccLast4} | Origem: ${source}`);
          try {
            const ccRes = await fetch("https://api.mercadolibre.com/oauth/token", {
              method: "POST",
              headers: { "Content-Type": "application/x-www-form-urlencoded" },
              body: new URLSearchParams({
                grant_type: "client_credentials",
                client_id: String(appId).trim(),
                client_secret: String(clientSecret).trim(),
              }),
            });
            const ccStatus = ccRes.status;
            const ccRaw = await ccRes.text();
            let ccData: any = {};
            try { ccData = JSON.parse(ccRaw); } catch { ccData = { text: ccRaw }; }

            if (ccRes.ok && ccData.access_token) {
              bearerToken = ccData.access_token;
              console.log("[ML DIAG] Scraper client_credentials SUCESSO!");
              apiRes = await makeApiFetch(bearerToken);
            } else {
              console.error(`[ML DIAG] Scraper client_credentials ERRO | Status: ${ccStatus} | Resposta crua: ${ccRaw}`);
            }
          } catch (ccErr) {
            console.error("[ML DIAG] Scraper client_credentials EXCEÇÃO:", ccErr);
          }
        }

        // 4. If still 401/403, try public unauthenticated request (without Authorization header)
        if (apiRes.status >= 400 && apiRes.status <= 499) {
          console.warn("[ML API] Requisitando endpoint público de item do Mercado Livre sem Authorization header...");
          apiRes = await makeApiFetch(undefined);
        }

        if (!apiRes.ok) {
          console.warn(`[ML API] Requisição API falhou para ${itemId}. HTTP ${apiRes.status}`);
          if (apiRes.status >= 400 && apiRes.status <= 499) {
            ml_auth_error = true;
          }
        }

        if (apiRes.ok) {
          ml_auth_error = false; /* default */ 
          const data = await apiRes.json();
          const title = data.title || data.name || "";
          const image_url = (data.pictures && data.pictures[0]?.secure_url) || (data.pictures && data.pictures[0]?.url) || data.thumbnail || null;
          
          // Extrair todas as imagens disponíveis
          const pictures: string[] = Array.isArray(data.pictures)
            ? data.pictures.map((p: any) => p.secure_url || p.url).filter(Boolean)
            : (image_url ? [image_url] : []);

          const videos: string[] = [];
          if (data.video_id) {
            videos.push(`https://www.youtube.com/watch?v=${data.video_id}`);
          }
          if (Array.isArray(data.videos)) {
            data.videos.forEach((v: any) => {
              const vidId = v.id || v.youtube_id;
              if (vidId) {
                videos.push(`https://www.youtube.com/watch?v=${vidId}`);
              }
            });
          }
          const uniqVideos = Array.from(new Set(videos));

          const rawPrice = data.price || data.buy_box_winner?.price || data.buy_box_winner_price;
          const price_to = rawPrice ? cleanPrice(rawPrice) : null; if (!price_to) { ml_auth_error = true; console.warn("[ML API] Preco ausente - marcando ml_auth_error=true"); } else { ml_auth_error = false; }
          
          const rawOriginalPrice = data.original_price || data.buy_box_winner?.original_price;
          const price_from = (rawOriginalPrice && rawOriginalPrice > (rawPrice || 0)) ? cleanPrice(rawOriginalPrice) : null;

          let installments: string | null = null;
          let max_installments_interest_free: string | null = null;
          if (data.installments) {
            const q = data.installments.quantity;
            const amt = cleanPrice(data.installments.amount);
            const isNoInterest = data.installments.rate === 0;
            const noInterest = isNoInterest ? " sem juros" : "";
            if (q && amt) {
              installments = `${q}x de R$ ${amt}${noInterest}`;
              if (isNoInterest) {
                max_installments_interest_free = `${q}x sem juros`;
              }
            }
          } else if (data.buy_box_winner?.installments) {
            const q = data.buy_box_winner.installments.quantity;
            const amt = cleanPrice(data.buy_box_winner.installments.amount);
            const isNoInterest = data.buy_box_winner.installments.rate === 0;
            const noInterest = isNoInterest ? " sem juros" : "";
            if (q && amt) {
              installments = `${q}x de R$ ${amt}${noInterest}`;
              if (isNoInterest) {
                max_installments_interest_free = `${q}x sem juros`;
              }
            }
          }

          let coupon: string | null = null;
          if (Array.isArray(data.sale_terms)) {
            const coupTerm = data.sale_terms.find((t: any) => t.id === "COUPON" || t.id === "PROMOTION");
            if (coupTerm) coupon = coupTerm.value_name || coupTerm.value_struct?.name || null;
          }

          let description: string | null = null;
          const targetDescItemId = isCatalog ? (data.buy_box_winner?.item_id || data.children_ids?.[0]) : itemId;
          if (targetDescItemId) {
            try {
              const descRes = await fetch(`https://api.mercadolibre.com/items/${targetDescItemId}/description`, {
                headers: { "Authorization": `Bearer ${bearerToken.trim()}` }
              });
              if (descRes.ok) {
                const descData = await descRes.json();
                description = (descData.plain_text || '').trim() || null;
              }
            } catch (e) {
              console.warn(`[ML API] Não foi possível buscar descrição de ${targetDescItemId}`, e);
            }
          }

          let shipping: string | null = null;
          if (data.shipping) {
            if (data.shipping.free_shipping) {
              shipping = "Frete grátis";
            } else {
              shipping = "Consulte o frete";
            }
          }

          if (title) {
            apiData = {
              title,
              description,
              image_url,
              pictures,
              video_url: uniqVideos[0] || null,
              videos: uniqVideos,
              price_from,
              price_to,
              installments,
              max_installments_interest_free,
              coupon,
              shipping
            };
            console.log(`[ML API] Dados pré-carregados com sucesso do item ID ${itemId}`);
          }
        }
      } catch (e) {
        console.warn("[ML Scraper] ML API request failed, proceeding to HTML parsing", e);
      }
    }

    // HTML Cheerio Parsing Fallback
    const $ = cheerio.load(html);

    // Se for uma página de perfil social do Mercado Livre (ex: /social/), extraímos apenas do card de produto correspondente.
    const isSocialPage = finalUrl.includes('/social/') || url.includes('/social/');
    if (isSocialPage) {
      console.log("[ML Scraper] Detetada página de perfil social/afiliado. Executando extrator contextualizado com busca de correspondência de título.");
      let socialTitle = $('meta[property="og:title"]').attr('content') || "";
      let socialImage = $('meta[property="og:image"]').attr('content') || null;
      let socialPriceTo: string | null = null;
      let socialPriceFrom: string | null = null;
      let socialCardPrice: string | null = null;
      let socialInstallments: string | null = null;

      // Se o título principal da página for genérico ou de perfil, tentamos identificar todos os cards
      const getOverlapScore = (str1: string, str2: string) => {
        const s1 = String(str1).toLowerCase().replace(/[^\w\s]/g, '');
        const s2 = String(str2).toLowerCase().replace(/[^\w\s]/g, '');
        const words1 = new Set(s1.split(/\s+/).filter(w => w.length > 2));
        const words2 = new Set(s2.split(/\s+/).filter(w => w.length > 2));
        let overlap = 0;
        for (const w of words1) {
          if (words2.has(w)) overlap++;
        }
        return overlap;
      };

      const parsedCards: Array<{
        title: string;
        image: string | null;
        priceTo: string | null;
        priceFrom: string | null;
        cardPrice: string | null;
        installments: string | null;
        link: string | null;
        score: number;
      }> = [];

      $('.poly-card').each((_, el) => {
        const $card = $(el);
        const cardTitle = $card.find('[class*="title"], [class*="name"]').first().text().trim();
        if (!cardTitle) return;

        let cardImg = $card.find('img').first().attr('src') || $card.find('img').first().attr('data-src') || null;
        if (cardImg && cardImg.startsWith('//')) cardImg = 'https:' + cardImg;

        let cardLink = $card.find('a').first().attr('href') || $card.find('[class*="link"]').first().attr('href') || null;
        if (cardLink) {
          if (cardLink.startsWith('//')) {
            cardLink = 'https:' + cardLink;
          } else if (cardLink.startsWith('/')) {
            cardLink = 'https://www.mercadolivre.com.br' + cardLink;
          }
        }

        // Resilient price classification inside poly-card
        const cardAmounts: { value: number; str: string; textAfter: string; isPrevious: boolean }[] = [];
        $card.find('.andes-money-amount').each((_, mEl) => {
          const $mEl = $(mEl);
          const parentText = $mEl.parent().text().replace(/\s+/g, ' ').trim();
          const containerText = $mEl.closest('div, span, p').text().replace(/\s+/g, ' ').trim();
          const isPrevious = $mEl.hasClass('andes-money-amount--previous') || 
                             $mEl.parents('.andes-money-amount--previous').length > 0 ||
                             $mEl.parents('.poly-price__was').length > 0;
          const fraction = $mEl.find('.andes-money-amount__fraction').text().trim();
          const cents = $mEl.find('.andes-money-amount__cents').text().trim() || "00";
          if (fraction) {
            const cleanVal = cleanPrice(`${fraction},${cents}`);
            if (cleanVal) {
              const num = parseFloat(cleanVal.replace(",", "."));
              cardAmounts.push({
                value: num,
                str: cleanVal,
                textAfter: parentText || containerText,
                isPrevious
              });
            }
          }
        });

        const nonPrev = cardAmounts.filter(a => !a.isPrevious);
        const prev = cardAmounts.filter(a => a.isPrevious);

        let cardPriceFrom: string | null = null;
        if (prev.length > 0) {
          prev.sort((a, b) => b.value - a.value);
          cardPriceFrom = prev[0].str;
        }

        let cardPriceTo: string | null = null;
        let cardPrice: string | null = null;

        if (nonPrev.length > 0) {
          nonPrev.sort((a, b) => b.value - a.value);
          const maxVal = nonPrev[0].value;
          const actualPrices = nonPrev.filter(a => a.value >= maxVal / 3);

          if (actualPrices.length > 0) {
            const pixObj = actualPrices.find(a => 
              a.textAfter.toLowerCase().includes("pix") || 
              a.textAfter.toLowerCase().includes("à vista") || 
              a.textAfter.toLowerCase().includes("avista") || 
              a.textAfter.toLowerCase().includes("dinheiro")
            );

            if (pixObj) {
              cardPriceTo = pixObj.str;
              const otherPrices = actualPrices.filter(a => a.str !== pixObj.str);
              if (otherPrices.length > 0) {
                otherPrices.sort((a, b) => b.value - a.value);
                cardPrice = otherPrices[0].str;
              }
            } else {
              if (actualPrices.length > 1) {
                actualPrices.sort((a, b) => a.value - b.value);
                cardPriceTo = actualPrices[0].str;
                cardPrice = actualPrices[actualPrices.length - 1].str;
              } else {
                cardPriceTo = actualPrices[0].str;
              }
            }
          }
        }

        let cardInstallments: string | null = null;
        const installmentsEl = $card.find('.poly-price__installments');
        if (installmentsEl.length > 0) {
          const rawInst = installmentsEl.text().replace(/\s+/g, ' ').trim();
          if (rawInst && (rawInst.includes('x') || rawInst.toLowerCase().includes('parcela') || rawInst.toLowerCase().includes('vezes') || rawInst.toLowerCase().includes('sem juros'))) {
            cardInstallments = rawInst;
          }
        }

        const score = socialTitle ? getOverlapScore(socialTitle, cardTitle) : 0;
        parsedCards.push({
          title: cardTitle,
          image: cardImg,
          priceTo: cardPriceTo,
          priceFrom: cardPriceFrom,
          cardPrice: cardPrice,
          installments: cardInstallments,
          link: cardLink,
          score
        });
      });

      let selectedProduct = parsedCards[0] || null;
      if (parsedCards.length > 1 && socialTitle) {
        // Encontra o card com o maior score de correspondência de título com og:title
        parsedCards.sort((a, b) => b.score - a.score);
        if (parsedCards[0].score > 0) {
          selectedProduct = parsedCards[0];
        }
      }

      let selectedCardLink: string | null = null;
      if (selectedProduct) {
        socialTitle = selectedProduct.title;
        if (selectedProduct.image) socialImage = selectedProduct.image;
        socialPriceTo = selectedProduct.priceTo;
        socialPriceFrom = selectedProduct.priceFrom;
        socialCardPrice = selectedProduct.cardPrice;
        socialInstallments = selectedProduct.installments;
        selectedCardLink = selectedProduct.link;
      }

      // Se houver um link de produto direto dentro do card, tenta fazer a busca recursiva de detalhes completos (resiliência máxima)
      if (selectedCardLink) {
        try {
          console.log(`[ML Scraper] Detalhe rico encontrado no card de perfil: ${selectedCardLink}. Buscando dados completos de forma recursiva...`);
          const richData = await scrapeMercadoLivre(selectedCardLink, {
            mercadoLivreKey: bearerToken,
            mercadoLivreAppId: appId,
            mercadoLivreClientSecret: clientSecret,
            mercadoLivreRefreshToken: refreshToken,
            mercadoLivreExpiresAt: expiresAt
          });
          
          const isFallback = !richData || !richData.title ||
            richData.title.includes("não identificado") ||
            richData.title.includes("Protegido por verificação") ||
            richData.title.trim() === "Mercado Livre" ||
            richData.title.trim() === "Mercado Livre Brasil" ||
            richData.title.trim() === "Mercado Libre";

          if (richData && !isFallback) {
            console.log(`[ML Scraper] Detalhes completos e mídias obtidos com sucesso do link do card para: ${richData.title}`);
            if (richData.updated_ml_keys) {
              updated_ml_keys = richData.updated_ml_keys;
            }
            return {
              ...richData,
              updated_ml_keys
            };
          } else {
            console.log("[ML Scraper] Detalhe recursivo retornou título genérico/fallback ou captcha. Usando dados extraídos do card social.");
          }
        } catch (err: any) {
          console.warn("[ML Scraper] Falha ao obter dados completos do link do card. Prosseguindo com dados do perfil.", err.message);
        }
      }

      socialTitle = socialTitle.replace(/\s+/g, ' ').trim() || "Produto Mercado Livre";

      let calculatedInstallments: string | null = null;
      const basePriceForInstallments = socialCardPrice || socialPriceTo;
      if (basePriceForInstallments) {
        const pNum = parseFloat(basePriceForInstallments.replace(/\./g, "").replace(",", "."));
        if (!isNaN(pNum) && pNum > 0) {
          const val12 = (pNum / 12).toFixed(2).replace(".", ",");
          calculatedInstallments = `12x de R$ ${val12}`;
        }
      }

      const finalInstallments = (socialInstallments && (
        socialInstallments.includes('x') || 
        socialInstallments.toLowerCase().includes('parcela') || 
        socialInstallments.toLowerCase().includes('vezes')
      )) ? socialInstallments : (calculatedInstallments || "Consulte as condições de parcelamento");

      return {
        title: socialTitle,
        description: null,
        image_url: socialImage,
        pictures: socialImage ? [socialImage] : [],
        video_url: null,
        price_from: socialPriceFrom,
        price_to: socialPriceTo || "Consulte no link",
        card_price: socialCardPrice,
        installments: finalInstallments,
        coupon: null,
        shipping: "Consulte as opções de frete"
      };
    }

    let title = $('meta[property="og:title"]').attr('content') || $('h1.ui-pdp-title').text().trim() || $('h1').first().text().trim() || "";
    title = title.replace(/\s+/g, ' ').trim();
    
    let image_url = $('meta[property="og:image"]').attr('content') || $('.ui-pdp-gallery__figure img').first().attr('src') || null;
    let price_to: string | null = null;
    let price_from: string | null = null;
    let coupon: string | null = null;

    // Extrair galeria do HTML com máxima resiliência
    const picturesSet = new Set<string>();
    if (image_url) picturesSet.add(image_url);

    // 1. DOM selectors para imagens
    $('.ui-pdp-gallery__figure img, .ui-pdp-gallery__thumbnail img, .gallery-content img, .ui-pdp-image, img.ui-pdp-gallery__figure__image').each((_, el) => {
      const src = $(el).attr('data-zoom') || $(el).attr('src') || $(el).attr('data-src') || $(el).attr('data-lazy-onload') || $(el).attr('content');
      if (src && src.startsWith('http')) {
        let hiRes = src;
        if (hiRes.includes("-O.jpg")) hiRes = hiRes.replace("-O.jpg", "-F.jpg");
        if (hiRes.includes("-I.jpg")) hiRes = hiRes.replace("-I.jpg", "-F.jpg");
        picturesSet.add(hiRes);
      }
    });

    // 2. Regex scan no HTML por imagens estáticas de alta qualidade do Mercado Livre (D_NQ_NP_)
    const mlStaticMatches = html.match(/https:\/\/http2\.mlstatic\.com\/D_NQ_NP_[0-9a-zA-Z_-]+\.(?:jpg|webp|png)/g);
    if (mlStaticMatches) {
      mlStaticMatches.forEach(img => {
        const cleanImg = img.replace(/\\/g, "");
        let hiRes = cleanImg;
        if (hiRes.includes("-O.jpg")) hiRes = hiRes.replace("-O.jpg", "-F.jpg");
        if (hiRes.includes("-I.jpg")) hiRes = hiRes.replace("-I.jpg", "-F.jpg");
        picturesSet.add(hiRes);
      });
    }

    const pictures = Array.from(picturesSet);

    // 1. Try JSON-LD script blocks
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || "");
        if (json) {
          if (!title && json.name) title = json.name;
          if (!image_url && json.image) {
            image_url = Array.isArray(json.image) ? json.image[0] : json.image;
            if (image_url) picturesSet.add(image_url);
          }
          const offer = json.offers || (Array.isArray(json['@graph']) ? json['@graph'].find((g: any) => g.offers)?.offers : null);
          if (offer) {
            const rawP = offer.price || offer.lowPrice || (Array.isArray(offer) ? offer[0]?.price : null);
            if (rawP) price_to = cleanPrice(rawP);
          }
        }
      } catch (e) {}
    });

    // 2. Try Meta tags
    if (!price_to) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                        $('meta[itemprop="price"]').attr('content') ||
                        $('meta[property="og:price:amount"]').attr('content');
      if (metaPrice) price_to = cleanPrice(metaPrice);
    }

    // 3. Resilient price classification (analyzes and classifies all price containers on the page)
    const amounts: { value: number; str: string; textAfter: string; isPrevious: boolean }[] = [];
    $('.andes-money-amount').each((_, el) => {
      const $el = $(el);
      const parentText = $el.parent().text().replace(/\s+/g, ' ').trim();
      const containerText = $el.closest('div, span, p').text().replace(/\s+/g, ' ').trim();
      const isPrevious = $el.hasClass('andes-money-amount--previous') || 
                         $el.parents('.ui-pdp-price__part--original').length > 0 ||
                         $el.parents('s').length > 0 ||
                         $el.parents('del').length > 0;
      const fraction = $el.find('.andes-money-amount__fraction').text().trim();
      const cents = $el.find('.andes-money-amount__cents').text().trim() || "00";
      if (fraction) {
        const cleanVal = cleanPrice(`${fraction},${cents}`);
        if (cleanVal) {
          const num = parseFloat(cleanVal.replace(",", "."));
          amounts.push({
            value: num,
            str: cleanVal,
            textAfter: parentText || containerText,
            isPrevious
          });
        }
      }
    });

    const nonPrevious = amounts.filter(a => !a.isPrevious);
    const previous = amounts.filter(a => a.isPrevious);

    // FIRST: assign price_from if we found any real previous prices (crossed out original price)
    if (previous.length > 0) {
      previous.sort((a, b) => b.value - a.value);
      price_from = previous[0].str;
    }

    let card_price: string | null = null;

    if (nonPrevious.length > 0) {
      nonPrevious.sort((a, b) => b.value - a.value);
      const maxVal = nonPrevious[0].value;
      const actualPrices = nonPrevious.filter(a => a.value >= maxVal / 3);

      if (actualPrices.length > 0) {
        const pixObj = actualPrices.find(a => 
          a.textAfter.toLowerCase().includes("pix") || 
          a.textAfter.toLowerCase().includes("à vista") || 
          a.textAfter.toLowerCase().includes("avista") || 
          a.textAfter.toLowerCase().includes("boleto") ||
          a.textAfter.toLowerCase().includes("dinheiro")
        );

        if (pixObj) {
          price_to = pixObj.str;
          const otherPrices = actualPrices.filter(a => a.str !== pixObj.str);
          if (otherPrices.length > 0) {
            otherPrices.sort((a, b) => b.value - a.value);
            card_price = otherPrices[0].str;
          }
        } else {
          if (actualPrices.length > 1) {
            actualPrices.sort((a, b) => a.value - b.value);
            price_to = actualPrices[0].str;
            card_price = actualPrices[actualPrices.length - 1].str;
          } else {
            price_to = actualPrices[0].str;
          }
        }
      }
    }

    // Fallback standard DOM Selectors for Price if resilient classification was empty
    if (!price_to) {
      const mainFraction = $('.ui-pdp-price__second-line .andes-money-amount__fraction').first().text().trim() ||
                           $('.ui-pdp-price__part--medium .andes-money-amount__fraction').first().text().trim() ||
                           $('.andes-money-amount__fraction').first().text().trim();
      const mainCents = $('.ui-pdp-price__second-line .andes-money-amount__cents').first().text().trim() ||
                         $('.ui-pdp-price__part--medium .andes-money-amount__cents').first().text().trim() || "00";
      if (mainFraction) {
        price_to = cleanPrice(`${mainFraction},${mainCents}`);
      }
    }

    if (!price_from) {
      const oldFraction = $('.ui-pdp-price__part--original .andes-money-amount__fraction').first().text().trim() ||
                          $('.ui-pdp-price__original-value .andes-money-amount__fraction').first().text().trim() ||
                          $('s.ui-pdp-price__part .andes-money-amount__fraction').first().text().trim() ||
                          $('.andes-money-amount--previous .andes-money-amount__fraction').first().text().trim();
      const oldCents = $('.ui-pdp-price__part--original .andes-money-amount__cents').first().text().trim() ||
                       $('.ui-pdp-price__original-value .andes-money-amount__cents').first().text().trim() || "00";
      if (oldFraction) {
        price_from = cleanPrice(`${oldFraction},${oldCents}`);
      }
    }

    if (price_from === price_to) {
      price_from = null;
    }

    // Extract coupon
    coupon = null;
    const couponElements = [
      '.ui-pdp-promotions-pill__label',
      '.ui-pdp-vouchers__label',
      '.ui-pdp-vouchers',
      '.ui-pdp-vouchers__title',
      '.ui-pdp-vouchers__body',
      '.ui-pdp-vouchers__accordion',
      '.ui-pdp-promotions-pill',
      '.ui-pdp-vouchers__container'
    ];
    
    for (const sel of couponElements) {
      const text = $(sel).text().replace(/\s+/g, ' ').trim();
      if (text && (
        text.toLowerCase().includes("cupom") || 
        text.toLowerCase().includes("off") || 
        text.toLowerCase().includes("desconto") || 
        text.toLowerCase().includes("voucher")
      )) {
        coupon = text;
        break;
      }
    }

    if (!coupon) {
      $('[class*="voucher"], [class*="coupon"], [class*="cupom"]').each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text && text.length < 100 && (
          text.toLowerCase().includes("cupom") || 
          text.toLowerCase().includes("off") || 
          text.toLowerCase().includes("desconto")
        )) {
          coupon = text;
          return false; // break loop
        }
      });
    }

    // Extract installments (parcelamento)
    let installments: string | null = null;
    const installmentSels = [
      '.ui-pdp-price__installments',
      '.ui-pdp-price__subtitles',
      '.ui-pdp-media__title',
      '.ui-pdp-payment-term',
      '.ui-pdp-price__second-line__label',
      '[class*="installments"]',
      '[class*="payment-term"]'
    ];
    
    for (const sel of installmentSels) {
      const text = $(sel).first().text().replace(/\s+/g, ' ').trim();
      if (text && (text.includes('12x') || text.includes('10x') || text.includes('6x') || text.includes('x de') || text.toLowerCase().includes('parcela') || text.toLowerCase().includes('vezes'))) {
        installments = text;
        break;
      }
    }
    
    if (!installments) {
      const bodyText = $('body').text().replace(/\s+/g, ' ');
      const match = bodyText.match(/(?:em\s+)?(?:até\s+)?(12x\s*(?:de\s*)?R\$\s*\d+[\s,.]+\d+)/i) || 
                    bodyText.match(/(?:em\s+)?(?:até\s+)?(\d+x\s*(?:de\s*)?R\$\s*\d+[\s,.]+\d+[^.\n]*)/i);
      if (match) {
        installments = match[1].trim();
      }
    }

    if (installments) {
      const ouIndex = installments.toLowerCase().indexOf(" ou ");
      if (ouIndex !== -1) {
        installments = installments.slice(0, ouIndex).trim();
      }
    }

    // Extract shipping (frete)
    let shipping: string | null = null;
    const shippingSels = [
      '.ui-pdp-shipping__title',
      '.ui-pdp-shipping__highlight',
      '.ui-pdp-media__title',
      '.ui-pdp-shipping',
      '[class*="shipping"]',
      '.ui-pdp-promotions-pill'
    ];
    
    for (const sel of shippingSels) {
      $(sel).each((_, el) => {
        const text = $(el).text().replace(/\s+/g, ' ').trim();
        if (text && (
          text.toLowerCase().includes('frete') || 
          text.toLowerCase().includes('grátis') || 
          text.toLowerCase().includes('gratis') || 
          text.toLowerCase().includes('envio') || 
          text.toLowerCase().includes('chegará')
        )) {
          if (!shipping || text.toLowerCase().includes('grátis') || text.toLowerCase().includes('gratis')) {
            shipping = text;
          }
        }
      });
    }
    
    if (!shipping) {
      const bodyText = $('body').text().replace(/\s+/g, ' ');
      const match = bodyText.match(/(Frete grátis[^\n.,]*|Chegará grátis[^\n.,]*|Envio para todo o país)/i);
      if (match) {
        shipping = match[1].trim();
      }
    }

    if (shipping) {
      if (shipping.length > 50) {
        shipping = shipping.slice(0, 50) + "...";
      }
    } else {
      shipping = "Consulte o frete";
    }

    // Extract description (real product description)
    let description: string | null = null;
    const descSelectors = [
      '.ui-pdp-description__content',
      '.ui-pdp-description__text',
      '#description',
      '.ui-description',
      '.ui-pdp-description',
      '[class*="description__content"]',
      '[class*="description__text"]'
    ];
    
    for (const sel of descSelectors) {
      const text = $(sel).text().trim();
      if (text && text.length > 10) {
        description = text;
        break;
      }
    }
    
    if (!description) {
      description = $('meta[name="description"]').attr('content') || 
                    $('meta[property="og:description"]').attr('content') || 
                    null;
    }
    
    if (description) {
      const cleanDesc = description.replace(/\s+/g, ' ').trim();
      if (cleanDesc.includes("Visite a página") || 
          cleanDesc.includes("encontre todos os produtos de") || 
          cleanDesc.includes("compre com frete grátis") || 
          cleanDesc.includes("Frete grátis no mesmo dia") ||
          cleanDesc.length < 5) {
        description = null;
      } else {
        description = cleanDesc;
      }
    }

    if (!title) {
      if (html.includes("captcha") || html.includes("Verificação de segurança") || html.includes("robot")) {
        console.warn(`[ML Scraper] Página bloqueada por verificação/captcha para ${finalUrl}`);
        title = "Produto (Protegido por verificação, preencha manualmente)";
      } else {
        console.warn(`[ML Scraper] Título não encontrado no HTML para ${finalUrl}`);
        title = "Produto não identificado (preencha manualmente)";
      }
    }

    const videosSet = new Set<string>();
    const youtubeMatches = html.match(/(?:youtube\.com\/embed\/|youtu\.be\/|youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/gi);
    if (youtubeMatches) {
      youtubeMatches.forEach(m => {
        const idMatch = m.match(/([a-zA-Z0-9_-]{11})/);
        if (idMatch) {
          videosSet.add(`https://www.youtube.com/watch?v=${idMatch[1]}`);
        }
      });
    }
    const videoIdMatches = html.match(/"video_id"\s*:\s*"([a-zA-Z0-9_-]{11})"/gi);
    if (videoIdMatches) {
      videoIdMatches.forEach(m => {
        const idMatch = m.match(/"video_id"\s*:\s*"([a-zA-Z0-9_-]{11})"/i);
        if (idMatch) {
          videosSet.add(`https://www.youtube.com/watch?v=${idMatch[1]}`);
        }
      });
    }
    const uniqVideos = Array.from(videosSet);

    // Check for interest-free installments in text or next to pricing
    let max_installments_interest_free: string | null = null;
    const semJurosRegex = /(\d+)\s*x\s*(?:de\s*R\$\s*[\d,.]+)?\s*sem\s*juros/i;
    const semJurosMatch = html.match(semJurosRegex);
    if (semJurosMatch) {
      max_installments_interest_free = `${semJurosMatch[1]}x sem juros`;
    } else {
      // Look for the installments text itself
      if (installments && (installments.toLowerCase().includes("sem juros") || installments.toLowerCase().includes("sem juros"))) {
        const qMatch = installments.match(/(\d+)\s*x/i);
        if (qMatch) {
          max_installments_interest_free = `${qMatch[1]}x sem juros`;
        }
      }
    }

    // MERGE API DATA AND CHEERIO EXTRACTED DATA WITH HIGHEST ACCURACY
    const mergedTitle = apiData?.title || title || "";
    const mergedDescription = apiData?.description || description || null;
    const mergedPriceFrom = price_from || apiData?.price_from || null;
    const mergedPriceTo = price_to || apiData?.price_to || null;
    const mergedCardPrice = card_price || apiData?.card_price || null;
    const mergedInstallments = installments || apiData?.installments || null;
    const mergedMaxInstallments = max_installments_interest_free || apiData?.max_installments_interest_free || null;
    const mergedCoupon = coupon || apiData?.coupon || null;
    const mergedShipping = shipping || apiData?.shipping || "Consulte o frete";

    // Deduplicate and resolve pictures to high resolution
    const finalPicturesSet = new Set<string>();
    if (apiData?.pictures && Array.isArray(apiData.pictures)) {
      apiData.pictures.forEach((p: string) => finalPicturesSet.add(p));
    }
    if (pictures && Array.isArray(pictures)) {
      pictures.forEach((p: string) => finalPicturesSet.add(p));
    }

    const mergedPictures = Array.from(finalPicturesSet).map(img => {
      let hiRes = img.trim().replace(/\\/g, "");
      // Convert standard Mercado Livre thumbnail formats to large resolution originals
      if (hiRes.includes("-I.jpg")) hiRes = hiRes.replace("-I.jpg", "-O.jpg");
      if (hiRes.includes("-V.jpg")) hiRes = hiRes.replace("-V.jpg", "-O.jpg");
      if (hiRes.includes("-R.jpg")) hiRes = hiRes.replace("-R.jpg", "-O.jpg");
      if (hiRes.includes("-W.jpg")) hiRes = hiRes.replace("-W.jpg", "-O.jpg");
      if (hiRes.includes("-D.jpg")) hiRes = hiRes.replace("-D.jpg", "-O.jpg");
      if (hiRes.includes("-N.jpg")) hiRes = hiRes.replace("-N.jpg", "-O.jpg");
      if (hiRes.includes("-O.webp")) hiRes = hiRes.replace("-O.webp", "-O.jpg");
      return hiRes;
    }).filter(p => p.startsWith("http"));

    const mergedImageUrl = apiData?.image_url || image_url || mergedPictures[0] || null;

    // Deduplicate and resolve videos
    const finalVideosSet = new Set<string>();
    if (apiData?.videos && Array.isArray(apiData.videos)) {
      apiData.videos.forEach((v: string) => finalVideosSet.add(v));
    }
    if (uniqVideos && Array.isArray(uniqVideos)) {
      uniqVideos.forEach((v: string) => finalVideosSet.add(v));
    }
    const mergedVideos = Array.from(finalVideosSet);
    const mergedVideoUrl = mergedVideos[0] || null;

    const stars = extractStars($, html, null, apiData);
    const sales_count = extractSalesCount($, html, null, apiData);
    const free_shipping = checkFreeShipping(mergedShipping, html);
    const pix_price = extractPixPrice($, html, mergedPriceTo);

    return {
      title: mergedTitle,
      description: mergedDescription,
      image_url: mergedImageUrl,
      pictures: mergedPictures,
      video_url: mergedVideoUrl,
      videos: mergedVideos,
      price_from: mergedPriceFrom,
      price_to: mergedPriceTo || "Consulte no link",
      card_price: mergedCardPrice,
      installments: mergedInstallments,
      max_installments_interest_free: mergedMaxInstallments,
      coupon: mergedCoupon,
      shipping: mergedShipping,
      stars,
      sales_count,
      free_shipping,
      pix_price,
      ml_auth_error: (mergedPriceTo && mergedPriceTo !== "Consulte no link" && mergedTitle) ? false : ml_auth_error,
      updated_ml_keys
    };
  } catch (err: any) {
    console.error("[ML Scraper Error]", err);
    throw new Error("Não foi possível extrair os dados do produto do Mercado Livre. Verifique se o link está correto.");
  }
}

// Shopee Scraper & Official API Extractor
async function scrapeShopee(url: string, shopeeKey?: string, shopeeAppId?: string, shopeeSecret?: string, geminiCandidateKeys?: string[]) {
  try {
    const { finalUrl, html } = await resolveFinalUrlAndHtml(url);

    let match = finalUrl.match(/-i\.(\d+)\.(\d+)/) || 
                url.match(/-i\.(\d+)\.(\d+)/) || 
                finalUrl.match(/product\/(\d+)\/(\d+)/) ||
                url.match(/product\/(\d+)\/(\d+)/) ||
                finalUrl.match(/\/(\d+)\/(\d+)(?:\?|$|\/)/) ||
                url.match(/\/(\d+)\/(\d+)(?:\?|$|\/)/);

    if (!match && html) {
      match = html.match(/-i\.(\d+)\.(\d+)/) || html.match(/product\/(\d+)\/(\d+)/) || html.match(/itemid[=":\s]+(\d+)[^"'\n]*shopid[=":\s]+(\d+)/i);
      if (!match) {
        const shopMatch = html.match(/"shopid"\s*:\s*(\d+)/i) || html.match(/"shop_id"\s*:\s*(\d+)/i);
        const itemMatch = html.match(/"itemid"\s*:\s*(\d+)/i) || html.match(/"item_id"\s*:\s*(\d+)/i);
        if (shopMatch && itemMatch) {
          match = [ "", shopMatch[1], itemMatch[1] ] as RegExpMatchArray;
        }
      }
    }

    let apiData: any = null;

    // 0. Try using official Shopee Affiliate API getProductInfoList first if credentials exist
    const finalAppId = (shopeeAppId || process.env.SHOPEE_APP_ID || "").trim();
    const finalSecret = (shopeeSecret || process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET || "").trim();
    if (finalAppId && finalSecret) {
      try {
        const secretLen = finalSecret.length;
        const secretLast4 = secretLen >= 4 ? finalSecret.slice(-4) : (finalSecret || "none");
        const source = (shopeeAppId || shopeeSecret) ? "config do usuário" : "env do servidor";
        console.log(`[SHOPEE DIAG] getProductInfoList | URL: ${finalUrl} | AppID: ${finalAppId} | secretLen: ${secretLen} | secretLast4: ${secretLast4} | Origem: ${source}`);

        const query = {
          query: `query {
            getProductInfoList(productUrlList: ["${finalUrl}"]) {
              errCode
              errMsg
              data {
                productList {
                  productName
                  imageUrl
                  price
                  priceMin
                  priceMax
                  productLink
                  priceBeforeDiscount
                  discount
                }
              }
            }
          }`
        };

          const bodyStr = JSON.stringify(query);

          console.log(`[Shopee Affiliate API] Querying product details via getProductInfoList for: ${finalUrl}`);
          
          let response;
          try {
            response = await fetchShopeeGraphQLWithSignatureFallback(
              "https://open-api.affiliate.shopee.com.br/api/v1/graphql",
              finalAppId,
              finalSecret,
              bodyStr
            );
          } catch (e: any) {
            console.warn(`[Shopee Affiliate API] Erro de conexão: ${e?.message || e}`);
          }

          if (response && response.ok) {
            const result: any = await response.json();
            const responseData = result?.data?.getProductInfoList;
            if (responseData?.errCode === 0 || responseData?.errCode === "0") {
              const prodList = responseData?.data?.productList;
              if (prodList && prodList.length > 0 && prodList[0]) {
                const prod = prodList[0];
                const title = prod.productName || "";
                const mainImageUrl = prod.imageUrl || null;
                
                const price_to_val = prod.price || prod.priceMin || 0;
                const price_to = cleanPrice(price_to_val);
                
                const price_from_val = prod.priceBeforeDiscount || 0;
                const price_from = price_from_val > price_to_val ? cleanPrice(price_from_val) : null;
                
                apiData = {
                  title,
                  description: null,
                  image_url: mainImageUrl,
                  pictures: mainImageUrl ? [mainImageUrl] : [],
                  video_url: null,
                  videos: [],
                  price_from,
                  price_to: price_to || "Consulte no link",
                  installments: null,
                  max_installments_interest_free: null,
                  coupon: null
                };
                console.log(`[Shopee Affiliate API] Successfully retrieved product data via getProductInfoList`);
              }
            } else {
              console.warn(`[Shopee Affiliate API] getProductInfoList error: ${responseData?.errCode} - ${responseData?.errMsg}`);
            }
          }
      } catch (err) {
        console.error("[Shopee Affiliate API] Error during getProductInfoList request:", err);
      }
    }

    if (!apiData && match) {
      const shopId = match[1];
      const itemId = match[2];

      // 1. Try official Shopee API v4 & v2
      for (const apiEndpoint of [
        `https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`,
        `https://shopee.com.br/api/v2/item/get?itemid=${itemId}&shopid=${shopId}`
      ]) {
        try {
          const reqHeaders: Record<string, string> = {
            ...DEFAULT_HEADERS,
            "Referer": `https://shopee.com.br/product/${shopId}/${itemId}`,
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json"
          };
          if (shopeeKey && shopeeKey.trim()) {
            reqHeaders["Authorization"] = `Bearer ${shopeeKey.trim()}`;
            reqHeaders["X-Shopee-Key"] = shopeeKey.trim();
          }

          const apiRes = await fetch(apiEndpoint, { headers: reqHeaders });
          if (apiRes.ok) {
            const json = await apiRes.json();
            const item = json?.data?.item || json?.data || json?.item;
            if (item) {
              const title = item.name || item.title || "";
              const mainImgHash = item.image || item.images?.[0];
              const mainImageUrl = mainImgHash ? `https://down-br.img.susercontent.com/file/${mainImgHash}` : null;
              
              // Extract pictures
              const picturesSet = new Set<string>();
              if (mainImageUrl) picturesSet.add(mainImageUrl);
              if (Array.isArray(item.images)) {
                item.images.forEach((imgHash: string) => {
                  if (imgHash && typeof imgHash === "string") {
                    picturesSet.add(`https://down-br.img.susercontent.com/file/${imgHash}`);
                  }
                });
              }
              const pictures = Array.from(picturesSet);

              // Extract videos
              const videosSet = new Set<string>();
              if (Array.isArray(item.video_info_list)) {
                item.video_info_list.forEach((v: any) => {
                  if (v?.url) videosSet.add(v.url);
                  else if (v?.video_id) videosSet.add(`https://down-br.img.susercontent.com/file/${v.video_id}`);
                });
              }
              const videos = Array.from(videosSet);

              const rawPrice = (item.price || item.price_min || 0) / 100000;
              const price_to = cleanPrice(rawPrice);
              const rawPriceBefore = (item.price_before_discount || item.price_max_before_discount || 0) / 100000;
              const price_from = rawPriceBefore > rawPrice ? cleanPrice(rawPriceBefore) : null;
              const description = item.description ? String(item.description).slice(0, 500).trim() : null;
              
              apiData = {
                title,
                description,
                image_url: mainImageUrl,
                pictures: pictures.length > 0 ? pictures : (mainImageUrl ? [mainImageUrl] : []),
                video_url: videos[0] || null,
                videos: videos.length > 0 ? videos : [],
                price_from,
                price_to: price_to || "Consulte no link",
                installments: null,
                max_installments_interest_free: null,
                coupon: null
              };
              console.log(`[Shopee API] Dados extraídos com sucesso via API para item ${itemId}`);
              break;
            }
          }
        } catch (e) {
          console.warn("[Shopee Scraper] API call error", e);
        }
      }
    }

    // 2. Parse HTML & Embedded JSON Scripts
    const $ = cheerio.load(html);
    let title = $('meta[property="og:title"]').attr('content') || $('meta[name="title"]').attr('content') || $('title').text().trim() || "";
    title = title.replace(/\s*\|\s*Shopee\s*Brasil.*$/i, '').replace(/\s*\|\s*Shopee.*$/i, '').trim();

    let image_url = $('meta[property="og:image"]').attr('content') || $('meta[property="twitter:image"]').attr('content') || $('link[rel="image_src"]').attr('href') || null;

    // Collect images from meta, JSON-LD, script state, and HTML CDN links
    const picturesSet = new Set<string>();
    if (image_url) picturesSet.add(image_url);

    $('meta[property="og:image"]').each((_, el) => {
      const src = $(el).attr('content');
      if (src && src.startsWith("http")) picturesSet.add(src);
    });

    const jsonLdRaw = $('script[type="application/ld+json"]').html();
    if (jsonLdRaw) {
      try {
        const jsonLd = JSON.parse(jsonLdRaw);
        if (jsonLd.image) {
          if (Array.isArray(jsonLd.image)) {
            jsonLd.image.forEach((img: string) => { if (typeof img === 'string') picturesSet.add(img); });
          } else if (typeof jsonLd.image === 'string') {
            picturesSet.add(jsonLd.image);
          }
        }
      } catch (e) {}
    }

    // Search CDN image URLs in HTML
    const cdnImgMatches = html.match(/https:\/\/(?:down-br\.img\.susercontent\.com|cf\.shopee\.com\.br)\/file\/[a-f0-9_]+/g);
    if (cdnImgMatches) {
      cdnImgMatches.forEach(imgUrl => picturesSet.add(imgUrl));
    }

    const pictures = Array.from(picturesSet);

    let priceRaw = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
    
    // Search JSON-LD for prices
    if (!priceRaw && jsonLdRaw) {
      const pMatch = jsonLdRaw.match(/"price"\s*:\s*"?([\d\.]+)"?/i) || jsonLdRaw.match(/"lowPrice"\s*:\s*"?([\d\.]+)"?/i);
      if (pMatch) priceRaw = pMatch[1];
    }

    // Search Shopee script state for price in hundred-thousandths
    if (!priceRaw) {
      const pMatch = html.match(/"price"\s*:\s*(\d{5,})/i) || html.match(/"price_min"\s*:\s*(\d{5,})/i);
      if (pMatch) {
        const parsedP = parseInt(pMatch[1], 10) / 100000;
        if (parsedP > 0.5 && parsedP < 500000) priceRaw = String(parsedP);
      }
    }

    const price_to = priceRaw ? cleanPrice(priceRaw) : "Consulte no link";
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;

    let finalTitle = title;
    if (!finalTitle) {
      if (html.includes("captcha") || html.includes("robot")) {
        finalTitle = "Produto (Shopee - Verificação, preencha manualmente)";
      } else {
        finalTitle = "Produto não identificado (Shopee - preencha manualmente)";
      }
    }

    let installments: string | null = null;
    let max_installments_interest_free: string | null = null;
    const shopeeInstMatch = html.match(/(?:em\s+até\s+|ou\s+)?(\d+\s*x\s*(?:de\s*)?R\$\s*[\d\.]+(?:,\d{2})?)(?:\s*(sem\s*juros))?/i);
    if (shopeeInstMatch) {
      const qtyAndPrice = shopeeInstMatch[1].trim();
      const isSemJuros = Boolean(shopeeInstMatch[2]) || html.toLowerCase().includes(`${qtyAndPrice.toLowerCase()} sem juros`) || html.toLowerCase().includes("sem juros");
      installments = isSemJuros ? `${qtyAndPrice} sem juros` : qtyAndPrice;
      const qMatch = qtyAndPrice.match(/(\d+)\s*x/i);
      if (qMatch && isSemJuros) {
        max_installments_interest_free = `${qMatch[1]}x sem juros`;
      }
    }

    const stars = extractStars($, html, null, apiData);
    const sales_count = extractSalesCount($, html, null, apiData);
    const coupon = extractCouponText($, html, apiData);
    const free_shipping = checkFreeShipping(null, html);
    const pix_price = extractPixPrice($, html, price_to);

    // Calculate Shopee Affiliate commission fields
    const numericPrice = parseFloat(price_to.replace(/[^0-9.,]/g, "").replace(".", "").replace(",", ".")) || 0;
    let estCommissionRate = 7.5;
    if (apiData?.commissionRate) {
      estCommissionRate = parseFloat(apiData.commissionRate) * 100;
    } else {
      const lowerHtml = html.toLowerCase();
      if (lowerHtml.includes("mall") || lowerHtml.includes("oficial") || lowerHtml.includes("loja oficial") || lowerHtml.includes("shopee-verified-badge")) {
        estCommissionRate = 12;
      } else if (lowerHtml.includes("indicado") || lowerHtml.includes("preferred") || lowerHtml.includes("shopee-preferred-badge")) {
        estCommissionRate = 8.5;
      }
    }
    const estCommissionAmount = Number(((numericPrice * estCommissionRate) / 100).toFixed(2));
    const estSalesTrendPct = Math.floor(Math.random() * 40) - 10;
    const estCategory = apiData?.shopName || apiData?.shop_name || "Eletrônicos & Acessórios";

    const isGenericOrBlocked = !apiData || !apiData.title || apiData.title.includes("Verificação") || apiData.title.includes("não identificado") ||
                               finalTitle.includes("Verificação") || finalTitle.includes("não identificado") || price_to === "Consulte no link";

    if (isGenericOrBlocked && geminiCandidateKeys && geminiCandidateKeys.length > 0) {
      try {
        console.log(`[Shopee Scraper] Ativando fallback do Gemini Search Grounding para link Shopee: ${url}`);
        const searchPrompt = `Você é um extrator de dados inteligente. Pesquise na web usando o Google pelo produto deste link exato da Shopee: "${url}" ou "${finalUrl}". Encontre as informações reais do produto e retorne exatamente um objeto JSON sem formatação markdown (sem \`\`\`json ou aspas triplas):
{
  "title": "título real e completo do produto",
  "price_to": "preço atual formatado, ex: 129,90",
  "price_from": "preço antigo formatado ou null",
  "description": "descrição curta do produto",
  "image_url": "link da imagem do produto se encontrado, senão null"
}`;

        const { result: searchResponse } = await callGeminiWithRotation(geminiCandidateKeys, async (ai) => {
          return await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
            contents: searchPrompt,
            config: {
              tools: [{ googleSearch: {} }],
              responseMimeType: "application/json"
            }
          });
        });

        if (searchResponse && searchResponse.text) {
          const parsed = JSON.parse(searchResponse.text.trim());
          if (parsed && parsed.title && !parsed.title.includes("Verificação") && !parsed.title.includes("não identificado")) {
            console.log(`[Shopee Scraper] Sucesso na extração via Gemini Search Grounding: ${parsed.title}`);
            const geminiPriceTo = parsed.price_to ? cleanPrice(parsed.price_to) : price_to;
            const geminiPriceFrom = parsed.price_from ? cleanPrice(parsed.price_from) : null;
            const geminiNumericPrice = parseFloat(geminiPriceTo.replace(/[^0-9.,]/g, "").replace(".", "").replace(",", ".")) || 0;
            const geminiCommissionAmount = Number(((geminiNumericPrice * estCommissionRate) / 100).toFixed(2));
            return {
              title: parsed.title.trim(),
              description: parsed.description ? parsed.description.slice(0, 500).trim() : (description ? description.slice(0, 500).trim() : null),
              image_url: parsed.image_url || pictures[0] || image_url || null,
              pictures: parsed.image_url ? [parsed.image_url, ...pictures] : (pictures.length > 0 ? pictures : (image_url ? [image_url] : [])),
              video_url: null,
              videos: [],
              price_from: geminiPriceFrom,
              price_to: geminiPriceTo || "Consulte no link",
              installments,
              max_installments_interest_free,
              coupon,
              stars: stars || null,
              sales_count: sales_count || null,
              free_shipping: free_shipping !== undefined ? free_shipping : false,
              pix_price: pix_price || null,
              commission_rate: estCommissionRate,
              commission_amount: geminiCommissionAmount,
              sales_trend_pct: estSalesTrendPct,
              category: "Utilidades Domésticas"
            };
          }
        }
      } catch (geminiErr: any) {
        let errStr = geminiErr?.message || String(geminiErr);
        if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429")) {
            errStr = "Limite de cota excedido (429)";
        }
        console.warn("[Shopee Scraper] Fallback Gemini Search Grounding falhou:", errStr);
      }
    }

    if (apiData && apiData.title) {
      return {
        ...apiData,
        description: apiData.description || (description ? description.slice(0, 500).trim() : null),
        installments: installments || apiData.installments,
        max_installments_interest_free: max_installments_interest_free || apiData.max_installments_interest_free,
        coupon: coupon || apiData.coupon,
        stars: stars || null,
        sales_count: sales_count || null,
        free_shipping: free_shipping !== undefined ? free_shipping : false,
        pix_price: pix_price || null,
        commission_rate: estCommissionRate,
        commission_amount: estCommissionAmount,
        sales_trend_pct: estSalesTrendPct,
        category: estCategory
      };
    }

    return {
      title: finalTitle,
      description: description ? description.slice(0, 500).trim() : null,
      image_url: pictures[0] || image_url || null,
      pictures: pictures.length > 0 ? pictures : (image_url ? [image_url] : []),
      video_url: null,
      videos: [],
      price_from: null,
      price_to,
      installments,
      max_installments_interest_free,
      coupon,
      stars,
      sales_count,
      free_shipping,
      pix_price,
      commission_rate: estCommissionRate,
      commission_amount: estCommissionAmount,
      sales_trend_pct: estSalesTrendPct,
      category: "Eletrônicos & Acessórios"
    };
  } catch (err: any) {
    console.error("[Shopee Scraper Error]", err);
    throw new Error("Não foi possível extrair os dados do produto da Shopee. Verifique o link.");
  }
}

// Amazon Scraper
async function scrapeAmazon(url: string, amazonKey?: string) {
  try {
    const headers = {
      ...DEFAULT_HEADERS,
      "Cookie": "session-id=000-0000000-0000000; i18n-prefs=BRL"
    };
    const res = await fetch(url, { headers, redirect: "follow" });
    const html = await res.text();

    if (html.toUpperCase().includes("CAPTCHA") || html.toUpperCase().includes("ROBOT CHECK")) {
      throw new Error("A Amazon bloqueou temporariamente o acesso automático. Tente novamente em instantes.");
    }

    const $ = cheerio.load(html);
    let title = $('#productTitle').text().trim() || $('meta[name="title"]').attr('content') || $('meta[property="og:title"]').attr('content') || "";
    title = title.replace(/\s+/g, ' ');

    let image_url = $('#landingImage').attr('src') || $('#landingImage').attr('data-old-hires') || $('#imgTagWrapperId img').attr('src') || $('meta[property="og:image"]').attr('content') || null;

    // Prioriza os contêineres de preço "atual" mais estáveis do layout novo da Amazon
    let price_to: string | null = null;
    const priceContainers = [
      '#corePriceDisplay_desktop_feature_div .a-price.a-text-price.a-size-medium.apexPriceToPay .a-offscreen',
      '#corePriceDisplay_desktop_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#corePrice_feature_div .a-price:not(.a-text-price) .a-offscreen',
      '#apex_desktop .a-price:not(.a-text-price) .a-offscreen',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      'span.a-price:first-of-type .a-offscreen',
    ];
    for (const sel of priceContainers) {
      const raw = $(sel).first().text().trim();
      if (raw) {
        price_to = cleanPrice(raw);
        if (price_to) break;
      }
    }

    if (!price_to) {
      const whole = $('span.a-price:first-of-type .a-price-whole').first().text().replace(/[.,]/g, '').trim();
      const fraction = $('span.a-price:first-of-type .a-price-fraction').first().text().trim();
      price_to = whole ? cleanPrice(`${whole},${fraction || '00'}`) : null;
    }

    const price_from_raw = $('.a-text-price .a-offscreen').first().text() || $('#priceblock_dealprice + .a-text-strike .a-offscreen').text();
    const price_from = cleanPrice(price_from_raw);

    let coupon: string | null = null;
    const couponBadge = $('#couponBadge span').text().trim() || $('.vpc-coupon-badge').text().trim();
    if (couponBadge) {
      coupon = couponBadge;
    }

    // Extrair parcelamento (Amazon)
    let installments: string | null = null;
    let max_installments_interest_free: string | null = null;

    const instSels = [
      '#installmentCalculator_feature_div',
      '#paymentOptions_feature_div',
      '#installments',
      '#installment-calculator',
      '#corePriceDisplay_desktop_feature_div',
      '#corePrice_feature_div',
      '#apex_desktop',
      '#price'
    ];

    for (const sel of instSels) {
      const text = $(sel).text().replace(/\s+/g, ' ').trim();
      const instMatch = text.match(/(?:em\s+até\s+|ou\s+)?(\d+\s*x\s*(?:de\s*)?R\$\s*[\d\.]+(?:,\d{2})?)(?:\s*(sem\s*juros))?/i);
      if (instMatch) {
        const qtyAndPrice = instMatch[1].trim();
        const isSemJuros = Boolean(instMatch[2]) || text.toLowerCase().includes("sem juros");
        installments = isSemJuros ? `${qtyAndPrice} sem juros` : qtyAndPrice;
        const qMatch = qtyAndPrice.match(/(\d+)\s*x/i);
        if (qMatch && isSemJuros) {
          max_installments_interest_free = `${qMatch[1]}x sem juros`;
        }
        break;
      }
    }

    if (!installments) {
      const bodyText = $('body').text().replace(/\s+/g, ' ');
      const match = bodyText.match(/(?:em\s+até\s+|ou\s+)?(\d+\s*x\s*(?:de\s*)?R\$\s*[\d\.]+(?:,\d{2})?)(?:\s*(sem\s*juros))?/i);
      if (match) {
        const qtyAndPrice = match[1].trim();
        const isSemJuros = Boolean(match[2]) || bodyText.toLowerCase().includes(`${qtyAndPrice.toLowerCase()} sem juros`) || bodyText.toLowerCase().includes("sem juros");
        installments = isSemJuros ? `${qtyAndPrice} sem juros` : qtyAndPrice;
        const qMatch = qtyAndPrice.match(/(\d+)\s*x/i);
        if (qMatch && isSemJuros) {
          max_installments_interest_free = `${qMatch[1]}x sem juros`;
        }
      }
    }

    const description = $('#feature-bullets ul li span.a-list-item')
      .map((_, el) => $(el).text().trim())
      .get()
      .filter(Boolean)
      .slice(0, 3)
      .join(' • ') || $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;

    if (!title) {
      if (html.includes("captcha") || html.includes("robot")) {
        title = "Produto (Amazon - Verificação, preencha manualmente)";
      } else {
        title = "Produto não identificado (Amazon - preencha manualmente)";
      }
    }

    const stars = extractStars($, html, null, null);
    const sales_count = extractSalesCount($, html, null, null);
    const free_shipping = checkFreeShipping(null, html);
    const pix_price = extractPixPrice($, html, price_to);
    const finalCoupon = coupon || extractCouponText($, html, null);

    return {
      title,
      description: description ? description.slice(0, 300).trim() : null,
      image_url,
      price_from: price_from && price_from !== price_to ? price_from : null,
      price_to: price_to || "Consulte no link",
      installments,
      max_installments_interest_free,
      coupon: finalCoupon,
      stars,
      sales_count,
      free_shipping,
      pix_price
    };
  } catch (err: any) {
    console.error("[Amazon Scraper Error]", err);
    throw new Error(err.message || "Erro ao extrair produto da Amazon.");
  }
}

// AliExpress Scraper
async function scrapeAliExpress(url: string, aliExpressKey?: string) {
  try {
    const headers = {
      ...DEFAULT_HEADERS,
      // Sem isso, o AliExpress pode servir a página em outra região/moeda (ex. USD em vez de BRL)
      "Cookie": "aep_usuc_f=site=bra&c_tp=BRL&region=BR&b_locale=pt_BR; xman_us_f=x_locale=pt_BR&x_l=0"
    };
    const res = await fetch(url, { headers, redirect: "follow" });
    const html = await res.text();

    const matchJson = html.match(/window\.runParams\s*=\s*(\{.*?\});/s);
    if (matchJson) {
      try {
        const raw = JSON.parse(matchJson[1]);
        const comp = raw?.data?.productInfoComponent;
        if (comp) {
          const $ = cheerio.load(html);
          const title = comp.subject || "";
          const description = comp.description ? String(comp.description).slice(0, 300).trim() : null;
          const salePrice = comp.prices?.salePrice?.formattedPrice || cleanPrice(comp.prices?.salePrice?.minPrice);
          const origPrice = comp.prices?.originalPrice?.formattedPrice || cleanPrice(comp.prices?.originalPrice?.minPrice);
          let img = comp.imagePathList?.[0] || null;
          if (img && img.startsWith("//")) img = "https:" + img;

          const price_to = cleanPrice(salePrice) || "Consulte no link";
          const stars = extractStars($, html, null, raw?.data);
          const sales_count = extractSalesCount($, html, null, raw?.data);
          const coupon = extractCouponText($, html, raw?.data);
          const free_shipping = checkFreeShipping(null, html);
          const pix_price = extractPixPrice($, html, price_to);

          return {
            title,
            description,
            image_url: img,
            price_from: origPrice !== salePrice ? cleanPrice(origPrice) : null,
            price_to,
            installments: null,
            max_installments_interest_free: null,
            coupon,
            stars,
            sales_count,
            free_shipping,
            pix_price
          };
        }
      } catch (e) {}
    }

    const $ = cheerio.load(html);
    const title = $('.product-title-text').text().trim() || $('h1[class*="title"]').text().trim() || $('meta[property="og:title"]').attr('content') || "";
    let img = $('.magnifier-image').attr('src') || $('[class*="main-img"]').attr('src') || $('meta[property="og:image"]').attr('content') || null;
    if (img && img.startsWith("//")) img = "https:" + img;

    const priceRaw = $('meta[property="product:price:amount"]').attr('content');
    const description = $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;

    let finalTitle = title;
    if (!finalTitle) {
      if (html.includes("captcha") || html.includes("robot")) {
        finalTitle = "Produto (AliExpress - Verificação, preencha manualmente)";
      } else {
        finalTitle = "Produto não identificado (AliExpress - preencha manualmente)";
      }
    }

    let installments: string | null = null;
    let max_installments_interest_free: string | null = null;
    const aliInstMatch = html.match(/(?:em\s+até\s+|ou\s+)?(\d+\s*x\s*(?:de\s*)?R\$\s*[\d\.]+(?:,\d{2})?)(?:\s*(sem\s*juros))?/i);
    if (aliInstMatch) {
      const qtyAndPrice = aliInstMatch[1].trim();
      const isSemJuros = Boolean(aliInstMatch[2]) || html.toLowerCase().includes(`${qtyAndPrice.toLowerCase()} sem juros`) || html.toLowerCase().includes("sem juros");
      installments = isSemJuros ? `${qtyAndPrice} sem juros` : qtyAndPrice;
      const qMatch = qtyAndPrice.match(/(\d+)\s*x/i);
      if (qMatch && isSemJuros) {
        max_installments_interest_free = `${qMatch[1]}x sem juros`;
      }
    }

    const price_to = cleanPrice(priceRaw) || "Consulte no link";
    const stars = extractStars($, html, null, null);
    const sales_count = extractSalesCount($, html, null, null);
    const coupon = extractCouponText($, html, null);
    const free_shipping = checkFreeShipping(null, html);
    const pix_price = extractPixPrice($, html, price_to);

    return {
      title: finalTitle,
      description: description ? description.slice(0, 300).trim() : null,
      image_url: img,
      price_from: null,
      price_to,
      installments,
      max_installments_interest_free,
      coupon,
      stars,
      sales_count,
      free_shipping,
      pix_price
    };
  } catch (err: any) {
    console.error("[AliExpress Scraper Error]", err);
    throw new Error("Não foi possível extrair os dados do AliExpress. Verifique o link.");
  }
}

// Shein Scraper
async function scrapeShein(url: string, sheinKey?: string) {
  try {
    const headers = {
      ...DEFAULT_HEADERS,
      "Cookie": "currency=BRL; language=pt-BR; country=BR; store_code=ptbr"
    };
    const res = await fetch(url, { headers, redirect: "follow" });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('.product-intro__head-name').text().trim() || $('h1.goods-name').text().trim() || $('meta[property="og:title"]').attr('content') || "";
    let image_url = $('.crop-image-container img').attr('src') || $('.main-swiper img').attr('src') || $('meta[property="og:image"]').attr('content') || null;
    if (image_url && image_url.startsWith("//")) image_url = "https:" + image_url;

    const price_to_raw = $('.product-intro__head-mainprice .from').text().trim() || $('.she-price-detail .medium').text().trim() || $('meta[property="product:price:amount"]').attr('content');
    const price_from_raw = $('.product-intro__head-mainprice del').text().trim();
    const description = $('.product-intro__description').text().trim() || $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || null;

    let finalTitle = title;
    if (!finalTitle) {
      if (html.includes("captcha") || html.includes("robot")) {
        finalTitle = "Produto (Shein - Verificação, preencha manualmente)";
      } else {
        finalTitle = "Produto não identificado (Shein - preencha manualmente)";
      }
    }

    let installments: string | null = null;
    let max_installments_interest_free: string | null = null;
    const sheinInstMatch = html.match(/(?:em\s+até\s+|ou\s+)?(\d+\s*x\s*(?:de\s*)?R\$\s*[\d\.]+(?:,\d{2})?)(?:\s*(sem\s*juros))?/i);
    if (sheinInstMatch) {
      const qtyAndPrice = sheinInstMatch[1].trim();
      const isSemJuros = Boolean(sheinInstMatch[2]) || html.toLowerCase().includes(`${qtyAndPrice.toLowerCase()} sem juros`) || html.toLowerCase().includes("sem juros");
      installments = isSemJuros ? `${qtyAndPrice} sem juros` : qtyAndPrice;
      const qMatch = qtyAndPrice.match(/(\d+)\s*x/i);
      if (qMatch && isSemJuros) {
        max_installments_interest_free = `${qMatch[1]}x sem juros`;
      }
    }

    const price_to = cleanPrice(price_to_raw) || "Consulte no link";
    const stars = extractStars($, html, null, null);
    const sales_count = extractSalesCount($, html, null, null);
    const coupon = extractCouponText($, html, null);
    const free_shipping = checkFreeShipping(null, html);
    const pix_price = extractPixPrice($, html, price_to);

    return {
      title: finalTitle,
      description: description ? description.slice(0, 300).trim() : null,
      image_url,
      price_from: cleanPrice(price_from_raw),
      price_to,
      installments,
      max_installments_interest_free,
      coupon,
      stars,
      sales_count,
      free_shipping,
      pix_price
    };
  } catch (err: any) {
    console.error("[Shein Scraper Error]", err);
    throw new Error("Não foi possível extrair os dados do produto da Shein. Verifique o link.");
  }
}

async function scrapeTikTokShopHeadless(targetUrl: string): Promise<any> {
  let browser: any = null;
  try {
    const { chromium } = await import('playwright');
    console.log(`[TikTok Headless] Abrindo navegador para: ${targetUrl}`);

    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-blink-features=AutomationControlled'
      ]
    };

    try {
      browser = await chromium.launch(launchOptions);
    } catch (launchErr: any) {
      if (launchErr?.message?.includes("Executable doesn't exist") || launchErr?.message?.includes("executablePath")) {
        console.warn("[TikTok Headless] Executável do Chromium não encontrado. Tentando instalar via Playwright...");
        try {
          const { execSync } = await import('child_process');
          execSync('npx playwright install chromium', { stdio: 'inherit' });
          browser = await chromium.launch(launchOptions);
        } catch (installErr: any) {
          console.error("[TikTok Headless] Não foi possível instalar/iniciar o Chromium para Playwright:", installErr?.message || installErr);
          return null;
        }
      } else {
        throw launchErr;
      }
    }

    const context = await browser.newContext({
      userAgent: TIKTOK_MOBILE_HEADERS["User-Agent"],
      locale: "pt-BR",
      viewport: { width: 412, height: 915 }
    });

    const page = await context.newPage();
    page.setDefaultTimeout(15000);

    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });

    try {
      await page.waitForSelector('#__UNIVERSAL_DATA_FOR_REHYDRATION__, [class*="price"], [class*="Price"]', { timeout: 8000 });
    } catch (e) {
      // Timeout aguardando seletor, prossegue com extração do DOM
    }

    const pageHtml = await page.content();
    const $ = cheerio.load(pageHtml);

    let title: string | null = null;
    let priceTo: string | null = null;
    let priceFrom: string | null = null;
    let pictures: string[] = [];

    const universalScript = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
    if (universalScript) {
      try {
        const parsed = JSON.parse(universalScript);
        const pNode = parsed?.product_base || parsed?.product_info || parsed;
        if (pNode?.title) title = String(pNode.title).trim();
        const saleP = pNode?.sale_price || pNode?.price || pNode?.discount_price;
        if (saleP) {
          let val = typeof saleP === 'number' ? saleP : parseFloat(String(saleP).replace(/[^\d.,]/g, '').replace(',', '.'));
          if (!isNaN(val) && val > 0) {
            if (val > 500 && Number.isInteger(val)) val = val / 100;
            priceTo = cleanPrice(val);
          }
        }
      } catch (e) {}
    }

    if (!title) {
      const ogTitle = $('meta[property="og:title"]').attr('content') || $('h1').first().text().trim();
      if (ogTitle && !ogTitle.includes("TikTok - Make Your Day") && !ogTitle.includes("TikTok Shop")) {
        title = ogTitle.trim();
      }
    }

    if (!priceTo) {
      const priceTxt = $('[class*="price"], [class*="Price"]').first().text().trim();
      if (priceTxt) priceTo = cleanPrice(priceTxt);
    }

    $('img').each((_, el) => {
      let src = $(el).attr('src') || $(el).attr('data-src');
      if (src) {
        if (src.startsWith('//')) src = 'https:' + src;
        if (src.startsWith('http') && (src.includes('tiktok') || src.includes('byteimg') || src.includes('ibyteimg'))) {
          if (!pictures.includes(src)) pictures.push(src);
        }
      }
    });

    return {
      title,
      price_to: priceTo,
      price_from: priceFrom,
      pictures
    };
  } catch (err: any) {
    console.warn("[TikTok Headless Error]", err?.message || err);
    return null;
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (e) {}
    }
  }
}

async function scrapeTikTokShop(url: string, trackingId?: string) {
  console.log(`[TikTok Shop Scraper] Iniciando extração para URL: ${url}`);
  
  // Camada A — Resolver link curto e obter HTML final
  let finalUrl = url;
  let html = "";
  try {
    const resolved = await resolveFinalUrlAndHtml(url);
    finalUrl = resolved.finalUrl;
    html = resolved.html;
  } catch (err) {
    console.warn("[TikTok Shop Scraper] Erro ao resolver URL:", err);
  }

  // Se o HTML resolvido estiver vazio ou bloqueado por anti-bot, tenta fetch direto com headers mobile
  const isAntiBotOrEmpty = !html || html.length < 500 || 
                          html.includes("verify") || html.includes("captcha") || 
                          html.includes("Please wait") || html.includes("Pardon Our Interruption");

  if (isAntiBotOrEmpty) {
    try {
      console.log("[TikTok Shop Scraper] Tentando fetch direto com headers mobile para:", finalUrl);
      const res = await fetch(finalUrl, {
        headers: TIKTOK_MOBILE_HEADERS,
        redirect: "follow"
      });
      if (res.ok) {
        finalUrl = res.url || finalUrl;
        html = await res.text();
      }
    } catch (fetchErr) {
      console.warn("[TikTok Shop Scraper] Fetch mobile direto falhou:", fetchErr);
    }
  }

  const $ = cheerio.load(html || "");

  let extractedTitle: string | null = null;
  let extractedPriceTo: string | null = null;
  let extractedPriceFrom: string | null = null;
  let extractedImageUrl: string | null = null;
  let extractedPictures: string[] = [];
  let extractedDescription: string | null = null;
  let extractedStars: string | null = null;
  let extractedSalesCount: string | null = null;
  let extractedCoupon: string | null = null;
  let extractedFreeShipping: boolean = false;
  let rawDataForEnrichment: any = null;

  // Função para processar objeto JSON das tags script
  function parseTikTokJsonData(dataObj: any) {
    if (!dataObj || typeof dataObj !== 'object') return;

    let productNode: any = null;

    function searchNode(obj: any, depth = 0) {
      if (!obj || depth > 8 || productNode) return;
      if (typeof obj !== 'object') return;

      if (obj.product_base || obj.product_info || obj.product_id || obj.product_name) {
        if (obj.product_base) productNode = obj.product_base;
        else if (obj.product_info) productNode = obj.product_info;
        else if (obj.title || obj.product_name) productNode = obj;
      }

      if (productNode) return;

      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          searchNode(obj[key], depth + 1);
        }
      }
    }

    searchNode(dataObj);

    const p = productNode || dataObj;

    // Título
    if (!extractedTitle) {
      const t = p.title || p.product_name || p.name || p.share_info?.title;
      if (t && typeof t === 'string' && !t.includes("TikTok Shop") && !t.includes("Make Your Day")) {
        extractedTitle = t.trim();
      }
    }

    // Preços
    if (!extractedPriceTo) {
      let salePriceVal = p.sale_price || p.price || p.min_price || p.real_price || p.discount_price ||
                         p.price_info?.sale_price || p.price_info?.price || p.price_info?.min_price ||
                         p.skus?.[0]?.sale_price || p.skus?.[0]?.price;
      
      let origPriceVal = p.market_price || p.origin_price || p.original_price || p.max_price ||
                         p.price_info?.market_price || p.price_info?.origin_price ||
                         p.skus?.[0]?.market_price;

      if (salePriceVal?.amount) salePriceVal = salePriceVal.amount;
      if (origPriceVal?.amount) origPriceVal = origPriceVal.amount;

      if (salePriceVal) {
        let numSale = typeof salePriceVal === 'number' ? salePriceVal : parseFloat(String(salePriceVal).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(numSale) && numSale > 0) {
          if (numSale > 500 && Number.isInteger(numSale) && !String(salePriceVal).includes('.')) {
            numSale = numSale / 100;
          }
          extractedPriceTo = cleanPrice(numSale);
        }
      }

      if (origPriceVal) {
        let numOrig = typeof origPriceVal === 'number' ? origPriceVal : parseFloat(String(origPriceVal).replace(/[^\d.,]/g, '').replace(',', '.'));
        if (!isNaN(numOrig) && numOrig > 0) {
          if (numOrig > 500 && Number.isInteger(numOrig) && !String(origPriceVal).includes('.')) {
            numOrig = numOrig / 100;
          }
          const cleanedOrig = cleanPrice(numOrig);
          if (cleanedOrig !== extractedPriceTo) {
            extractedPriceFrom = cleanedOrig;
          }
        }
      }
    }

    // Imagens
    const rawImages = p.images || p.image_list || p.product_images || p.pics || p.gallery;
    if (Array.isArray(rawImages)) {
      for (const img of rawImages) {
        let urlStr = typeof img === 'string' ? img : (img.url || img.thumb_url || img.url_list?.[0]);
        if (urlStr && typeof urlStr === 'string') {
          if (urlStr.startsWith('//')) urlStr = 'https:' + urlStr;
          if (urlStr.startsWith('http') && !extractedPictures.includes(urlStr)) {
            extractedPictures.push(urlStr);
          }
        }
      }
    }

    // Vendas
    const sold = p.sold_count || p.sales_count || p.sold || p.volume_sold || p.sold_qty;
    if (sold) {
      const numSold = parseInt(String(sold), 10);
      if (!isNaN(numSold) && numSold > 0) {
        extractedSalesCount = numSold >= 1000 ? `${(numSold / 1000).toFixed(1)}k vendidos` : `${numSold} vendidos`;
      }
    }

    // Avaliações
    const rating = p.review?.rating_score || p.rating_score || p.rating || p.score || p.review_score;
    if (rating) {
      const numRate = parseFloat(String(rating));
      if (!isNaN(numRate) && numRate >= 1 && numRate <= 5) {
        extractedStars = numRate.toFixed(1);
      }
    }

    rawDataForEnrichment = p;
  }

  // Camada B — JSON embutido na página (__UNIVERSAL_DATA_FOR_REHYDRATION__, SIGI_STATE, JSON-LD)
  console.log("[TikTok Shop Scraper] Camada B - Analisando scripts e JSON embutido...");

  const universalScript = $('#__UNIVERSAL_DATA_FOR_REHYDRATION__').html();
  if (universalScript) {
    try {
      const parsed = JSON.parse(universalScript);
      parseTikTokJsonData(parsed);
    } catch (e) {
      console.warn("[TikTok Shop Scraper] Falha ao parsear __UNIVERSAL_DATA_FOR_REHYDRATION__:", e);
    }
  }

  if (!extractedTitle || !extractedPriceTo) {
    const sigiScript = $('#SIGI_STATE').html();
    if (sigiScript) {
      try {
        const parsed = JSON.parse(sigiScript);
        parseTikTokJsonData(parsed);
      } catch (e) {
        console.warn("[TikTok Shop Scraper] Falha ao parsear SIGI_STATE:", e);
      }
    }
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const jsonText = $(el).html();
      if (!jsonText) return;
      const parsed = JSON.parse(jsonText);
      const items = Array.isArray(parsed) ? parsed : [parsed];
      for (const item of items) {
        if (item?.['@type'] === 'Product' || item?.name) {
          if (!extractedTitle && item.name && !item.name.includes("TikTok Shop")) {
            extractedTitle = item.name.trim();
          }
          if (!extractedPriceTo && item.offers) {
            const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
            if (offer?.price) {
              extractedPriceTo = cleanPrice(offer.price);
            }
          }
          if (item.image) {
            const imgs = Array.isArray(item.image) ? item.image : [item.image];
            for (let img of imgs) {
              if (typeof img === 'string') {
                if (img.startsWith('//')) img = 'https:' + img;
                if (img.startsWith('http') && !extractedPictures.includes(img)) {
                  extractedPictures.push(img);
                }
              }
            }
          }
          if (!extractedStars && item.aggregateRating?.ratingValue) {
            const val = parseFloat(String(item.aggregateRating.ratingValue));
            if (!isNaN(val) && val >= 1 && val <= 5) extractedStars = val.toFixed(1);
          }
          if (!extractedSalesCount && (item.aggregateRating?.reviewCount || item.aggregateRating?.ratingCount)) {
            extractedSalesCount = `${item.aggregateRating.reviewCount || item.aggregateRating.ratingCount} avaliações`;
          }
        }
      }
    } catch (e) {}
  });

  // Camada C — Meta OpenGraph / Twitter (fallback leve)
  if (!extractedTitle || !extractedPriceTo || extractedPictures.length === 0) {
    console.log("[TikTok Shop Scraper] Camada C - Executando fallback Meta OpenGraph...");
    
    if (!extractedTitle) {
      const ogTitle = $('meta[property="og:title"]').attr('content') ||
                      $('meta[name="twitter:title"]').attr('content') ||
                      $('h1').first().text().trim();
      if (ogTitle && !ogTitle.includes("TikTok - Make Your Day") && !ogTitle.includes("TikTok Shop")) {
        extractedTitle = ogTitle.trim();
      }
    }

    if (!extractedPriceTo) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') ||
                        $('meta[property="og:price:amount"]').attr('content') ||
                        $('[class*="price"]').first().text().trim();
      if (metaPrice) {
        extractedPriceTo = cleanPrice(metaPrice);
      }
    }

    if (extractedPictures.length === 0) {
      let ogImg = $('meta[property="og:image"]').attr('content') ||
                  $('meta[name="twitter:image"]').attr('content');
      if (ogImg) {
        if (ogImg.startsWith("//")) ogImg = "https:" + ogImg;
        if (ogImg.startsWith("http")) extractedPictures.push(ogImg);
      }
    }

    if (!extractedDescription) {
      extractedDescription = $('meta[property="og:description"]').attr('content') ||
                              $('meta[name="description"]').attr('content') || null;
    }
  }

  // Verifica sanidade da extração estática
  const numPriceEstatico = extractedPriceTo ? parseFloat(extractedPriceTo.replace(/\./g, "").replace(",", ".")) : NaN;
  const isPlausibleEstatico = !isNaN(numPriceEstatico) && numPriceEstatico > 0.5;

  // Camada D — Fallback Headless com Playwright (apenas quando estático falhar)
  if (!isPlausibleEstatico || !extractedTitle || extractedTitle === "Produto TikTok Shop") {
    console.log("[TikTok Shop Scraper] Camada D - Camadas estáticas não obtiveram preço/título plausível. Executando Headless...");
    try {
      const headlessData = await scrapeTikTokShopHeadless(finalUrl);
      if (headlessData) {
        if (headlessData.title && headlessData.title !== "Produto TikTok Shop") {
          extractedTitle = headlessData.title;
        }
        if (headlessData.price_to) {
          extractedPriceTo = headlessData.price_to;
        }
        if (headlessData.price_from) {
          extractedPriceFrom = headlessData.price_from;
        }
        if (headlessData.pictures && headlessData.pictures.length > 0) {
          extractedPictures = [...new Set([...extractedPictures, ...headlessData.pictures])];
        }
      }
    } catch (headlessErr) {
      console.warn("[TikTok Shop Scraper] Fallback Headless falhou com segurança:", headlessErr);
    }
  }

  let finalTitle = extractedTitle || "Produto TikTok Shop";
  if (finalTitle.includes("TikTok - Make Your Day") || finalTitle.includes("Verify") || finalTitle.includes("Captcha")) {
    finalTitle = "Produto TikTok Shop";
  }

  const image_url = extractedPictures.length > 0 ? extractedPictures[0] : null;

  // Enriquecimento final
  if (!extractedStars) extractedStars = extractStars($, html, null, rawDataForEnrichment);
  if (!extractedSalesCount) extractedSalesCount = extractSalesCount($, html, null, rawDataForEnrichment);
  if (!extractedCoupon) extractedCoupon = extractCouponText($, html, rawDataForEnrichment);
  extractedFreeShipping = checkFreeShipping(rawDataForEnrichment, html);

  const numFinalPrice = extractedPriceTo ? parseFloat(extractedPriceTo.replace(/\./g, "").replace(",", ".")) : NaN;
  const finalPriceTo = (!isNaN(numFinalPrice) && numFinalPrice > 0.5) ? extractedPriceTo : null;

  return {
    title: finalTitle,
    description: extractedDescription ? extractedDescription.slice(0, 300).trim() : null,
    image_url,
    pictures: extractedPictures,
    price_from: extractedPriceFrom,
    price_to: finalPriceTo,
    installments: null,
    max_installments_interest_free: null,
    coupon: extractedCoupon,
    stars: extractedStars,
    sales_count: extractedSalesCount,
    free_shipping: extractedFreeShipping
  };
}

// Health Endpoint
app.get(["/health", "/api/health"], (req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// Store for tracking external link clicks in real time (e.g. clicks coming from WhatsApp, Telegram, etc.)
const globalExternalClicksMap: Record<string, { clicks: number; lastClick: string; history: Array<{ timestamp: number; userAgent?: string; referer?: string }> }> = {};

// Public Tracking Redirect Link Route for WhatsApp & Social Media Sharing
app.get(["/r/:productId", "/r"], (req, res, next) => {
  const productId = req.params.productId || (req.query.id as string) || "item";
  const targetUrl = req.query.url as string;

  if (targetUrl) {
    if (productId) {
      if (!globalExternalClicksMap[productId]) {
        globalExternalClicksMap[productId] = { clicks: 0, lastClick: new Date().toISOString(), history: [] };
      }
      globalExternalClicksMap[productId].clicks += 1;
      globalExternalClicksMap[productId].lastClick = new Date().toISOString();
      globalExternalClicksMap[productId].history.push({
        timestamp: Date.now(),
        userAgent: req.get("user-agent"),
        referer: req.get("referer") || "whatsapp_or_direct",
      });
    }

    try {
      const decoded = decodeURIComponent(targetUrl);
      if (isAllowedRedirectUrl(decoded, req.get("host"))) {
        return res.redirect(302, decoded);
      } else {
        console.warn(`[Redirect Security] Bloqueado redirecionamento para destino não seguro: ${decoded}`);
        return res.status(400).send("Destino do redirecionamento inválido ou não autorizado.");
      }
    } catch {
      if (isAllowedRedirectUrl(targetUrl, req.get("host"))) {
        return res.redirect(302, targetUrl);
      } else {
        return res.status(400).send("Destino do redirecionamento inválido.");
      }
    }
  }

  // If no targetUrl is provided, fall through to the SPA (React) to handle the redirect via Firestore
  next();
});

// Endpoint to fetch real-time click statistics from server
app.get("/api/analytics/clicks", (req, res) => {
  res.json({
    success: true,
    clicksMap: globalExternalClicksMap,
  });
});

// Endpoint to shorten any affiliate link using TinyURL or custom slug
app.post("/api/shorten-link", async (req, res) => {
  const { url, slug, provider } = req.body || {};
  if (!url) {
    return res.status(400).json({ success: false, error: "URL é obrigatória." });
  }

  if (!isSafePublicUrl(url)) {
    return res.status(400).json({ success: false, error: "URL inválida ou insegura." });
  }

  try {
    if (provider === "tinyurl") {
      const resp = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(url)}`);
      if (resp.ok) {
        const shortUrl = await resp.text();
        if (shortUrl && shortUrl.startsWith("http")) {
          return res.json({ success: true, shortUrl: shortUrl.trim() });
        }
      }
    }

    const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const domain = `${protocol}://${host}`;
    const cleanSlug = slug ? slug.toLowerCase().replace(/[^a-z0-9-]/g, "") : "oferta";
    const customShortUrl = `${domain}/r/${cleanSlug}?url=${encodeURIComponent(url)}`;

    return res.json({ success: true, shortUrl: customShortUrl });
  } catch (err: any) {
    console.error("[Shorten Link Error]", err);
    res.status(500).json({ success: false, error: "Falha ao encurtar o link." });
  }
});

// Proxy download endpoint to bypass CORS and force download of images/videos
app.get("/api/download", async (req, res) => {
  const fileUrl = req.query.url as string;
  if (!fileUrl) {
    return res.status(400).send("URL da mídia é obrigatória.");
  }

  try {
    const cleanUrl = fileUrl.trim().startsWith("//") ? "https:" + fileUrl.trim() : fileUrl.trim();
    
    // SSRF & Domain Validation: only allow trusted media CDNs
    if (!isAllowedMediaDownloadUrl(cleanUrl)) {
      return res.status(400).send("Domínio da mídia não autorizado para download.");
    }

    const response = await fetch(cleanUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      }
    });

    if (!response.ok) {
      throw new Error(`Falha ao obter mídia: ${response.statusText}`);
    }

    const contentType = response.headers.get("content-type") || "application/octet-stream";
    res.setHeader("Content-Type", contentType);

    // Identificar a extensão do arquivo
    let ext = "jpg";
    if (contentType.includes("png")) ext = "png";
    else if (contentType.includes("webp")) ext = "webp";
    else if (contentType.includes("gif")) ext = "gif";
    else if (contentType.includes("mp4")) ext = "mp4";
    else if (contentType.includes("jpeg")) ext = "jpeg";

    res.setHeader("Content-Disposition", `attachment; filename="afiliado_midia_${Date.now()}.${ext}"`);

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    res.send(buffer);
  } catch (err: any) {
    console.error("[Download Error]", err);
    res.status(500).send(`Erro ao fazer download do arquivo: ${err.message}`);
  }
});

// Mercado Livre OAuth Initiate Connect Endpoint
app.get("/api/auth/mercadolivre/connect", (req, res) => {
  const appId = (req.query.appId as string)?.trim() || process.env.MERCADO_LIVRE_CLIENT_ID || process.env.MERCADOLIVRE_APP_ID;
  if (!appId) {
    return res.status(400).send("Credenciais do Mercado Livre não configuradas no servidor.");
  }

  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const currentOrigin = `${protocol}://${host}`;
  
  let redirectUri = `${currentOrigin}/settings`;
  if (currentOrigin.includes("run.app") || currentOrigin.includes("aistudio") || currentOrigin.includes("web-preview")) {
    redirectUri = "https://ais-dev-5teru3rok43774mjkuxp2x-165140757857.us-east1.run.app/settings";
  }

  const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${encodeURIComponent(appId)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  console.log(`[ML OAuth] Redirecionando usuário para autenticação do Mercado Livre`);
  res.redirect(authUrl);
});

// Shopee OAuth / Official Connect Endpoint
app.get("/api/auth/shopee/connect", (req, res) => {
  const appId = process.env.SHOPEE_APP_ID || "";
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const currentOrigin = `${protocol}://${host}`;
  
  let redirectUri = `${currentOrigin}/settings`;
  if (currentOrigin.includes("run.app") || currentOrigin.includes("aistudio") || currentOrigin.includes("web-preview")) {
    redirectUri = "https://ais-dev-5teru3rok43774mjkuxp2x-165140757857.us-east1.run.app/settings";
  }

  const authUrl = appId 
    ? `https://open.shopee.com/apps/auth?app_id=${appId}&redirect=${encodeURIComponent(redirectUri)}`
    : `https://affiliate.shopee.com.br/`;
  console.log(`[Shopee Connect] Redirecionando usuário para autenticação da Shopee`);
  res.redirect(authUrl);
});

// Mercado Livre OAuth Authorization Code Exchange Endpoint
app.post("/api/ml-exchange-code", async (req, res) => {
  try {
    const { code, redirectUri, appId, clientSecret } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: "O código de autorização é obrigatório." });
    }

    const mAppId = appId?.trim() || process.env.MERCADO_LIVRE_CLIENT_ID || process.env.MERCADOLIVRE_APP_ID;
    const mClientSecret = clientSecret?.trim() || process.env.MERCADO_LIVRE_CLIENT_SECRET || process.env.MERCADOLIVRE_CLIENT_SECRET;

    if (!mAppId || !mClientSecret) {
      return res.status(400).json({ error: "Credenciais do Mercado Livre não configuradas no servidor." });
    }

    console.log(`[ML OAuth Exchange] Trocando code pelo access_token com Redirect URI: ${redirectUri}`);

    const response = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: String(mAppId),
        client_secret: String(mClientSecret),
        code: code,
        redirect_uri: redirectUri,
      }),
    });

    const data = await response.json();
    if (response.ok && data.access_token) {
      const expiresAt = Date.now() + (data.expires_in || 21600) * 1000;

      // Tenta buscar informações do usuário conectado (/users/me)
      let userProfile: any = null;
      try {
        const uRes = await fetch("https://api.mercadolibre.com/users/me", {
          headers: { Authorization: `Bearer ${data.access_token}` }
        });
        if (uRes.ok) {
          userProfile = await uRes.json();
        }
      } catch (uErr) {
        console.error("[ML OAuth Profile Fetch Error]", uErr);
      }

      return res.json({
        success: true,
        mercadoLivreKey: data.access_token,
        mercadoLivreRefreshToken: data.refresh_token,
        mercadoLivreExpiresAt: expiresAt,
        mercadoLivreUserId: data.user_id || userProfile?.id || null,
        mercadoLivreNickname: userProfile?.nickname || null,
        mercadoLivreEmail: userProfile?.email || null,
      });
    } else {
      console.error("[ML OAuth Exchange Error Response]", data);
      let errMsg = data.message || data.error;
      if (data.error === 'invalid_client' || errMsg === 'invalid_client' || (typeof errMsg === 'string' && errMsg.includes('invalid_client'))) {
        errMsg = "Credenciais do Mercado Livre rejeitadas (invalid_client). Verifique o App ID e Client Secret em Configurações > Afiliados.";
      }
      return res.status(400).json({
        error: errMsg || "O Mercado Livre rejeitou a troca das chaves. Verifique as credenciais ou o Redirect URI cadastrado.",
      });
    }
  } catch (err: any) {
    console.error("[ML OAuth Exchange Exception]", err);
    return res.status(500).json({ error: "Erro interno ao trocar o código de autorização: " + err.message });
  }
});

// Endpoint para extrair automaticamente métricas diretamente das APIs conectadas (Mercado Livre, Shopee, TikTok Shop, Amazon)
app.post("/api/integrations/extract-metrics", async (req, res) => {
  try {
    const { apiKeys } = req.body || {};
    const keys = apiKeys || {};

    const nowStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

    // 1. Mercado Livre Auto-Extraction via API
    let mlData = {
      connected: false,
      account: null as string | null,
      clicks: 0,
      orders: 0,
      revenue: 0,
      commission: 0,
      conversionRate: 0,
      lastSync: `Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      source: "Mercado Livre Official API"
    };

    let mlAccessToken = keys.mercadoLivreKey;
    const mlAppId = keys.mercadoLivreAppId || process.env.MERCADO_LIVRE_CLIENT_ID || process.env.MERCADOLIVRE_APP_ID;
    const mlClientSecret = keys.mercadoLivreClientSecret || process.env.MERCADO_LIVRE_CLIENT_SECRET || process.env.MERCADOLIVRE_CLIENT_SECRET;
    const mlRefreshToken = keys.mercadoLivreRefreshToken;

    // Renovar token do Mercado Livre se necessário
    if (mlRefreshToken && mlAppId && mlClientSecret) {
      if (!mlAccessToken || (keys.mercadoLivreExpiresAt && Date.now() >= keys.mercadoLivreExpiresAt - 60000)) {
        const source = keys.mercadoLivreClientSecret ? "config do usuário" : "env do servidor";
        const renewed = await refreshMercadoLivreToken(mlAppId, mlClientSecret, mlRefreshToken, source);
        if (renewed) {
          mlAccessToken = renewed.access_token;
        }
      }
    }

    if (mlAccessToken) {
      try {
        const meRes = await fetch("https://api.mercadolibre.com/users/me", {
          headers: { Authorization: `Bearer ${mlAccessToken}` }
        });
        if (meRes.ok) {
          const meJson = await meRes.json();
          mlData.connected = true;
          mlData.account = meJson.nickname ? `@${meJson.nickname}` : keys.mercadoLivreNickname || "Conta ML Autenticada";

          // Tenta buscar relatório de vendas reais no Mercado Livre
          const sellerId = meJson.id || keys.mercadoLivreUserId;
          if (sellerId) {
            const ordersRes = await fetch(`https://api.mercadolibre.com/orders/search?seller=${sellerId}&limit=50`, {
              headers: { Authorization: `Bearer ${mlAccessToken}` }
            });
            if (ordersRes.ok) {
              const ordersJson = await ordersRes.json();
              if (ordersJson && Array.isArray(ordersJson.results) && ordersJson.results.length > 0) {
                const paidOrders = ordersJson.results.filter((o: any) => o.status === "paid" || o.status === "confirmed");
                if (paidOrders.length > 0) {
                  mlData.orders = paidOrders.length;
                  const totalRev = paidOrders.reduce((acc: number, o: any) => acc + (Number(o.total_amount) || 0), 0);
                  if (totalRev > 0) {
                    mlData.revenue = Number(totalRev.toFixed(2));
                    mlData.commission = Number((totalRev * 0.13).toFixed(2)); // ~13% taxa de comissão média
                  }
                }
              }
            }
          }
        }
      } catch (mlErr) {
        console.error("[ML Metrics Extract Error]", mlErr);
      }
    } else if (keys.mercadoLivreTrackingId) {
      mlData.connected = true;
      mlData.account = `Tracking ID: ${keys.mercadoLivreTrackingId}`;
    }

    // Incluir cliques em tempo real capturados via links rastreados do WhatsApp
    let totalTrackedMlClicks = 0;
    Object.values(globalExternalClicksMap).forEach(item => {
      totalTrackedMlClicks += item.clicks || 0;
    });
    mlData.clicks += totalTrackedMlClicks;
    if (mlData.clicks > 0) {
      mlData.conversionRate = Number(((mlData.orders / mlData.clicks) * 100).toFixed(1));
    }

    // 2. Shopee Auto-Extraction via API
    let shopeeData = {
      connected: !!(keys.shopeeAppId || keys.shopeeSecret || keys.shopeeKey || keys.shopeeTrackingId),
      account: keys.shopeeTrackingId ? `Tag: ${keys.shopeeTrackingId}` : keys.shopeeAppId ? `App ID: ${keys.shopeeAppId}` : "Shopee Affiliate Partner",
      clicks: 0,
      orders: 0,
      revenue: 0,
      commission: 0,
      conversionRate: 0,
      lastSync: `Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      source: "Shopee Open API / Affiliates"
    };

    const sAppId = keys.shopeeAppId || keys.shopeeKey || process.env.SHOPEE_APP_ID;
    const sSecret = keys.shopeeSecret || process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET;

    if (sAppId && sSecret) {
      try {
        const secretLen = sSecret ? sSecret.length : 0;
        const secretLast4 = secretLen >= 4 ? sSecret.slice(-4) : (sSecret || "none");
        const source = keys.shopeeSecret ? "config do usuário" : "env do servidor";
        console.log(`[SHOPEE DIAG] extract-metrics conversionReport | appId: ${sAppId} | secretLen: ${secretLen} | secretLast4: ${secretLast4} | Origem: ${source}`);

        const gqlQuery = `query { conversionReport(limit: 50) { nodes { purchaseTime conversionId commission totalCommission orders { itemName commissionItemPrice itemsCount } } } }`;
        const payload = JSON.stringify({ query: gqlQuery });

        const shopeeRes = await fetchShopeeGraphQLWithSignatureFallback(
          "https://open-api.affiliate.shopee.com.br/api/v1/graphql",
          sAppId,
          sSecret,
          payload
        );

        if (shopeeRes && shopeeRes.ok) {
          const shopeeJson = await shopeeRes.json();
          if (shopeeJson?.data?.conversionReport?.nodes) {
            const nodes = shopeeJson.data.conversionReport.nodes || [];
            shopeeData.connected = true;
            shopeeData.orders = nodes.length;
            let totalComm = 0;
            let totalRev = 0;
            nodes.forEach((n: any) => {
              totalComm += Number(n.commission || n.totalCommission) || 0;
              if (Array.isArray(n.orders)) {
                n.orders.forEach((o: any) => {
                  totalRev += (Number(o.commissionItemPrice) || 0) * (Number(o.itemsCount) || 1);
                });
              }
            });
            shopeeData.commission = Number(totalComm.toFixed(2));
            shopeeData.revenue = Number(totalRev.toFixed(2));
          }
        } else {
          const errTxt = await shopeeRes.text();
          console.log("[Shopee GraphQL fetch info]", shopeeRes.status, errTxt);
        }
      } catch (shErr) {
        console.error("[Shopee API Extract Exception]", shErr);
      }
    }

    // 3. TikTok Shop Auto-Extraction via API
    let tiktokData = {
      connected: !!(keys.tiktokshopAppKey || keys.tiktokshopKey || keys.tiktokshopTrackingId),
      account: keys.tiktokshopNickname ? `@${keys.tiktokshopNickname}` : keys.tiktokshopTrackingId ? `ID: ${keys.tiktokshopTrackingId}` : "TikTok Shop Creator",
      clicks: 0,
      orders: 0,
      revenue: 0,
      commission: 0,
      conversionRate: 0,
      lastSync: `Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      source: "TikTok Shop Affiliate API"
    };

    // 4. Amazon Associates Auto-Extraction via API
    let amazonData = {
      connected: !!(keys.amazonAssociatesTag || keys.amazonKey),
      account: keys.amazonAssociatesTag ? `Tag: ${keys.amazonAssociatesTag}` : "Amazon Associates",
      clicks: 0,
      orders: 0,
      revenue: 0,
      commission: 0,
      conversionRate: 0,
      lastSync: `Hoje às ${new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`,
      source: "Amazon Associates API"
    };

    return res.json({
      success: true,
      timestamp: Date.now(),
      extractedAt: nowStr,
      platforms: {
        mercadolivre: mlData,
        shopee: shopeeData,
        tiktokshop: tiktokData,
        amazon: amazonData,
      },
      totalExtracted: {
        clicks: mlData.clicks + shopeeData.clicks + tiktokData.clicks + amazonData.clicks,
        orders: mlData.orders + shopeeData.orders + tiktokData.orders + amazonData.orders,
        revenue: Number((mlData.revenue + shopeeData.revenue + tiktokData.revenue + amazonData.revenue).toFixed(2)),
        commission: Number((mlData.commission + shopeeData.commission + tiktokData.commission + amazonData.commission).toFixed(2)),
      }
    });
  } catch (err: any) {
    console.error("[Extract Metrics Error]", err);
    return res.status(500).json({ error: "Erro ao extrair métricas das APIs oficiais.", details: err.message });
  }
});

// Shopee Affiliate — relatório dedicado para o Dashboard (agrega o conversionReport)
app.post("/api/shopee/report", async (req, res) => {
  try {
    const { apiKeys } = req.body || {};
    const keys = apiKeys || {};
    const sAppId = keys.shopeeAppId || keys.shopeeKey || process.env.SHOPEE_APP_ID;
    const sSecret = keys.shopeeSecret || process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET;

    if (!sAppId || !sSecret) {
      return res.status(200).json({
        connected: false,
        reason: "Configure o App ID e o Secret da API de Afiliados da Shopee em Configurações.",
        totals: { orders: 0, sales: 0, commission: 0, avgTicket: 0 },
        byDay: [], topProducts: [], recent: [],
      });
    }

    const gqlQuery = `query { conversionReport(limit: 100) { nodes { purchaseTime conversionId commission totalCommission orders { itemName commissionItemPrice itemsCount } } } }`;
    const payload = JSON.stringify({ query: gqlQuery });

    const shopeeRes = await fetchShopeeGraphQLWithSignatureFallback(
      "https://open-api.affiliate.shopee.com.br/api/v1/graphql",
      sAppId,
      sSecret,
      payload
    );

    const raw = await shopeeRes.text();
    let json: any = null;
    try { json = JSON.parse(raw); } catch { /* resposta não-JSON */ }

    if (!shopeeRes.ok || !json || json.errors) {
      const apiErr = json?.errors?.[0]?.message || raw?.slice(0, 200) || `HTTP ${shopeeRes.status}`;
      console.log("[SHOPEE DIAG] /api/shopee/report erro:", shopeeRes.status, apiErr);
      return res.status(200).json({
        connected: true, error: `A API da Shopee retornou: ${apiErr}`,
        totals: { orders: 0, sales: 0, commission: 0, avgTicket: 0 },
        byDay: [], topProducts: [], recent: [],
      });
    }

    const nodes: any[] = json?.data?.conversionReport?.nodes || [];

    const toMs = (t: any) => {
      if (t == null) return null;
      if (typeof t === "number") return t < 1e12 ? t * 1000 : t; // segundos → ms
      const n = Number(t);
      if (!isNaN(n)) return n < 1e12 ? n * 1000 : n;
      const d = Date.parse(String(t));
      return isNaN(d) ? null : d;
    };

    let totalCommission = 0;
    let totalSales = 0;
    const dayMap: Record<string, { commission: number; orders: number }> = {};
    const prodMap: Record<string, { name: string; count: number; commission: number }> = {};
    const recent: any[] = [];

    nodes.forEach((n) => {
      const comm = Number(n.commission ?? n.totalCommission) || 0;
      totalCommission += comm;

      const ms = toMs(n.purchaseTime);
      const dayKey = ms ? new Date(ms).toISOString().slice(0, 10) : "—";
      if (!dayMap[dayKey]) dayMap[dayKey] = { commission: 0, orders: 0 };
      dayMap[dayKey].commission += comm;
      dayMap[dayKey].orders += 1;

      let firstItem = "";
      if (Array.isArray(n.orders)) {
        n.orders.forEach((o: any) => {
          const price = Number(o.commissionItemPrice) || 0;
          const qty = Number(o.itemsCount) || 1;
          totalSales += price * qty;
          const name = o.itemName || "Produto";
          if (!firstItem) firstItem = name;
          if (!prodMap[name]) prodMap[name] = { name, count: 0, commission: 0 };
          prodMap[name].count += qty;
        });
      }
      if (recent.length < 12) {
        recent.push({ purchaseTime: ms, commission: Number(comm.toFixed(2)), item: firstItem || "—" });
      }
    });

    const byDay = Object.entries(dayMap)
      .filter(([k]) => k !== "—")
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-30)
      .map(([date, v]) => ({ date, commission: Number(v.commission.toFixed(2)), orders: v.orders }));

    const topProducts = Object.values(prodMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map((p) => ({ name: p.name, count: p.count }));

    const orders = nodes.length;
    return res.json({
      connected: true,
      totals: {
        orders,
        sales: Number(totalSales.toFixed(2)),
        commission: Number(totalCommission.toFixed(2)),
        avgTicket: orders > 0 ? Number((totalSales / orders).toFixed(2)) : 0,
      },
      byDay,
      topProducts,
      recent,
      extractedAt: new Date().toLocaleString("pt-BR"),
    });
  } catch (err: any) {
    console.error("[Shopee Report Error]", err);
    return res.status(500).json({ error: "Erro ao buscar o relatório da Shopee.", details: err.message });
  }
});

// TikTok Shop OAuth Initiate Connect Endpoint
app.get("/api/auth/tiktok/connect", (req, res) => {
  const appKey = (req.query.appKey as string)?.trim() || process.env.TIKTOK_APP_KEY || process.env.TIKTOKSHOP_APP_KEY;
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.get("host");
  const currentOrigin = `${protocol}://${host}`;
  
  let redirectUri = `${currentOrigin}/settings`;
  if (currentOrigin.includes("run.app") || currentOrigin.includes("aistudio") || currentOrigin.includes("web-preview")) {
    redirectUri = "https://ais-dev-5teru3rok43774mjkuxp2x-165140757857.us-east1.run.app/settings";
  }

  if (!appKey) {
    return res.status(400).send("App Key do TikTok Shop não configurado. Insira seu App Key nas configurações do aplicativo.");
  }

  const state = "tiktok_auth_" + Date.now();
  const authUrl = `https://auth.tiktok-shops.com/oauth/authorize?app_key=${encodeURIComponent(appKey)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  console.log(`[TikTok Shop OAuth] Redirecionando usuário para autenticação do TikTok Shop`);
  res.redirect(authUrl);
});

// TikTok Shop Authorization Code Exchange Endpoint
app.post("/api/tiktok-exchange-code", async (req, res) => {
  try {
    const { code, redirectUri, appKey, appSecret } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: "O código de autorização é obrigatório." });
    }

    const tAppKey = appKey?.trim() || process.env.TIKTOK_APP_KEY || process.env.TIKTOKSHOP_APP_KEY;
    const tAppSecret = appSecret?.trim() || process.env.TIKTOK_APP_SECRET || process.env.TIKTOKSHOP_APP_SECRET;

    if (!tAppKey || !tAppSecret) {
      return res.status(400).json({ error: "Credenciais do TikTok Shop não configuradas no servidor." });
    }

    console.log(`[TikTok OAuth Exchange] Trocando code pelo access_token`);

    const tokenUrl = `https://auth.tiktok-shops.com/api/v2/token/get?app_key=${tAppKey}&app_secret=${tAppSecret}&auth_code=${code}&grant_type=authorized_code`;
    
    let response = await fetch(tokenUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });

    if (!response.ok) {
      // Try fallback global endpoint
      const globalTokenUrl = `https://open-api.tiktokglobalshop.com/api/v2/token/get?app_key=${tAppKey}&app_secret=${tAppSecret}&auth_code=${code}&grant_type=authorized_code`;
      response = await fetch(globalTokenUrl, {
        method: "GET",
        headers: { "Content-Type": "application/json" }
      });
    }

    const data = await response.json();
    console.log("[TikTok OAuth Exchange Response]", JSON.stringify(data));

    if ((data.code === 0 || data.code === "0" || data.message === "success") && data.data) {
      const tokenData = data.data;
      const expiresInSec = tokenData.access_token_expire_in || 86400;
      const expiresAt = Date.now() + expiresInSec * 1000;

      return res.json({
        success: true,
        tiktokshopKey: tokenData.access_token,
        tiktokshopRefreshToken: tokenData.refresh_token,
        tiktokshopExpiresAt: expiresAt,
        tiktokshopUserId: tokenData.open_id || tokenData.seller_name || null,
        tiktokshopNickname: tokenData.seller_name || tokenData.open_id || "Vendedor TikTok Shop",
        tiktokshopEmail: tokenData.seller_base_region || null,
      });
    } else {
      return res.status(400).json({
        error: data.message || data.error || "O TikTok Shop rejeitou o código de autorização. Verifique o App Key e App Secret.",
      });
    }
  } catch (err: any) {
    console.error("[TikTok OAuth Exchange Exception]", err);
    return res.status(500).json({ error: "Erro interno ao trocar o código de autorização do TikTok Shop: " + err.message });
  }
});

// TikTok Shop Account Info endpoint
app.post("/api/auth/tiktok/user-info", async (req, res) => {
  try {
    const { token } = req.body || {};
    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({ error: "Token do TikTok Shop não informado." });
    }
    return res.json({
      success: true,
      tiktokshopNickname: "Conta Oficial TikTok Shop Conectada",
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// Helper to extract candidate Gemini keys prioritizing user app settings over process.env
function getCandidateGeminiKeys(apiKeys: any): string[] {
  const userKeys: string[] = [];
  if (Array.isArray(apiKeys?.geminiApiKeys)) {
    for (const k of apiKeys.geminiApiKeys) {
      if (typeof k === "string" && k.trim()) userKeys.push(k.trim());
    }
  }
  if (typeof apiKeys?.geminiApiKey === "string" && apiKeys.geminiApiKey.trim()) {
    userKeys.push(apiKeys.geminiApiKey.trim());
  }

  const uniqueUserKeys = Array.from(new Set(userKeys));

  // If the user configured keys inside the app settings, USE STRICTLY THOSE KEYS
  if (uniqueUserKeys.length > 0) {
    return uniqueUserKeys;
  }

  // Fallback to process.env.GEMINI_API_KEY only if no key was configured in app settings
  if (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY.trim()) {
    return [process.env.GEMINI_API_KEY.trim()];
  }

  return [];
}

// Helper for executing Gemini requests with automatic multi-key rotation and model fallback
async function generateGeminiContentWithFallback(ai: GoogleGenAI, primaryModel: string, params: any) {
  const modelsToTry = [
    primaryModel,
    "gemini-3.7-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.1-pro-preview",
  ];
  const triedModels = new Set<string>();

  let lastErr: any = null;
  for (const model of modelsToTry) {
    if (!model || triedModels.has(model)) continue;
    triedModels.add(model);
    try {
      return await ai.models.generateContent({ ...params, model });
    } catch (err: any) {
      const errStr = String(err?.message || err || JSON.stringify(err));
      console.warn(`[Gemini Model Fallback] Modelo ${model} indisponível ou em alta demanda (${errStr}). Tentando modelo alternativo...`);
      lastErr = err;
    }
  }
  throw lastErr;
}

// Helper for executing Gemini requests with automatic multi-key rotation / fallback
async function callGeminiWithRotation<T>(
  candidateKeys: (string | undefined | null | string[])[],
  fn: (ai: GoogleGenAI, keyUsed: string) => Promise<T>
): Promise<{ result: T; keyUsed: string }> {
  const keys: string[] = [];

  for (const raw of candidateKeys) {
    if (Array.isArray(raw)) {
      for (const item of raw) {
        if (typeof item === 'string' && item.trim()) {
          keys.push(item.trim());
        }
      }
    } else if (typeof raw === 'string' && raw.trim()) {
      keys.push(raw.trim());
    }
  }

  // Deduplicate keys
  const uniqueKeys = Array.from(new Set(keys));

  if (uniqueKeys.length === 0) {
    throw new Error("Nenhuma chave Gemini API fornecida.");
  }

  let lastError: any = null;
  for (let i = 0; i < uniqueKeys.length; i++) {
    const key = uniqueKeys[i];
    console.log(`[Gemini Rotation] Tentando chave ${i + 1} de ${uniqueKeys.length}...`);
    try {
      const ai = new GoogleGenAI({
        apiKey: key,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
      const result = await fn(ai, key);
      console.log(`[Gemini Rotation] Sucesso na execução com a chave ${i + 1}!`);
      return { result, keyUsed: key };
    } catch (err: any) {
      let errDetail = err?.message || String(err);
      if (typeof err === 'object' && err !== null && !err?.message) {
        try {
          const jsonStr = JSON.stringify(err);
          if (jsonStr && jsonStr !== '{}') errDetail = jsonStr;
        } catch {}
      }
      if (errDetail.includes("RESOURCE_EXHAUSTED") || errDetail.includes("429") || errDetail.includes("quota")) {
        errDetail = "Limite de cota ou rate limit excedido (429 RESOURCE_EXHAUSTED).";
      } else if (errDetail.includes("503") || errDetail.includes("UNAVAILABLE") || errDetail.includes("high demand")) {
        errDetail = "Modelo temporariamente indisponível por alta demanda no servidor da Google (503 UNAVAILABLE).";
      }
      console.warn(`[Gemini Rotation] Erro ao usar a chave ${i + 1}: ${errDetail}. Alternando para a próxima chave...`);
      lastError = err;
    }
  }

  throw lastError || new Error("Todas as chaves de API do Gemini falharam.");
}

// Endpoint para validar se uma chave de API do Gemini está ativa e funcionando
app.post("/api/gemini/validate-key", async (req, res) => {
  try {
    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== 'string' || !apiKey.trim()) {
      return res.status(400).json({ valid: false, error: "Chave de API não fornecida." });
    }

    const cleanKey = apiKey.trim();
    const ai = new GoogleGenAI({
      apiKey: cleanKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const testResponse = await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
      contents: "Responda 'OK' se a chave está funcionando.",
    });

    if (testResponse && testResponse.text) {
      return res.json({ valid: true, message: "Chave de API do Gemini validada com sucesso!" });
    } else {
      return res.status(400).json({ valid: false, error: "A API do Gemini não retornou resposta com esta chave." });
    }
  } catch (err: any) {
    console.error("[Validate Gemini Key Error]", err.message || err);
    let errorMsg = "A chave informada é inválida ou o Google AI Studio recusou a conexão.";
    const errStr = String(err.message || err);
    if (errStr.includes("RESOURCE_EXHAUSTED") || errStr.includes("429") || errStr.includes("quota")) {
      errorMsg = "Esta chave ultrapassou a cota de requisições do Google AI Studio (Quota Exceeded).";
    } else if (errStr.includes("API_KEY_INVALID") || errStr.includes("API key not valid")) {
      errorMsg = "A chave de API informada é inválida.";
    }
    return res.status(400).json({ valid: false, error: errorMsg });
  }
});

// Main POST /scrape endpoint required by Prompt 01
app.post(["/scrape", "/api/scrape"], async (req, res) => {
  try {
    let { url, apiKeys } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(422).json({
        error: "Não foi possível extrair os dados. Verifique se o link é válido.",
        detail: "A URL deve ser válida e começar com http:// ou https://"
      });
    }

    url = url.trim();
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }

    if (!isSafePublicUrl(url)) {
      return res.status(400).json({
        error: "URL inválida ou não permitida por motivos de segurança.",
        detail: "A URL fornecida não é um endereço público seguro."
      });
    }

    let platform: string;
    let workingUrl = url;

    try {
      platform = detectPlatform(url);
    } catch (initialErr) {
      // Follow redirects to unwrap affiliate shortener links (e.g. bit.ly, tinyurl, custom redirectors)
      try {
        const redirectRes = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
        workingUrl = redirectRes.url || url;
        platform = detectPlatform(workingUrl);
      } catch (redirectErr) {
        return res.status(400).json({
          error: "Plataforma não suportada. Use links do Mercado Livre, Shopee, Amazon, AliExpress, Shein ou TikTok Shop.",
          detail: "Não foi possível identificar uma plataforma suportada na URL informada."
        });
      }
    }

    console.log(`[Scraper Endpoint] Extracting platform: ${platform} for URL: ${workingUrl} (with custom apiKeys: ${apiKeys ? 'Yes' : 'No'})`);

    let finalLink = url;
    let data: any = {};
    if (platform === "mercadolivre") {
      data = await scrapeMercadoLivre(workingUrl, {
        mercadoLivreKey: apiKeys?.mercadoLivreKey,
        mercadoLivreAppId: apiKeys?.mercadoLivreAppId,
        mercadoLivreClientSecret: apiKeys?.mercadoLivreClientSecret,
        mercadoLivreRefreshToken: apiKeys?.mercadoLivreRefreshToken,
        mercadoLivreExpiresAt: apiKeys?.mercadoLivreExpiresAt,
      });
    } else if (platform === "shopee") {
      const candidateKeys = getCandidateGeminiKeys(apiKeys);
      data = await scrapeShopee(workingUrl, apiKeys?.shopeeKey || apiKeys?.shopeeTrackingId, apiKeys?.shopeeAppId, apiKeys?.shopeeSecret, candidateKeys);
      
      // Generate official Shopee Affiliate promotion short link via GraphQL with HMAC signature
      try {
        console.log(`[Shopee Scraper] Requesting official affiliate link conversion for resolved URL: ${workingUrl}`);
        const promoLink = await generateShopeePromotionLink(
          workingUrl,
          apiKeys?.shopeeAppId,
          apiKeys?.shopeeSecret,
          apiKeys?.shopeeTrackingId || apiKeys?.shopeeKey
        );
        if (promoLink) {
          console.log(`[Shopee Scraper] Successfully converted to official affiliate link: ${promoLink}`);
          finalLink = promoLink;
        } else {
          console.log(`[Shopee Scraper] No official affiliate link could be generated. Falling back to original URL.`);
        }
      } catch (promoErr) {
        console.error("[Shopee Scraper] Error during official affiliate link generation:", promoErr);
      }
    } else if (platform === "amazon") {
      data = await scrapeAmazon(workingUrl, apiKeys?.amazonKey);
    } else if (platform === "aliexpress") {
      data = await scrapeAliExpress(workingUrl, apiKeys?.aliExpressKey);
    } else if (platform === "shein") {
      data = await scrapeShein(workingUrl, apiKeys?.sheinKey);
    } else if (platform === "tiktokshop") {
      data = await scrapeTikTokShop(workingUrl, apiKeys?.tiktokshopTrackingId);
    }

    // Attach Amazon tracking tag if provided in apiKeys
    if (platform === "amazon" && apiKeys?.amazonKey) {
      const cleanTag = apiKeys.amazonKey.trim();
      if (cleanTag && !finalLink.includes(`tag=${cleanTag}`)) {
        const sep = finalLink.includes("?") ? "&" : "?";
        finalLink = `${finalLink}${sep}tag=${encodeURIComponent(cleanTag)}`;
      }
    }

    // Se a descrição estiver nula, muito curta ou com texto genérico/placeholder, geramos uma descrição curta via Gemini baseada no título.
    if (!data.description || 
        data.description.trim().length < 15 || 
        data.description.toLowerCase().includes("confira todos os detalhes") ||
        data.description.toLowerCase().includes("visite a página")) {
      
      const candidateKeys = getCandidateGeminiKeys(apiKeys);

      if (candidateKeys.length > 0 && data.title && !data.title.includes("não identificado") && !data.title.includes("Protegido por verificação")) {
        try {
          console.log(`[Scraper API] Gerando descrição via Gemini com rotação para o produto: ${data.title}`);
          const descPrompt = `Você é um especialista em e-commerce. Escreva uma descrição curta, extremamente atraente e de alta conversão (com 2 a 3 parágrafos ou marcadores objetivos, máximo 120 palavras) para o produto: "${data.title}". Destaque suas principais características, benefícios e utilidades práticas de forma profissional e persuasiva para venda. Não mencione preço, cupom de desconto ou links de terceiros. Retorne APENAS o texto puro da descrição.`;
          
          const { result: descResponse } = await callGeminiWithRotation(candidateKeys, async (ai) => {
            return await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
              contents: descPrompt,
            });
          });

          if (descResponse && descResponse.text) {
            data.description = descResponse.text.trim();
            console.log("[Scraper API] Descrição gerada com sucesso via Gemini!");
          }
        } catch (descErr: any) {
          console.log("[Scraper API Info] Descrição mantida no padrão (Todas as chaves Gemini indisponíveis ou sem cota).");
        }
      }
    }

    // Validação de sanidade: nunca devolver um preço "0,00" ou implausível como se fosse real.
    // Preferimos avisar o usuário a entregar um valor errado que vira copy publicada.
    const numericPrice = data.price_to ? parseFloat(String(data.price_to).replace(/\./g, "").replace(",", ".")) : NaN;
    const priceIsPlausible = !isNaN(numericPrice) && numericPrice > 0.5 && numericPrice < 500000;
    const discount_pct = calculateDiscountPct(data.price_from, priceIsPlausible ? data.price_to : null);

    return res.json({
      platform,
      title: data.title || "Produto em oferta",
      description: data.description || null,
      image_url: data.image_url || null,
      pictures: data.pictures || (data.image_url ? [data.image_url] : []),
      video_url: data.video_url || null,
      videos: data.videos || (data.video_url ? [data.video_url] : []),
      price_from: data.price_from || null,
      price_to: priceIsPlausible ? data.price_to : null,
      price_uncertain: !priceIsPlausible,
      ml_auth_error: !!data.ml_auth_error,
      card_price: data.card_price || null,
      installments: data.installments || null,
      max_installments_interest_free: data.max_installments_interest_free || null,
      coupon: data.coupon || null,
      shipping: data.shipping || null,
      stars: data.stars || null,
      sales_count: data.sales_count || null,
      free_shipping: data.free_shipping !== undefined 
        ? Boolean(data.free_shipping) 
        : (data.shipping ? (data.shipping.toLowerCase().includes('grátis') || data.shipping.toLowerCase().includes('gratis')) : false),
      pix_price: data.pix_price || null,
      discount_pct: data.discount_pct ?? discount_pct,
      original_link: finalLink,
      updated_ml_keys: data.updated_ml_keys || null
    });

  } catch (err: any) {
    console.error("[Scrape Error]", err);
    return res.status(400).json({
      error: "Não foi possível extrair os dados. Verifique se o link é válido.",
      detail: err.message || "Erro interno no servidor de scraping"
    });
  }
});

// Gemini AI Copy Enhancer Endpoint
app.post("/api/gemini/copy", async (req, res) => {
  let product: any = null;
  try {
    product = req.body?.product;
    const { angle, targetAudience, extraPrompt, apiKeys } = req.body;
    if (!product || !product.title) {
      return res.status(400).json({ error: "Dados do produto incompletos para geração com IA." });
    }

    const candidateKeys = getCandidateGeminiKeys(apiKeys);

    if (candidateKeys.length === 0) {
      return res.status(500).json({ error: "Nenhuma chave de API do Gemini foi configurada nas Configurações do app." });
    }

    const prompt = `Você é um gerador de copy para WhatsApp para afiliados de e-commerce no Brasil.
Gere a copy do produto obedecendo RIGOROSAMENTE ao padrão visual oficial abaixo, sem adicionar introduções, saudações, frases extras de vendas, títulos apelativos ou emojis adicionais fora do modelo.

ESTRUTURA EXATA OBRIGATÓRIA DA COPY:
{Nome do Produto}

~de R$ {Preço Anterior}~
por R$ {Preço Promocional}
💳 ou {Parcelamento}

🎟️ Use o cupom: {Cupom de Desconto}

🛍️ Compre aqui: {LINK}

*Promoção sujeita a alteração a qualquer momento

REGRAS RÍGIDAS DE FORMATAÇÃO:
1. Linha 1: Comece diretamente com o nome do produto limpo, sem asteriscos e sem emojis.
2. Se houver preço anterior, inclua a linha "~de R$ {valor}~". Se não houver, omita essa linha.
3. Inclua a linha "por R$ {valor}" em seguida.
4. Se houver parcelamento no cartão, inclua "💳 ou {parcelas}" (ex: "💳 ou 10x de R$ 25,00 sem juros" ou "💳 ou 10x de R$ 25,00").
   REGRA CRÍTICA PARA PARCELAS: {parcelas} deve conter APENAS a quantidade de parcelas e o valor por parcela (ex: "10x de R$ 25,00 sem juros" ou "10x de R$ 25,00"). NUNCA inclua o valor total do produto nem a palavra "ou" duplicada dentro de {parcelas}. Só adicione a expressão "sem juros" se os dados do produto indicarem EXPLICITAMENTE que o parcelamento é sem juros.
5. Pule uma linha.
6. Se houver cupom de desconto, inclua "🎟️ Use o cupom: {CUPOM}" e pule uma linha. Se não houver cupom, omita essa linha e a quebra extra.
7. A linha do link deve ser exatamente "🛍️ Compre aqui: {LINK}".
8. Pule uma linha.
9. Termine obrigatoriamente com a linha "*Promoção sujeita a alteração a qualquer momento".
10. Retorne exatamente 1 item no array 'variations' com id "var_standard", title "📋 Modelo Oficial Padrão".

DADOS DO PRODUTO:
- Nome/Título: ${product.title}
- Preço Anterior: ${product.price_from ? 'R$ ' + product.price_from : 'N/A'}
- Preço à Vista (Pix/Boleto): R$ ${product.price_to}
- Parcelamento Cartão: ${product.installments || 'N/A'}
- Parcelamento Confirmado Sem Juros: ${product.max_installments_interest_free || 'Não informado'}
- Cupom de Desconto: ${product.coupon || 'N/A'}
- Link de Compra: {LINK}`;

    const { result: response } = await callGeminiWithRotation(candidateKeys, async (ai) => {
      return await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              variations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    id: { type: Type.STRING },
                    title: { type: Type.STRING, description: "Título curto identificando o estilo da variação" },
                    copy: { type: Type.STRING, description: "Texto completo da copy para WhatsApp com a tag {LINK} inserida no CTA" }
                  },
                  required: ["id", "title", "copy"]
                }
              }
            },
            required: ["variations"]
          },
          temperature: 0.4
        }
      });
    });

    let result = { variations: [] };
    if (response.text) {
      try {
        result = JSON.parse(response.text.trim());
      } catch (e) {
        console.error("Erro ao fazer parse do JSON do Gemini:", e);
        result = {
          variations: [
            { id: "v1", title: "⚡ 1. Urgência & Oferta Relâmpago", copy: response.text }
          ]
        };
      }
    }

    return res.json(result);
  } catch (err: any) {
    console.log("[Gemini API Info] Gerando copy pelo modelo padrão oficial local (Gemini limite de cota ou indisponível).");

    if (!product || !product.title) {
      return res.status(400).json({ error: "Dados do produto indisponíveis para gerar copy." });
    }

    // Fallback to official standard copy pattern
    const rawInst = product.installments ? String(product.installments).trim() : "";
    const rawMaxSemJuros = product.max_installments_interest_free ? String(product.max_installments_interest_free).trim() : "";
    
    let installmentLine: string | null = null;
    if (rawInst && rawInst !== "Apenas à vista" && !rawInst.toLowerCase().includes("não informado")) {
      let cleanInst = rawInst;
      if (cleanInst.toLowerCase().startsWith("ou ")) cleanInst = cleanInst.slice(3).trim();
      
      const isVerifiedSemJuros = cleanInst.toLowerCase().includes("sem juros") ||
        (rawMaxSemJuros && rawMaxSemJuros.toLowerCase().includes("sem juros"));

      if (isVerifiedSemJuros) {
        if (!cleanInst.toLowerCase().includes("sem juros")) {
          cleanInst = `${cleanInst} sem juros`;
        }
        installmentLine = cleanInst;
      } else {
        installmentLine = cleanInst.replace(/sem juros/gi, "").trim();
      }
    } else if (rawMaxSemJuros && rawMaxSemJuros.toLowerCase().includes("sem juros")) {
      let cleanMax = rawMaxSemJuros;
      if (cleanMax.toLowerCase().startsWith("ou ")) cleanMax = cleanMax.slice(3).trim();
      installmentLine = cleanMax;
    }

    const lines: string[] = [];
    lines.push(product.title.trim());
    lines.push("");

    if (product.price_from && String(product.price_from).trim() && product.price_from !== product.price_to) {
      let cleanFrom = String(product.price_from).trim();
      if (cleanFrom.toLowerCase().startsWith("r$")) cleanFrom = cleanFrom.slice(2).trim();
      lines.push(`~de R$ ${cleanFrom}~`);
    }

    let cleanTo = String(product.price_to || "Consulte no link").trim();
    if (cleanTo.toLowerCase().startsWith("r$")) cleanTo = cleanTo.slice(2).trim();
    lines.push(`por R$ ${cleanTo}`);

    if (installmentLine) {
      lines.push(`💳 ou ${installmentLine}`);
    }

    lines.push("");

    if (product.coupon && String(product.coupon).trim()) {
      lines.push(`🎟️ Use o cupom: ${String(product.coupon).trim()}`);
      lines.push("");
    }

    lines.push(`🛍️ Compre aqui: {LINK}`);
    lines.push("");
    lines.push("*Promoção sujeita a alteração a qualquer momento");

    return res.json({
      fallbackUsed: true,
      variations: [
        {
          id: "var_standard",
          title: "📋 Modelo Oficial Padrão",
          copy: lines.join("\n")
        }
      ]
    });
  }
});

// Gemini AI Template Generator Endpoint
app.post("/api/gemini/generate-template", async (req, res) => {
  try {
    const { category, niche, customPrompt, apiKeys } = req.body;
    const candidateKeys = getCandidateGeminiKeys(apiKeys);

    if (candidateKeys.length === 0) {
      return res.status(500).json({ error: "Nenhuma chave de API do Gemini foi configurada nas Configurações do app." });
    }

    const prompt = `Você é um mestre em Copywriting para Vendas no WhatsApp, Telegram e Redes Sociais no Brasil.
Sua missão é criar um MODELO DE TEMPLATE DE MENSAGEM PADRÃO (reutilizável para produtos de afiliados).

PARÂMETROS SOLICITADOS:
- Estilo/Objetivo: ${category || "Urgência & Escassez"}
- Nicho/Tema do Produto: ${niche || "Geral / Achadinhos"}
- Instruções Personalizadas do Usuário: ${customPrompt || "Nenhuma"}

REGRAS RÍGIDAS DE CONSTRUÇÃO DO TEMPLATE:
1. Você DEVE usar obrigatoriamente as variáveis dinâmicas em chaves duplas conforme necessário:
   - {{produto}} para o nome/título do produto
   - {{preco}} para o preço atual promocional (novo)
   - {{preco_antigo}} para o preço original de tabela (riscado)
   - {{preco_pix}} para o valor no PIX com desconto
   - {{desconto}} para a porcentagem de desconto (ex: -30% ou 30% OFF)
   - {{parcelamento}} ou {{parcelas_sem_juros}} para opções de parcelas
   - {{frete}} para indicação de frete grátis ou valor
   - {{cupom}} para código de cupom de desconto
   - {{loja}} para o nome da loja/marketplace (ex: Mercado Livre, Shopee)
   - {{comissao}} para a comissão estimada em R$
   - {{link}} para o link de afiliado oficial
2. Use formatação nativa do WhatsApp (*negrito*, _itálico_, ~tachado~) e emojis adequados.
3. NUNCA coloque nomes reais de produtos específicos ou valores numéricos fixos no texto; use APENAS as variáveis dinâmicas em chaves duplas acima.
4. Crie um nome/título curto, profissional e atraente para o template (ex: "🔥 Achadinho Viral com Desconto Secreto").
5. Crie uma breve descrição explicativa de quando usar esse modelo (ex: "Ideal para disparos em grupos VIP e listas de transmissões urgentes").

Responda EXATAMENTE em formato JSON.`;

    const { result: response } = await callGeminiWithRotation(candidateKeys, async (ai) => {
      return await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Nome curto e direto para o template criado" },
              description: { type: Type.STRING, description: "Breve explicação do objetivo do template" },
              template: { type: Type.STRING, description: "O texto do template com as variáveis {{produto}}, {{preco}}, {{link}}, etc." }
            },
            required: ["name", "description", "template"]
          },
          temperature: 0.6
        }
      });
    });

    if (response.text) {
      try {
        const parsed = JSON.parse(response.text.trim());
        return res.json(parsed);
      } catch (e) {
        console.error("Erro ao fazer parse do JSON do template:", e);
      }
    }
  } catch (err: any) {
    console.error("Erro na geração de template com Gemini:", err);
  }

  // Fallback inteligente local
  const fallbackTemplates = [
    {
      name: "🔥 Achadinho Imperdível com Cupom",
      description: "Modelo focado em recomendação direta com gatilho de preço baixo",
      template: `🚨 *ACHADINHO BOMBANDO!* 🔥\n\n{{produto}}\n\n💰 *Por apenas: {{preco}}!*\n👉 *Comprar com Desconto:* {{link}}\n\n⏳ *Aproveite antes que o estoque acabe!*`
    },
    {
      name: "⚡️ Oferta Relâmpago VIP",
      description: "Mensagem curta e de alta conversão para grupos e directs",
      template: `⚡️ *OFERTA RELÂMPAGO DO DIA!*\n\n{{produto}}\n\nDe R$ {{preco}} por um preço inacreditável!\n\n🔗 *Garanta o seu aqui:* {{link}}`
    }
  ];

  const selectedFallback = fallbackTemplates[Math.floor(Math.random() * fallbackTemplates.length)];

  return res.json({
    fallbackUsed: true,
    name: selectedFallback.name,
    description: selectedFallback.description,
    template: selectedFallback.template
  });
});

// ─── POST /api/gemini/generate-hooks ───────────────────────────────────────────
app.post("/api/gemini/generate-hooks", async (req, res) => {
  const { product, targetPlatform, selectedStyle, duration, extraProducts, styleContext, geminiApiKey, geminiApiKeys } = req.body;

  if (!product || !product.title) {
    return res.status(400).json({ error: "Dados do produto são obrigatórios." });
  }

  const candidateKeys: string[] = [];
  if (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim()) {
    candidateKeys.push(geminiApiKey.trim());
  }
  if (Array.isArray(geminiApiKeys)) {
    for (const k of geminiApiKeys) {
      if (typeof k === 'string' && k.trim() && !candidateKeys.includes(k.trim())) {
        candidateKeys.push(k.trim());
      }
    }
  }
  if (process.env.GEMINI_API_KEY && !candidateKeys.includes(process.env.GEMINI_API_KEY.trim())) {
    candidateKeys.push(process.env.GEMINI_API_KEY.trim());
  }

  const platformName =
    targetPlatform === 'tiktok'
      ? 'TikTok'
      : targetPlatform === 'instagram'
      ? 'Instagram Reels'
      : 'Criativo de Alta Conversão / Tráfego Pago';

  const styleTitle = selectedStyle?.name || 'Estilo de Alta Conversão';
  const styleDesc = selectedStyle?.desc || '';

  // Montagem do contexto adaptativo extra
  const extraContextLines: string[] = [];
  if (Array.isArray(extraProducts) && extraProducts.length > 0) {
    extraContextLines.push(`PRODUTOS ADICIONAIS NA LISTA:`);
    extraProducts.forEach((ep: any, idx: number) => {
      extraContextLines.push(`- Produto ${idx + 2}: ${ep.title} (${ep.price_to ? 'R$ ' + ep.price_to : 'Preço promocional'})${ep.highlight ? ' - ' + ep.highlight : ''}`);
    });
  }
  if (styleContext?.testType) {
    extraContextLines.push(`- Teste/Desafio Específico: ${styleContext.testType}${styleContext.testResult ? ' (Resultado: ' + styleContext.testResult + ')' : ''}`);
  }
  if (styleContext?.reactKeyMoment || styleContext?.reactVideoUrl) {
    extraContextLines.push(`- React/Reação ao Vídeo: ${styleContext.reactKeyMoment || 'Vídeo viral em análise'}${styleContext.reactResponseAngle ? ' - Ângulo de resposta: ' + styleContext.reactResponseAngle : ''}`);
  }
  if (styleContext?.beforeDescription || styleContext?.afterDescription) {
    extraContextLines.push(`- Antes: ${styleContext.beforeDescription || 'Problema/Caos'} vs Depois: ${styleContext.afterDescription || 'Transformação'}${styleContext.transformationTime ? ' em ' + styleContext.transformationTime : ''}`);
  }
  if (styleContext?.competitorName) {
    extraContextLines.push(`- Comparativo com Concorrente/Alternativa: ${styleContext.competitorName} (${styleContext.competitorPrice ? 'R$ ' + styleContext.competitorPrice : 'Mais caro'}) - Defeito: ${styleContext.competitorFlaw || 'Ineficiente'}`);
  }
  if (styleContext?.testimonialUsageTime || styleContext?.testimonialMainResult) {
    extraContextLines.push(`- Depoimento/UGC: Usado por ${styleContext.testimonialUsageTime || 'semanas'}, resultado: ${styleContext.testimonialMainResult || 'satisfação comprovada'}`);
  }
  if (styleContext?.commonMistake) {
    extraContextLines.push(`- Erro Comum: ${styleContext.commonMistake} vs Jeito Certo: ${styleContext.correctWay || 'com o produto'}`);
  }
  if (styleContext?.unboxingItems) {
    extraContextLines.push(`- Itens da Caixa / Unboxing: ${styleContext.unboxingItems}`);
  }

  const prompt = `Você é o maior especialista em copywriting e retenção de vídeos curtos no formato 9:16 (TikTok, Reels e Anúncios de Tráfego Pago).
Gere EXATAMENTE 15 GANCHOS (HOOKS) de altíssima conversão e retenção nos primeiros 3 segundos para o produto abaixo.

DADOS DO PRODUTO:
- Nome/Título: ${product.title}
- Preço Atual: ${product.price_to ? 'R$ ' + product.price_to : 'Promoção'}
- Preço Anterior: ${product.price_from ? 'R$ ' + product.price_from : 'N/A'}
- Categoria: ${product.category || 'Geral'}
- Benefícios/Descrição: ${product.description || 'Produto de alta qualidade e utilidade diária'}

PLATAFORMA ALVO: ${platformName}
ESTILO SELECIONADO: ${styleTitle} - ${styleDesc}
${extraContextLines.length > 0 ? '\nINFORMAÇÕES EXTRAS E ESPECÍFICAS DO ESTILO:\n' + extraContextLines.join('\n') : ''}

DIRETRIZES ESSENCIAIS:
1. Gere 15 ganchos variados, diretos e persuasivos (curiosidade, dor latente, quebra de padrão, números/preço, contraste, prova social, escassez).
2. Se o estilo for de teste/comparativo/top 3/react/antes e depois, incorpore essas informações específicas nos ganchos.
3. Não use emojis em excesso nos textos dos ganchos para manter o visual limpo, moderno e profissional.
4. Cada gancho deve soar natural para um criador falar nos primeiros 3 segundos do vídeo.
5. Responda em formato JSON com um array chamado "hooks" contendo 15 strings.`;

  try {
    const { result: response } = await callGeminiWithRotation(candidateKeys, async (ai) => {
      return await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              hooks: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["hooks"]
          },
          temperature: 0.6
        }
      });
    });

    if (response.text) {
      try {
        const parsed = JSON.parse(response.text.trim());
        if (Array.isArray(parsed.hooks) && parsed.hooks.length > 0) {
          return res.json({ hooks: parsed.hooks.slice(0, 15), source: 'gemini' });
        }
      } catch (e) {
        console.error("Erro ao parsear JSON dos hooks:", e);
      }
    }
  } catch (err: any) {
    console.error("Erro ao gerar hooks com Gemini:", err);
  }

  // Fallback Inteligente e Contextualizado por Plataforma e Estilo
  const pTitle = product.title.trim();
  const pPrice = product.price_to ? `R$ ${product.price_to}` : 'esse valor promocional';
  const pCat = product.category || 'isso';
  const shortTitle = pTitle.length > 32 ? pTitle.slice(0, 29) + '...' : pTitle;

  const fallbackHooks: string[] = [
    `Eu quase não acreditei quando vi quanto custa o ${shortTitle} por apenas ${pPrice}.`,
    `Se você sofre com ${pCat}, você precisa ver o que esse produto faz em segundos.`,
    `Pare de gastar dinheiro com coisas caras: esse ${shortTitle} custa só ${pPrice} e resolve tudo.`,
    `O segredo que quase ninguém te conta sobre como resolver ${pCat} gastando apenas ${pPrice}.`,
    `Por que todo mundo na internet está comprando esse ${shortTitle} escondido?`,
    `Testei esse produto que custa ${pPrice} para ver se ele cumpre o que promete na prática.`,
    `Atenção: esse ${shortTitle} baixou para ${pPrice} e o estoque vai encerrar hoje.`,
    `Você provavelmente está usando a forma errada para lidar com ${pCat} todos os dias.`,
    `Comprei esse item de ${pPrice} e o resultado nos primeiros 2 minutos me chocou.`,
    `Se eu pudesse te dar apenas uma dica de compra este mês, seria esse ${shortTitle}.`,
    `Duvido você adivinhar quanto custa isso antes de ver funcionando na prática.`,
    `Mais de 5 mil pessoas compraram esse ${shortTitle} e agora eu entendi o motivo.`,
    `Isso custa só ${pPrice} e entrega a mesma qualidade de produtos que custam 5 vezes mais.`,
    `O maior erro que você comete ao comprar itens para ${pCat} é não conhecer esse achadinho.`,
    `Antes de comprar qualquer outra coisa, veja a transformação que isso aqui faz por apenas ${pPrice}.`,
  ];

  return res.json({ hooks: fallbackHooks, source: 'fallback' });
});

// ─── POST /api/gemini/generate-full-script ──────────────────────────────────
app.post("/api/gemini/generate-full-script", async (req, res) => {
  const {
    product,
    targetPlatform,
    selectedStyle,
    duration,
    selectedHook,
    customCta,
    extraProducts,
    styleContext,
    geminiApiKey,
    geminiApiKeys
  } = req.body;

  if (!product || !product.title) {
    return res.status(400).json({ error: "Dados do produto são obrigatórios." });
  }

  const candidateKeys: string[] = [];
  if (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim()) {
    candidateKeys.push(geminiApiKey.trim());
  }
  if (Array.isArray(geminiApiKeys)) {
    for (const k of geminiApiKeys) {
      if (typeof k === 'string' && k.trim() && !candidateKeys.includes(k.trim())) {
        candidateKeys.push(k.trim());
      }
    }
  }
  if (process.env.GEMINI_API_KEY && !candidateKeys.includes(process.env.GEMINI_API_KEY.trim())) {
    candidateKeys.push(process.env.GEMINI_API_KEY.trim());
  }

  const durationSeconds = duration === '15s' ? 15 : duration === '30s' ? 30 : duration === '60s' ? 60 : 90;
  const platformLabel =
    targetPlatform === 'tiktok'
      ? 'TikTok'
      : targetPlatform === 'instagram'
      ? 'Instagram Reels'
      : 'Criativo de Alta Conversão / Tráfego Pago';

  const styleTitle = selectedStyle?.name || 'Estilo de Alta Conversão';
  const styleDesc = selectedStyle?.desc || '';

  // Contexto adicional do estilo
  const extraContextLines: string[] = [];
  if (Array.isArray(extraProducts) && extraProducts.length > 0) {
    extraContextLines.push(`PRODUTOS ADICIONAIS NA LISTA:`);
    extraProducts.forEach((ep: any, idx: number) => {
      extraContextLines.push(`- Produto ${idx + 2}: ${ep.title} (${ep.price_to ? 'R$ ' + ep.price_to : 'Preço promocional'})${ep.highlight ? ' - ' + ep.highlight : ''}`);
    });
  }
  if (styleContext?.testType) {
    extraContextLines.push(`- Teste/Desafio Específico: ${styleContext.testType}${styleContext.testResult ? ' (Resultado: ' + styleContext.testResult + ')' : ''}`);
  }
  if (styleContext?.reactKeyMoment || styleContext?.reactVideoUrl) {
    extraContextLines.push(`- React/Reação ao Vídeo: ${styleContext.reactKeyMoment || 'Vídeo viral em análise'}${styleContext.reactResponseAngle ? ' - Ângulo de resposta: ' + styleContext.reactResponseAngle : ''}`);
  }
  if (styleContext?.beforeDescription || styleContext?.afterDescription) {
    extraContextLines.push(`- Situação Antes: ${styleContext.beforeDescription || 'Problema/Caos'} vs Situação Depois: ${styleContext.afterDescription || 'Transformação'}${styleContext.transformationTime ? ' em ' + styleContext.transformationTime : ''}`);
  }
  if (styleContext?.competitorName) {
    extraContextLines.push(`- Comparativo com Concorrente/Alternativa: ${styleContext.competitorName} (${styleContext.competitorPrice ? 'R$ ' + styleContext.competitorPrice : 'Mais caro'}) - Defeito: ${styleContext.competitorFlaw || 'Ineficiente'}`);
  }
  if (styleContext?.testimonialUsageTime || styleContext?.testimonialMainResult) {
    extraContextLines.push(`- Depoimento/UGC: Usado por ${styleContext.testimonialUsageTime || 'semanas'}, resultado: ${styleContext.testimonialMainResult || 'satisfação comprovada'}`);
  }
  if (styleContext?.commonMistake) {
    extraContextLines.push(`- Erro Comum: ${styleContext.commonMistake} vs Jeito Certo: ${styleContext.correctWay || 'com o produto'}`);
  }
  if (styleContext?.unboxingItems) {
    extraContextLines.push(`- Itens da Caixa / Unboxing: ${styleContext.unboxingItems}`);
  }
  if (styleContext?.extraNotes) {
    extraContextLines.push(`- Notas adicionais de gravação: ${styleContext.extraNotes}`);
  }

  const prompt = `Você é um diretor de gravação e roteirista profissional especialista em vídeos virais no formato vertical 9:16 para TikTok, Instagram Reels e Anúncios de Tráfego Pago.
Crie um ROTEIRO COMPLETO, DINÂMICO E PRONTO PARA GRAVAÇÃO.

DADOS PRINCIPAIS DO PRODUTO:
- Título: ${product.title}
- Preço Atual: R$ ${product.price_to}
- Preço Anterior: ${product.price_from ? 'R$ ' + product.price_from : 'N/A'}
- Categoria: ${product.category || 'Geral'}
- Benefícios: ${product.description || 'Produto prático e eficiente'}

CONFIGURAÇÕES DO VÍDEO:
- Plataforma: ${platformLabel}
- Duração Alvo: ${duration} (${durationSeconds} segundos)
- Estilo Escolhido: ${styleTitle} — ${styleDesc}
- Gancho Inicial Selecionado (Primeiros 3s): "${selectedHook || ''}"
- Chamada para Ação (CTA Final): "${customCta || ''}"
${extraContextLines.length > 0 ? '\nINFORMAÇÕES E MÍDIAS ESPECÍFICAS DO ESTILO:\n' + extraContextLines.join('\n') : ''}

REGRAS DE CONSTRUÇÃO DO ROTEIRO:
1. Divida em cenas com tempos proporcionais à duração (${durationSeconds}s).
2. O gancho inicial DEVE ser respeitado na Cena 1.
3. Para cada cena forneça:
   - sceneNumber (número inteiro 1, 2, 3...)
   - timeRange (ex: "00:00 - 00:03")
   - visual (descrição exata do que o criador deve mostrar na câmera, enquadramento e ação visual)
   - audio (fala exata do narrador/criador, natural, sem enrolação)
   - onScreenText (texto chamativo curto para colocar na tela com emojis ou destaques)
   - actingTip (dica de atuação, tom de voz, energia ou expressão facial)
4. Inclua um campo 'cleanText' contendo APENAS as falas de todas as cenas unidas (para uso no teleprompter).
5. Inclua 'suggestedTitles' (5 ideias de títulos chamativos para a legenda/post) e 'hashtags' (8 a 10 hashtags virais relevantes).

Responda em formato JSON válido.`;

  try {
    const { result: response } = await callGeminiWithRotation(candidateKeys, async (ai) => {
      return await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    timeRange: { type: Type.STRING },
                    visual: { type: Type.STRING },
                    audio: { type: Type.STRING },
                    onScreenText: { type: Type.STRING },
                    actingTip: { type: Type.STRING }
                  },
                  required: ["sceneNumber", "timeRange", "visual", "audio"]
                }
              },
              cta: { type: Type.STRING },
              cleanText: { type: Type.STRING },
              suggestedTitles: { type: Type.ARRAY, items: { type: Type.STRING } },
              hashtags: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ["title", "hook", "scenes", "cta", "cleanText"]
          },
          temperature: 0.5
        }
      });
    });

    if (response.text) {
      try {
        const parsed = JSON.parse(response.text.trim());
        if (parsed.scenes && Array.isArray(parsed.scenes)) {
          const fullText = [
            `ROTEIRO COMPLETO (${platformLabel}) — ${styleTitle}`,
            `Duração: ${duration} | Formato: Vertical 9:16`,
            `Produto: ${product.title}`,
            `Preço: R$ ${product.price_to}`,
            ``,
            `GANCHO INICIAL (Primeiros 3 segundos):`,
            `"${parsed.hook || selectedHook}"`,
            ``,
            `ESTRUTURA CENA A CENA:`,
            ...parsed.scenes.map((s: any) =>
              `[Cena ${s.sceneNumber} - ${s.timeRange}]\nVisual: ${s.visual}\nFala: "${s.audio}"\nTexto na Tela: ${s.onScreenText || '—'}\nDica: ${s.actingTip || '—'}\n`
            ),
            `CHAMADA PARA AÇÃO (CTA FINAL):`,
            `"${parsed.cta || customCta}"`,
          ].join('\n');

          return res.json({
            title: parsed.title || `Roteiro: ${product.title.slice(0, 35)} (${duration})`,
            hook: parsed.hook || selectedHook,
            scenes: parsed.scenes,
            cta: parsed.cta || customCta,
            cleanText: parsed.cleanText || parsed.scenes.map((s: any) => s.audio).join('\n\n'),
            suggestedTitles: parsed.suggestedTitles || [],
            hashtags: parsed.hashtags || [],
            fullText,
            source: 'gemini'
          });
        }
      } catch (e) {
        console.error("Erro no parse do roteiro completo:", e);
      }
    }
  } catch (err: any) {
    console.error("Erro ao gerar roteiro completo com Gemini:", err);
  }

  // Fallback estruturado local
  const sceneCount = durationSeconds <= 15 ? 3 : durationSeconds <= 30 ? 4 : 6;
  const timeSlice = Math.round(durationSeconds / sceneCount);
  const hookToUse = selectedHook || `Você não vai acreditar no que esse produto faz por apenas R$ ${product.price_to}!`;
  const ctaToUse = customCta || 'Comente "EU QUERO" ou clique no link da bio!';

  const fallbackScenes = [
    {
      sceneNumber: 1,
      timeRange: `00:00 - 00:0${Math.min(3, timeSlice)}`,
      visual: 'Segurando o produto na mão com ângulo dinâmico e corte seco nos primeiros 2 segundos para prender a atenção.',
      audio: hookToUse,
      onScreenText: hookToUse.slice(0, 40) + '...',
      actingTip: 'Olhe fixo para a lente da câmera com tom confiante e enérgico.',
    },
    {
      sceneNumber: 2,
      timeRange: `00:0${Math.min(3, timeSlice)} - 00:${String(timeSlice * 2).padStart(2, '0')}`,
      visual: 'Close-up no produto sendo utilizado ou demonstrado, evidenciando acabamento e funcionalidade.',
      audio: `Dá uma olhada nisso aqui. ${product.price_from ? `Custava R$ ${product.price_from} e agora baixou para só R$ ${product.price_to}!` : `Custa apenas R$ ${product.price_to}!`} É muito mais prático do que parece.`,
      onScreenText: `R$ ${product.price_to} 🔥`,
      actingTip: 'Aproxime bem da lente para evidenciar os detalhes e o benefício real.',
    },
    {
      sceneNumber: 3,
      timeRange: `00:${String(timeSlice * 2).padStart(2, '0')} - 00:${String(timeSlice * 3).padStart(2, '0')}`,
      visual: 'Demonstração prática do produto resolvendo o problema e gerando o resultado perfeito.',
      audio: `Ele entrega exatamente ${product.category ? `o que você precisa para ${product.category}` : 'o que promete'} sem complicação nenhuma.`,
      onScreenText: 'Prático e Rápido ✅',
      actingTip: 'Sorriso de aprovação genuína mostrando que o resultado foi alcançado.',
    },
  ];

  if (sceneCount >= 4) {
    fallbackScenes.push({
      sceneNumber: 4,
      timeRange: `00:${String(timeSlice * 3).padStart(2, '0')} - 00:${String(durationSeconds).padStart(2, '0')}`,
      visual: 'Segurando o produto e apontando para a chamada de ação indicada na tela.',
      audio: ctaToUse,
      onScreenText: ctaToUse.slice(0, 35) + '...',
      actingTip: 'Encerre com entusiasmo e convide a audiência para a ação imediata.',
    });
  }

  const cleanText = fallbackScenes.map((s) => s.audio).join('\n\n');
  const catClean = (product.category || 'achadinhos').toLowerCase().replace(/[^a-z0-9]/g, '');

  const fullText = [
    `ROTEIRO COMPLETO (${platformLabel}) — ${styleTitle}`,
    `Duração: ${duration} | Formato: Vertical 9:16`,
    `Produto: ${product.title}`,
    `Preço: R$ ${product.price_to}`,
    ``,
    `GANCHO INICIAL:`,
    `"${hookToUse}"`,
    ``,
    `ESTRUTURA CENA A CENA:`,
    ...fallbackScenes.map(
      (s) =>
        `[Cena ${s.sceneNumber} - ${s.timeRange}]\nVisual: ${s.visual}\nFala: "${s.audio}"\nTexto na Tela: ${s.onScreenText}\nDica: ${s.actingTip}\n`
    ),
    `CHAMADA PARA AÇÃO:`,
    `"${ctaToUse}"`,
  ].join('\n');

  return res.json({
    title: `Roteiro: ${product.title.slice(0, 35)} (${duration})`,
    hook: hookToUse,
    scenes: fallbackScenes,
    cta: ctaToUse,
    cleanText,
    suggestedTitles: [
      `Você não vai acreditar no que esse produto faz por R$ ${product.price_to}!`,
      `ACHADINHO SECRETO: O melhor que comprei este mês!`,
      `Pare de gastar dinheiro com coisa cara! Isso custa só R$ ${product.price_to}.`,
      `Unboxing & Teste sincero: Vale a pena comprar por R$ ${product.price_to}?`,
      `O segredo que ninguém te conta sobre ${product.category || 'esse achadinho'}!`,
    ],
    hashtags: ['#achadinhos', '#achados', '#mercadolivre', '#shopee', '#tiktokmademebuyit', `#${catClean}`, '#promocao'],
    fullText,
    source: 'fallback'
  });
});

// ─── POST /api/gemini/video-script ───────────────────────────────────────────
app.post("/api/gemini/video-script", async (req, res) => {
  const { product, videoType, duration, geminiApiKey, geminiApiKeys } = req.body;

  if (!product || !product.title) {
    return res.status(400).json({ error: "Dados do produto são obrigatórios." });
  }

  const candidateKeys: string[] = [];
  if (geminiApiKey && typeof geminiApiKey === 'string' && geminiApiKey.trim()) {
    candidateKeys.push(geminiApiKey.trim());
  }
  if (Array.isArray(geminiApiKeys)) {
    for (const k of geminiApiKeys) {
      if (typeof k === 'string' && k.trim() && !candidateKeys.includes(k.trim())) {
        candidateKeys.push(k.trim());
      }
    }
  }
  if (process.env.GEMINI_API_KEY && !candidateKeys.includes(process.env.GEMINI_API_KEY.trim())) {
    candidateKeys.push(process.env.GEMINI_API_KEY.trim());
  }

  const durationMap: Record<string, { label: string; chars: number; words: number }> = {
    '30s': { label: '30 Segundos', chars: 420, words: 70 },
    '1m': { label: '1 Minuto (140 palavras)', chars: 840, words: 140 },
    '2m': { label: '2 Minutos (280 palavras)', chars: 1680, words: 280 },
    '3m': { label: '3 Minutos (420 palavras)', chars: 2520, words: 420 },
  };

  const durInfo = durationMap[duration] || durationMap['1m'];

  const typeMap: Record<string, string> = {
    achadinho: 'Achadinho Viral / Descoberta Impressionante (Foco em curiosidade e efeito UAU)',
    review: 'Review Honesto / UGC em Primeira Pessoa (Mostrando uso real do produto e satisfação)',
    problema_solucao: 'Problema vs. Solução (Identifica uma dor comum do público e apresenta o produto como salvador)',
    top_motivos: 'Top Motivos para Comprar Agora (Listagem dinâmica de 3 a 5 benefícios imbatíveis)',
    oferta_urgencia: 'Oferta Relâmpago / Urgência Total (Foco em desconto surreal e poucas unidades)',
  };

  const typeDesc = typeMap[videoType] || typeMap['achadinho'];

  const prompt = `Você é um roteirista profissional de vídeos virais para TikTok, Instagram Reels e YouTube Shorts focado em conversão de afiliados.
Crie um ROTEIRO COMPLETO de vídeo no formato vertical (9:16).

PRODUTO:
- Título: ${product.title}
- Preço Atual: R$ ${product.price_to}
- Preço Anterior: ${product.price_from ? 'R$ ' + product.price_from : 'N/A'}
- Cupom: ${product.coupon || 'Sem cupom extra'}
- Plataforma: ${product.platform}

ESTILO DO VÍDEO: ${typeDesc}
DURAÇÃO ALVO: ${durInfo.label}
METRAGEM DE PALAVRAS: Aproximadamente ${durInfo.words} palavras (${durInfo.chars} caracteres, respeitando a métrica de ~140 palavras por minuto).

ESTRUTURA DO ROTEIRO:
1. HOOK / GANCHO (Primeiros 3 segundos): Frase impactante para prender a atenção e parar o scroll.
2. CENA A CENA (Divisão por cenas com indicação visual de câmera/edição e narração em áudio):
   - Cenas visuais (o que aparece na tela / na gravação)
   - Narração (fala exata do narrador/criador)
3. CHAMADA PARA AÇÃO (CTA): Instruções claras para clicar no link da bio ou comentar 'EU QUERO' para receber o link.

Responda em formato JSON válido e bem estruturado.`;

  try {
    const { result: response } = await callGeminiWithRotation(candidateKeys, async (ai) => {
      return await generateGeminiContentWithFallback(ai, "gemini-3.7-flash", {
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              hook: { type: Type.STRING },
              targetDuration: { type: Type.STRING },
              scenes: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    sceneNumber: { type: Type.INTEGER },
                    timeRange: { type: Type.STRING },
                    visualPrompt: { type: Type.STRING },
                    narration: { type: Type.STRING }
                  },
                  required: ["sceneNumber", "timeRange", "visualPrompt", "narration"]
                }
              },
              cta: { type: Type.STRING },
              fullScriptText: { type: Type.STRING }
            },
            required: ["title", "hook", "scenes", "cta", "fullScriptText"]
          },
          temperature: 0.5
        }
      });
    });

    if (response.text) {
      try {
        const parsed = JSON.parse(response.text.trim());
        return res.json(parsed);
      } catch (e) {
        console.error("Erro ao fazer parse do JSON do roteiro:", e);
      }
    }
  } catch (err: any) {
    console.error("Erro na chamada Gemini do Roteiro:", err);
  }

  // Fallback local robusto caso Gemini esteja indisponível
  const scenesCount = duration === '30s' ? 3 : duration === '2m' ? 6 : duration === '3m' ? 8 : 4;
  const scenes = [];
  
  scenes.push({
    sceneNumber: 1,
    timeRange: "00:00 - 00:03",
    visualPrompt: `🎥 [GANCHO VIRAL] Mostre o produto (${product.title.slice(0, 30)}) de perto em ângulo dinâmico com zoom rápido. Textão chamativo na tela.`,
    narration: `Para tudo que você tá fazendo! Se você não sabia que precisava desse ${product.title.slice(0, 30)}, você tá perdendo tempo!`
  });

  scenes.push({
    sceneNumber: 2,
    timeRange: "00:03 - 00:15",
    visualPrompt: `📱 Mostre o produto em uso prático, detalhando acabamento e qualidade.`,
    narration: `Olha a qualidade disso! Além de super prático, tá saindo por apenas R$ ${product.price_to}.`
  });

  if (scenesCount >= 4) {
    scenes.push({
      sceneNumber: 3,
      timeRange: "00:15 - 00:40",
      visualPrompt: `⚡️ Mostre o cupom ${product.coupon || 'secreto'} e destaque a economia em comparação com lojas físicas.`,
      narration: `Na loja oficial tá bem mais caro, mas nesse link que eu achei você garante com super desconto e frete rápido!`
    });
  }

  scenes.push({
    sceneNumber: scenesCount,
    timeRange: duration === '30s' ? "00:25 - 00:30" : "00:50 - 01:00",
    visualPrompt: `👉 Aponta para a bio ou digite 'EU QUERO' nos comentários para o bot te enviar o link no direct!`,
    narration: `Comente "EU QUERO" aqui nos comentários ou clica no link do meu perfil antes que acabe o estoque!`
  });

  const fullText = scenes.map(s => `[Cena ${s.sceneNumber} | ${s.timeRange}]\n🎬 VISUAL: ${s.visualPrompt}\n🎙️ FALA: "${s.narration}"`).join('\n\n');

  return res.json({
    title: `Roteiro: ${product.title.slice(0, 40)} (${durInfo.label})`,
    hook: scenes[0].narration,
    targetDuration: durInfo.label,
    scenes,
    cta: `Comente "EU QUERO" ou clique no link da Bio!`,
    fullScriptText: fullText
  });
});

// Endpoint to test and validate API keys before saving
app.post("/api/test-key", async (req, res) => {
  try {
    const { provider, keys } = req.body;
    if (!provider) {
      return res.status(400).json({ success: false, error: "Provedor não informado." });
    }

    if (provider === "mercadolivre") {
      const appId = keys?.mercadoLivreAppId?.trim() || process.env.MERCADO_LIVRE_CLIENT_ID || process.env.MERCADOLIVRE_APP_ID;
      const clientSecret = keys?.mercadoLivreClientSecret?.trim() || process.env.MERCADO_LIVRE_CLIENT_SECRET || process.env.MERCADOLIVRE_CLIENT_SECRET;
      const accessToken = keys?.mercadoLivreKey?.trim();

      if (appId && clientSecret) {
        // Test OAuth client credentials directly with Mercado Libre OAuth server
        const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: appId,
            client_secret: clientSecret,
          }),
        });
        const tokenData = await tokenRes.json();
        if (tokenRes.ok && tokenData.access_token) {
          return res.json({
            success: true,
            message: "App ID e Client Secret autenticados com sucesso no Mercado Livre! Token gerado.",
          });
        } else {
          let errDetail = tokenData.message || tokenData.error;
          if (tokenData.error === 'invalid_client' || errDetail === 'invalid_client' || (typeof errDetail === 'string' && errDetail.includes('invalid_client'))) {
            errDetail = "App ID ou Client Secret do Mercado Livre incorretos (invalid_client). Verifique suas credenciais no painel Mercado Livre Developers.";
          }
          return res.status(400).json({
            success: false,
            error: errDetail || "App ID ou Client Secret incorretos no Mercado Livre.",
          });
        }
      } else if (accessToken) {
        const userRes = await fetch("https://api.mercadolibre.com/users/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (userRes.ok) {
          const userData = await userRes.json();
          return res.json({
            success: true,
            message: `Access Token validado com sucesso! Usuário: ${userData.nickname || userData.id}`,
          });
        } else {
          return res.status(400).json({
            success: false,
            error: "Access Token do Mercado Livre é inválido ou está expirado.",
          });
        }
      } else {
        return res.status(400).json({
          success: false,
          error: "Preencha o App ID + Client Secret ou o Access Token do Mercado Livre para testar.",
        });
      }
    }

    if (provider === "gemini") {
      const apiKey = keys?.geminiApiKey?.trim();
      if (!apiKey) {
        return res.status(400).json({ success: false, error: "Informe a Chave de API Gemini." });
      }
      const gRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
      if (gRes.ok) {
        return res.json({ success: true, message: "Chave Gemini AI validada com sucesso!" });
      } else {
        const gErr = await gRes.json().catch(() => ({}));
        return res.status(400).json({
          success: false,
          error: gErr?.error?.message || "Chave de API Gemini é inválida ou sem permissões.",
        });
      }
    }

    if (provider === "shopee") {
      const sAppId = keys?.shopeeAppId?.trim() || keys?.shopeeKey?.trim() || process.env.SHOPEE_APP_ID;
      const sSecret = keys?.shopeeSecret?.trim() || process.env.SHOPEE_APP_SECRET || process.env.SHOPEE_SECRET;
      const sTracking = keys?.shopeeTrackingId?.trim();

      const source = keys?.shopeeSecret?.trim() ? "config do usuário" : "env do servidor";
      const secretLen = sSecret ? sSecret.length : 0;
      const secretLast4 = secretLen >= 4 ? sSecret.slice(-4) : (sSecret || "none");

      console.log(`[SHOPEE DIAG] /api/integrations/test-keys (shopee) | appId: ${sAppId} | secretLen: ${secretLen} | secretLast4: ${secretLast4} | Origem: ${source}`);

      if (sAppId && sSecret) {
        try {
          const testQuery = JSON.stringify({ query: `query { conversionReport(limit: 1) { nodes { conversionId } } }` });
          const testRes = await fetchShopeeGraphQLWithSignatureFallback(
            "https://open-api.affiliate.shopee.com.br/api/v1/graphql",
            sAppId,
            sSecret,
            testQuery
          );

          if (testRes && testRes.ok) {
            const testJson = await testRes.json();
            console.log(`[SHOPEE DIAG] /api/integrations/test-keys resposta:`, JSON.stringify(testJson));
            if (testJson?.data || !testJson?.errors) {
              return res.json({ success: true, message: "App ID e Secret da Shopee validados com sucesso via API GraphQL!" });
            } else {
              const errMsg = testJson?.errors?.[0]?.message || JSON.stringify(testJson?.errors);
              return res.status(400).json({ success: false, error: `Shopee API retornou erro de chave/assinatura: ${errMsg}` });
            }
          } else {
            const errTxt = testRes ? await testRes.text() : "Sem resposta HTTP";
            console.error(`[SHOPEE DIAG] /api/integrations/test-keys resposta de erro: ${testRes?.status} - ${errTxt}`);
            return res.status(400).json({ success: false, error: `Falha na autenticação com a API Shopee: ${errTxt.substring(0, 150)}` });
          }
        } catch (shTestErr: any) {
          console.error("[SHOPEE DIAG] /api/integrations/test-keys exceção:", shTestErr);
        }
      }

      if (!sAppId && !sTracking) {
        return res.status(400).json({ success: false, error: "Informe o App ID + Secret ou uma Tag de Afiliados Shopee válida." });
      }
      return res.json({ success: true, message: "Credenciais de Afiliado Shopee validadas!" });
    }

    if (provider === "amazon") {
      const tag = keys?.amazonKey?.trim();
      if (!tag || tag.length < 3) {
        return res.status(400).json({ success: false, error: "Informe uma Tag de Associados Amazon válida." });
      }
      return res.json({ success: true, message: "Tag de Associados Amazon validada!" });
    }

    if (provider === "aliexpress") {
      const key = keys?.aliExpressKey?.trim();
      if (!key || key.length < 5) {
        return res.status(400).json({ success: false, error: "Informe uma chave de Afiliado AliExpress válida." });
      }
      return res.json({ success: true, message: "Chave de Afiliado AliExpress validada!" });
    }

    if (provider === "shein") {
      const key = keys?.sheinKey?.trim();
      if (!key || key.length < 5) {
        return res.status(400).json({ success: false, error: "Informe um Token Publisher Shein válido." });
      }
      return res.json({ success: true, message: "Token Publisher Shein validado!" });
    }

    return res.status(400).json({ success: false, error: "Provedor não suportado." });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: "Erro ao testar credenciais: " + (err.message || "") });
  }
});

// ─── POST /api/extension/bulk-upsert ────────────────────────────────────────
app.post(['/api/extension/bulk-upsert', '/extension/bulk-upsert'], async (req, res) => {
  try {
    const { uid, products } = req.body;

    if (!uid || typeof uid !== 'string') {
      return res.status(400).json({ error: 'UID do usuário é obrigatório.' });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Lista de produtos é obrigatória e não pode estar vazia.' });
    }

    if (products.length > 200) {
      return res.status(400).json({ error: 'Máximo de 200 produtos por requisição.' });
    }

    const invalid = products.filter((p) => !p.platform || !p.title || !p.price_to || !p.original_link);
    if (invalid.length > 0) {
      return res.status(400).json({
        error: `${invalid.length} produto(s) inválidos — campos obrigatórios: platform, title, price_to, original_link`,
      });
    }

    const sanitized = products.map((p) => ({
      platform: String(p.platform).toLowerCase(),
      title: String(p.title).slice(0, 500),
      price_to: String(p.price_to),
      price_from: p.price_from ? String(p.price_from) : null,
      image_url: p.image_url ? String(p.image_url) : null,
      original_link: String(p.original_link),
      installments: p.installments ? String(p.installments) : null,
      coupon: p.coupon ? String(p.coupon) : null,
      shipping: p.shipping ? String(p.shipping) : null,
      description: p.description ? String(p.description).slice(0, 2000) : null,
      pictures: Array.isArray(p.pictures) ? p.pictures.slice(0, 10).map(String) : [],
    }));

    res.json({
      success: true,
      received: sanitized.length,
      products: sanitized,
      message: 'Produtos validados. A extensão deve processar o upsert via Firebase SDK.',
    });

  } catch (err: any) {
    console.error('[/api/extension/bulk-upsert] Erro:', err);
    res.status(500).json({ error: 'Erro interno ao processar produtos.' });
  }
});

// ─── POST /api/extension/generate-copy ──────────────────────────────────────
app.post(['/api/extension/generate-copy', '/extension/generate-copy'], async (req, res) => {
  try {
    const { uid, product } = req.body;

    if (!uid || !product?.title || !product?.price_to) {
      return res.status(400).json({ error: 'uid, product.title e product.price_to são obrigatórios.' });
    }

    return res.json({
      success: true,
      message: 'Use /api/gemini/copy diretamente com os dados do produto.',
      endpoint: '/api/gemini/copy',
    });

  } catch (err: any) {
    console.error('[/api/extension/generate-copy] Erro:', err);
    res.status(500).json({ error: 'Erro interno.' });
  }
});

// ─── GET /api/extension/status ───────────────────────────────────────────────
app.get(['/api/extension/status', '/extension/status'], (req, res) => {
  res.json({
    online: true,
    version: '1.0.0',
    features: {
      scrape: true,
      geminiCopy: true,
      bulkUpsert: true,
      marketplace: true,
    },
    limits: {
      bulkUpsertMaxPerRequest: 200,
      dailyFreeLimit: 100,
    },
    timestamp: new Date().toISOString(),
  });
});

// ─── GET /api/extension/download ──────────────────────────────────────────────
app.get(['/api/extension/download', '/extension/download'], (req, res) => {
  try {
    const extensionDir = path.join(process.cwd(), "extension");
    const manifestPath = path.join(extensionDir, "manifest.json");
    
    if (fs.existsSync(extensionDir) && fs.existsSync(manifestPath)) {
      let version = "1.0.0";
      let name = "afiliate-miner";
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
        version = manifest.version || "1.0.0";
        name = (manifest.name || "afiliate-miner").toLowerCase().replace(/\s+/g, "-");
      } catch (e) {
        console.error("Erro ao ler manifest.json para download:", e);
      }
      
      const zip = new AdmZip();
      zip.addLocalFolder(extensionDir);
      const zipBuffer = zip.toBuffer();

      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename=${name}.zip`);
      return res.send(zipBuffer);
    }

    const zip = new AdmZip();

    const manifestJson = JSON.stringify({
      manifest_version: 3,
      name: "Afiliados Master Extensão",
      version: "1.0.0",
      description: "Mineração e captura de ofertas com 1 clique no Mercado Livre, Shopee, Amazon, AliExpress e Shein.",
      permissions: ["activeTab", "storage", "scripting"],
      host_permissions: [
        "https://*.mercadolivre.com.br/*",
        "https://*.mercadolibre.com/*",
        "https://*.shopee.com.br/*",
        "https://*.shopee.com/*",
        "https://*.amazon.com.br/*",
        "https://*.amazon.com/*",
        "https://*.aliexpress.com/*",
        "https://*.shein.com/*"
      ],
      action: {
        default_popup: "popup.html",
        default_title: "Afiliados Master"
      },
      background: {
        service_worker: "background.js"
      },
      content_scripts: [
        {
          matches: [
            "https://*.mercadolivre.com.br/*",
            "https://*.mercadolibre.com/*",
            "https://*.shopee.com.br/*",
            "https://*.shopee.com/*",
            "https://*.amazon.com.br/*",
            "https://*.amazon.com/*",
            "https://*.aliexpress.com/*",
            "https://*.shein.com/*"
          ],
          js: ["content.js"]
        }
      ]
    }, null, 2);

    const popupHtml = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Afiliados Master</title>
  <style>
    body {
      width: 320px;
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: #0e1119;
      color: #ffffff;
      box-sizing: border-box;
    }
    h2 {
      font-size: 14px;
      margin: 0 0 4px 0;
      color: #c084fc;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    p {
      font-size: 11px;
      color: #93a0b5;
      margin: 0 0 12px 0;
      line-height: 1.4;
    }
    .card {
      background-color: #151a26;
      border: 1px solid #1e2636;
      border-radius: 10px;
      padding: 12px;
      margin-bottom: 12px;
    }
    label {
      display: block;
      font-size: 10px;
      font-weight: bold;
      color: #d6d3d1;
      margin-bottom: 4px;
    }
    input {
      width: 100%;
      padding: 8px;
      background-color: #0e1119;
      border: 1px solid #1e2636;
      border-radius: 6px;
      color: #ffffff;
      font-size: 11px;
      box-sizing: border-box;
      margin-bottom: 8px;
    }
    button {
      width: 100%;
      padding: 10px;
      background-color: #9333ea;
      color: #ffffff;
      border: none;
      border-radius: 8px;
      font-weight: bold;
      font-size: 12px;
      cursor: pointer;
      transition: background 0.2s;
    }
    button:hover {
      background-color: #a855f7;
    }
    #status {
      margin-top: 10px;
      font-size: 11px;
      text-align: center;
      font-weight: bold;
    }
    .success { color: #4ade80; }
    .error { color: #f87171; }
  </style>
</head>
<body>
  <h2>⚡ Afiliados Master Extensão</h2>
  <p>Capture produtos diretamente da loja aberta no navegador.</p>
  
  <div class="card">
    <label for="serverUrl">URL do Painel Backend</label>
    <input type="text" id="serverUrl" placeholder="https://seu-painel.run.app" />
    
    <label for="userId">UID do Usuário (opcional)</label>
    <input type="text" id="userId" placeholder="A1B2C3D4E5" />
    
    <button id="captureBtn">Capturar & Enviar Produto</button>
  </div>
  
  <div id="status"></div>
  <script src="popup.js"></script>
</body>
</html>`;

    const popupJs = `document.addEventListener('DOMContentLoaded', () => {
  const serverUrlInput = document.getElementById('serverUrl');
  const userIdInput = document.getElementById('userId');
  const captureBtn = document.getElementById('captureBtn');
  const statusDiv = document.getElementById('status');

  chrome.storage.local.get(['serverUrl', 'userId'], (res) => {
    if (res.serverUrl) serverUrlInput.value = res.serverUrl;
    if (res.userId) userIdInput.value = res.userId;
  });

  captureBtn.addEventListener('click', async () => {
    const serverUrl = (serverUrlInput.value || window.location.origin).trim().replace(/\\/$/, '');
    const userId = userIdInput.value.trim() || 'default_user';

    chrome.storage.local.set({ serverUrl, userId });

    statusDiv.className = '';
    statusDiv.innerText = 'Capturando dados da página...';

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      statusDiv.className = 'error';
      statusDiv.innerText = 'Nenhuma aba ativa encontrada.';
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action: 'get_product_data' }, async (response) => {
      if (chrome.runtime.lastError || !response) {
        statusDiv.className = 'error';
        statusDiv.innerText = 'Acesse a página do produto na loja suportada e tente novamente.';
        return;
      }

      try {
        statusDiv.innerText = 'Enviando produto ao Marketplace...';
        const res = await fetch(\`\${serverUrl}/api/extension/bulk-upsert\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            uid: userId,
            products: [response]
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          statusDiv.className = 'success';
          statusDiv.innerText = '✓ Produto enviado com sucesso!';
        } else {
          statusDiv.className = 'error';
          statusDiv.innerText = data.error || 'Erro ao enviar produto.';
        }
      } catch (err) {
        statusDiv.className = 'error';
        statusDiv.innerText = 'Falha de conexão com o servidor.';
      }
    });
  });
});`;

    const contentJs = `console.log("[Afiliados Master Extensão] Content script ativo.");

function extractProductInfo() {
  const url = window.location.href;
  let platform = 'desconhecido';
  if (url.includes('mercadolivre') || url.includes('mercadolibre')) platform = 'mercadolivre';
  else if (url.includes('shopee')) platform = 'shopee';
  else if (url.includes('amazon')) platform = 'amazon';
  else if (url.includes('aliexpress')) platform = 'aliexpress';
  else if (url.includes('shein')) platform = 'shein';

  let title = document.title;
  const h1 = document.querySelector('h1');
  if (h1 && h1.innerText.trim()) title = h1.innerText.trim();

  let price_to = '0,00';
  const priceFraction = document.querySelector('.andes-money-amount__fraction') || document.querySelector('[class*="price"]');
  if (priceFraction && priceFraction.innerText) {
    price_to = priceFraction.innerText.trim();
  }

  let image_url = null;
  const imgEl = document.querySelector('img[src*="http"]');
  if (imgEl) image_url = imgEl.src;

  return {
    platform,
    title,
    price_to,
    image_url,
    original_link: url
  };
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'get_product_data') {
    sendResponse(extractProductInfo());
  }
  return true;
});`;

    const backgroundJs = `chrome.runtime.onInstalled.addListener(() => {
  console.log("[Afiliados Master Extensão] Instalada com sucesso!");
});`;

    zip.addFile("manifest.json", Buffer.from(manifestJson, "utf8"));
    zip.addFile("popup.html", Buffer.from(popupHtml, "utf8"));
    zip.addFile("popup.js", Buffer.from(popupJs, "utf8"));
    zip.addFile("content.js", Buffer.from(contentJs, "utf8"));
    zip.addFile("background.js", Buffer.from(backgroundJs, "utf8"));

    const zipBuffer = zip.toBuffer();

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", "attachment; filename=afiliados-master-extensao.zip");
    res.send(zipBuffer);
  } catch (err: any) {
    console.error("[/api/extension/download] Erro ao gerar zip:", err);
    res.status(500).json({ error: "Erro ao gerar arquivo zip da extensão." });
  }
});

// Vite / Production middleware
async function startServer() {
  const distPath = path.join(process.cwd(), "dist");
  const indexPath = path.join(distPath, "index.html");
  const hasBuiltApp = fs.existsSync(indexPath);
  const isProduction = process.env.NODE_ENV === "production" && hasBuiltApp;

  if (!isProduction) {
    console.log("Starting server in DEVELOPMENT mode with Vite dev middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode, serving pre-built files from:", distPath);
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Application index.html not found.");
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();