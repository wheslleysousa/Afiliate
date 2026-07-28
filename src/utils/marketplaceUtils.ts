import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
  increment,
  collection,
  addDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { ProductData, GlobalProduct, MinedProductRef } from '../types';
import { cleanAffiliateLink } from './affiliateLink';

// ─── Extrair ID nativo do produto por plataforma ──────────────────────────────

/**
 * Extrai o ID específico do produto dentro da plataforma a partir da URL.
 * Usado para montar o globalId de deduplicação.
 */
export function extractPlatformId(platform: string, url: string): string {
  try {
    switch (platform) {
      case 'mercadolivre': {
        // Exemplo: https://www.mercadolivre.com.br/...MLB123456789...
        const match = url.match(/(MLB\d+)/i);
        return match ? match[1].toUpperCase() : stableHash(url);
      }
      case 'amazon': {
        // Exemplo: /dp/B07XYZ12345 ou /gp/product/B07XYZ12345
        const match =
          url.match(/\/dp\/([A-Z0-9]{10})/i) ||
          url.match(/\/gp\/product\/([A-Z0-9]{10})/i);
        return match ? match[1].toUpperCase() : stableHash(url);
      }
      case 'shopee': {
        // Exemplo: shopee.com.br/produto-i.123456.987654321
        const match = url.match(/[-.]i\.(\d+)\.(\d+)/);
        return match ? `${match[1]}_${match[2]}` : stableHash(url);
      }
      case 'aliexpress': {
        // Exemplo: /item/123456789.html
        const match = url.match(/\/item\/(\d+)/);
        return match ? match[1] : stableHash(url);
      }
      case 'shein': {
        // Exemplo: /p-sr12345678.html ou /product/p-sr12345678.html
        const match = url.match(/\/p-([a-z0-9]+)/i);
        return match ? match[1].toLowerCase() : stableHash(url);
      }
      default:
        return stableHash(url);
    }
  } catch {
    return stableHash(url);
  }
}

/** Gera um hash estável e curto de uma string (usado como fallback de ID) */
function stableHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

// ─── ID global do produto ─────────────────────────────────────────────────────

/** Retorna o ID global do produto no formato "{platform}_{platformId}" */
export function buildGlobalId(platform: string, platformId: string): string {
  return `${platform}_${platformId}`;
}

// ─── Upsert no Marketplace Global ────────────────────────────────────────────

export interface UpsertResult {
  globalId: string;
  isNew: boolean;
  priceChanged: boolean;
}

/**
 * Cria ou atualiza o produto no Marketplace Global e registra a referência
 * no perfil do usuário (minedProducts). Também adiciona entrada no histórico
 * de preço se o preço mudou.
 *
 * @param uid       UID do usuário autenticado no Firebase
 * @param product   Dados do produto recém-extraído
 */
export async function upsertToMarketplace(
  uid: string,
  product: ProductData
): Promise<UpsertResult> {
  const cleanLink = cleanAffiliateLink(product.original_link);
  const platformId = extractPlatformId(product.platform, cleanLink);
  const globalId = buildGlobalId(product.platform, platformId);
  const now = new Date().toISOString();

  const productRef = doc(db, 'products', globalId);
  const existing = await getDoc(productRef);

  let isNew = false;
  let priceChanged = false;

  if (!existing.exists()) {
    // ── Produto novo: criar documento completo ──────────────────────────────
    isNew = true;

    const newGlobalProduct: GlobalProduct = {
      id: globalId,
      platform: product.platform,
      platformId,
      title: product.title,
      description: product.description ?? null,
      image_url: product.image_url,
      pictures: product.pictures ?? [],
      video_url: product.video_url ?? null,
      price_to: product.price_to,
      price_from: product.price_from ?? null,
      installments: product.installments ?? null,
      coupon: product.coupon ?? null,
      shipping: product.shipping ?? null,
      original_link: cleanLink,
      miners: [uid],
      mineCount: 1,
      firstMinedAt: now,
      lastMinedAt: now,
      lastUpdatedAt: now,
      pix_price: product.pix_price ?? null,
      free_shipping: product.free_shipping ?? false,
      stars: product.stars ?? null,
      sales_count: product.sales_count ?? null,
      discount_pct: product.discount_pct ?? null,
    };

    await setDoc(productRef, newGlobalProduct);

    // Registrar primeiro preço no histórico
    await addDoc(collection(db, 'products', globalId, 'priceHistory'), {
      price: product.price_to,
      price_from: product.price_from ?? null,
      recordedAt: now,
    });
  } else {
    // ── Produto existente: atualizar dados e adicionar minerador ────────────
    const existingData = existing.data() as GlobalProduct;
    const oldPrice = existingData.price_to;
    priceChanged = oldPrice !== product.price_to;

    const updates: Partial<GlobalProduct> & Record<string, any> = {
      lastMinedAt: now,
      lastUpdatedAt: now,
      title: product.title,
      image_url: product.image_url,
      price_to: product.price_to,
      original_link: cleanLink,
      miners: arrayUnion(uid) as any,
      mineCount: increment(1) as any,
    };

    // Só atualiza campos opcionais se vierem preenchidos
    if (product.price_from != null) updates.price_from = product.price_from;
    if (product.installments != null) updates.installments = product.installments;
    if (product.coupon != null) updates.coupon = product.coupon;
    if (product.shipping != null) updates.shipping = product.shipping;
    if (product.pictures?.length) updates.pictures = product.pictures;
    if (product.description) updates.description = product.description;
    if (product.pix_price != null) updates.pix_price = product.pix_price;
    if (product.free_shipping != null) updates.free_shipping = product.free_shipping;
    if (product.stars != null) updates.stars = product.stars;
    if (product.sales_count != null) updates.sales_count = product.sales_count;
    if (product.discount_pct != null) updates.discount_pct = product.discount_pct;

    await updateDoc(productRef, updates);

    // Registrar no histórico somente se preço mudou
    if (priceChanged) {
      await addDoc(collection(db, 'products', globalId, 'priceHistory'), {
        price: product.price_to,
        price_from: product.price_from ?? null,
        recordedAt: now,
      });
    }
  }

  // ── Registrar referência no perfil do usuário ───────────────────────────
  const minedRef = doc(db, 'users', uid, 'minedProducts', globalId);
  const minedSnap = await getDoc(minedRef);

  if (!minedSnap.exists()) {
    const minedEntry: MinedProductRef = {
      productId: globalId,
      platform: product.platform,
      minedAt: now,
      favorite: false,
      status: 'active',
    };
    await setDoc(minedRef, minedEntry);
  } else {
    // Atualiza data da última mineração
    await updateDoc(minedRef, { minedAt: now });
  }

  return { globalId, isNew, priceChanged };
}

