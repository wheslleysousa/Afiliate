import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { slugify, buildAffiliateLink } from './affiliateLink';
import { ApiKeysConfig, ProductData } from '../types';

export type ShortStyleType = 'random' | 'custom_random' | 'custom_only' | 'custom_custom';

export interface ShortenerPreferences {
  shortStyle: ShortStyleType;
  defaultCustomPrefix: string;
  useProductNameAsSlug: boolean;
  customDomain: string; // Sempre 'https://lkrm.site' como base
}

export const DEFAULT_SHORT_PREFERENCES: ShortenerPreferences = {
  shortStyle: 'custom_random',
  defaultCustomPrefix: 'oferta',
  useProductNameAsSlug: false,
  customDomain: 'https://lkrm.site',
};

/**
 * Carrega as preferências de encurtador do usuário
 */
export async function getUserShortenerPreferences(uid?: string): Promise<ShortenerPreferences> {
  if (!uid) return DEFAULT_SHORT_PREFERENCES;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'shortener'));
    if (snap.exists()) {
      return { 
        ...DEFAULT_SHORT_PREFERENCES, 
        ...snap.data(),
        customDomain: 'https://lkrm.site' // Garante sempre o domínio oficial lkrm.site
      } as ShortenerPreferences;
    }
  } catch (err) {
    console.warn("Erro ao carregar preferências de encurtador:", err);
  }
  return DEFAULT_SHORT_PREFERENCES;
}

/**
 * Salva as preferências de encurtador do usuário
 */
export async function saveUserShortenerPreferences(uid: string, prefs: ShortenerPreferences): Promise<void> {
  if (!uid) return;
  const cleanPrefs: ShortenerPreferences = {
    ...prefs,
    customDomain: 'https://lkrm.site',
    defaultCustomPrefix: prefs.defaultCustomPrefix ? slugify(prefs.defaultCustomPrefix) : 'oferta'
  };
  await setDoc(doc(db, 'users', uid, 'settings', 'shortener'), cleanPrefs, { merge: true });
}

/**
 * Gera código aleatório alfanumérico seguro
 */
export function generateRandomCode(length = 7): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Verifica se um slug ou ID de link já existe no Firestore
 */
export async function checkSlugAvailability(slugOrDocId: string): Promise<boolean> {
  if (!slugOrDocId || !slugOrDocId.trim()) return false;
  try {
    const cleanId = slugify(slugOrDocId.trim());
    const snap = await getDoc(doc(db, 'shortLinks', cleanId));
    return !snap.exists();
  } catch (err) {
    console.error("Erro ao checar disponibilidade de slug:", err);
    return true;
  }
}

/**
 * Cria um link encurtado para um produto respeitando o estilo configurado
 */
export async function createShortLinkForProduct(
  product: ProductData,
  apiKeys: ApiKeysConfig,
  uid?: string,
  campaignCustomSlug?: string,
  campaignShortStyle?: ShortStyleType
): Promise<{ shortUrl: string; docId: string }> {
  const prefs = await getUserShortenerPreferences(uid);
  const targetUrl = product.affiliate_link || product.original_link;
  const domain = 'https://lkrm.site';

  const effectiveStyle: ShortStyleType = campaignShortStyle || prefs.shortStyle || 'custom_random';

  let displayPath = '';
  let docId = '';

  const baseSlug = campaignCustomSlug 
    ? slugify(campaignCustomSlug)
    : (prefs.useProductNameAsSlug && product.title 
        ? slugify(product.title) 
        : (prefs.defaultCustomPrefix ? slugify(prefs.defaultCustomPrefix) : 'oferta'));

  if (effectiveStyle === 'random') {
    const code = generateRandomCode(7);
    displayPath = code;
    docId = code;
  } else if (effectiveStyle === 'custom_only') {
    // Somente o nome personalizado
    displayPath = baseSlug;
    docId = baseSlug;
  } else if (effectiveStyle === 'custom_custom') {
    const customCode = campaignCustomSlug ? slugify(campaignCustomSlug) : generateRandomCode(6);
    displayPath = `${baseSlug}/${customCode}`;
    docId = `${baseSlug}-${customCode}`;
  } else {
    // custom_random padrão
    const code = generateRandomCode(6);
    displayPath = `${baseSlug}/${code}`;
    docId = `${baseSlug}-${code}`;
  }

  // Check uniqueness in Firestore
  let finalDocId = docId;
  let attempts = 0;
  while (attempts < 5) {
    const existing = await getDoc(doc(db, 'shortLinks', finalDocId));
    if (!existing.exists()) {
      break;
    }
    // Se colidir e não for custom_only estrito, adiciona sufixo
    const suffix = generateRandomCode(4);
    finalDocId = `${docId}-${suffix}`;
    displayPath = `${displayPath}-${suffix}`;
    attempts++;
  }

  const shortUrl = `${domain}/${displayPath}`;

  await setDoc(doc(db, 'shortLinks', finalDocId), {
    targetUrl,
    originalUrl: product.original_link,
    title: product.title || `Produto (${displayPath})`,
    platform: product.platform || 'shopee',
    fullUrl: shortUrl,
    docId: finalDocId,
    createdBy: uid || 'anonymous',
    createdAt: new Date().toISOString()
  });

  return { shortUrl, docId: finalDocId };
}
