import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import * as cheerio from "cheerio";
import { GoogleGenAI } from "@google/genai";
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

// Mercado Livre Scraper
async function scrapeMercadoLivre(url: string) {
  let finalUrl = url;
  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
    finalUrl = res.url || url;
    const html = await res.text();

    // Try extracting MLB ID
    const mlbMatch = finalUrl.match(/(MLB-?\d+)/i) || url.match(/(MLB-?\d+)/i);
    if (mlbMatch && mlbMatch[1]) {
      const itemId = mlbMatch[1].replace("-", "").toUpperCase();
      try {
        const apiRes = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
          headers: { "Accept": "application/json" }
        });
        if (apiRes.ok) {
          const data = await apiRes.json();
          const title = data.title || "";
          const image_url = (data.pictures && data.pictures[0]?.url) || data.thumbnail || null;
          const price_to = cleanPrice(data.price);
          const price_from = (data.original_price && data.original_price > data.price) ? cleanPrice(data.original_price) : null;
          
          let installments: string | null = null;
          if (data.installments) {
            const q = data.installments.quantity;
            const amt = cleanPrice(data.installments.amount);
            const noInterest = data.installments.rate === 0 ? " sem juros" : "";
            if (q && amt) installments = `${q}x de R$ ${amt}${noInterest}`;
          }

          let coupon: string | null = null;
          if (Array.isArray(data.sale_terms)) {
            const coupTerm = data.sale_terms.find((t: any) => t.id === "COUPON" || t.id === "PROMOTION");
            if (coupTerm) coupon = coupTerm.value_name || coupTerm.value_struct?.name || null;
          }

          if (title && price_to) {
            return { title, image_url, price_from, price_to, installments, coupon };
          }
        }
      } catch (e) {
        console.warn("[ML Scraper] ML API request failed, proceeding to HTML parsing", e);
      }
    }

    // HTML Cheerio Parsing Fallback
    const $ = cheerio.load(html);

    let title = $('meta[property="og:title"]').attr('content') || $('h1.ui-pdp-title').text().trim() || $('h1').first().text().trim() || "";
    let image_url = $('meta[property="og:image"]').attr('content') || $('.ui-pdp-gallery__figure img').first().attr('src') || null;
    let price_to: string | null = null;
    let price_from: string | null = null;
    let coupon: string | null = null;

    // 1. Try JSON-LD script blocks
    $("script[type='application/ld+json']").each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || "");
        if (json) {
          if (!title && json.name) title = json.name;
          if (!image_url && json.image) {
            image_url = Array.isArray(json.image) ? json.image[0] : json.image;
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

    // 3. Try DOM Selectors for Price
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

    // Check for original price (price_from)
    const oldFraction = $('.ui-pdp-price__part--original .andes-money-amount__fraction').first().text().trim();
    if (oldFraction) {
      const oldCents = $('.ui-pdp-price__part--original .andes-money-amount__cents').first().text().trim() || "00";
      price_from = cleanPrice(`${oldFraction},${oldCents}`);
    }

    // Check for real coupon badge on PDP
    const couponPill = $('.ui-pdp-promotions-pill__label').text().trim() || $('.ui-pdp-vouchers__label').text().trim();
    if (couponPill && couponPill.toLowerCase().includes("cupom")) {
      coupon = couponPill;
    }

    if (!title) {
      throw new Error("Não foi possível extrair o título do produto do Mercado Livre.");
    }

    return {
      title,
      image_url,
      price_from,
      price_to: price_to || "Consulte no link",
      installments: null,
      coupon: coupon || null,
    };
  } catch (err: any) {
    console.error("[ML Scraper Error]", err);
    throw new Error("Não foi possível extrair os dados do produto do Mercado Livre. Verifique se o link está correto.");
  }
}

