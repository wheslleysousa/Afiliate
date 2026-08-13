import type { ApiKeysConfig } from '../types';

/**
 * Extrai o ID ou Tag de rastreamento limpo de qualquer string ou URL fornecida pelo usuário.
 * Suporta colagens de links completos (ex: https://www.mercadolivre.com.br/social/sowh5608494),
 * query params (ex: ?tracking_id=sowh5608494 ou ?tag=minhatag-20), ou o próprio ID direto.
 */
export function extractCleanTrackingId(rawInput: string | undefined | null, platform: string): string {
  if (!rawInput) return '';
  let str = rawInput.trim();
  if (!str) return '';

  const plat = (platform || '').toLowerCase();

  try {
    // Se o usuário colou uma URL completa (começando com http/https)
    if (str.startsWith('http://') || str.startsWith('https://')) {
      const url = new URL(str);

      if (plat === 'mercadolivre') {
        // Extrai handle do perfil social: /social/sowh5608494
        if (url.pathname.includes('/social/')) {
          const parts = url.pathname.split('/social/');
          if (parts[1]) {
            const handle = parts[1].split('/')[0].split('?')[0].split('#')[0].trim();
            if (handle) return handle;
          }
        }
        // Extrai parâmetro tracking_id se houver
        const paramId = url.searchParams.get('tracking_id');
        if (paramId) return paramId.trim();
      }

      if (plat === 'amazon') {
        const paramTag = url.searchParams.get('tag');
        if (paramTag) return paramTag.trim();
      }

      if (plat === 'shopee') {
        const paramSmtt = url.searchParams.get('smtt') || url.searchParams.get('an_id') || url.searchParams.get('affiliate_id');
        if (paramSmtt) return paramSmtt.trim();
      }

      if (plat === 'aliexpress') {
        const paramAff = url.searchParams.get('aff_id');
        if (paramAff) return paramAff.trim();
      }

      if (plat === 'shein') {
        const paramUrlFrom = url.searchParams.get('url_from');
        if (paramUrlFrom) return paramUrlFrom.trim();
      }

      if (plat === 'tiktokshop' || plat === 'tiktok') {
        const paramTt = url.searchParams.get('affiliate_id') || url.searchParams.get('link_id') || url.searchParams.get('tt_creator');
        if (paramTt) return paramTt.trim();
      }
    }
  } catch {
    // ignorar falha ao analisar URL e seguir para regex de limpeza
  }

  // Regex para tratar fragmentos de texto colados como "social/sowh5608494" ou "tracking_id=sowh5608494"
  if (str.includes('social/')) {
    const match = str.match(/social\/([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) return match[1];
  }

  if (str.includes('tracking_id=')) {
    const match = str.match(/tracking_id=([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) return match[1];
  }

  if (str.includes('tag=')) {
    const match = str.match(/tag=([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) return match[1];
  }

  if (str.includes('smtt=')) {
    const match = str.match(/smtt=([a-zA-Z0-9_\-\.]+)/);
    if (match && match[1]) return match[1];
  }

  if (str.includes('aff_id=')) {
    const match = str.match(/aff_id=([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) return match[1];
  }

  if (str.includes('url_from=')) {
    const match = str.match(/url_from=([a-zA-Z0-9_\-]+)/);
    if (match && match[1]) return match[1];
  }

  // Remove barras, arrobas e espaços sobrando
  str = str.replace(/^[/@\s]+/, '').replace(/[/@\s]+$/, '').trim();
  return str;
}

/**
 * Remove parâmetros de rastreamento e sujeira de raspagem do link antes de salvar no Firestore
 * ou de montar o link de afiliado final.
 */
export function cleanAffiliateLink(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);

    // Parâmetros a serem limpos para deixar a URL pura
    [
      'tracking_id', 'tag', 'smtt', 'aff_id', 'url_from', 'affiliate_id',
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term',
      'searchVariation', 'be_origin', 'overlay_label', 'search_layout', 'position', 'type', 'sid'
    ].forEach(p => u.searchParams.delete(p));

    // Limpar hash fragments de polycard do Mercado Livre (ex: #polycard_client=...)
    if (u.hash.includes('polycard_client') || u.hash.startsWith('#D[')) {
      u.hash = '';
    }

    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Constrói link de afiliado com a tag do usuário logado.
 * O original_link armazenado é limpo e o parâmetro de afiliado correto é injetado.
 */
export function buildAffiliateLink(
  originalLink: string,
  platform: string,
  apiKeys: ApiKeysConfig
): string {
  if (!originalLink) return '';

  try {
    // 1. Limpar qualquer parâmetro de rastreamento antigo ou sujeira da URL original
    const cleanUrlStr = cleanAffiliateLink(originalLink);
    const url = new URL(cleanUrlStr);

    const plat = (platform || '').toLowerCase();

    switch (plat) {
      case 'mercadolivre': {
        if (originalLink.includes('meli.la') || originalLink.includes('mercadolivre.com/sec/')) {
          const mlTrackingId = extractCleanTrackingId(apiKeys.mercadolivreTrackingId || apiKeys.mercadoLivreNickname, 'mercadolivre');
          if (mlTrackingId && !url.searchParams.has('tracking_id')) {
            url.searchParams.set('tracking_id', mlTrackingId);
          }
          return url.toString();
        }
        const mlTrackingId = extractCleanTrackingId(apiKeys.mercadolivreTrackingId || apiKeys.mercadoLivreNickname, 'mercadolivre');
        if (mlTrackingId) {
          url.searchParams.set('tracking_id', mlTrackingId);
        }
        break;
      }
      case 'amazon': {
        const amazonTag = extractCleanTrackingId(apiKeys.amazonAssociatesTag || apiKeys.amazonKey, 'amazon');
        if (amazonTag) {
          url.searchParams.set('tag', amazonTag);
        }
        break;
      }
      case 'shopee': {
        if (originalLink.includes('shope.ee') || originalLink.includes('shopee.com.br/universal-link') || originalLink.includes('s.shopee.com.br')) {
          return originalLink;
        }
        const shopeeId = extractCleanTrackingId(apiKeys.shopeeTrackingId || apiKeys.shopeeKey, 'shopee');
        if (shopeeId) {
          url.searchParams.set('smtt', shopeeId);
        }
        break;
      }
      case 'aliexpress': {
        const aliId = extractCleanTrackingId(apiKeys.aliexpressAffiliateId || apiKeys.aliExpressKey, 'aliexpress');
        if (aliId) {
          url.searchParams.set('aff_id', aliId);
        }
        break;
      }
      case 'shein': {
        const sheinToken = extractCleanTrackingId(apiKeys.sheinAffiliateToken || apiKeys.sheinKey, 'shein');
        if (sheinToken) {
          url.searchParams.set('url_from', sheinToken);
        }
        break;
      }
      case 'tiktokshop':
      case 'tiktok': {
        const ttId = extractCleanTrackingId(apiKeys.tiktokshopTrackingId, 'tiktokshop');
        if (ttId) {
          url.searchParams.set('affiliate_id', ttId);
        }
        break;
      }
    }

    return url.toString();
  } catch {
    return originalLink;
  }
}

/**
 * Converte um título em um slug limpo e amigável para URLs encurtadas.
 * Exemplo: "Fone de Ouvido Bluetooth Redmi" -> "fone-de-ouvido-bluetooth-redmi"
 */
export function slugify(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 35)
    .replace(/-+$/, '');
}

/**
 * Constrói o link de rastreamento encurtado e amigável com o nome do produto para compartilhamento.
 * Exemplo: https://radardeofertas.app/r/fone-bluetooth-redmi?url=...
 */
export function buildShareableTrackingLink(
  productId: string,
  originalLink: string,
  platform: string,
  apiKeys: ApiKeysConfig,
  productTitle?: string
): string {
  const directAffiliateUrl = buildAffiliateLink(originalLink, platform, apiKeys);
  if (!directAffiliateUrl) return '';

  const cleanTitleSlug = slugify(productTitle);
  const cleanIdSlug = slugify(productId);
  const identifier = cleanTitleSlug || cleanIdSlug || 'oferta';

  let basePrefix = '';
  if (apiKeys.customShortDomain) {
    basePrefix = apiKeys.customShortDomain.replace(/\/+$/, '');
  } else if (typeof window !== 'undefined' && window.location && window.location.origin) {
    basePrefix = `${window.location.origin}/r`;
  }

  if (basePrefix) {
    return `${basePrefix}/${identifier}`;
  }

  return directAffiliateUrl;
}

/**
 * Encurta qualquer link longo usando a API pública gratuita do TinyURL / Is.gd
 */
export async function shortenLinkWithTinyUrl(longUrl: string): Promise<string> {
  if (!longUrl) return '';
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    if (res.ok) {
      const shortUrl = await res.text();
      if (shortUrl && shortUrl.startsWith('http')) {
        return shortUrl.trim();
      }
    }
  } catch (err) {
    console.warn('Erro ao encurtar com TinyURL:', err);
  }
  return longUrl;
}


