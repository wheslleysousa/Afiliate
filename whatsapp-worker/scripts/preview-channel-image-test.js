'use strict';

// Afiliate / Termux: preview read-only by default. An explicit opt-in queues
// exactly ONE manual image test; no campaign, schedule or products are edited.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { getProductImageUrl } = require('../channelMedia');
const { formattedPrice } = require('../templateEngine');

const shouldEnqueue = process.argv.includes('--enqueue-one-post');
const confirmation = process.argv.includes('--confirm=ONE_IMAGE_TO_MY_CHANNEL');
const UID = process.env.USER_UID;
const DATABASE = process.env.FIRESTORE_DATABASE_ID ||
  'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';

async function run() {
  if (!UID) throw Error('USER_UID ausente. Configure o mesmo UID do Afiliate.');
  if (shouldEnqueue && !confirmation) {
    throw Error('A publicação exige --enqueue-one-post --confirm=ONE_IMAGE_TO_MY_CHANNEL.');
  }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ||
    fs.readFileSync(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      './serviceAccountKey.json'), 'utf8');
  const app = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(raw)),
  });

  try {
    const db = getFirestore(app, DATABASE);
    const user = db.collection('users').doc(UID);

    const [channelsSnap, campaignSnap, pendingSnap, processingSnap, minedSnap, logsSnap] =
      await Promise.all([
        user.collection('waChannels').get(),
        user.collection('campaigns').where('enabled', '==', true).limit(2).get(),
        user.collection('sendQueue').where('status', '==', 'pending').limit(1).get(),
        user.collection('sendQueue').where('status', '==', 'processing').limit(1).get(),
        user.collection('minedProducts').limit(50).get(),
        user.collection('sendLog').orderBy('sentAt', 'desc').limit(400).get(),
      ]);

    const allowed = channelsSnap.docs.filter(d => d.data().canPost === true &&
      String(d.data().channelId || '').endsWith('@newsletter'));
    const recentlySent = new Set(logsSnap.docs.filter(d => d.data().status === 'sent')
      .map(d => d.data().productId).filter(Boolean));

    console.log('\nAFILIATE - PREVIA DO TESTE DE UMA FOTO');
    console.log('Canais administrados:', allowed.length);
    console.log('Campanhas ligadas:', campaignSnap.size);
    console.log('Fila pendente:', pendingSnap.empty ? 0 : '>=1');
    console.log('Fila processando:', processingSnap.empty ? 0 : '>=1');

    if (allowed.length !== 1) throw Error('Exige exatamente um canal administrador. Nenhum item enfileirado.');
    const channel = allowed[0].data();
    if (!channel.sessionId) throw Error('Canal não tem sessionId verificado.');
    console.log('Canal selecionado:', channel.name || 'Canal sem nome');

    let product = null;
    let image = null;
    let link = null;
    let isPreviouslySent = false;
    for (const ref of minedSnap.docs) {
      const pId = ref.data().productId;
      if (!pId) continue;
      const snapshot = await db.collection('products').doc(pId).get();
      if (!snapshot.exists) continue;
      const data = snapshot.data();
      const url = getProductImageUrl(data);
      const dest = String(data.affiliate_link || data.original_link || '').trim();
      if (!url || !/^https:\/\//i.test(dest)) continue;
      // Prefer an unused product, otherwise allow exactly one clearly
      // labelled repeat of an offer the channel may have already received.
      if (product && recentlySent.has(pId)) continue;
      product = { id: snapshot.id, ...data };
      image = url;
      link = dest;
      isPreviouslySent = recentlySent.has(pId);
      if (!isPreviouslySent) break;
    }
    if (!product) throw Error('Não encontrei produto novo com imagem e link entre 50 minerações. Nenhum envio realizado.');

    const price = formattedPrice(product.price_to);
    const caption = [
      '🛍️ *TESTE DE IMAGEM — RADAR DE OFERTAS*',
      '',
      '📦 *' + String(product.title || 'Produto') + '*',
      price ? '💰 *' + price + '*' : '',
      '',
      '🔗 ' + link,
    ].filter(Boolean).join('\n');

    console.log('Produto:', product.title || 'Produto');
    console.log('Já consta no histórico de envio:', isPreviouslySent ? 'SIM (repostagem de teste)' : 'NÃO');
    console.log('Imagem:', new URL(image).hostname);
    console.log('Link:', new URL(link).hostname);
    console.log('Legenda:', caption.length, 'caracteres');
    console.log('Aviso: HTTPS identificada; ainda não comprova que a imagem abre ou aparece no WhatsApp.');

    if (!shouldEnqueue) {
      console.log('SOMENTE LEITURA. Nenhum item adicionado à fila.');
      return;
    }

    if (!campaignSnap.empty || !pendingSnap.empty || !processingSnap.empty) {
      throw Error('Teste cancelado: campanha ligada ou fila não vazia. Desative/inspecione antes de enfileirar.');
    }

    // Creating a deterministic document makes this manual test idempotent
    // for the local day; a second run cannot accidentally post twice.
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Boa_Vista', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date()).replace(/\D/g, '');
    const itemId = 'manual-channel-image-test-' + day;
    const q = user.collection('sendQueue').doc(itemId);
    await q.create({
      sessionId: channel.sessionId,
      productId: product.id,
      productTitle: product.title || 'Produto',
      groupId: channel.channelId,
      groupName: channel.name || 'Canal WhatsApp',
      campaignName: 'Teste manual de imagem',
      copyText: caption,
      imageUrl: image,
      affiliateLink: link,
      scheduledAt: admin.firestore.Timestamp.now(),
      status: 'pending',
      manualMediaTest: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    console.log('UMA mensagem enfileirada. NÃO liga o worker nem a campanha.');
    console.log('O envio exige liberar somente UMA tentativa no worker (com geração de campanhas bloqueada).');
  } finally {
    await app.delete();
  }
}

run().catch(error => {
  console.error('Teste não preparado:', error.message);
  process.exitCode = 1;
});
