const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HOUR_MS, readHourlyRate, buildHourlyOffsets } = require('../campaignHourlyRate');

test('permite dezenas de produtos por hora escolhidas no aplicativo', () => {
  assert.equal(readHourlyRate({ productsPerHour: 30 }), 30);
  assert.equal(readHourlyRate({ productsPerHour: 120 }), 120);
  assert.equal(readHourlyRate({ productsPerHour: 1 }), 1);
  assert.equal(readHourlyRate({ quantity: 30, windowMinutes: 30 }), null);
});

test('não aceita taxa inválida nem um limite silencioso', () => {
  for (const value of [0, -5, 501, 2.5, 'abc']) {
    assert.equal(readHourlyRate({ productsPerHour: value }), null);
  }
  assert.throws(() => buildHourlyOffsets(0), RangeError);
  assert.throws(() => buildHourlyOffsets(501), RangeError);
});

test('modo uniforme reserva exatamente 30 horários durante uma hora', () => {
  const offsets = buildHourlyOffsets(30, 'uniforme');
  assert.equal(offsets.length, 30);
  assert.equal(offsets[0], 0);
  assert.equal(offsets[1], 120000);
  assert.equal(offsets.at(-1), 3480000);
  assert.ok(offsets.every((n, i) => n >= 0 && n < HOUR_MS && (!i || n > offsets[i - 1])));
});

test('modo aleatório mantém todos os produtos dentro da sua fatia horária', () => {
  for (const value of [0, 1]) {
    const offsets = buildHourlyOffsets(60, 'aleatorio', () => value);
    assert.equal(offsets.length, 60);
    offsets.forEach((n, i) => {
      assert.ok(n >= i * 60000 && n < (i + 1) * 60000);
    });
  }
});
