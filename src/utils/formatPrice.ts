/**
 * Normaliza qualquer representação de preço para "R$ 99,90"
 * Cobre: "99.90", "99,90", "R$ 99,90", "R$99,90", "R$99.90", números, strings vazias e nulas.
 */
export function formatPrice(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return '—';
  
  if (typeof raw === 'number') {
    if (isNaN(raw) || raw === 0) return '—';
    return `R$ ${raw.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  
  const clean = String(raw).trim();
  if (!clean || clean === '—' || clean === '0' || clean === '0,00' || clean === '0.00') {
    return '—';
  }

  // Se for uma mensagem de texto como "Consulte no link"
  if (/^[a-zA-Z]/i.test(clean) && !clean.toLowerCase().startsWith('r$')) {
    return clean;
  }
  
  // Se já começa com "R$", remover para normalização consistente
  const withoutPrefix = clean.replace(/^R\$\s*/i, '').trim();
  if (!withoutPrefix || withoutPrefix === '0' || withoutPrefix === '0,00' || withoutPrefix === '0.00') {
    return '—';
  }
  
  // Tentar converter para número
  // Aceita: "99.90", "99,90", "1.299,90", "1299.90"
  const normalized = withoutPrefix
    .replace(/\./g, (_, offset, str) => {
      const afterDot = str.slice(offset + 1);
      return afterDot.includes(',') ? '' : ',';
    })
    .replace(',', '.');
  
  const num = parseFloat(normalized);
  
  if (!isNaN(num)) {
    if (num <= 0) return '—';
    return `R$ ${num.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  
  return clean.startsWith('R$') ? clean : `R$ ${clean}`;
}

/** Versão simples: apenas garante o prefixo sem reformatar */
export function ensurePricePrefix(price: string | null | undefined): string {
  if (!price) return '—';
  const clean = String(price).trim();
  if (!clean || clean === '—') return '—';
  if (/^[a-zA-Z]/i.test(clean) && !clean.toLowerCase().startsWith('r$')) return clean;
  return clean.startsWith('R$') ? clean : `R$ ${clean}`;
}
