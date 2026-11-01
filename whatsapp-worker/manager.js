/**
 * Supervisor multiusuário do Afiliate.
 * Executar somente em infraestrutura confiável, com Firebase Admin,
 * armazenamento PRIVADO/PERSISTENTE e processo sempre ativo.
 * Nunca distribuir este arquivo + credenciais dentro de APK.
 */
'use strict';
require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const AUTH_ROOT = path.resolve(process.env.WA_MULTIUSER_AUTH_ROOT || './auth-users');
const MAX_USERS = Math.max(1, Math.min(500, Number(process.env.WA_MAX_MANAGED_USERS || 100) || 100));
const MAX_RUNNING = Math.max(1, Math.min(100, Number(process.env.WA_MAX_RUNNING_WORKERS || 20) || 20));
const START_RETRY_MS = 30000;
const users = new Map();
let quitting = false;

function createFirestore() {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON));
  } else {
    const file = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json');
    if (!fs.existsSync(file)) throw new Error('Chave Firebase Admin ausente no servidor.');
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(file, 'utf8')));
  }
  const app = admin.initializeApp({ credential });
  const databaseId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';
  return getFirestore(app, databaseId);
}

function validUid(uid) {
  return typeof uid === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(uid);
}

function workerCount() {
  return [...users.values()].filter(u => !!u.child).length;
}

function ensureWorker(uid) {
  const info = users.get(uid);
  if (!info || !info.hasSessions || info.child || quitting) return;
  if (workerCount() >= MAX_RUNNING) {
    console.warn('[Manager] Limite de workers simultâneos atingido; UID aguardando capacidade.');
    return;
  }
  const userAuthDir = path.join(AUTH_ROOT, uid);
  fs.mkdirSync(userAuthDir, { recursive: true, mode: 0o700 });
  const child = fork(path.join(__dirname, 'index.js'), [], {
    cwd: __dirname,
    env: {
      ...process.env,
      USER_UID: uid,
      AUTH_DIR: userAuthDir,
      // Modo seguro padrão. Não colocar credenciais Firebase no aplicativo.
      // Onboarding público NÃO deve ativar campanhas de todos os usuários.
      // Envios ficam desativados até existir autorização granular auditada.
      WA_SEND_ENABLED: 'false',
      WA_GROUP_COMMANDS_ENABLED: 'false',
      WA_PAIRING_PHONE: '', // Cada usuário deve escolher seu próprio número no app.
    },
    stdio: 'inherit',
  });
  info.child = child;
  console.log('[Manager] Iniciado worker individual de usuário; PID:', child.pid);
  child.on('exit', (code, signal) => {
    if (info.child === child) info.child = null;
    if (quitting || !info.hasSessions) return;
    console.warn('[Manager] Worker encerrado:', code, signal, '; reinicialização atrasada.');
    clearTimeout(info.retryTimer);
    info.retryTimer = setTimeout(() => {
      info.retryTimer = null;
      ensureWorker(uid);
    }, START_RETRY_MS);
  });
}

function subscribeUser(doc) {
  const uid = doc.id;
  if (!validUid(uid) || users.has(uid)) return;
  if (users.size >= MAX_USERS) {
    console.warn('[Manager] Limite de usuários monitorados atingido. Aumente a capacidade para produção.');
    return;
  }
  const info = { child: null, hasSessions: false, unsubscribe: null, retryTimer: null };
  users.set(uid, info);
  info.unsubscribe = doc.ref.collection('waSessions').limit(1).onSnapshot(snap => {
    if (quitting) return;
    info.hasSessions = !snap.empty;
    if (info.hasSessions) ensureWorker(uid);
    else if (info.child) {
      info.child.kill('SIGTERM');
      // O gerenciador não exclui credenciais quando a coleção fica vazia.
    }
  }, error => {
    console.error('[Manager] Falha ao observar sessões de um usuário:', error.message);
  });
}

function unsubscribeUser(uid) {
  const info = users.get(uid);
  if (!info) return;
  if (info.unsubscribe) info.unsubscribe();
  if (info.retryTimer) clearTimeout(info.retryTimer);
  if (info.child) info.child.kill('SIGTERM');
  users.delete(uid);
}

function shutdown() {
  if (quitting) return;
  quitting = true;
  if (unsubscribeUsers) unsubscribeUsers();
  for (const uid of [...users.keys()]) unsubscribeUser(uid);
  console.log('[Manager] Encerrando. Arquivos de autenticação preservados.');
}
let unsubscribeUsers = null;

async function main() {
  fs.mkdirSync(AUTH_ROOT, { recursive: true, mode: 0o700 });
  fs.chmodSync(AUTH_ROOT, 0o700);
  const db = createFirestore();
  console.log('[Manager] Afiliate multiusuário iniciado; sem site para o usuário final.');
  console.log('[Manager] Diretórios separados e privados, limite de workers:', MAX_RUNNING);
  console.log('[Manager] Apenas pareamento: envio e alterações em grupos bloqueados por padrão.');
  unsubscribeUsers = db.collection('users').onSnapshot(snap => {
    for (const change of snap.docChanges()) {
      if (change.type === 'added') subscribeUser(change.doc);
      if (change.type === 'removed') unsubscribeUser(change.doc.id);
    }
    // Inicia usuários que estavam aguardando capacidade, se possível.
    for (const uid of users.keys()) ensureWorker(uid);
  }, err => console.error('[Manager] Escuta users falhou:', err.message));

  setInterval(() => {
    if (!quitting) for (const uid of users.keys()) ensureWorker(uid);
  }, 30000).unref();
}
process.once('SIGINT', () => { shutdown(); process.exit(0); });
process.once('SIGTERM', () => { shutdown(); process.exit(0); });
main().catch(error => {
  console.error('[Manager] Falha na inicialização:', error.message);
  process.exitCode = 1;
});
