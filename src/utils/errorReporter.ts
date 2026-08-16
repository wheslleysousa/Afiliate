export interface ReportedErrorInfo {
  id?: string;
  title?: string;
  message?: string;
  action?: string;
  endpoint?: string;
  status?: number;
  detail?: string;
  platform?: string;
  timestamp?: string;
  screen?: string;
  appVersion?: string;
  userAgent?: string;
  rawError?: any;
}

export const APP_VERSION = '0.0.40';

/**
 * Mascara quaisquer tokens, chaves de API, autorizações ou senhas antes de exibir/copiar.
 */
export function sanitizeErrorText(text: string): string {
  if (!text) return '';
  return text
    .replace(/(bearer\s+)[a-zA-Z0-9_\-\.\=]+/gi, '$1[REDACTED]')
    .replace(/(api[_\-]?key=)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/(token=)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]')
    .replace(/(password=)[^&]+/gi, '$1[REDACTED]')
    .replace(/(secret=)[a-zA-Z0-9_\-\.]+/gi, '$1[REDACTED]');
}

/**
 * Gera um bloco de texto formatado para cópia do relatório técnico de diagnóstico.
 */
export function formatErrorForClipboard(info: ReportedErrorInfo): string {
  const now = info.timestamp || new Date().toISOString();
  const screen = info.screen || (typeof window !== 'undefined' ? (window.location.hash || window.location.pathname || 'app') : 'app');
  const userAgent = info.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A');
  const version = info.appVersion || APP_VERSION;

  const lines: string[] = [
    '=== DIAGNÓSTICO DE ERRO ===',
    `Data/Hora: ${now}`,
    `Ação/Onde: ${info.action || 'Operação no app'} (Tela: ${screen})`,
    `App: v${version} | UA: ${userAgent}`
  ];

  if (info.endpoint) {
    lines.push(`Endpoint: ${sanitizeErrorText(info.endpoint)}`);
  }
  if (info.status !== undefined && info.status !== null) {
    lines.push(`Status HTTP: ${info.status}`);
  }
  if (info.platform) {
    lines.push(`Plataforma: ${info.platform}`);
  }

  const msg = info.detail || info.message || 'Erro não detalhado';
  lines.push(`Mensagem: ${sanitizeErrorText(msg)}`);
  lines.push('===========================');

  return lines.join('\n');
}

type ErrorListener = (error: ReportedErrorInfo | null) => void;

let currentError: ReportedErrorInfo | null = null;
const listeners = new Set<ErrorListener>();

let lastReportTime = 0;
let lastReportKey = '';

export function subscribeError(listener: ErrorListener): () => void {
  listeners.add(listener);
  if (currentError) {
    listener(currentError);
  }
  return () => {
    listeners.delete(listener);
  };
}

export function getCurrentError(): ReportedErrorInfo | null {
  return currentError;
}

export function clearError(): void {
  currentError = null;
  listeners.forEach((fn) => fn(null));
}

export function reportError(input: ReportedErrorInfo | Error | string): void {
  const nowTime = Date.now();
  let info: ReportedErrorInfo = {};

  if (typeof input === 'string') {
    info = {
      message: input,
      detail: input,
      action: 'Erro de Operação'
    };
  } else if (input instanceof Error) {
    info = {
      message: input.message || 'Ocorreu um erro no aplicativo',
      detail: input.stack || input.message,
      action: input.name || 'Erro de Runtime'
    };
  } else {
    info = { ...input };
  }

  const endpointStr = info.endpoint || '';
  const statusStr = info.status !== undefined ? String(info.status) : '';
  const msgStr = info.message || info.detail || '';
  const actionStr = info.action || '';
  const reportKey = `${actionStr}|${endpointStr}|${statusStr}|${msgStr}`;

  // Anti-spam: ignora relatórios idênticos em menos de 3 segundos
  if (reportKey === lastReportKey && nowTime - lastReportTime < 3000) {
    return;
  }

  lastReportTime = nowTime;
  lastReportKey = reportKey;

  info.id = `err_${nowTime}_${Math.random().toString(36).substring(2, 7)}`;
  info.timestamp = info.timestamp || new Date().toISOString();
  info.screen = info.screen || (typeof window !== 'undefined' ? (window.location.hash || window.location.pathname || 'app') : 'app');
  info.appVersion = info.appVersion || APP_VERSION;
  info.userAgent = info.userAgent || (typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A');

  if (info.message === 'invalid_client' || (typeof info.message === 'string' && info.message.includes('invalid_client'))) {
    info.message = 'Credenciais de API/OAuth inválidas (invalid_client). Verifique se o App ID e Client Secret estão corretos em Configurações > Afiliados.';
  }

  if (info.message) {
    info.message = sanitizeErrorText(info.message);
  }
  if (info.detail) {
    info.detail = sanitizeErrorText(info.detail);
  }

  currentError = info;
  listeners.forEach((fn) => fn(info));
}

/**
 * Inicializa ouvintes globais para erros não tratados de JS e Promises no navegador.
 */
export function initGlobalErrorHandlers(): void {
  if (typeof window === 'undefined') return;

  window.addEventListener('error', (event) => {
    // Ignorar erros benignos de redimensionamento de janela / HMR
    if (event.message && (event.message.includes('ResizeObserver') || event.message.includes('Script error'))) {
      return;
    }
    reportError({
      action: 'Erro não tratado (JS Runtime)',
      message: event.message || 'Erro de execução no navegador',
      detail: event.error?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
      title: 'ao executar código na interface'
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    let msg = 'Promessa rejeitada sem tratamento';
    let detail = '';

    if (typeof reason === 'string') {
      msg = reason;
      detail = reason;
    } else if (reason && typeof reason === 'object') {
      msg = reason.message || msg;
      detail = reason.stack || JSON.stringify(reason);
    }

    reportError({
      action: 'Promessa rejeitada (Unhandled Rejection)',
      message: msg,
      detail: detail || msg,
      title: 'na operação assíncrona'
    });
  });
}
