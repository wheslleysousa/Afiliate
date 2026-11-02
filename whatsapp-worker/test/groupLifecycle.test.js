'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { staleGroupDocIds, validateGroupAction } = require('../groupLifecycle');

test('remove apenas grupos ausentes da sessao correspondente', () => {
  const docs = [
    { id: 'sess_a_1@g.us', sessionId: 'sess_a' },
    { id: 'sess_a_2@g.us', sessionId: 'sess_a' },
    { id: 'sess_b_3@g.us', sessionId: 'sess_b' },
  ];
  assert.deepEqual(staleGroupDocIds('sess_a', [{ id: '1@g.us' }], docs), ['sess_a_2@g.us']);
  assert.deepEqual(staleGroupDocIds('sess_a', [], docs), ['sess_a_1@g.us', 'sess_a_2@g.us']);
});
test('falha fechada se a consulta nao retornou snapshot valido', () => {
  assert.throws(() => staleGroupDocIds('sess_a', null, []), /invalido/);
  assert.throws(() => staleGroupDocIds('', [], []), /invalido/);
});
test('exige sessao exata e JID real para sair do grupo', () => {
  assert.doesNotThrow(() => validateGroupAction({ action: 'leaveGroup', sessionId: 'sess_a', groupId: '12036399999-123@g.us' }));
  assert.throws(() => validateGroupAction({ action: 'leaveGroup', sessionId: '', groupId: '123@g.us' }), /conta conectada/);
  assert.throws(() => validateGroupAction({ action: 'leaveGroup', sessionId: 'sess_a', groupId: '999@s.whatsapp.net' }), /invalido/);
});
test('nao confunde criacao de grupo com comunidade/canal', () => {
  assert.doesNotThrow(() => validateGroupAction({ action: 'createGroup', sessionId: 'sess_a', type: 'group', name: 'Grupo', participants: [] }));
  assert.throws(() => validateGroupAction({ action: 'createGroup', sessionId: 'sess_a', type: 'community', name: 'Nova comunidade', participants: [] }), /Comunidades e canais/);
});
