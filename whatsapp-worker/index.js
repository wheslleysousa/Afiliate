/**
 * ==============================================================================
 * WORKER DE AUTOMAÇÃO MULTI-SESSÃO WHATSAPP DA PLATAFORMA AFILIATE
 * ==============================================================================
 * AVISO IMPORTANTE DE SEGURANÇA E TERMOS DE USO:
 * 1. Este worker utiliza a biblioteca não-oficial @whiskeysockets/baileys.
 * 2. O uso de automações não oficiais viola os Termos de Serviço do WhatsApp.
 * 3. RISCO DE BANIMENTO: Há risco real de bloqueio definitivo do número de telefone.
 * 4. RECOMENDAÇÃO ABSOLUTA: Use SEMPRE NÚMEROS EXCLUSIVOS E DEDICADOS para disparos!
 * 5. CONFORMIDADE LGPD: Este script salva APENAS a contagem agregada de membros
 *    dos grupos, sem armazenar números de telefone ou dados pessoais de participantes.
 * ==============================================================================
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');

// ------------------------------------------------------------------------------
// 1. INICIALIZAÇÃO DAS VARIÁVEIS E FIREBASE ADMIN
// ------------------------------------------------------------------------------

const USER_UID = process.env.USER_UID;
if (!USER_UID) {
  console.error('\n❌ ERRO CRÍTICO: A variável de ambiente USER_UID não foi informada no arquivo .env!');
  console.error('Informe o UID do seu usuário do Afiliate App e inicie novamente.\n');
  process.exit(1);
}

const AUTH_BASE_DIR = process.env.AUTH_DIR || './auth';
const DEFAULT_APPLET_DB_ID = 'ai-studio-afiliate-06286741-5088-42ae-9702-cf4c78eb1a07';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || DEFAULT_APPLET_DB_ID;

// Garantir que diretório de autenticação exista
if (!fs.existsSync(AUTH_BASE_DIR)) {
  fs.mkdirSync(AUTH_BASE_DIR, { recursive: true });
}

function initFirebase() {
  let app;
  if (admin.apps.length > 0) {
    app = admin.apps[0];
  } else {
    let serviceAccount = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      try {
        serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      } catch (e) {
        console.error('❌ Erro ao ler FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
      }
    } else {
      const serviceAccountPath = path.resolve(
        process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './serviceAccountKey.json'
      );
      if (fs.existsSync(serviceAccountPath)) {
        serviceAccount = require(serviceAccountPath);
      } else {
        console.warn(`⚠️ Arquivo de credenciais não encontrado em: ${serviceAccountPath}`);
      }
    }

    const appConfig = {};
    if (serviceAccount) {
      appConfig.credential = admin.credential.cert(serviceAccount);
    } else {
      console.log('ℹ️ Usando credenciais padrão do ambiente Google Cloud / Application Default Credentials.');
      appConfig.credential = admin.credential.applicationDefault();
    }

    app = admin.initializeApp(appConfig);
  }

  return FIRESTORE_DATABASE_ID ? getFirestore(app, FIRESTORE_DATABASE_ID) : getFirestore(app);
}

const db = initFirebase();
console.log(`\n🚀 Worker Multi-Sessão Afiliate iniciado para o Usuário UID: ${USER_UID}`);
console.log(`🗄️ Banco de Dados Firestore: ${FIRESTORE_DATABASE_ID || '(default)'}`);

// Globais & Estado Multi-Sessão
// Map<sessionId, { sessionId, sock, isConnecting, reconnectTimer, status, label }>
const sessionsMap = new Map();

let isRunningCampaign = false;
let isProcessingQueue = false;
let sessionsListenerUnsub = null;

// ------------------------------------------------------------------------------
// MIGRACÃO E SUPORTE A SESSÕES LEGADAS (waSession/current)
// ------------------------------------------------------------------------------

async function checkAndMigrateLegacySession() {
  try {
    const legacyDocRef = db.collection('users').doc(USER_UID).collection('waSession').doc('current');
    const legacySnap = await legacyDocRef.get();

    if (legacySnap.exists) {
      const legacyData = legacySnap.data() || {};
      const newDocRef = db.collection('users').doc(USER_UID).collection('waSessions').doc('current');
      const newSnap = await newDocRef.get();

      if (!newSnap.exists) {
        console.log('📦 Migrando sessão legada "waSession/current" para "waSessions/current"...');
        await newDocRef.set({
          label: legacyData.label || 'Conta Principal (Migrada)',
          status: legacyData.status || 'disconnected',
          phoneNumber: legacyData.phoneNumber || null,
          name: legacyData.name || null,
          requestedConnect: legacyData.status === 'connecting' || legacyData.status === 'qr',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastConnectedAt: legacyData.lastConnectedAt || null,
        });
      }

      // Se existirem arquivos de auth diretamente em ./auth/ sem subpasta, mover para ./auth/current/
      const legacyCredsFile = path.join(AUTH_BASE_DIR, 'creds.json');
      if (fs.existsSync(legacyCredsFile)) {
        const currentAuthDir = path.join(AUTH_BASE_DIR, 'current');
        if (!fs.existsSync(currentAuthDir)) {
          fs.mkdirSync(currentAuthDir, { recursive: true });
        }
        const files = fs.readdirSync(AUTH_BASE_DIR);
        for (const file of files) {
          const filePath = path.join(AUTH_BASE_DIR, file);
          if (fs.statSync(filePath).isFile()) {
            const destPath = path.join(currentAuthDir, file);
            fs.renameSync(filePath, destPath);
          }
        }
        console.log('📂 Arquivos de sessão legada movidos para auth/current/');
      }
    }
  } catch (err) {
    console.warn('⚠️ Aviso ao verificar migração de sessão legada:', err.message);
  }
}

// Helper para atualizar status da sessão no Firestore (users/{uid}/waSessions/{sessionId})
async function updateSessionDoc(sessionId, data) {
  try {
    const docRef = db.collection('users').doc(USER_UID).collection('waSessions').doc(sessionId);
    await docRef.set(
      {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error(`⚠️ Erro ao atualizar waSessions/${sessionId} no Firestore:`, err.message);
  }
}

// ------------------------------------------------------------------------------
// 2. CONEXÃO BAILEYS POR SESSÃO
// ------------------------------------------------------------------------------

async function connectToWhatsAppSession(sessionId, label) {
  let sessionObj = sessionsMap.get(sessionId);

  if (sessionObj && sessionObj.isConnecting) {
    return;
  }

  if (!sessionObj) {
    sessionObj = {
      sessionId,
      sock: null,
      isConnecting: true,
      reconnectTimer: null,
      status: 'connecting',
      label: label || 'Conta WhatsApp',
    };
    sessionsMap.set(sessionId, sessionObj);
  } else {
    sessionObj.isConnecting = true;
    sessionObj.status = 'connecting';
    if (label) sessionObj.label = label;
  }

  const sessionAuthDir = path.join(AUTH_BASE_DIR, sessionId);
  if (!fs.existsSync(sessionAuthDir)) {
    fs.mkdirSync(sessionAuthDir, { recursive: true });
  }

  try {
    await updateSessionDoc(sessionId, {
      status: 'connecting',
      qr: null,
      label: sessionObj.label,
    });

    const { state, saveCreds } = await useMultiFileAuthState(sessionAuthDir);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`\n📱 [Sessão: ${sessionObj.label} (${sessionId})] Iniciando Baileys v${version.join('.')}...`);

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: ['Afiliate Worker', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sessionObj.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log(`\n================================================================`);
        console.log(`📲 QR CODE PARA CONTA "${sessionObj.label}" (${sessionId}):`);
        console.log(`================================================================\n`);
        qrcode.generate(qr, { small: true });

        await updateSessionDoc(sessionId, {
          status: 'qr',
          qr: qr,
          label: sessionObj.label,
        });
      }

      if (connection === 'connecting') {
        sessionObj.status = 'connecting';
        await updateSessionDoc(sessionId, {
          status: 'connecting',
        });
      }

      if (connection === 'close') {
        sessionObj.isConnecting = false;
        sessionObj.status = 'disconnected';

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`⚠️ [Sessão: ${sessionId}] Conexão encerrada (código: ${statusCode}). Reconectar: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.error(`❌ [Sessão: ${sessionId}] Número deslogado. Limpando credenciais...`);
          if (fs.existsSync(sessionAuthDir)) {
            try {
              fs.rmSync(sessionAuthDir, { recursive: true, force: true });
            } catch (e) {
              console.error('Erro ao remover diretório de auth:', e.message);
            }
          }
          await updateSessionDoc(sessionId, {
            status: 'disconnected',
            qr: null,
            phoneNumber: null,
            name: null,
            requestedConnect: false,
          });
          sessionsMap.delete(sessionId);
        } else {
          await updateSessionDoc(sessionId, {
            status: shouldReconnect ? 'connecting' : 'disconnected',
            qr: null,
          });

          if (shouldReconnect) {
            clearTimeout(sessionObj.reconnectTimer);
            sessionObj.reconnectTimer = setTimeout(() => {
              connectToWhatsAppSession(sessionId, sessionObj.label);
            }, 5000);
          }
        }
      } else if (connection === 'open') {
        sessionObj.isConnecting = false;
        sessionObj.status = 'connected';

        const userJid = sock.user?.id || '';
        const phoneNum = userJid ? userJid.split(':')[0].split('@')[0] : null;
        const name = sock.user?.name || sock.user?.notify || null;

        console.log(`\n✅ [Sessão: ${sessionObj.label}] CONECTADO COM SUCESSO AO WHATSAPP! (${phoneNum})`);
        console.log(`----------------------------------------------------------------\n`);

        await updateSessionDoc(sessionId, {
          status: 'connected',
          qr: null,
          phoneNumber: phoneNum,
          name: name,
          requestedConnect: false,
          lastConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Sincronizar grupos desta conta específica
        await syncGroups(sessionId, sock);
      }
    });
  } catch (err) {
    sessionObj.isConnecting = false;
    sessionObj.status = 'disconnected';
    console.error(`❌ Erro ao conectar sessão ${sessionId}:`, err.message);

    await updateSessionDoc(sessionId, {
      status: 'disconnected',
      qr: null,
    });
  }
}

// ------------------------------------------------------------------------------
// 3. LISTENERS DE SESSÕES EM TEMPO REAL (users/{uid}/waSessions)
// ------------------------------------------------------------------------------

function startSessionsManager() {
  // 1. Escanear pastas existentes em ./auth/ para reconectar contas prévias
  if (fs.existsSync(AUTH_BASE_DIR)) {
    const entries = fs.readdirSync(AUTH_BASE_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const sessionId = entry.name;
        console.log(`📂 Sessão detectada no disco: ${sessionId}. Inicializando...`);
        connectToWhatsAppSession(sessionId, 'Conta WhatsApp');
      }
    }
  }

  // 2. Escutar Firestore em tempo real
  const sessionsColRef = db.collection('users').doc(USER_UID).collection('waSessions');

  sessionsListenerUnsub = sessionsColRef.onSnapshot(
    (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        const sessionId = change.doc.id;
        const data = change.doc.data() || {};

        if (change.type === 'removed') {
          // Desconectar se o documento foi excluído
          const sessionObj = sessionsMap.get(sessionId);
          if (sessionObj) {
            if (sessionObj.sock) {
              try { sessionObj.sock.logout(); } catch (e) {}
            }
            sessionsMap.delete(sessionId);
          }
          const sessionAuthDir = path.join(AUTH_BASE_DIR, sessionId);
          if (fs.existsSync(sessionAuthDir)) {
            try { fs.rmSync(sessionAuthDir, { recursive: true, force: true }); } catch (e) {}
          }
          return;
        }

        // Se pediu logout
        if (data.requestedLogout) {
          console.log(`🚪 [Sessão: ${sessionId}] Solicitado logout via aplicativo...`);
          const sessionObj = sessionsMap.get(sessionId);
          if (sessionObj) {
            if (sessionObj.sock) {
              try { sessionObj.sock.logout(); } catch (e) {}
            }
            sessionsMap.delete(sessionId);
          }

          const sessionAuthDir = path.join(AUTH_BASE_DIR, sessionId);
          if (fs.existsSync(sessionAuthDir)) {
            try { fs.rmSync(sessionAuthDir, { recursive: true, force: true }); } catch (e) {}
          }

          updateSessionDoc(sessionId, {
            status: 'disconnected',
            qr: null,
            phoneNumber: null,
            name: null,
            requestedLogout: false,
            requestedConnect: false,
          });
          return;
        }

        // Se pediu conexão
        if (data.requestedConnect) {
          const sessionObj = sessionsMap.get(sessionId);
          if (!sessionObj || sessionObj.status === 'disconnected') {
            console.log(`📲 [Sessão: ${sessionId}] Solicitação de conexão recebida! Gerando QR...`);
            connectToWhatsAppSession(sessionId, data.label || 'Conta WhatsApp');
          }
        }
      });
    },
    (err) => {
      console.error('⚠️ Erro no listener de waSessions:', err.message);
    }
  );
}

// ------------------------------------------------------------------------------
// 4. SINCRONIZAÇÃO DE GRUPOS POR SESSÃO (users/{uid}/waGroups)
// ------------------------------------------------------------------------------

function formatPhoneBR(rawNum) {
  if (!rawNum) return '';
  const cleanNum = rawNum.replace(/\D/g, '');
  if (cleanNum.startsWith('55') && cleanNum.length === 13) {
    const ddd = cleanNum.slice(2, 4);
    const part1 = cleanNum.slice(4, 9);
    const part2 = cleanNum.slice(9);
    return `+55 (${ddd}) ${part1}-${part2}`;
  }
  return `+${cleanNum}`;
}

async function syncGroups(sessionId, sock) {
  if (!sock) return;
  console.log(`🔄 [Sessão: ${sessionId}] Sincronizando grupos do WhatsApp com o Firestore...`);

  try {
    const groupsMap = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groupsMap);

    console.log(`📋 [Sessão: ${sessionId}] ${groupList.length} grupo(s) detectado(s). Atualizando Firestore...`);

    const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';

    for (const group of groupList) {
      if (!group.id.endsWith('@g.us')) continue;

      const rawParticipants = group.participants || [];
      const participants = [];

      for (const p of rawParticipants) {
        const pJid = p.id || '';
        if (!pJid) continue;

        const isAdmin = p.admin === 'admin' || p.admin === 'superadmin';
        let rawNum = pJid.split(':')[0].split('@')[0];

        if (p.phoneNumber) {
          rawNum = String(p.phoneNumber).replace(/\D/g, '');
        }

        let phone = '';
        if (pJid.endsWith('@s.whatsapp.net')) {
          phone = formatPhoneBR(rawNum);
        } else if (pJid.endsWith('@lid')) {
          // Check if LID exposes numeric phone
          if (rawNum && /^\d+$/.test(rawNum) && rawNum.length >= 10 && !rawNum.startsWith('102') && !rawNum.startsWith('103')) {
            phone = formatPhoneBR(rawNum);
          } else {
            phone = 'Oculto pelo WhatsApp (@lid)';
          }
        } else {
          phone = formatPhoneBR(rawNum);
        }

        participants.push({
          id: pJid,
          phone: phone,
          isAdmin: isAdmin,
        });
      }

      // Total group size is guaranteed to be at least group.size or rawParticipants.length
      const totalSize = group.size || rawParticipants.length || participants.length || 0;

      const isBotAdmin = rawParticipants.some((p) => {
        const pJid = p.id ? p.id.split(':')[0] + '@s.whatsapp.net' : '';
        return pJid === botJid && (p.admin === 'admin' || p.admin === 'superadmin');
      });

      let photoUrl = null;
      try {
        photoUrl = await sock.profilePictureUrl(group.id, 'image');
      } catch (e) {
        photoUrl = null;
      }

      // ID composto para suportar múltiplos sockets na mesma conta sem conflito
      const docId = `${sessionId}_${group.id}`;

      const groupDocData = {
        groupId: group.id,
        sessionId: sessionId,
        name: group.subject || 'Grupo sem nome',
        photoUrl: photoUrl || null,
        size: totalSize,
        participantsCount: totalSize,
        participants: participants,
        description: group.desc || null,
        isAdmin: isBotAdmin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      await db
        .collection('users')
        .doc(USER_UID)
        .collection('waGroups')
        .doc(docId)
        .set(groupDocData, { merge: true });
    }

    console.log(`✅ [Sessão: ${sessionId}] Sincronização de grupos concluída!`);
  } catch (err) {
    console.error(`⚠️ [Sessão: ${sessionId}] Erro ao sincronizar grupos:`, err.message);
  }
}

// Sincronizar grupos de todas as sessões conectadas periodicamente
async function syncAllGroups() {
  for (const [sessionId, sessionObj] of sessionsMap.entries()) {
    if (sessionObj.status === 'connected' && sessionObj.sock) {
      await syncGroups(sessionId, sessionObj.sock);
    }
  }
}

// ------------------------------------------------------------------------------
// 5. HELPER LINK DE AFILIADO E COPY
// ------------------------------------------------------------------------------

function buildAffiliateLink(rawUrl, platform, apiKeys) {
  if (!rawUrl) return '';
  const plat = (platform || '').toLowerCase();
  const keys = apiKeys || {};

  let tagParam = null;
  let tagValue = null;

  if (plat.includes('mercadolivre') || plat.includes('mercado livre') || plat.includes('mercadolibre')) {
    tagParam = 'tracking_id';
    tagValue = keys.mercadolivreTrackingId;
  } else if (plat.includes('amazon')) {
    tagParam = 'tag';
    tagValue = keys.amazonAssociatesTag;
  } else if (plat.includes('shopee')) {
    tagParam = 'smtt';
    tagValue = keys.shopeeTrackingId;
  } else if (plat.includes('aliexpress')) {
    tagParam = 'aff_id';
    tagValue = keys.aliexpressAffiliateId;
  } else if (plat.includes('shein')) {
    tagParam = 'url_from';
    tagValue = keys.sheinAffiliateToken;
  }

  if (!tagParam || !tagValue) {
    return rawUrl;
  }

  try {
    const urlObj = new URL(rawUrl);
    urlObj.searchParams.set(tagParam, tagValue);
    return urlObj.toString();
  } catch (e) {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}${tagParam}=${encodeURIComponent(tagValue)}`;
  }
}

function formatProductCopy(product, affiliateLink) {
  const title = product.title || 'Produto de Oferta';
  const priceTo = product.price_to ? `R$ ${product.price_to}` : '';
  const priceFrom = product.price_from ? `~R$ ${product.price_from}~` : '';
  const discount = product.discount_pct ? `🔥 *${product.discount_pct}% OFF*` : '';
  const link = affiliateLink || product.original_link || product.affiliate_link || '';

  return (
    `🚨 *OFERTA IMPERDÍVEL!* 🚨\n\n` +
    `📦 *${title}*\n\n` +
    (priceFrom ? `❌ De: ${priceFrom}\n` : '') +
    (priceTo ? `✅ Por: *${priceTo}* ${discount}\n\n` : '\n') +
    `🛒 *Compre aqui com desconto:* \n${link}\n\n` +
    `⚡ *Aproveite antes que o estoque acabe!*`
  );
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return null;
  const parts = timeStr.trim().split(':');
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

function isScheduleActive(schedule) {
  if (!schedule) return true;

  try {
    const tz = schedule.timezone || 'America/Sao_Paulo';
    const now = new Date();

    const localDate = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const dayOfWeek = localDate.getDay();

    if (Array.isArray(schedule.days) && schedule.days.length > 0) {
      if (!schedule.days.includes(dayOfWeek)) {
        return false;
      }
    }

    if (schedule.startHour && schedule.endHour) {
      const currentHours = localDate.getHours();
      const currentMinutes = localDate.getMinutes();
      const currentTotalMin = currentHours * 60 + currentMinutes;

      const startMin = parseTimeToMinutes(schedule.startHour);
      const endMin = parseTimeToMinutes(schedule.endHour);

      if (startMin !== null && endMin !== null) {
        if (startMin <= endMin) {
          if (currentTotalMin < startMin || currentTotalMin > endMin) {
            return false;
          }
        } else {
          if (currentTotalMin < startMin && currentTotalMin > endMin) {
            return false;
          }
        }
      }
    }

    return true;
  } catch (err) {
    return true;
  }
}

// ------------------------------------------------------------------------------
// 6. MOTOR DE DISPARO DE CAMPANHAS (MULTI-SESSÃO)
// ------------------------------------------------------------------------------

async function runCampaignCycle() {
  if (isRunningCampaign) return;
  isRunningCampaign = true;

  try {
    console.log('\n⚙️ Executando ciclo de campanhas de disparo...');

    let apiKeys = {};
    try {
      const apiKeysDoc = await db
        .collection('users')
        .doc(USER_UID)
        .collection('userConfig')
        .doc('apiKeys')
        .get();

      if (apiKeysDoc.exists) {
        apiKeys = apiKeysDoc.data() || {};
      }
    } catch (keyErr) {
      console.warn('⚠️ Não foi possível carregar as chaves de API/Afiliado:', keyErr.message);
    }

    const campaignsSnap = await db
      .collection('users')
      .doc(USER_UID)
      .collection('campaigns')
      .where('enabled', '==', true)
      .get();

    if (campaignsSnap.empty) {
      return;
    }

    const twentyFourHoursAgo = admin.firestore.Timestamp.fromDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000)
    );

    const recentQueueSnap = await db
      .collection('users')
      .doc(USER_UID)
      .collection('sendQueue')
      .where('scheduledAt', '>=', twentyFourHoursAgo)
      .get();

    const recentlySentProductIds = new Set();
    recentQueueSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.productId) recentlySentProductIds.add(data.productId);
    });

    const recentLogSnap = await db
      .collection('users')
      .doc(USER_UID)
      .collection('sendLog')
      .where('sentAt', '>=', twentyFourHoursAgo)
      .get();

    recentLogSnap.docs.forEach((doc) => {
      const data = doc.data();
      if (data.productId) recentlySentProductIds.add(data.productId);
    });

    for (const campaignDoc of campaignsSnap.docs) {
      const campaign = { id: campaignDoc.id, ...campaignDoc.data() };

      const campaignSessionId = campaign.sessionId || 'current';
      const sessionObj = sessionsMap.get(campaignSessionId);

      if (!sessionObj || sessionObj.status !== 'connected' || !sessionObj.sock) {
        console.log(`⏳ Campanha "${campaign.name}" aguardando conta WhatsApp (${campaignSessionId}) estar conectada. Pulando.`);
        continue;
      }

      const windowMin = campaign.windowMinutes || 30;
      if (campaign.lastRunAt) {
        let lastRunMs = 0;
        if (typeof campaign.lastRunAt.toMillis === 'function') {
          lastRunMs = campaign.lastRunAt.toMillis();
        } else if (campaign.lastRunAt.seconds) {
          lastRunMs = campaign.lastRunAt.seconds * 1000;
        } else if (campaign.lastRunAt instanceof Date) {
          lastRunMs = campaign.lastRunAt.getTime();
        } else if (typeof campaign.lastRunAt === 'number') {
          lastRunMs = campaign.lastRunAt;
        }

        if (lastRunMs > 0) {
          const elapsedMs = Date.now() - lastRunMs;
          const windowMs = windowMin * 60 * 1000;
          if (elapsedMs < windowMs) {
            const remainMin = Math.ceil((windowMs - elapsedMs) / 60000);
            console.log(`⏳ Campanha "${campaign.name}" aguardando janela (${remainMin} min restantes). Pulando.`);
            continue;
          }
        }
      }

      if (!isScheduleActive(campaign.schedule)) {
        console.log(`⏰ Campanha "${campaign.name}" fora do horário ativo agendado. Pulando.`);
        continue;
      }

      if (!campaign.targetGroupIds || campaign.targetGroupIds.length === 0) {
        console.log(`⚠️ Campanha "${campaign.name}" sem grupos alvo. Pulando.`);
        continue;
      }

      console.log(`🎯 Processando campanha: "${campaign.name}" na conta "${sessionObj.label}" (${campaignSessionId})`);

      const minedSnap = await db
        .collection('users')
        .doc(USER_UID)
        .collection('minedProducts')
        .get();

      if (minedSnap.empty) continue;

      const minedRefs = minedSnap.docs.map((d) => d.data());
      const candidateProducts = [];
      for (const ref of minedRefs) {
        if (!ref.productId) continue;
        const pDoc = await db.collection('products').doc(ref.productId).get();
        if (pDoc.exists) {
          candidateProducts.push({ id: pDoc.id, ...pDoc.data() });
        }
      }

      const filters = campaign.filters || {};
      let filtered = candidateProducts.filter((p) => {
        if (recentlySentProductIds.has(p.id)) return false;

        if (filters.platforms && filters.platforms.length > 0) {
          const platSet = new Set(filters.platforms.map((pl) => pl.toLowerCase()));
          if (!platSet.has((p.platform || '').toLowerCase())) return false;
        }

        if (filters.minSales && filters.minSales > 0) {
          let countNum = 0;
          const s = String(p.sales_count || '').toLowerCase().replace(',', '.');
          if (s.includes('k')) countNum = parseFloat(s.replace('k', '')) * 1000;
          else countNum = parseFloat(s) || 0;
          if (countNum < filters.minSales) return false;
        }

        if (filters.minDiscount && filters.minDiscount > 0) {
          if ((p.discount_pct || 0) < filters.minDiscount) return false;
        }

        if (filters.maxPrice && filters.maxPrice > 0) {
          const numPrice = parseFloat((p.price_to || '0').replace(/\./g, '').replace(',', '.'));
          if (numPrice > filters.maxPrice) return false;
        }

        return true;
      });

      filtered.sort((a, b) => {
        if (campaign.objective === 'mais_vendidos') {
          const parseSales = (sc) => {
            if (!sc) return 0;
            const s = String(sc).toLowerCase().replace(',', '.');
            if (s.includes('k')) return parseFloat(s.replace('k', '')) * 1000;
            return parseFloat(s) || 0;
          };
          return parseSales(b.sales_count) - parseSales(a.sales_count);
        } else if (campaign.objective === 'maior_desconto') {
          return (b.discount_pct || 0) - (a.discount_pct || 0);
        } else if (campaign.objective === 'maior_comissao') {
          return (b.commission_amount || 0) - (a.commission_amount || 0);
        } else {
          return (b.firstMinedAt || '').localeCompare(a.firstMinedAt || '');
        }
      });

      const qty = campaign.quantity || 30;
      const selectedProducts = filtered.slice(0, qty);

      if (selectedProducts.length === 0) {
        console.log(`ℹ️ Sem novos produtos elegíveis para a campanha "${campaign.name}".`);
        continue;
      }

      console.log(`📦 ${selectedProducts.length} produto(s) enfileirados para a campanha "${campaign.name}".`);

      let currentTimeMs = Date.now();

      for (let i = 0; i < selectedProducts.length; i++) {
        const product = selectedProducts[i];

        let gapMs = 60 * 1000;
        if (campaign.pacing === 'aleatorio') {
          const minG = campaign.minGapSec || 30;
          const maxG = campaign.maxGapSec || 120;
          const randomSec = Math.floor(Math.random() * (maxG - minG + 1)) + minG;
          gapMs = randomSec * 1000;
        } else {
          const totalMin = campaign.windowMinutes || 30;
          const stepSec = Math.max(10, Math.floor((totalMin * 60) / qty));
          gapMs = stepSec * 1000;
        }

        if (i > 0) {
          currentTimeMs += gapMs;
        }

        const rawLink = product.original_link || product.affiliate_link || '';
        const affiliateLink = buildAffiliateLink(rawLink, product.platform, apiKeys);
        const copyText = formatProductCopy(product, affiliateLink);

        for (const targetGId of campaign.targetGroupIds) {
          // Extrair groupId real se for no formato sessionId_groupId
          const realGroupId = targetGId.includes('_') && targetGId.endsWith('@g.us')
            ? targetGId.split('_').slice(1).join('_')
            : targetGId;

          const queueItemData = {
            sessionId: campaignSessionId,
            productId: product.id,
            productTitle: product.title || 'Oferta Imperdível',
            groupId: realGroupId,
            campaignId: campaign.id,
            campaignName: campaign.name,
            copyText: copyText,
            imageUrl: product.image_url || null,
            affiliateLink: affiliateLink,
            scheduledAt: admin.firestore.Timestamp.fromMillis(currentTimeMs),
            status: 'pending',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          };

          await db
            .collection('users')
            .doc(USER_UID)
            .collection('sendQueue')
            .add(queueItemData);
        }

        recentlySentProductIds.add(product.id);
      }

      await db
        .collection('users')
        .doc(USER_UID)
        .collection('campaigns')
        .doc(campaign.id)
        .update({ lastRunAt: admin.firestore.FieldValue.serverTimestamp() });
    }
  } catch (err) {
    console.error('⚠️ Erro ao rodar ciclo de campanhas:', err.message);
  } finally {
    isRunningCampaign = false;
  }
}

// ------------------------------------------------------------------------------
// 7. CONSUMIDOR DA FILA DE ENVIOS (sendQueue) MULTI-SESSÃO
// ------------------------------------------------------------------------------

async function processSendQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const nowTimestamp = admin.firestore.Timestamp.now();

    const pendingSnap = await db
      .collection('users')
      .doc(USER_UID)
      .collection('sendQueue')
      .where('status', '==', 'pending')
      .where('scheduledAt', '<=', nowTimestamp)
      .limit(5)
      .get();

    if (pendingSnap.empty) return;

    console.log(`⚡ Processando ${pendingSnap.docs.length} disparo(s) agendado(s) da fila...`);

    for (const queueDoc of pendingSnap.docs) {
      const item = { id: queueDoc.id, ...queueDoc.data() };
      const itemSessionId = item.sessionId || 'current';

      const sessionObj = sessionsMap.get(itemSessionId);

      // Se a sessão estiver offline ou desconectada, marcar erro claro
      if (!sessionObj || sessionObj.status !== 'connected' || !sessionObj.sock) {
        const errorMsg = `Sessão do WhatsApp (${itemSessionId}) não está conectada ou disponível no worker.`;
        console.error(`❌ Falha no disparo (${item.id}): ${errorMsg}`);

        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendQueue')
          .doc(item.id)
          .update({
            status: 'failed',
            error: errorMsg,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendLog')
          .add({
            sessionId: itemSessionId,
            productId: item.productId || '',
            productName: item.productTitle || '',
            groupId: item.groupId,
            groupName: item.groupName || item.groupId,
            campaignId: item.campaignId || '',
            campaignName: item.campaignName || '',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: errorMsg,
          });

        continue;
      }

      const sock = sessionObj.sock;

      try {
        console.log(`📤 [Sessão: ${sessionObj.label}] Enviando "${item.productTitle}" para ${item.groupId}...`);

        // Simulação de presença "composing"
        await sock.sendPresenceUpdate('composing', item.groupId);
        const typingDelay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, typingDelay));

        if (item.imageUrl) {
          await sock.sendMessage(item.groupId, {
            image: { url: item.imageUrl },
            caption: item.copyText,
          });
        } else {
          await sock.sendMessage(item.groupId, {
            text: item.copyText,
          });
        }

        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendQueue')
          .doc(item.id)
          .update({
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendLog')
          .add({
            sessionId: itemSessionId,
            productId: item.productId || '',
            productName: item.productTitle || '',
            groupId: item.groupId,
            groupName: item.groupName || item.groupId,
            campaignId: item.campaignId || '',
            campaignName: item.campaignName || '',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'sent',
            affiliateLink: item.affiliateLink || '',
            copyText: item.copyText || '',
            imageUrl: item.imageUrl || null,
          });

        console.log(`✅ [Sessão: ${sessionObj.label}] Disparo concluído para ${item.groupId}!`);

        const interMessageDelay = Math.floor(Math.random() * 5000) + 3000;
        await new Promise((resolve) => setTimeout(resolve, interMessageDelay));
      } catch (sendErr) {
        console.error(`❌ [Sessão: ${sessionObj.label}] Erro ao enviar para ${item.groupId}:`, sendErr.message);

        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendQueue')
          .doc(item.id)
          .update({
            status: 'failed',
            error: sendErr.message || 'Erro de envio',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendLog')
          .add({
            sessionId: itemSessionId,
            productId: item.productId || '',
            productName: item.productTitle || '',
            groupId: item.groupId,
            groupName: item.groupName || item.groupId,
            campaignId: item.campaignId || '',
            campaignName: item.campaignName || '',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'failed',
            error: sendErr.message || 'Erro de envio',
          });
      }
    }
  } catch (err) {
    console.error('⚠️ Erro no processamento da fila de envios:', err.message);
  } finally {
    isProcessingQueue = false;
  }
}

// ------------------------------------------------------------------------------
// 8. TEMPORIZADORES (LOOPS)
// ------------------------------------------------------------------------------

async function main() {
  // 1. Migração se houver sessão legada
  await checkAndMigrateLegacySession();

  // 2. Iniciar gerenciador de sessões (carrega auth/ e escuta waSessions)
  startSessionsManager();

  // 3. Sincronização periódica de grupos (a cada X minutos)
  const syncIntervalMs = (parseInt(process.env.SYNC_GROUPS_INTERVAL_MIN) || 15) * 60 * 1000;
  setInterval(syncAllGroups, syncIntervalMs);

  // 4. Ciclo de geração de campanhas (a cada 1 minuto)
  const campaignIntervalMs = (parseInt(process.env.CAMPAIGN_CYCLE_INTERVAL_MIN) || 1) * 60 * 1000;
  setInterval(runCampaignCycle, campaignIntervalMs);
  runCampaignCycle();

  // 5. Consumidor de fila em tempo real (a cada 15 segundos)
  setInterval(processSendQueue, 15 * 1000);
}

main().catch((err) => {
  console.error('❌ Erro fatal no worker:', err);
});
