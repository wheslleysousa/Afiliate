/**
 * Normaliza qualquer representação de preço para "R$ 99,90"
 * Cobre: "99.90", "99,90", "R$ 99,90", "R$99,90", "R$99.90"
 */
export function formatPrice(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  if (typeof raw === 'number') {
    return `R$ ${raw.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  
  // Remove espaços extras
  const clean = raw.trim();
  
  // Se já começa com "R$", remover e reformatar para garantir consistência
  const withoutPrefix = clean.replace(/^R\$\s*/i, '').trim();
  
  // Tentar converter para número
  // Aceita: "99.90", "99,90", "1.299,90", "1299.90"
  const normalized = withoutPrefix
    .replace(/\./g, (_, offset, str) => {
      // Ponto como separador de milhar (ex: "1.299,90") → remover
      // Ponto como decimal (ex: "99.90") → manter como vírgula depois
      const afterDot = str.slice(offset + 1);
      return afterDot.includes(',') ? '' : ',';
    })
    .replace(',', '.');
  
  const num = parseFloat(normalized);
  
  if (!isNaN(num)) {
    return `R$ ${num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  
  // Se não conseguiu converter, retorna com prefixo
  return clean.startsWith('R$') ? clean : `R$ ${clean}`;
}

/** Versão simples: apenas garante o prefixo sem reformatar */
export function ensurePricePrefix(price: string | null | undefined): string {
  if (!price) return '—';
  const clean = price.trim();
  return clean.startsWith('R$') ? clean : `R$ ${clean}`;
}
