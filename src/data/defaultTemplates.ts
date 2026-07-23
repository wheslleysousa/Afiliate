import { CopyTemplate } from '../types';

export const DEFAULT_TEMPLATES: CopyTemplate[] = [
  {
    id: 'urgency_flash',
    name: '⚡ Oferta Relâmpago / Urgência',
    category: 'urgency',
    description: 'Ideal para produtos com grande desconto ou estoque limitado',
    template: `⚡ *CORRE QUE É OFERTA RELÂMPAGO!* ⚡

*{TITLE}*

De: ~R$ {PRICE_FROM}~
🔥 Por apenas: *R$ {PRICE_TO}*
💳 Parcelas: {INSTALLMENTS}
🎟️ Cupom: *{COUPON}*

👉 *Garanta o seu no link oficial:*
{LINK}

⏳ *Preço sujeito a alteração a qualquer momento!*`
  },
  {
    id: 'direct_clear',
    name: '🎯 Direto ao Ponto com Desconto',
    category: 'direct',
    description: 'Template limpo e objetivo, focado no preço final e link',
    template: `🔥 *OFERTINHA IMPERDÍVEL!*

*{TITLE}*

 De R$ {PRICE_FROM} por apenas *R$ {PRICE_TO}*!
💳 {INSTALLMENTS}
🏷️ Use o cupom: *{COUPON}*

🛒 *Compre aqui antes que acabe:*
{LINK}`
  },
  {
    id: 'review_recommendation',
    name: '⭐ Recomendação / Review de Afiliado',
    category: 'review',
    description: 'Estilo pessoal de indicação com sensação de achadinho',
    template: `Gente, olhem esse achado de hoje! 😍

*{TITLE}*

Tava custando R$ {PRICE_FROM} e agora baixou para *R$ {PRICE_TO}*!
💳 {INSTALLMENTS}
🎟️ Cupom ativo: *{COUPON}*

Super recomendo, nota máxima de avaliações! ⭐⭐⭐⭐⭐

👉 *Link com o desconto aplicado:*
{LINK}`
  },
  {
    id: 'vip_group',
    name: '🔒 Exclusivo Grupo VIP',
    category: 'group',
    description: 'Sensação de exclusividade para canais e grupos de ofertas',
    template: `🚨 *EXCLUSIVO PRO NOSSO GRUPO!* 🚨

*{TITLE}*

💥 De: R$ {PRICE_FROM}
🔥 *Por apenas: R$ {PRICE_TO}*
💳 {INSTALLMENTS}
🏷️ Cupom especial: *{COUPON}*

⚠️ *Pegue antes do estoque zerar:*
{LINK}`
  },
  {
    id: 'minimalist_clean',
    name: '✨ Minimalista Limpo',
    category: 'minimalist',
    description: 'Apenas as informações essenciais sem excesso de emojis',
    template: `*{TITLE}*

De: R$ {PRICE_FROM}
Por: *R$ {PRICE_TO}*
{INSTALLMENTS}
Cupom: {COUPON}

Compre aqui: {LINK}`
  }
];
