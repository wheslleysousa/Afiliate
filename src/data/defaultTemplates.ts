import { CopyTemplate } from '../types';

export const DEFAULT_TEMPLATES: CopyTemplate[] = [
  {
    id: 'padrao_oficial',
    name: '📋 Modelo Oficial Padrão',
    category: 'direct',
    description: 'Padrão oficial com título, preços, cupom e link',
    template: `{TITLE}

~de R$ {PRICE_FROM}~
por R$ {PRICE_TO}
💳 ou {INSTALLMENTS}

🎟️ Use o cupom: {COUPON}

🛍️ Compre aqui: {LINK}

*Promoção sujeita a alteração a qualquer momento`
  }
];

