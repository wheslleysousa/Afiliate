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
import type { ProductData, GlobalProduct, MinedProductRef, CommissionRatesConfig } from '../types';
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

/**
 * Adiciona um produto existente do Marketplace Global diretamente na lista "Meus Produtos" do usuário
 */
export async function addGlobalProductToUserList(uid: string, product: GlobalProduct): Promise<boolean> {
  if (!uid || !product?.id) return false;
  try {
    const now = new Date().toISOString();
    const minedRef = doc(db, 'users', uid, 'minedProducts', product.id);
    const minedSnap = await getDoc(minedRef);

    if (!minedSnap.exists()) {
      const minedEntry: MinedProductRef = {
        productId: product.id,
        platform: product.platform,
        minedAt: now,
        favorite: false,
        status: 'active',
      };
      await setDoc(minedRef, minedEntry);
    } else {
      await updateDoc(minedRef, { minedAt: now });
    }

    // Atualizar lista de mineradores e contador no produto global
    const productRef = doc(db, 'products', product.id);
    await updateDoc(productRef, {
      miners: arrayUnion(uid),
      mineCount: increment(1),
    }).catch(() => {});

    return true;
  } catch (e) {
    console.error('Erro ao adicionar produto aos Meus Produtos:', e);
    return false;
  }
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

export const DEFAULT_COMMISSION_CONFIG: CommissionRatesConfig = {
  mercadolivre: {
    default: 4,
    categories: {
      esportes: 16,
      ferramentas: 14,
      saude: 12,
      pet: 12,
      livros: 10,
      beleza: 8,
      casa: 8,
      moda: 8,
      eletronicos: 7,
      informatica: 6,
      celulares: 5
    }
  },
  shopee: {
    default: 10,
    categories: {
      moda: 15,
      beleza: 14,
      casa: 10,
      esportes: 8,
      brinquedos: 7,
      eletrodomesticos: 5,
      eletronicos: 4,
      celulares: 3
    }
  },
  amazon: {
    default: 4,
    categories: {
      moda: 10,
      beleza: 10,
      livros: 8,
      casa: 8,
      esportes: 8,
      brinquedos: 6,
      games: 4,
      eletronicos: 3,
      informatica: 3,
      celulares: 2
    }
  },
  aliexpress: {
    default: 5,
    categories: {
      moda: 7,
      casa: 6,
      eletronicos: 3,
      celulares: 3
    }
  },
  shein: {
    default: 10,
    categories: {
      moda: 12,
      beleza: 12
    }
  }
};

// Mantido para compatibilidade simples
export const DEFAULT_COMMISSION_RATES: Record<string, number> = {
  shopee: 10,
  mercadolivre: 4,
  amazon: 4,
  aliexpress: 5,
  shein: 10,
};

export function normalizeCategoryText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .trim();
}

export function findMatchedCategoryKey(categoryText?: string | null): string | null {
  if (!categoryText) return null;
  const norm = normalizeCategoryText(categoryText);

  // Match keyword rules
  if (norm.includes('beleza')) return 'beleza';
  if (norm.includes('esporte') || norm.includes('fitness')) return 'esportes';
  if (norm.includes('celular') || norm.includes('smartphone')) return 'celulares';
  if (norm.includes('eletrodom')) return 'eletrodomesticos';
  if (norm.includes('eletron')) return 'eletronicos';
  if (norm.includes('casa') || norm.includes('movel') || norm.includes('decor')) return 'casa';
  if (norm.includes('moda') || norm.includes('roupa') || norm.includes('calcado') || norm.includes('vestuario')) return 'moda';
  if (norm.includes('ferramenta') || norm.includes('construcao')) return 'ferramentas';
  if (norm.includes('pet') || norm.includes('animal')) return 'pet';
  if (norm.includes('livro')) return 'livros';
  if (norm.includes('game') || norm.includes('console')) return 'games';
  if (norm.includes('saude')) return 'saude';
  if (norm.includes('informatica') || norm.includes('notebook') || norm.includes('computador')) return 'informatica';
  if (norm.includes('brinquedo')) return 'brinquedos';

  return null;
}

