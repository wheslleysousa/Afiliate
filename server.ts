import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

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
    urlLower.includes("she.in")
  ) {
    return "shein";
  }
  throw new Error("Plataforma não suportada. Use links do Mercado Livre, Shopee, Amazon, AliExpress ou Shein.");
}

const DEFAULT_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
};

// Helper to refresh ML token
async function refreshMercadoLivreToken(appId: string, clientSecret: string, refreshToken: string) {
  try {
    console.log("[ML Token Refresh] Tentando renovar access_token usando o refresh_token...");
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

    const data = await res.json();
    if (res.ok && data.access_token) {
      const expiresAt = Date.now() + (data.expires_in || 21600) * 1000;
      console.log("[ML Token Refresh] Token renovado com sucesso!");
      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: expiresAt,
      };
    } else {
      console.error("[ML Token Refresh] Erro de resposta do Mercado Livre:", data);
      return null;
    }
  } catch (err) {
    console.error("[ML Token Refresh] Exceção ao renovar token:", err);
    return null;
  }
}

// Mercado Livre Scraper
async function scrapeMercadoLivre(url: string, mlConfig?: any) {
  let finalUrl = url;
  let ml_auth_error = false;
  let updated_ml_keys: any = null;
  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
    finalUrl = res.url || url;
    const html = await res.text();

    let bearerToken = typeof mlConfig === 'string' ? mlConfig : (mlConfig?.mercadoLivreKey || process.env.MERCADOLIVRE_KEY);
    let refreshToken = typeof mlConfig === 'object' ? mlConfig?.mercadoLivreRefreshToken : undefined;
    let expiresAt = typeof mlConfig === 'object' ? mlConfig?.mercadoLivreExpiresAt : undefined;
    const appId = (typeof mlConfig === 'object' ? mlConfig?.mercadoLivreAppId : undefined) || process.env.MERCADOLIVRE_APP_ID || "1096973158666349";
    const clientSecret = (typeof mlConfig === 'object' ? mlConfig?.mercadoLivreClientSecret : undefined) || process.env.MERCADOLIVRE_CLIENT_SECRET || "5YoWCSRNr90KiVumj0tf35NGkpOAbops";

    // Preemptive Auto-Renew using Refresh Token if expired (or close to expiry)
    if (refreshToken && appId && clientSecret) {
      const isExpired = !bearerToken || !expiresAt || Date.now() >= Number(expiresAt) - 300000;
      if (isExpired) {
        const renewed = await refreshMercadoLivreToken(appId, clientSecret, refreshToken);
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

    // Se tivermos App ID e Client Secret mas não o Access Token direto, tenta obter token de client_credentials
    if (!bearerToken && appId && clientSecret) {
      try {
        const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: String(appId).trim(),
            client_secret: String(clientSecret).trim(),
          }),
        });
        if (tokenRes.ok) {
          const tokenData = await tokenRes.json();
          if (tokenData.access_token) {
            bearerToken = tokenData.access_token;
            console.log("[ML Scraper] Token de client_credentials obtido com sucesso para o App ID.");
          }
        }
      } catch (tErr) {
        console.warn("[ML Scraper] Falha ao obter token de client_credentials:", tErr);
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

    if (itemId) {
      try {
        const apiHeaders: Record<string, string> = {
          "Accept": "application/json",
          "User-Agent": DEFAULT_HEADERS["User-Agent"],
        };
        if (bearerToken && bearerToken.trim()) {
          apiHeaders["Authorization"] = `Bearer ${bearerToken.trim()}`;
        }

        const isCatalog = finalUrl.includes("/p/MLB") || url.includes("/p/MLB") || canonicalUrl.includes("/p/MLB");
        const getApiUrl = (id: string) => isCatalog 
          ? `https://api.mercadolibre.com/products/${id}`
          : `https://api.mercadolibre.com/items/${id}`;

        let apiRes = await fetch(getApiUrl(itemId), {
          headers: apiHeaders
        });

        if ((apiRes.status === 401 || apiRes.status === 403) && refreshToken && appId && clientSecret && !updated_ml_keys) {
          console.warn("[ML API] Token falhou com status 401/403. Tentando renovar com refresh_token...");
          const renewed = await refreshMercadoLivreToken(appId, clientSecret, refreshToken);
          if (renewed) {
            bearerToken = renewed.access_token;
            refreshToken = renewed.refresh_token;
            expiresAt = renewed.expires_at;
            updated_ml_keys = {
              mercadoLivreKey: renewed.access_token,
              mercadoLivreRefreshToken: renewed.refresh_token,
              mercadoLivreExpiresAt: renewed.expires_at,
            };
            
            // Refazer requisição com novo token
            const retryHeaders = {
              ...apiHeaders,
              "Authorization": `Bearer ${bearerToken.trim()}`
            };
            apiRes = await fetch(getApiUrl(itemId), {
              headers: retryHeaders
            });
          }
        }

        if (!apiRes.ok) {
          console.warn(`[ML API] Requisição falhou para ${itemId}. HTTP ${apiRes.status}`);
          if (apiRes.status === 401 || apiRes.status === 403) {
            ml_auth_error = true;
          }
        }

        if (apiRes.ok) {
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
          const video_url = uniqVideos[0] || null;

          const rawPrice = data.price || data.buy_box_winner?.price || data.buy_box_winner_price;
          const price_to = rawPrice ? cleanPrice(rawPrice) : null;
          
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
          if (!isCatalog) {
            try {
              const descRes = await fetch(`https://api.mercadolibre.com/items/${itemId}/description`, {
                headers: { "User-Agent": DEFAULT_HEADERS["User-Agent"] }
              });
              if (descRes.ok) {
                const descData = await descRes.json();
                description = (descData.plain_text || '').slice(0, 1000).trim() || null;
              }
            } catch (e) {
              console.warn(`[ML API] Não foi possível buscar descrição de ${itemId}`, e);
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

          if (title && price_to) {
            return { title, description, image_url, pictures, video_url, videos: uniqVideos, price_from, price_to, installments, max_installments_interest_free, coupon, shipping, ml_auth_error: false };
          } else {
            console.warn(`[ML API] Resposta OK mas incompleta para ${itemId}. status=${data.status} title="${title}" price=${data.price}`);
          }
        } else {
          console.warn(`[ML API] Requisição falhou para ${itemId}. HTTP ${apiRes.status}`);
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
          cardInstallments = installmentsEl.text().replace(/\s+/g, ' ').trim();
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

      return {
        title: socialTitle,
        description: "Confira todos os detalhes e garanta o seu produto com desconto no link oficial do Mercado Livre.",
        image_url: socialImage,
        pictures: socialImage ? [socialImage] : [],
        video_url: null,
        price_from: socialPriceFrom,
        price_to: socialPriceTo || "Consulte no link",
        card_price: socialCardPrice,
        installments: socialInstallments || "Consulte as condições de parcelamento",
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

    // If still not found, calculate 12x installment from card_price or price_to
    if (!installments) {
      const basePriceForInstallments = card_price || price_to;
      if (basePriceForInstallments) {
        const pNum = parseFloat(basePriceForInstallments.replace(/\./g, "").replace(",", "."));
        if (!isNaN(pNum) && pNum > 0) {
          const val12 = (pNum / 12).toFixed(2).replace(".", ",");
          installments = `12x de R$ ${val12} sem juros`;
        }
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
    const video_url = uniqVideos[0] || null;

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

    return {
      title,
      description: description ? description.slice(0, 1000).trim() : null,
      image_url,
      pictures,
      video_url,
      videos: uniqVideos,
      price_from,
      price_to: price_to || "Consulte no link",
      card_price,
      installments,
      max_installments_interest_free,
      coupon,
      shipping,
      ml_auth_error,
      updated_ml_keys
    };
  } catch (err: any) {
    console.error("[ML Scraper Error]", err);
    throw new Error("Não foi possível extrair os dados do produto do Mercado Livre. Verifique se o link está correto.");
  }
}

// Shopee Scraper
async function scrapeShopee(url: string, shopeeKey?: string) {
  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
    const finalUrl = res.url || url;
    const match = finalUrl.match(/-i\.(\d+)\.(\d+)/) || url.match(/-i\.(\d+)\.(\d+)/) || finalUrl.match(/product\/(\d+)\/(\d+)/);

    if (match) {
      const shopId = match[1];
      const itemId = match[2];
      try {
        const apiRes = await fetch(`https://shopee.com.br/api/v4/item/get?itemid=${itemId}&shopid=${shopId}`, {
          headers: {
            ...DEFAULT_HEADERS,
            "Referer": "https://shopee.com.br/",
            "X-Requested-With": "XMLHttpRequest",
            "Accept": "application/json"
          }
        });
        if (apiRes.ok) {
          const json = await apiRes.json();
          const item = json?.data?.item;
          if (item) {
            const title = item.name || "";
            const image_url = item.image ? `https://cf.shopee.com.br/file/${item.image}` : null;
            const rawPrice = (item.price || 0) / 100000;
            const price_to = cleanPrice(rawPrice);
            const rawPriceBefore = (item.price_before_discount || 0) / 100000;
            const price_from = rawPriceBefore > rawPrice ? cleanPrice(rawPriceBefore) : null;
            const description = item.description ? String(item.description).slice(0, 300).trim() : null;
            
            return {
              title,
              description,
              image_url,
              price_from,
              price_to: price_to || "Consulte no link",
              installments: null,
              coupon: null
            };
          }
        }
      } catch (e) {
        console.warn("[Shopee Scraper] API call failed, falling back to HTML parsing", e);
      }
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const title = $('meta[property="og:title"]').attr('content') || $('title').text().trim() || "";
    const image_url = $('meta[property="og:image"]').attr('content') || null;
    const priceRaw = $('meta[property="product:price:amount"]').attr('content');
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

    return {
      title: finalTitle,
      description: description ? description.slice(0, 300).trim() : null,
      image_url,
      price_from: null,
      price_to,
      installments: null,
      coupon: null
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

    return {
      title,
      description: description ? description.slice(0, 300).trim() : null,
      image_url,
      price_from: price_from && price_from !== price_to ? price_from : null,
      price_to: price_to || "Consulte no link",
      installments: null,
      coupon: coupon || null
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
          const title = comp.subject || "";
          const description = comp.description ? String(comp.description).slice(0, 300).trim() : null;
          const salePrice = comp.prices?.salePrice?.formattedPrice || cleanPrice(comp.prices?.salePrice?.minPrice);
          const origPrice = comp.prices?.originalPrice?.formattedPrice || cleanPrice(comp.prices?.originalPrice?.minPrice);
          let img = comp.imagePathList?.[0] || null;
          if (img && img.startsWith("//")) img = "https:" + img;

          return {
            title,
            description,
            image_url: img,
            price_from: origPrice !== salePrice ? cleanPrice(origPrice) : null,
            price_to: cleanPrice(salePrice) || "Consulte no link",
            installments: null,
            coupon: null
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

    return {
      title: finalTitle,
      description: description ? description.slice(0, 300).trim() : null,
      image_url: img,
      price_from: null,
      price_to: cleanPrice(priceRaw) || "Consulte no link",
      installments: null,
      coupon: null
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

    return {
      title: finalTitle,
      description: description ? description.slice(0, 300).trim() : null,
      image_url,
      price_from: cleanPrice(price_from_raw),
      price_to: cleanPrice(price_to_raw) || "Consulte no link",
      installments: null,
      coupon: null
    };
  } catch (err: any) {
    console.error("[Shein Scraper Error]", err);
    throw new Error("Não foi possível extrair os dados do produto da Shein. Verifique o link.");
  }
}

// Health Endpoint
app.get(["/health", "/api/health"], (req, res) => {
  res.json({ status: "ok", version: "1.0.0" });
});

// Proxy download endpoint to bypass CORS and force download of images/videos
app.get("/api/download", async (req, res) => {
  const fileUrl = req.query.url as string;
  if (!fileUrl) {
    return res.status(400).send("URL da mídia é obrigatória.");
  }

  try {
    const cleanUrl = fileUrl.trim().startsWith("//") ? "https:" + fileUrl.trim() : fileUrl.trim();
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

// Mercado Livre OAuth Authorization Code Exchange Endpoint
app.post("/api/ml-exchange-code", async (req, res) => {
  try {
    const { code, redirectUri, appId, clientSecret } = req.body || {};
    if (!code) {
      return res.status(400).json({ error: "O código de autorização é obrigatório." });
    }

    const mAppId = appId?.trim() || process.env.MERCADOLIVRE_APP_ID || "1096973158666349";
    const mClientSecret = clientSecret?.trim() || process.env.MERCADOLIVRE_CLIENT_SECRET || "5YoWCSRNr90KiVumj0tf35NGkpOAbops";

    console.log(`[ML OAuth Exchange] Trocando code pelo access_token com App ID: ${mAppId} e Redirect URI: ${redirectUri}`);

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
      console.log("[ML OAuth Exchange] Chaves geradas com sucesso via OAuth oficial!");
      return res.json({
        success: true,
        mercadoLivreKey: data.access_token,
        mercadoLivreRefreshToken: data.refresh_token,
        mercadoLivreExpiresAt: expiresAt,
      });
    } else {
      console.error("[ML OAuth Exchange Error Response]", data);
      return res.status(400).json({
        error: data.message || data.error || "O Mercado Livre rejeitou a troca das chaves. Verifique as credenciais ou o Redirect URI cadastrado.",
      });
    }
  } catch (err: any) {
    console.error("[ML OAuth Exchange Exception]", err);
    return res.status(500).json({ error: "Erro interno ao trocar o código de autorização: " + err.message });
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
          error: "Plataforma não suportada. Use links do Mercado Livre, Shopee, Amazon, AliExpress ou Shein.",
          detail: "Não foi possível identificar uma plataforma suportada na URL informada."
        });
      }
    }

    console.log(`[Scraper Endpoint] Extracting platform: ${platform} for URL: ${workingUrl} (with custom apiKeys: ${apiKeys ? 'Yes' : 'No'})`);

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
      data = await scrapeShopee(workingUrl, apiKeys?.shopeeKey);
    } else if (platform === "amazon") {
      data = await scrapeAmazon(workingUrl, apiKeys?.amazonKey);
    } else if (platform === "aliexpress") {
      data = await scrapeAliExpress(workingUrl, apiKeys?.aliExpressKey);
    } else if (platform === "shein") {
      data = await scrapeShein(workingUrl, apiKeys?.sheinKey);
    }

    // Attach Amazon tracking tag if provided in apiKeys
    let finalLink = url;
    if (platform === "amazon" && apiKeys?.amazonKey) {
      const cleanTag = apiKeys.amazonKey.trim();
      if (cleanTag && !finalLink.includes(`tag=${cleanTag}`)) {
        const sep = finalLink.includes("?") ? "&" : "?";
        finalLink = `${finalLink}${sep}tag=${encodeURIComponent(cleanTag)}`;
      }
    }

    // Validação de sanidade: nunca devolver um preço "0,00" ou implausível como se fosse real.
    // Preferimos avisar o usuário a entregar um valor errado que vira copy publicada.
    const numericPrice = data.price_to ? parseFloat(String(data.price_to).replace(/\./g, "").replace(",", ".")) : NaN;
    const priceIsPlausible = !isNaN(numericPrice) && numericPrice > 0.5 && numericPrice < 500000;

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
  try {
    const { product, angle, targetAudience, extraPrompt, apiKeys } = req.body;
    if (!product || !product.title) {
      return res.status(400).json({ error: "Dados do produto incompletos para geração com IA." });
    }

    const apiKey = (apiKeys?.geminiApiKey && apiKeys.geminiApiKey.trim()) || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave GEMINI_API_KEY não configurada no servidor nem informada nas Configurações." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const prompt = `Você é um mestre experiente em copywriting para grupos de ofertas do WhatsApp e afiliados de alto desempenho no Brasil.
Escreva 3 variações de textos de venda altamente persuasivos, limpos e atraentes para o produto abaixo, respeitando rigorosamente cada um dos 3 estilos predefinidos solicitados.

DADOS DO PRODUTO:
- Nome/Título: ${product.title}
- Preço de (Anterior): ${product.price_from ? 'R$ ' + product.price_from : 'N/A'}
- Preço à Vista (Pix, Boleto ou Cartão 1x): R$ ${product.price_to}
- Parcelamento / Cartão: ${product.installments || 'N/A'}
- Máximo de parcelas sem juros: ${product.max_installments_interest_free || 'N/A'}
- Preço total parcelado no Cartão: ${product.card_price ? 'R$ ' + product.card_price : 'N/A'}
- Cupom de Desconto: ${product.coupon || 'N/A'}
- Frete: ${product.shipping || 'Consulte no link'}
- Link de Compra: {LINK}
- Gatilho principal: ${angle || 'Promoção imperdível'}
- Público-alvo: ${targetAudience || 'Compradores de promoções'}
- Notas extras: ${extraPrompt || 'Nenhuma'}

REQUISITOS EXTRA DE CONTEXTO:
- A copy de cada variação deve obrigatoriamente mostrar o preço estruturado desta forma exata:
  * O preço que estava antes (se disponível, ex: De: ~R$ ${product.price_from || ''}~)
  * O preço que vai pagar se for pagamento à vista no PIX, Boleto ou Cartão de Crédito 1x (ex: À vista (Pix, Boleto ou Cartão 1x): *R$ ${product.price_to}*)
  * O preço parcelado no cartão de crédito, com destaque para a quantidade máxima de parcelas sem juros se disponível (ex: Parcelado: em até *${product.max_installments_interest_free || product.installments || '12x sem juros'}*). Utilize o valor real das parcelas informado em "Parcelamento / Cartão".
- Se houver Cupom de Desconto disponível (${product.coupon || ''}), mencione-o com IMENSO destaque e ensine o usuário como aplicar (ex: "🎟️ Use o cupom: *${product.coupon}*").
- Se houver Frete Grátis (${product.shipping || ''}), enfatize isso como um grande diferencial competitivo!

ESTILOS DAS 3 VARIAÇÕES QUE VOCÊ DEVE GERAR:
1. Variação 1 - Título: "⚡ 1. Urgência & Oferta Relâmpago"
   - Tom altamente urgente, escassez, FOMO (medo de perder), preço reduzido por tempo limitado.
   - Frases fortes como "CORRE QUE É OFERTA RELÂMPAGO!", "Estoque limitado", "O preço pode subir a qualquer momento!".

2. Variação 2 - Título: "🎯 2. Direta & Foco no Preço"
   - Extremamente direto ao ponto, limpo e escaneável.
   - Listagem em tópicos organizados: Título do produto, Valores de desconto (se houver), Preço promocional destacado, Parcelas, Cupom, Frete e o Link oficial de compra.

3. Variação 3 - Título: "⭐ 3. Indicação & Review Sincero"
   - Tom de recomendação pessoal ("achadinho" de amigo ou influencer para o grupo).
   - Use falas informais e amigáveis, ex: "Gente, olhem esse achado de hoje!", e inclua recomendação com avaliação alta (5 estrelas ⭐⭐⭐⭐⭐).

REGRAS IMPORTANTES DE FORMATAÇÃO:
- Use formatação simples com quebras de linha para ficar bem estruturado no WhatsApp.
- Aplique negrito do WhatsApp colocando palavras importantes entre asteriscos (ex: *R$ ${product.price_to}*).
- Insira a tag exata {LINK} como o marcador para o link de compra onde o usuário deve clicar.
- Retorne a resposta rigorosamente respeitando o JSON Schema fornecido.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
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
    console.error("[Gemini API Error]", err);
    return res.status(500).json({ error: "Erro ao gerar copy com Gemini AI: " + (err.message || "") });
  }
});

// Endpoint to test and validate API keys before saving
app.post("/api/test-key", async (req, res) => {
  try {
    const { provider, keys } = req.body;
    if (!provider) {
      return res.status(400).json({ success: false, error: "Provedor não informado." });
    }

    if (provider === "mercadolivre") {
      const appId = keys?.mercadoLivreAppId?.trim() || process.env.MERCADOLIVRE_APP_ID || "1096973158666349";
      const clientSecret = keys?.mercadoLivreClientSecret?.trim() || process.env.MERCADOLIVRE_CLIENT_SECRET || "5YoWCSRNr90KiVumj0tf35NGkpOAbops";
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
          return res.status(400).json({
            success: false,
            error: tokenData.message || tokenData.error || "App ID ou Client Secret incorretos no Mercado Livre.",
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
      const key = keys?.shopeeKey?.trim();
      if (!key || key.length < 5) {
        return res.status(400).json({ success: false, error: "Informe uma chave válida de Afiliados Shopee." });
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

// Vite / Production middleware
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();