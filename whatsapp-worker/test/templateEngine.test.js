const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  BUILTIN_TEMPLATES,
  renderTemplate,
  parseProductPrice,
  formattedPrice
} = require('../templateEngine');

test('parses reais and decimal prices', () => {
  assert.equal(parseProductPrice('R$ 1.299,90'), 1299.90);
  assert.equal(parseProductPrice('1,299.90'), 1299.90);
  assert.equal(parseProductPrice('1299.90'), 1299.90);
  assert.equal(parseProductPrice('1.299'), 1299);
  assert.ok(Number.isNaN(parseProductPrice('Consulte no link')));
});

test('formats currency exactly once', () => {
  assert.equal(formattedPrice('R$ 49,90'), 'R$ 49,90');
  assert.equal(formattedPrice('49,90'), 'R$ 49,90');
});

test('renders the selected WhatsApp template and preserves affiliate link', () => {
  const link = 'https://s.shopee.com.br/exemplo';
  const product = {
    title: 'Tênis de corrida',
    price_to: 'R$ 89,90',
    price_from: 'R$ 130,00',
    coupon_text: 'TENIS10',
    free_shipping: true
  };
  const result = renderTemplate(BUILTIN_TEMPLATES['whatsapp-direct'], product, link);
  assert.ok(result.includes('Tênis de corrida'));
  assert.ok(result.includes(link));
  assert.ok(result.includes('R$ 89,90'));
  assert.equal(result.includes('R$ R$'), false);
  assert.equal(result.includes('{'), false);
});

test('refuses invalid URLs and incomplete custom templates', () => {
  const product = {title:'Tênis',price_to:'R$ 10'};
  assert.equal(renderTemplate('Compre {titulo} {linkAfiliado}', product, 'javascript:alert(1)'), null);
  assert.equal(renderTemplate('Compre {titulo} {tagSemSuporte} {linkAfiliado}', product, 'https://example.com/oferta'), null);
});