export function parsePriceNumber(priceStr?: string | number | null): number {
  if (priceStr == null) return 0;
  if (typeof priceStr === 'number') return isNaN(priceStr) ? 0 : priceStr;
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

export interface CommissionResult {
  amount: number;
  amountFormatted: string;
  ratePct: number;
  isCategoryBased: boolean;
  categoryUsed?: string | null;
  isCustomOverride: boolean;
  isDefaultFallback: boolean;
}

export function calculateCommission(
  priceStr: string | number,
  platform: string,
  productOrRate?: {
    category?: string | null;
    commission_rate?: number | null;
    commission_amount?: number | null;
  } | number | null,
  customAmount?: number | null,
  productCategory?: string | null,
  userCommissionRates?: CommissionRatesConfig | null
): CommissionResult {
  const price = parsePriceNumber(priceStr);
  const platKey = (platform || '').toLowerCase().trim();
  const ratesConfig = userCommissionRates || DEFAULT_COMMISSION_CONFIG;

  let explicitRate: number | null = null;
  let explicitAmount: number | null = null;
  let category: string | null = null;

  if (typeof productOrRate === 'object' && productOrRate !== null) {
    explicitRate = productOrRate.commission_rate ?? null;
    explicitAmount = productOrRate.commission_amount ?? null;
    category = productOrRate.category ?? productCategory ?? null;
  } else {
    explicitRate = typeof productOrRate === 'number' ? productOrRate : null;
    explicitAmount = customAmount ?? null;
    category = productCategory ?? null;
  }

  // 1. Explicit commission_amount
  if (explicitAmount != null && explicitAmount > 0) {
    const ratePct = price > 0 ? Number(((explicitAmount / price) * 100).toFixed(1)) : (explicitRate || 5);
    return {
      amount: explicitAmount,
      amountFormatted: `+R$ ${explicitAmount.toFixed(2).replace('.', ',')}`,
      ratePct,
      isCategoryBased: false,
      isCustomOverride: true,
      isDefaultFallback: false,
    };
  }

  // 2. Explicit commission_rate
  if (explicitRate != null && explicitRate > 0) {
    const amount = (price * explicitRate) / 100;
    return {
      amount,
      amountFormatted: `+R$ ${amount.toFixed(2).replace('.', ',')}`,
      ratePct: explicitRate,
      isCategoryBased: false,
      isCustomOverride: true,
      isDefaultFallback: false,
    };
  }

  // Obter configurações da plataforma
  const platConfig = ratesConfig[platKey] || DEFAULT_COMMISSION_CONFIG[platKey];

  // 3. Taxa por Categoria (se houver categoria no produto e regra na plataforma)
  const matchedKey = findMatchedCategoryKey(category);
  if (platConfig && platConfig.categories && matchedKey) {
    const ratePct = platConfig.categories[matchedKey];
    if (ratePct !== undefined) {
      const amount = (price * ratePct) / 100;
      return {
        amount,
        amountFormatted: `+R$ ${amount.toFixed(2).replace('.', ',')}`,
        ratePct,
        isCategoryBased: true,
        categoryUsed: matchedKey,
        isCustomOverride: false,
        isDefaultFallback: false,
      };
    }
  }

  // 4 & 5. Taxa padrão da plataforma ou fallback global (5%)
  const defaultRate = platConfig?.default ?? DEFAULT_COMMISSION_CONFIG[platKey]?.default ?? 5;
  const amount = (price * defaultRate) / 100;

  return {
    amount,
    amountFormatted: `+R$ ${amount.toFixed(2).replace('.', ',')}`,
    ratePct: defaultRate,
    isCategoryBased: false,
    categoryUsed: null,
    isCustomOverride: false,
    isDefaultFallback: true,
  };
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
