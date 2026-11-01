/** Diagnóstico SOMENTE LEITURA para testar Termux -> Firestore -> Afiliate. */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

async function doctor() {
  const uid = (process.env.USER_UID || '').trim();
  if (!uid || uid === 'seu_uid_do_firebase_aqui') {
    throw new Error('Configure USER_UID com o UID da sua conta no Afiliate (.env).');
  }
  const dbId = process.env.FIRESTORE_DATABASE_ID || 'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  } else {
    const file = path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json');
    if (!fs.existsSync(file)) throw new Error('Chave Firebase não encontrada: verifique FIREBASE_SERVICE_ACCOUNT_PATH.');
    credential = JSON.parse(fs.readFileSync(file, 'utf8'));
  }
  if (!credential.client_email || !credential.private_key || !credential.project_id) {
    throw new Error('JSON de service account inválido ou incompleto.');
  }
  const app = admin.initializeApp({credential:admin.credential.cert(credential)});
  const db = dbId ? getFirestore(app,dbId) : getFirestore(app);
  const user = db.collection('users').doc(uid);
  console.log('🔍 Diagnóstico Afiliate (somente leitura)');
  console.log('Banco:', dbId, '| Firebase project:', credential.project_id);
  const userSnap = await user.get();
  if(!userSnap.exists) throw new Error('UID sem perfil em users/{uid}; confira a mesma conta usada na extensão.');
  console.log('✅ Conta existente no Firebase.');
  const cols = [
    ['Produtos minerados','minedProducts'],
    ['Campanhas','campaigns'],
    ['Sessões WhatsApp','waSessions'],
    ['Grupos','waGroups'],
    ['Mensagens pendentes','sendQueue']
  ];
  for (const [label, col] of cols) {
    const ref = user.collection(col);
    const snap = col === 'sendQueue' ?
      await ref.where('status','==','pending').limit(5).get() :
      await ref.limit(5).get();
    console.log(`✅ ${label}: ${snap.size}${snap.size === 5 ? '+' : ''} registro(s) amostrados`);
    if (col === 'campaigns' && !snap.empty) {
      const active = snap.docs.filter(d => d.data().enabled === true).length;
      console.log(`   → ${active} campanha(s) ativa(s) nesta amostra; revise antes de WA_SEND_ENABLED=true.`);
    }
    if (col === 'waSessions' && !snap.empty) {
      const statuses = snap.docs.map(d => d.data().status || 'sem status');
      console.log('   → Status das sessões na amostra:', statuses.join(', '));
    }
  }
  const processingSnap = await user.collection('sendQueue').where('status','==','processing').limit(5).get();
  if (!processingSnap.empty) console.warn(`⚠️ ${processingSnap.size}+ item(ns) em processing: revisar manualmente antes de reenviar.`);
  console.log('✅ Conexão com Firestore OK. Isto NÃO prova que o WhatsApp está conectado ou enviando.');
  await app.delete();
}
doctor().catch(e => {
  console.error('❌ Diagnóstico falhou:', e.message || e);
  process.exitCode=1;
});
