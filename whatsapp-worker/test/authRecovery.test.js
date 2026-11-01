'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { archiveRejectedAuth } = require('../authRecovery');

test('401 preserves credentials in a private folder OUTSIDE scanned auth dir', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'afiliate-auth-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const auth = path.join(base, 'auth');
  const session = path.join(auth, 'sess_123_test');
  fs.mkdirSync(session, { recursive: true });
  fs.writeFileSync(path.join(session, 'creds.json'), '{"sample":"do not delete"}');
  const archived = archiveRejectedAuth(auth, 'sess_123_test');
  assert.ok(archived.startsWith(path.join(base, 'auth-rejected') + path.sep));
  assert.equal(fs.existsSync(session), false);
  assert.equal(fs.readFileSync(path.join(archived, 'creds.json'), 'utf8'), '{"sample":"do not delete"}');
  assert.equal(fs.statSync(path.dirname(archived)).mode & 0o777, 0o700);
  // Mesmo sessionId poderá ser reusado para o próximo QR sem reusar creds velhas.
  fs.mkdirSync(session);
  assert.equal(fs.existsSync(path.join(session, 'creds.json')), false);
});

test('does not touch missing sessions or allow path traversal', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afiliate-auth-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.equal(archiveRejectedAuth(path.join(root, 'auth'), 'sess_404'), null);
  assert.throws(() => archiveRejectedAuth(path.join(root, 'auth'), '../x'), /inválido/);
  assert.throws(() => archiveRejectedAuth(path.join(root, 'auth'), 'test/name'), /inválido/);
});

test('preserves original auth when archive creation fails', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'afiliate-auth-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const session = path.join(root, 'auth', 'sess_aaa');
  fs.mkdirSync(session, { recursive: true });
  fs.writeFileSync(path.join(session, 'creds.json'), 'must survive');
  // Um arquivo com esse nome impede criar auth-rejected como diretório.
  fs.writeFileSync(path.join(root, 'auth-rejected'), 'blocking');
  assert.throws(() => archiveRejectedAuth(path.join(root, 'auth'), 'sess_aaa'));
  assert.equal(fs.readFileSync(path.join(session, 'creds.json'), 'utf8'), 'must survive');
});
