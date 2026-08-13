import { db } from '../lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { slugify, buildAffiliateLink } from './affiliateLink';
import { ApiKeysConfig, ProductData } from '../types';

export interface ShortenerPreferences {
  shortStyle: 'random' | 'custom_random' | 'custom_custom';
  defaultCustomPrefix: string;
  useProductNameAsSlug: boolean;
  customDomain: string;
}

export const DEFAULT_SHORT_PREFERENCES: ShortenerPreferences = {
  shortStyle: 'random',
  defaultCustomPrefix: 'oferta',
  useProductNameAsSlug: false,
  customDomain: 'https://lkrm.site',
};

export async function getUserShortenerPreferences(uid?: string): Promise<ShortenerPreferences> {
  if (!uid) return DEFAULT_SHORT_PREFERENCES;
  try {
    const snap = await getDoc(doc(db, 'users', uid, 'settings', 'shortener'));
    if (snap.exists()) {
      return { ...DEFAULT_SHORT_PREFERENCES, ...snap.data() } as ShortenerPreferences;
    }
  } catch (err) {
    console.warn("Erro ao carregar preferências de encurtador:", err);
  }
  return DEFAULT_SHORT_PREFERENCES;
}

export async function saveUserShortenerPreferences(uid: string, prefs: ShortenerPreferences): Promise<void> {
  if (!uid) return;
  await setDoc(doc(db, 'users', uid, 'settings', 'shortener'), prefs, { merge: true });
}

export function generateRandomCode(length = 7): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export async function createShortLinkForProduct(
  product: ProductData,
  apiKeys: ApiKeysConfig,
  uid?: string,
  campaignCustomSlug?: string
): Promise<{ shortUrl: string; docId: string }> {
  const prefs = await getUserShortenerPreferences(uid);
  const targetUrl = product.affiliate_link || product.original_link;
  const domain = prefs.customDomain || 'https://lkrm.site';

  let displayPath = '';
  let docId = '';

  const baseSlug = campaignCustomSlug 
    ? slugify(campaignCustomSlug)
    : (prefs.useProductNameAsSlug && product.title 
        ? slugify(product.title) 
        : (prefs.defaultCustomPrefix ? slugify(prefs.defaultCustomPrefix) : 'oferta'));

  if (prefs.shortStyle === 'random' && !campaignCustomSlug) {
    const code = generateRandomCode(7);
    displayPath = code;
    docId = code;
  } else if (prefs.shortStyle === 'custom_random' || (prefs.shortStyle === 'random' && campaignCustomSlug)) {
    const code = generateRandomCode(6);
    displayPath = `${baseSlug}/${code}`;
    docId = `${baseSlug}-${code}`;
  } else {
    // custom_custom or campaign custom slug
    const customCode = campaignCustomSlug ? slugify(campaignCustomSlug) : generateRandomCode(6);
    displayPath = `${baseSlug}/${customCode}`;
    docId = `${baseSlug}-${customCode}`;
  }

  // Check uniqueness in Firestore
  let finalDocId = docId;
  let attempts = 0;
  while (attempts < 5) {
    const existing = await getDoc(doc(db, 'shortLinks', finalDocId));
    if (!existing.exists()) {
      break;
    }
    // If exists, append random suffix
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
