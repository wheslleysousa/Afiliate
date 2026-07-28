// Utilitário para controle de produtos divulgados (Anti-duplicação 24 horas)
// e armazenamento de histórico no LocalStorage + Firestore

const STORAGE_KEY = 'affiliate_shared_products_v1';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export interface SharedStatus {
  isShared: boolean;
  sharedAt?: number;
  remainingMs: number;
  remainingFormatted: string;
  hoursAgoFormatted: string;
}

/**
 * Retorna todos os registros de produtos compartilhados { [productId]: timestamp_ms }
 */
export function getSharedProductsMap(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed;
    }
  } catch (e) {
    console.error('Erro ao ler shared products:', e);
  }
  return {};
}

/**
 * Salva o mapa atualizado no localStorage
 */
function saveSharedProductsMap(map: Record<string, number>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error('Erro ao salvar shared products:', e);
  }
}

/**
 * Formata o tempo restante de 24h
 */
export function formatTimeRemaining(remainingMs: number): string {
  if (remainingMs <= 0) return '0m';
  const totalMinutes = Math.floor(remainingMs / (1000 * 60));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours > 0) {
    return `${hours}h ${mins}min`;
  }
  return `${mins}min`;
}

/**
 * Formata há quanto tempo o produto foi compartilhado
 */
export function formatTimeAgo(sharedAt: number): string {
  const diffMs = Date.now() - sharedAt;
  const mins = Math.floor(diffMs / (1000 * 60));
  if (mins < 1) return 'agora mesmo';
  if (mins < 60) return `há ${mins}min`;
  const hours = Math.floor(mins / 60);
  return `há ${hours}h`;
}

/**
 * Verifica se um produto foi compartilhado nas últimas 24 horas
 */
export function isProductSharedRecently(productId: string, customMap?: Record<string, number>): SharedStatus {
  const map = customMap || getSharedProductsMap();
  const sharedAt = map[productId];

  if (!sharedAt) {
    return {
      isShared: false,
      remainingMs: 0,
      remainingFormatted: '0m',
      hoursAgoFormatted: '',
    };
  }

  const elapsed = Date.now() - sharedAt;
  if (elapsed >= TWENTY_FOUR_HOURS_MS) {
    // Passaram mais de 24h, automaticamente expirou!
    return {
      isShared: false,
      sharedAt,
      remainingMs: 0,
      remainingFormatted: '0m',
      hoursAgoFormatted: formatTimeAgo(sharedAt),
    };
  }

  const remainingMs = TWENTY_FOUR_HOURS_MS - elapsed;
  return {
    isShared: true,
    sharedAt,
    remainingMs,
    remainingFormatted: formatTimeRemaining(remainingMs),
    hoursAgoFormatted: formatTimeAgo(sharedAt),
  };
}

/**
 * Marca um produto como compartilhado (inicia a contagem de 24h)
 */
export function markProductAsShared(productId: string): Record<string, number> {
  const map = getSharedProductsMap();
  map[productId] = Date.now();
  saveSharedProductsMap(map);
  return { ...map };
}

/**
 * Desmarca um produto compartilhado (libera imediatamente)
 */
export function unmarkProductAsShared(productId: string): Record<string, number> {
  const map = getSharedProductsMap();
  delete map[productId];
  saveSharedProductsMap(map);
  return { ...map };
}

/**
 * Alterna a marcação de divulgação
 */
export function toggleProductShared(productId: string): { newMap: Record<string, number>; isNowShared: boolean } {
  const map = getSharedProductsMap();
  const status = isProductSharedRecently(productId, map);

  if (status.isShared) {
    delete map[productId];
    saveSharedProductsMap(map);
    return { newMap: { ...map }, isNowShared: false };
  } else {
    map[productId] = Date.now();
    saveSharedProductsMap(map);
    return { newMap: { ...map }, isNowShared: true };
  }
}
