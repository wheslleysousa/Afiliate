import { Capacitor } from '@capacitor/core';

/**
 * URL padrão pública do backend quando rodando como app nativo (Capacitor/APK)
 * e nenhuma VITE_API_URL foi injetada no build.
 */
export const DEFAULT_API_URL = 'https://afiliate-backend.onrender.com';

/**
 * Domínio padrão oficial do encurtador de links
 */
export const DEFAULT_SHORT_DOMAIN = 'https://lkrm.site';

/**
 * Verifica se a aplicação está executando em ambiente nativo (Android/iOS via Capacitor)
 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false;

  try {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
  } catch {
    // Fallback manual se o core do Capacitor não inicializar
  }

  const protocol = window.location.protocol;
  const hostname = window.location.hostname;

  if (protocol === 'capacitor:' || protocol === 'ionic:' || protocol === 'file:') {
    return true;
  }

  // Capacitor Android local WebView serve a partir de https://localhost ou http://localhost com capacitor
  if ((hostname === 'localhost' || hostname === '127.0.0.1') && (window as any).Capacitor) {
    return true;
  }

  return false;
}

/**
 * Resolve a URL base para chamadas ao backend Express (server.ts):
 * 1. VITE_API_URL definida no build (ex: https://afiliate-backend.onrender.com)
 * 2. Em APK Nativo (Capacitor), fallback para DEFAULT_API_URL
 * 3. Na Web (Vercel / Render / Dev local com same-origin), retorna '' (string vazia para caminhos relativos)
 */
export function getApiBaseUrl(): string {
  const envApiUrl = import.meta.env.VITE_API_URL;
  if (envApiUrl && typeof envApiUrl === 'string' && envApiUrl.trim()) {
    return envApiUrl.trim().replace(/\/+$/, '');
  }

  if (isNativeApp()) {
    return DEFAULT_API_URL.replace(/\/+$/, '');
  }

  return '';
}

/**
 * Constante exportada com a base da API resolvida
 */
export const API_BASE = getApiBaseUrl();

/**
 * Constrói a URL completa para qualquer endpoint do backend
 */
export function getApiUrl(path: string): string {
  if (!path) return getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalizedPath}` : normalizedPath;
}

/**
 * Wrapper de fetch universal para o backend que anexa a URL base dinamicamente
 */
export async function apiFetch(path: string, options?: RequestInit): Promise<Response> {
  const fullUrl = getApiUrl(path);
  return fetch(fullUrl, options);
}

/**
 * Obtém o domínio base do encurtador de links (configurável via VITE_SHORT_DOMAIN)
 */
export function getShortDomain(): string {
  const envShortDomain = import.meta.env.VITE_SHORT_DOMAIN;
  if (envShortDomain && typeof envShortDomain === 'string' && envShortDomain.trim()) {
    return envShortDomain.trim().replace(/\/+$/, '');
  }
  return DEFAULT_SHORT_DOMAIN;
}
