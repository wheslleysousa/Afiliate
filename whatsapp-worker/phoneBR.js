'use strict';

/**
 * Aceita DDD + número brasileiro (10/11 dígitos) ou 55 + DDD + número.
 * WhatsApp/Baileys necessita do DDI 55 em requestPairingCode.
 * Não infere números estrangeiros.
 */
function normalizeBRWhatsAppPhone(input) {
  let digits = String(input || '').replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  }
  if (!/^\d{10,11}$/.test(digits)) return null;
  const ddd = digits.slice(0, 2);
  const local = digits.slice(2);
  if (!/^[1-9]{2}$/.test(ddd) || !/^[2-9]\d{7,8}$/.test(local)) return null;
  return '55' + digits;
}
module.exports = { normalizeBRWhatsAppPhone };
