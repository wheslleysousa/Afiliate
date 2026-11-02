/**
 * Vercel Function: reutiliza as rotas do servidor Express original.
 * O rewrite preserva o endpoint público em __afiliate_route e removemos
 * apenas esse parâmetro de roteamento antes de passar a chamada ao Express.
 */
import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../server';

const MAX_ROUTE_LENGTH = 256;
export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const requestUrl = new URL(req.url || '/', 'https://api.afiliate.local');
    const originalRoute = requestUrl.searchParams.get('__afiliate_route');
    if (!originalRoute || originalRoute.length > MAX_ROUTE_LENGTH ||
        originalRoute.startsWith('/') || originalRoute.includes('..') ||
        originalRoute.includes('\\') || originalRoute.includes('?') ||
        originalRoute.includes('#')) {
      res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: 'Rota não encontrada.' }));
      return;
    }
    requestUrl.searchParams.delete('__afiliate_route');
    const query = requestUrl.searchParams.toString();
    const publicRedirect = originalRoute.startsWith('__public_r/') || originalRoute.startsWith('__public_rb/');
    const routePath = originalRoute.startsWith('__public_r/') ? `/r/${originalRoute.slice(11)}`
      : originalRoute.startsWith('__public_rb/') ? `/rb/${originalRoute.slice(12)}`
      : `/api/${originalRoute}`;
    req.url = `${routePath}${query ? `?${query}` : ''}`;
    app(req as any, res as any);
  } catch {
    res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Requisição inválida.' }));
  }
}
