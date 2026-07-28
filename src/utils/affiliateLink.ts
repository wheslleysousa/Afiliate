import type { ApiKeysConfig } from '../types';

/**
 * Constrói link de afiliado com a tag do usuário logado.
 * O original_link armazenado no Firestore é SEMPRE limpo (sem tag).
 * O link com tag é gerado dinamicamente na hora de exibir/compartilhar.
 */
export function buildAffiliateLink(
  originalLink: string,
  platform: string,
  apiKeys: ApiKeysConfig
): string {
  if (!originalLink) return '';

  try {
    const url = new URL(originalLink);

    // Limpar qualquer tag de afiliado existente
    ['tracking_id', 'tag', 'smtt', 'aff_id', 'url_from', 'affiliate_id'].forEach(
      p => url.searchParams.delete(p)
    );

    switch (platform) {
      case 'mercadolivre':
        if (apiKeys.mercadolivreTrackingId) {
          url.searchParams.set('tracking_id', apiKeys.mercadolivreTrackingId);
        }
        break;
      case 'amazon':
        if (apiKeys.amazonAssociatesTag) {
          url.searchParams.set('tag', apiKeys.amazonAssociatesTag);
        }
        break;
      case 'shopee':
        if (apiKeys.shopeeTrackingId) {
          url.searchParams.set('smtt', apiKeys.shopeeTrackingId);
        }
        break;
      case 'aliexpress':
        if (apiKeys.aliexpressAffiliateId) {
          url.searchParams.set('aff_id', apiKeys.aliexpressAffiliateId);
        }
        break;
      case 'shein':
        if (apiKeys.sheinAffiliateToken) {
          url.searchParams.set('url_from', apiKeys.sheinAffiliateToken);
        }
        break;
    }

    return url.toString();
  } catch {
    return originalLink;
  }
}

/**
 * Remove tracking params do link antes de salvar no Firestore.
 * Garante que o link armazenado é sempre o link "limpo".
 */
export function cleanAffiliateLink(url: string): string {
  try {
    const u = new URL(url);
    ['tracking_id', 'tag', 'smtt', 'aff_id', 'url_from', 'affiliate_id',
     'utm_source', 'utm_medium', 'utm_campaign', 'utm_content'].forEach(
      p => u.searchParams.delete(p)
    );
    if (u.hash.startsWith('#D[')) u.hash = '';
    return u.toString();
  } catch {
    return url;
  }
}
