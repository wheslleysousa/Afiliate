/**
 * Telefone WhatsApp Brasil: no app a pessoa informa apenas DDD + número.
 * Valida 10 ou 11 dígitos nacionais e envia o DDI 55 ao Baileys.
 */
export function normalizeBRWhatsAppPhone(input: string): string | null {
  let digits = String(input || '').replace(/\D/g, '');
  // Aceita também colagem de número já com +55, mas o campo só mostra DDD+número.
  if (digits.startsWith('55') && [12, 13].includes(digits.length)) {
    digits = digits.slice(2);
  }
  if (!/^\d{10,11}$/.test(digits)) return null;
  const ddd = digits.slice(0, 2);
  const local = digits.slice(2);
  if (!/^[1-9]{2}$/.test(ddd)) return null;
  if (!/^[2-9]\d{7,8}$/.test(local)) return null;
  return '55' + digits;
}