// Shopee Scraper
async function scrapeShopee(url: string) {
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
            
            return {
              title,
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

    if (!title) {
      throw new Error("Não foi possível ler o título do produto na Shopee.");
    }

    return {
      title,
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
async function scrapeAmazon(url: string) {
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

    const whole = $('span.a-price:first-child .a-price-whole').first().text().replace(/[.,]/g, '').trim();
    const fraction = $('span.a-price:first-child .a-price-fraction').first().text().trim();
    let price_to = whole ? cleanPrice(`${whole},${fraction || '00'}`) : null;

    if (!price_to) {
      const offscreen = $('.a-price .a-offscreen').first().text();
      price_to = cleanPrice(offscreen);
    }

    const price_from_raw = $('.a-text-price .a-offscreen').first().text() || $('#priceblock_dealprice + .a-text-strike .a-offscreen').text();
    const price_from = cleanPrice(price_from_raw);

    let coupon: string | null = null;
    const couponBadge = $('#couponBadge span').text().trim() || $('.vpc-coupon-badge').text().trim();
    if (couponBadge) {
      coupon = couponBadge;
    }

    if (!title) {
      throw new Error("Não foi possível extrair o título do produto na Amazon.");
    }

    return {
      title,
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
async function scrapeAliExpress(url: string) {
  try {
    const res = await fetch(url, { headers: DEFAULT_HEADERS, redirect: "follow" });
    const html = await res.text();

    const matchJson = html.match(/window\.runParams\s*=\s*(\{.*?\});/s);
    if (matchJson) {
      try {
        const raw = JSON.parse(matchJson[1]);
        const comp = raw?.data?.productInfoComponent;
        if (comp) {
          const title = comp.subject || "";
          const salePrice = comp.prices?.salePrice?.formattedPrice || cleanPrice(comp.prices?.salePrice?.minPrice);
          const origPrice = comp.prices?.originalPrice?.formattedPrice || cleanPrice(comp.prices?.originalPrice?.minPrice);
          let img = comp.imagePathList?.[0] || null;
          if (img && img.startsWith("//")) img = "https:" + img;

          return {
            title,
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

    if (!title) {
      throw new Error("Não foi possível extrair o produto do AliExpress.");
    }

    return {
      title,
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
async function scrapeShein(url: string) {
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

    if (!title) {
      throw new Error("Não foi possível extrair o produto da Shein.");
    }

    return {
      title,
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

// Main POST /scrape endpoint required by Prompt 01
app.post(["/scrape", "/api/scrape"], async (req, res) => {
  try {
    let { url } = req.body || {};
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

    console.log(`[Scraper Endpoint] Extracting platform: ${platform} for URL: ${workingUrl}`);

    let data: any = {};
    if (platform === "mercadolivre") {
      data = await scrapeMercadoLivre(workingUrl);
    } else if (platform === "shopee") {
      data = await scrapeShopee(workingUrl);
    } else if (platform === "amazon") {
      data = await scrapeAmazon(workingUrl);
    } else if (platform === "aliexpress") {
      data = await scrapeAliExpress(workingUrl);
    } else if (platform === "shein") {
      data = await scrapeShein(workingUrl);
    }

    return res.json({
      platform,
      title: data.title || "Produto em oferta",
      image_url: data.image_url || null,
      price_from: data.price_from || null,
      price_to: data.price_to || "0,00",
      installments: data.installments || null,
      coupon: data.coupon || null,
      original_link: url
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
    const { product, angle, targetAudience, extraPrompt } = req.body;
    if (!product || !product.title) {
      return res.status(400).json({ error: "Dados do produto incompletos para geração com IA." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: "Chave GEMINI_API_KEY não configurada no servidor." });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });

    const prompt = `Atue como um mestre do copywriting de vendas para grupos de ofertas do WhatsApp e afiliados brasileiros.
Gere 3 variações de textos persuasivos e curtos para vender este produto no WhatsApp:

PRODUTO: ${product.title}
PREÇO ANTERIOR: ${product.price_from ? 'R$ ' + product.price_from : 'N/A'}
PREÇO PROMO: R$ ${product.price_to}
PARCELAMENTO: ${product.installments || 'N/A'}
CUPOM: ${product.coupon || 'N/A'}
LINK DE AFILIADO: {LINK}
GATILHO DE VENDA: ${angle || 'Urgência e Oferta Imperdível'}
PÚBLICO ALVO: ${targetAudience || 'Compradores de ofertas no WhatsApp'}
OBSERVAÇÕES ADICIONAIS: ${extraPrompt || 'Nenhuma'}

Regras:
1. Use emojis estratégicos para chamar atenção sem exagerar.
2. Destaque o preço e o desconto.
3. Inclua a tag {LINK} exatamente no local correto da chamada para ação (CTA).
4. Formate em texto limpo com quebras de linha prontas para copiar e colar no WhatsApp (*negrito* entre asteriscos).
5. Retorne a resposta estritamente no formato JSON com a seguinte estrutura:
{
  "variations": [
    { "id": "v1", "title": "⚡ Oferta Relâmpago", "copy": "texto da copy aqui" },
    { "id": "v2", "title": "🔥 Mais Vendido", "copy": "texto da copy aqui" },
    { "id": "v3", "title": "💡 Recomendação Sincera", "copy": "texto da copy aqui" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    let result = { variations: [] };
    if (response.text) {
      try {
        result = JSON.parse(response.text.trim());
      } catch (e) {
        result = {
          variations: [
            { id: "v1", title: "⚡ Oferta Especial", copy: response.text }
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
