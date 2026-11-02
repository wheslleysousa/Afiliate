'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { normalizeBRWhatsAppPhone } = require('../phoneBR');

test('DDD + 9 digit Brazilian mobile gets country code automatically', () => {
  assert.equal(normalizeBRWhatsAppPhone('95984049808'), '5595984049808');
  assert.equal(normalizeBRWhatsAppPhone('(95) 98404-9808'), '5595984049808');
  assert.equal(normalizeBRWhatsAppPhone('+55 (95) 98404-9808'), '5595984049808');
  assert.equal(normalizeBRWhatsAppPhone('5595984049808'), '5595984049808');
});

test('supported Brazilian 10-digit landline-shaped number', () => {
  assert.equal(normalizeBRWhatsAppPhone('1133345566'), '551133345566');
});

test('reject invalid or foreign numbers instead of guessing', () => {
  assert.equal(normalizeBRWhatsAppPhone(''), null);
  assert.equal(normalizeBRWhatsAppPhone('1234567'), null);
  assert.equal(normalizeBRWhatsAppPhone('00000000000'), null);
  assert.equal(normalizeBRWhatsAppPhone('095984049808'), null);
  assert.equal(normalizeBRWhatsAppPhone('9955984049808'), null);
  assert.equal(normalizeBRWhatsAppPhone('+1 (212) 555-1234'), null);
  assert.equal(normalizeBRWhatsAppPhone('55'), null);
});