// ─── Contador diário de mineração ────────────────────────────────────────────

/** Retorna a data de hoje no formato "YYYY-MM-DD" */
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Retorna quantos produtos o usuário já minerou hoje.
 */
export async function getDailyMineCount(uid: string): Promise<number> {
  const key = todayKey();
  const ref = doc(db, 'users', uid, 'dailyStats', key);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data().count as number) : 0;
}

/**
 * Incrementa o contador diário de mineração do usuário.
 */
export async function incrementDailyMineCount(uid: string): Promise<void> {
  const key = todayKey();
  const ref = doc(db, 'users', uid, 'dailyStats', key);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    await updateDoc(ref, { count: increment(1) });
  } else {
    await setDoc(ref, { date: key, count: 1 });
  }
}

// ─── Limites por plano ────────────────────────────────────────────────────────

export const PLAN_LIMITS = {
  free: 100,
  pro: 500,
} as const;

// ─── Calculadores de Comissão e Tendência de Vendas ─────────────────────────

export const DEFAULT_COMMISSION_RATES: Record<string, number> = {
  shopee: 15,
  mercadolivre: 12,
  amazon: 10,
  aliexpress: 9,
  shein: 14,
};

export function parsePriceNumber(priceStr?: string | null): number {
  if (!priceStr) return 0;
  // Limpar "R$", espaços, e converter vírgula para ponto se necessário
  let clean = priceStr.replace(/[^\d.,]/g, '').trim();
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const val = parseFloat(clean);
  return isNaN(val) ? 0 : val;
}

export function calculateCommission(
  priceStr: string,
  platform: string,
  customRate?: number | null,
  customAmount?: number | null
): { amount: number; amountFormatted: string; ratePct: number } {
  const price = parsePriceNumber(priceStr);
  
  if (customAmount && customAmount > 0) {
    const ratePct = price > 0 ? Math.round((customAmount / price) * 100) : (customRate || 10);
    return {
      amount: customAmount,
      amountFormatted: `+R$ ${customAmount.toFixed(2).replace('.', ',')}`,
      ratePct,
    };
  }

  const ratePct = customRate || DEFAULT_COMMISSION_RATES[platform.toLowerCase()] || 12;
  const amount = (price * ratePct) / 100;
  const formatted = `+R$ ${amount.toFixed(2).replace('.', ',')}`;

  return { amount, amountFormatted: formatted, ratePct };
}

export function calculateSalesTrend(product: GlobalProduct | ProductData): {
  isUp: boolean;
  pct: number | null;
  formatted: string;
} {
  if (product.sales_trend_pct != null) {
    const p = product.sales_trend_pct;
    const isUp = p >= 0;
    return {
      isUp,
      pct: Math.abs(p),
      formatted: `${isUp ? '↗' : '↘'} ${isUp ? '+' : '-'}${Math.abs(p)}%`,
    };
  }

  return {
    isUp: true,
    pct: null,
    formatted: 'Sem informações suficientes',
  };
}

/**
 * Verifica se o usuário ainda tem cota para minerar hoje.
 * Por enquanto todos os usuários são tratados como "free".
 * Quando planos forem implementados, substituir o plano aqui.
 */
export async function checkMiningLimit(uid: string): Promise<{
  allowed: boolean;
  current: number;
  limit: number;
}> {
  const current = await getDailyMineCount(uid);
  const limit = PLAN_LIMITS.free;
  return { allowed: current < limit, current, limit };
}
