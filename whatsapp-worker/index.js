/**
 * ==============================================================================
 * WORKER DE AUTOMAÇÃO MULTI-SESSÃO WHATSAPP DA PLATAFORMA AFILIATE
 * ==============================================================================
 * AVISO IMPORTANTE DE SEGURANÇA E TERMOS DE USO:
 * 1. Este worker utiliza a biblioteca não-oficial @whiskeysockets/baileys.
 * 2. O uso de automações não oficiais viola os Termos de Serviço do WhatsApp.
 * 3. RISCO DE BANIMENTO: Há risco real de bloqueio definitivo do número de telefone.
 * 4. RECOMENDAÇÃO ABSOLUTA: Use SEMPRE NÚMEROS EXCLUSIVOS E DEDICADOS para disparos!
 * 5. PRIVACIDADE: o código legado sincroniza metadados de participantes
 *    (incluindo identificadores e telefones disponíveis) em waGroups. Restrinja
 *    o acesso a esses dados e revise retenção/consentimento antes de operar.
 * ==============================================================================
 */

require('dotenv').config();
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode-terminal');
const pino = require('pino');
const admin = require('firebase-admin');
const { getFirestore } = require('firebase-admin/firestore');
const { BUILTIN_TEMPLATES, formattedPrice, renderTemplate, parseProductPrice } = require('./templateEngine');
const { archiveRejectedAuth } = require('./authRecovery');
const { normalizeBRWhatsAppPhone } = require('./phoneBR');
const { getCurrentWaWebVersion } = require('./waVersion');
const { parseChannelReference, normalizeChannelId, canPublishToChannel, getChannelId } = require('./channelSupport');

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
  Browsers,
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
// A instalação e o pareamento são permitidos em modo seguro. Envio real
// e comandos que modificam grupos só são habilitados explicitamente no Termux.
const WA_SEND_ENABLED = process.env.WA_SEND_ENABLED === 'true';
const WA_GROUP_COMMANDS_ENABLED = process.env.WA_GROUP_COMMANDS_ENABLED === 'true';
const WA_PAIRING_PHONE = process.env.WA_PAIRING_PHONE || '';
const WA_PRINT_QR_IN_TERMINAL = process.env.WA_PRINT_QR_IN_TERMINAL === 'true';
const WA_MAX_QUEUE_AGE_MIN = Math.max(5, Number(process.env.WA_MAX_QUEUE_AGE_MIN || 180) || 180);

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
console.log(WA_SEND_ENABLED
  ? '⚠️ MODO ATIVO: campanhas e envio real estão habilitados.'
  : '🔒 MODO SEGURO: sem gerar filas nem disparar mensagens (WA_SEND_ENABLED=false).');
console.log(WA_GROUP_COMMANDS_ENABLED
  ? '⚠️ Comandos de criação/saída de grupos habilitados.'
  : '🔒 Comandos de criação/saída de grupos desabilitados.');

// Globais & Estado Multi-Sessão
// Map<sessionId, { sessionId, sock, isConnecting, reconnectTimer, status, label }>
const sessionsMap = new Map();

let isRunningCampaign = false;
let isProcessingQueue = false;
let sessionsListenerUnsub = null;

// Sinal de vida real do Termux para evitar status "conectado" antigo no painel.
const WORKER_RUN_ID = String(Date.now()) + '-' + Math.random().toString(36).slice(2, 9);
async function updateWorkerHealth() {
  try {
    const connectedSessions = Array.from(sessionsMap.values()).filter(s => s.status === 'connected' && s.sock).length;
    await db.collection('users').doc(USER_UID).collection('workerStatus').doc('current').set({
      runId: WORKER_RUN_ID,
      heartbeatAt: admin.firestore.FieldValue.serverTimestamp(),
      sendEnabled: WA_SEND_ENABLED,
      groupCommandsEnabled: WA_GROUP_COMMANDS_ENABLED,
      connectedSessions,
      totalSessions: sessionsMap.size,
      workerVersion: '1.1.0'
    }, { merge: true });
  } catch (error) {
    console.warn('Não foi possível atualizar o estado do worker:', error.message);
  }
}

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

async function connectToWhatsAppSession(sessionId, label, requestedPairingPhone = null) {
  // O campo brasileiro é DDD+número; adicionar 55 no servidor também
  // para proteger clientes antigos e entradas enviadas diretamente ao Firestore.
  const rawPairingPhone = requestedPairingPhone === null ? WA_PAIRING_PHONE : requestedPairingPhone;
  const validPairingPhone = normalizeBRWhatsAppPhone(rawPairingPhone);
  if (String(rawPairingPhone || '').trim() && !validPairingPhone) {
    console.warn('[WhatsApp] Número para pareamento inválido. Informe DDD + número brasileiro.');
    await updateSessionDoc(sessionId, {
      status: 'disconnected',
      pairingCode: null,
      pairingCodeAt: null,
      pairingError: 'Número inválido. Informe somente DDD + número brasileiro. O +55 é automático.',
      requestedConnect: false,
    });
    return;
  }
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
      pairingRequested: false,
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
      pairingCode: null,
      pairingCodeAt: null,
      pairingError: null,
      label: sessionObj.label,
    });

    const { state, saveCreds } = await useMultiFileAuthState(sessionAuthDir);
    // A versão obtida do repositório Baileys pode estar atrasada. A versão do
    // WhatsApp Web é obtida diretamente; se falhar, não emitir código inválido.
    const version = await getCurrentWaWebVersion(fetchLatestWaWebVersion);

    console.log(`\n📱 [Sessão: ${sessionObj.label} (${sessionId})] Iniciando Baileys v${version.join('.')}...`);

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: Browsers.windows('Chrome'),
      syncFullHistory: false,
    });

    sessionObj.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        // Não registrar QR de autenticação em logs do PM2 por padrão.
        // Para depuração local, WA_PRINT_QR_IN_TERMINAL=true permite a saída.
        if (WA_PRINT_QR_IN_TERMINAL) {
          console.log(`\n📲 QR para sessão ${sessionId}:`);
          qrcode.generate(qr, { small: true });
        }

        await updateSessionDoc(sessionId, {
          status: 'qr',
          qr: qr,
          label: sessionObj.label,
        });

        // No mesmo celular, use o código no WhatsApp > Aparelhos conectados >
        // Conectar um aparelho > Conectar com número de telefone.
        if (validPairingPhone && !state.creds?.registered && !sessionObj.pairingRequested) {
          sessionObj.pairingRequested = true;
          try {
            const code = await sock.requestPairingCode(validPairingPhone);
            if (!/^[A-Z0-9-]{4,16}$/i.test(String(code || ''))) throw new Error('Código inválido');
            await updateSessionDoc(sessionId, {
              status: 'qr', pairingCode: code,
              pairingCodeAt: admin.firestore.FieldValue.serverTimestamp(), pairingError: null,
            });
            console.log('[WhatsApp] Código disponível no app Afiliate.');
          } catch (err) {
            console.error('[WhatsApp] Falha ao gerar código:', err.message);
            await updateSessionDoc(sessionId, {
              pairingCode: null, pairingCodeAt: null,
              pairingError: 'Não foi possível gerar o código. Tente novamente ou use QR.',
            });
            sessionObj.pairingRequested = false;
          }
        }
      }

      // Não sobrescrever o QR/status com "connecting" no mesmo evento.
      if (connection === 'connecting' && !qr) {
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
          // 401 = sessão recusada. Não destruir credenciais antigas
          // automaticamente: arquivar fora de auth/ para um novo pareamento
          // usar o MESMO ID de sessão sem tentar novamente as chaves recusadas.
          clearTimeout(sessionObj.reconnectTimer);
          console.error(`❌ [Sessão: ${sessionId}] Erro 401: WhatsApp encerrou ou recusou a tentativa de conexão.`);
          try {
            const archivedAt = archiveRejectedAuth(AUTH_BASE_DIR, sessionId);
            if (archivedAt) {
              console.warn(`🔐 Sessão anterior preservada fora de auth/: ${archivedAt}`);
            }
          } catch (archiveError) {
            console.error('⚠️ Não foi possível preservar a sessão recusada; NENHUM arquivo foi apagado:', archiveError.message);
            console.error('⚠️ Pare o worker e faça backup manual antes de solicitar reconexão.');
          }
          await updateSessionDoc(sessionId, {
            status: 'disconnected',
            qr: null,
            pairingCode: null,
            pairingCodeAt: null,
            pairingError: validPairingPhone
              ? 'O WhatsApp recusou ou encerrou o pareamento (401). Confirme o DDD + número, peça outro código e tente novamente. Se persistir, tente QR em outra tela.'
              : 'Sessão desconectada pelo WhatsApp (401). Solicite uma nova conexão.',
            pairingPhone: null,
            phoneNumber: null,
            name: null,
            requestedConnect: false,
            reloginRequired: true,
            lastDisconnectCode: statusCode,
          });
          sessionsMap.delete(sessionId);
        } else {
          await updateSessionDoc(sessionId, {
            status: shouldReconnect ? 'connecting' : 'disconnected',
            qr: null,
            pairingCode: null,
            pairingCodeAt: null,
          });

          if (shouldReconnect) {
            clearTimeout(sessionObj.reconnectTimer);
            sessionObj.reconnectTimer = setTimeout(() => {
              sessionObj.pairingRequested = false;
              connectToWhatsAppSession(sessionId, sessionObj.label, requestedPairingPhone);
            }, 5000);
          }
        }
      } else if (connection === 'open') {
        sessionObj.isConnecting = false;
        sessionObj.status = 'connected';
        sessionObj.pairingRequested = false;
        clearTimeout(sessionObj.reconnectTimer);

        const userJid = sock.user?.id || '';
        const phoneNum = userJid ? userJid.split(':')[0].split('@')[0] : null;
        const name = sock.user?.name || sock.user?.notify || null;

        console.log(`\n✅ [Sessão: ${sessionObj.label}] CONECTADO COM SUCESSO AO WHATSAPP! (${phoneNum})`);
        console.log(`----------------------------------------------------------------\n`);

        await updateSessionDoc(sessionId, {
          status: 'connected',
          qr: null,
          pairingCode: null,
          pairingCodeAt: null,
          pairingError: null,
          pairingPhone: null,
          phoneNumber: phoneNum,
          name: name,
          requestedConnect: false,
          reloginRequired: false,
          lastDisconnectCode: null,
          groupCapabilities: {
            createGroup: typeof sock.groupCreate === 'function',
            createCommunity: typeof sock.communityCreate === 'function',
            createChannel: typeof sock.newsletterCreate === 'function',
            linkGroupToCommunity: typeof sock.communityLinkGroup === 'function',
            commandsEnabled: WA_GROUP_COMMANDS_ENABLED,
          },
          lastConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Sincronizar grupos e canais autorizados desta conta.
        await syncGroups(sessionId, sock);
        await syncChannels(sessionId, sock);
      }
    });
  } catch (err) {
    sessionObj.isConnecting = false;
    sessionObj.status = 'disconnected';
    console.error(`❌ Erro ao conectar sessão ${sessionId}:`, err.message);

    await updateSessionDoc(sessionId, {
      status: 'disconnected',
      qr: null,
      pairingCode: null,
      pairingCodeAt: null,
      pairingError: err?.message?.includes('versão') || err?.message?.includes('fetchLatestWaWebVersion')
        ? 'Não foi possível consultar uma versão compatível do WhatsApp Web. Confira a internet e tente mais tarde.'
        : 'Não foi possível iniciar a conexão. Confira o serviço e tente novamente.',
      requestedConnect: false,
    });
    sessionsMap.delete(sessionId);
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
        const credsPath = path.join(AUTH_BASE_DIR, sessionId, 'creds.json');
        // Sessão recém-criada (ainda não registrada) NÃO deve gerar QR ou
        // código automaticamente ao iniciar o Termux. O usuário deve iniciar
        // o pareamento no aplicativo, com seu número e método selecionados.
        let registered = false;
        try {
          if (fs.existsSync(credsPath)) {
            registered = JSON.parse(fs.readFileSync(credsPath, 'utf8')).registered === true;
          }
        } catch (error) {
          console.warn(`⚠️ [Sessão: ${sessionId}] Arquivo de autenticação ilegível; preservado para revisão.`);
        }
        if (registered) {
          console.log(`📂 Sessão vinculada encontrada no disco: ${sessionId}. Reconectando...`);
          connectToWhatsAppSession(sessionId, 'Conta WhatsApp', '');
        } else {
          console.log(`📂 Sessão incompleta ${sessionId} preservada. Aguardando pedido no app.`);
        }
      }
    }
  }

  // 2. Escutar Firestore em tempo real
  const sessionsColRef = db.collection('users').doc(USER_UID).collection('waSessions');

  // Impede duas sincronizações concorrentes quando o listener vê alterações do próprio worker.
  const groupSyncInFlight = new Set();
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

        // O botão "Sincronizar" no aplicativo solicita atualização imediata.
        // Antes, requestedSyncGroups era escrito no Firestore mas nunca consumido.
        if (data.requestedSyncGroups && !groupSyncInFlight.has(sessionId)) {
          groupSyncInFlight.add(sessionId);
          const connected = sessionsMap.get(sessionId);
          (async () => {
            try {
              if (!connected || connected.status !== 'connected' || !connected.sock) {
                await updateSessionDoc(sessionId, {
                  requestedSyncGroups: false,
                  groupSyncError: 'Conecte esta conta WhatsApp antes de sincronizar os grupos.',
                });
              } else {
                const ok = await syncGroups(sessionId, connected.sock);
                await syncChannels(sessionId, connected.sock);
                await updateSessionDoc(sessionId, {
                  requestedSyncGroups: false,
                  lastGroupSyncAt: admin.firestore.FieldValue.serverTimestamp(),
                  groupSyncError: ok ? null : 'O WhatsApp não conseguiu atualizar os grupos. Tente novamente.',
                });
              }
            } catch (err) {
              console.error('[WhatsApp] Falha na sincronização solicitada:', err.message);
              await updateSessionDoc(sessionId, {
                requestedSyncGroups: false, groupSyncError: 'Falha na atualização dos grupos.',
              }).catch(() => {});
            } finally {
              groupSyncInFlight.delete(sessionId);
            }
          })();
        }

        // Se pediu conexão
        if (data.requestedConnect) {
          const sessionObj = sessionsMap.get(sessionId);
          if (!sessionObj || sessionObj.status === 'disconnected') {
            console.log(`📲 [Sessão: ${sessionId}] Solicitação de conexão recebida! Gerando QR...`);
            connectToWhatsAppSession(sessionId, data.label || 'Conta WhatsApp', data.pairingMethod === 'code' ? data.pairingPhone : '');
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
        isCommunity: !!group.isCommunity,
        linkedParent: group.linkedParent || null,
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

    // ── Remove grupos que NÃO existem mais no WhatsApp (saiu/foi excluído) ──
    // Assim o app mostra somente os grupos que realmente estão no WhatsApp.
    try {
      const liveDocIds = new Set(
        groupList.filter((g) => g.id && g.id.endsWith('@g.us')).map((g) => `${sessionId}_${g.id}`)
      );
      const existingSnap = await db
        .collection('users')
        .doc(USER_UID)
        .collection('waGroups')
        .where('sessionId', '==', sessionId)
        .get();
      const stale = [];
      existingSnap.forEach((docSnap) => {
        if (!liveDocIds.has(docSnap.id)) stale.push(docSnap.ref);
      });
      if (stale.length) {
        await Promise.all(stale.map((ref) => ref.delete()));
        console.log(`🗑️ [Sessão: ${sessionId}] ${stale.length} grupo(s) removido(s) do app (não estão mais no WhatsApp).`);
      }
    } catch (cleanupErr) {
      console.error(`⚠️ [Sessão: ${sessionId}] Erro ao limpar grupos antigos:`, cleanupErr.message);
    }

    console.log(`✅ [Sessão: ${sessionId}] Sincronização de grupos concluída!`);
    return true;
  } catch (err) {
    console.error(`⚠️ [Sessão: ${sessionId}] Erro ao sincronizar grupos:`, err.message);
    return false;
  }
}

// Canais não aparecem em groupFetchAllParticipating: @newsletter != @g.us.
async function saveVerifiedChannel(sessionId, sock, input) {
  if (typeof sock.newsletterMetadata !== 'function') throw new Error('Baileys não oferece consulta de canais nesta instalação.');
  const ref = typeof input === 'string' ? parseChannelReference(input) : { type: 'jid', value: getChannelId(input) };
  if (!ref?.value) throw new Error('Informe um link https://whatsapp.com/channel/... ou um ID @newsletter válido.');
  const metadata = await sock.newsletterMetadata(ref.type, ref.value);
  const channelId = getChannelId(metadata) || (ref.type === 'jid' ? normalizeChannelId(ref.value) : null);
  if (!channelId || !canPublishToChannel(metadata)) throw new Error('Canal não confirmado como administrado por esta conta; nenhum destino foi habilitado.');
  const name = typeof metadata.name === 'string' ? metadata.name : (metadata.name?.text || 'Canal WhatsApp');
  await db.collection('users').doc(USER_UID).collection('waChannels').doc(`${sessionId}_${channelId}`).set({
    channelId, sessionId, name, canPost: true, verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, { merge: true });
  return channelId;
}

async function syncChannels(sessionId, sock) {
  // A versão instalada pode não implementar a descoberta automática.
  if (typeof sock.newsletterFetchAllParticipating !== 'function') return;
  try {
    const response = await sock.newsletterFetchAllParticipating();
    const channels = Array.isArray(response) ? response : Object.values(response || {});
    for (const metadata of channels) {
      if (!getChannelId(metadata) || !canPublishToChannel(metadata)) continue;
      try { await saveVerifiedChannel(sessionId, sock, metadata); }
      catch (err) { console.warn('[Canais] Não foi possível validar canal:', err.message); }
    }
  } catch (err) {
    console.warn('[Canais] Descoberta indisponível; utilize o link de convite no app:', err.message);
  }
}

// Sincronizar grupos e canais de todas as sessões conectadas periodicamente
async function syncAllGroups() {
  for (const [sessionId, sessionObj] of sessionsMap.entries()) {
    if (sessionObj.status === 'connected' && sessionObj.sock) {
      await syncGroups(sessionId, sessionObj.sock);
      await syncChannels(sessionId, sessionObj.sock);
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
  const priceTo = formattedPrice(product.price_to);
  const priceFrom = product.price_from ? `~${formattedPrice(product.price_from)}~` : '';
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
      // Categorias pessoais existem em minedProducts/categories (IDs) e seus
      // nomes ficam em userConfig/categories. Não se pode usar só p.category.
      const categoryNames = new Map();
      if (campaign.filters?.categories?.length) {
        try {
          const catDoc = await db.collection('users').doc(USER_UID)
            .collection('userConfig').doc('categories').get();
          for (const cat of (catDoc.data()?.items || [])) {
            if (cat.id && cat.name) categoryNames.set(cat.id, String(cat.name).trim().toLowerCase());
          }
        } catch (error) {
          console.warn('⚠️ Falha ao carregar categorias pessoais da campanha:', error.message);
        }
      }
      const candidateProducts = [];
      for (const ref of minedRefs) {
        if (!ref.productId) continue;
        const pDoc = await db.collection('products').doc(ref.productId).get();
        if (pDoc.exists) {
          candidateProducts.push({
            id: pDoc.id, ...pDoc.data(),
            minedCategoryIds: Array.isArray(ref.categories) ? ref.categories : []
          });
        }
      }

      const filters = campaign.filters || {};
      let filtered = candidateProducts.filter((p) => {
        if (recentlySentProductIds.has(p.id)) return false;

        if (filters.platforms && filters.platforms.length > 0) {
          const platSet = new Set(filters.platforms.map((pl) => pl.toLowerCase()));
          if (!platSet.has((p.platform || '').toLowerCase())) return false;
        }

        if (Array.isArray(filters.categories) && filters.categories.length > 0) {
          const allowed = new Set(filters.categories.map(c => String(c).trim().toLowerCase()));
          const labels = [
            String(p.category || '').trim().toLowerCase(),
            ...(p.minedCategoryIds || []).flatMap(id =>
              [String(id).trim().toLowerCase(), categoryNames.get(id) || ''])
          ];
          if (!labels.some(label => label && allowed.has(label))) return false;
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
          const numPrice = parseProductPrice(p.price_to);
          // Preço desconhecido também deve ser excluído por filtros de teto.
          if (!Number.isFinite(numPrice) || numPrice > filters.maxPrice) return false;
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

      // Respeita o modelo de mensagem escolhido no painel Afiliate.
      // Também suporta templates personalizados em users/{uid}/templates.
      let campaignTemplate = null;
      if (campaign.templateId) {
        campaignTemplate = BUILTIN_TEMPLATES[campaign.templateId] || null;
        if (!campaignTemplate) {
          try {
            const templateSnap = await db.collection('users').doc(USER_UID)
              .collection('templates').doc(campaign.templateId).get();
            if (templateSnap.exists) campaignTemplate = templateSnap.data()?.template || null;
          } catch (error) {
            console.warn('⚠️ Não foi possível ler o template da campanha:', error.message);
          }
        }
        if (!campaignTemplate) {
          console.warn(`⚠️ Template "${campaign.templateId}" indisponível na campanha "${campaign.name}". Usando mensagem padrão.`);
        }
      }

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
        // Preserva o link de afiliado já salvo pela extensão quando existir.
        const affiliateLink = product.affiliate_link || buildAffiliateLink(rawLink, product.platform, apiKeys);
        const copyText = (campaignTemplate && renderTemplate(campaignTemplate, product, affiliateLink))
          || formatProductCopy(product, affiliateLink);

        for (const targetGId of campaign.targetGroupIds) {
          // Extrair o JID real para grupos e canais com prefixo de sessão.
          const realGroupId = targetGId.includes('_') && (targetGId.endsWith('@g.us') || targetGId.endsWith('@newsletter'))
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
      .limit(10)
      .get();

    if (pendingSnap.empty) return;

    console.log(`⚡ Processando ${pendingSnap.docs.length} disparo(s) agendado(s) da fila...`);

    for (const queueDoc of pendingSnap.docs) {
      const item = { id: queueDoc.id, ...queueDoc.data() };
      const itemSessionId = item.sessionId || 'current';

      const sessionObj = sessionsMap.get(itemSessionId);

      // Mensagem antiga pode conter preço desatualizado: não disparar após o
      // prazo configurado, mesmo que a sessão tenha estado offline.
      const scheduledMs = item.scheduledAt?.toMillis?.();
      if (scheduledMs && Date.now() - scheduledMs > WA_MAX_QUEUE_AGE_MIN * 60_000) {
        await queueDoc.ref.update({
          status: 'failed',
          error: `Oferta expirada: mais de ${WA_MAX_QUEUE_AGE_MIN} minutos desde o horário agendado.`,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.warn(`⏰ Oferta antiga descartada da fila: ${item.id}`);
        continue;
      }

      // Não consumir a fila enquanto o WhatsApp estiver offline: ela poderá
      // ser processada ao reconectar, respeitando o prazo acima.
      if (!sessionObj || sessionObj.status !== 'connected' || !sessionObj.sock) {
        continue;
      }

      // Pausar uma campanha no Afiliate interrompe também os envios já
      // enfileirados. Mantemos o registro como falha, sem publicar no WhatsApp.
      if (item.campaignId) {
        const campaignSnap = await db
          .collection('users').doc(USER_UID).collection('campaigns')
          .doc(item.campaignId).get();
        if (!campaignSnap.exists || campaignSnap.data()?.enabled !== true) {
          await queueDoc.ref.update({
            status: 'failed',
            error: 'Campanha pausada ou removida antes do envio.',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }
        if (!isScheduleActive(campaignSnap.data()?.schedule)) continue;

        // A fila pode ter sido criada antes de alguém editar os destinos.
        // Sempre respeitar a seleção atual do Afiliate, não a configuração antiga.
        const liveTargets = campaignSnap.data()?.targetGroupIds || [];
        const queueTarget = String(item.groupId || '');
        const isTargetStillSelected = liveTargets.some(target => {
          const original = String(target);
          return original === queueTarget ||
            original === itemSessionId + '_' + queueTarget;
        });
        if (!isTargetStillSelected || (campaignSnap.data()?.sessionId || 'current') !== itemSessionId) {
          await queueDoc.ref.update({
            status: 'failed',
            error: 'Grupo ou conta removidos da campanha antes do envio.',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          continue;
        }
      }

      // Apenas grupos reais ou canais gerenciados pela conta, nunca conversas privadas.
      const isChannel = !!normalizeChannelId(item.groupId);
      if (!item.groupId || (!String(item.groupId).endsWith('@g.us') && !isChannel)) {
        await queueDoc.ref.update({
          status: 'failed',
          error: 'Destino inválido: apenas grupos ou canais do WhatsApp são suportados.',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }

      const targetDoc = await db.collection('users').doc(USER_UID)
        .collection(isChannel ? 'waChannels' : 'waGroups').doc(itemSessionId + '_' + item.groupId).get();
      if (!targetDoc.exists || (isChannel && targetDoc.data()?.canPost !== true)) {
        await queueDoc.ref.update({
          status: 'failed', error: 'Destino não sincronizado ou canal sem autorização de publicação.',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        continue;
      }
      // Revalidar permissão ao vivo antes do claim/envio; não confiar somente no Firestore.
      if (isChannel) {
        try {
          const sock = sessionObj.sock;
          if (typeof sock.newsletterMetadata !== 'function' ||
              !canPublishToChannel(await sock.newsletterMetadata('jid', item.groupId))) {
            throw new Error('Esta conta não é administradora do canal.');
          }
        } catch (err) {
          await queueDoc.ref.update({ status: 'failed', error: 'Permissão do canal não confirmada: ' + err.message,
            updatedAt: admin.firestore.FieldValue.serverTimestamp() });
          continue;
        }
      }

      // Claim atômico: se duas instâncias iniciarem por engano, apenas uma
      // poderá consumir a mesma mensagem. Um "processing" interrompido fica
      // para revisão manual, evitando disparo duplicado após falha inesperada.
      const claimed = await db.runTransaction(async (tx) => {
        const latest = await tx.get(queueDoc.ref);
        if (!latest.exists || latest.data()?.status !== 'pending') return false;
        tx.update(queueDoc.ref, {
          status: 'processing',
          processingAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return true;
      });
      if (!claimed) continue;

      const sock = sessionObj.sock;

      try {
        console.log(`📤 [Sessão: ${sessionObj.label}] Enviando "${item.productTitle}" para ${item.groupId}...`);

        // Canais não suportam indicadores de digitação como grupos.
        if (!isChannel) {
          try { await sock.sendPresenceUpdate('composing', item.groupId); } catch (_) { /* opcional */ }
          const typingDelay = Math.floor(Math.random() * 2000) + 1500;
          await new Promise((resolve) => setTimeout(resolve, typingDelay));
        }

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
// 7b. FILA DE COMANDOS DE GRUPO (users/{uid}/waCommands) — criar/sair de grupos
//     a partir do app (sincronização de mão dupla).
// ------------------------------------------------------------------------------

function normalizeJid(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  if (s.endsWith('@s.whatsapp.net') || s.endsWith('@g.us')) return s;
  let num = s.replace(/\D/g, '');
  if (!num) return '';
  if (num.length <= 11) num = '55' + num; // assume Brasil se vier sem DDI
  return num + '@s.whatsapp.net';
}

function pickConnectedSock(preferredSessionId) {
  if (preferredSessionId) {
    const s = sessionsMap.get(preferredSessionId);
    if (s && s.status === 'connected' && s.sock) return { sock: s.sock, sessionId: preferredSessionId };
    // Nunca executar saída/criação de grupo em outra conta WhatsApp.
    return { sock: null, sessionId: null };
  }
  for (const [sid, s] of sessionsMap.entries()) {
    if (s.status === 'connected' && s.sock) return { sock: s.sock, sessionId: sid };
  }
  return { sock: null, sessionId: null };
}

let isProcessingCommands = false;
async function processCommands() {
  if (isProcessingCommands) return;
  isProcessingCommands = true;
  try {
    const snap = await db
      .collection('users').doc(USER_UID).collection('waCommands')
      .where('status', '==', 'pending').limit(10).get();
    if (snap.empty) return;

    for (const cmdDoc of snap.docs) {
      const cmd = cmdDoc.data() || {};
      const ref = cmdDoc.ref;
      try {
        // Nunca executar de surpresa comandos antigos quando a automação for ligada.
        const requestTime = cmd.createdAt?.toMillis?.();
        if (!requestTime || Date.now() - requestTime > 30 * 60 * 1000) {
          await ref.update({ status: 'failed', error: 'Comando expirado ou sem data. Solicite novamente.', doneAt: admin.firestore.FieldValue.serverTimestamp() });
          continue;
        }
        await ref.update({ status: 'processing', startedAt: admin.firestore.FieldValue.serverTimestamp() });
        const { sock, sessionId } = pickConnectedSock(cmd.sessionId);
        if (!sock) throw new Error('Nenhuma sessão do WhatsApp conectada.');

        if (cmd.action === 'registerChannel') {
          const channelId = await saveVerifiedChannel(sessionId, sock, cmd.channelReference);
          await ref.update({ status: 'done', channelId, doneAt: admin.firestore.FieldValue.serverTimestamp() });
        } else if (!WA_GROUP_COMMANDS_ENABLED) {
          throw new Error('Comandos de criação/saída desativados; apenas cadastro seguro de canais está disponível.');
        } else if (cmd.action === 'createGroup') {
          const name = (cmd.name || '').toString().trim().slice(0, 100);
          if (!name) throw new Error('Informe o nome do grupo, comunidade ou canal.');
          const participants = Array.isArray(cmd.participants) ? cmd.participants.map(normalizeJid).filter(Boolean) : [];
          const type = cmd.type || 'group';
          let gid = null;
          let inviteLink = null;
          let linkWarning = null;
          if (type === 'community') {
            if (typeof sock.communityCreate !== 'function') throw new Error('A versão de Baileys instalada não suporta criar comunidades. Nenhuma ação foi realizada.');
            const created = await sock.communityCreate(name, String(cmd.description || ''));
            gid = created?.id || null;
          } else if (type === 'channel') {
            if (typeof sock.newsletterCreate !== 'function') throw new Error('A versão de Baileys instalada não suporta criar canais. Nenhuma ação foi realizada.');
            const created = await sock.newsletterCreate(name, String(cmd.description || ''));
            gid = created?.id || null;
          } else if (type === 'group') {
            const created = await sock.groupCreate(name, participants);
            gid = created?.id || null;
            if (gid && cmd.description) {
              try { await sock.groupUpdateDescription(gid, String(cmd.description)); }
              catch (e) { linkWarning = 'Grupo criado, mas não foi possível adicionar a descrição.'; }
            }
            if (gid && cmd.parentCommunityJid) {
              if (typeof sock.communityLinkGroup !== 'function') {
                linkWarning = 'Grupo criado, mas esta versão do WhatsApp Web não permite vinculá-lo à comunidade.';
              } else {
                try { await sock.communityLinkGroup(gid, String(cmd.parentCommunityJid)); }
                catch (e) { linkWarning = 'Grupo criado, mas não foi possível vinculá-lo à comunidade.'; }
              }
            }
          } else {
            throw new Error('Tipo de criação desconhecido: ' + type);
          }
          if (!gid) throw new Error('WhatsApp não confirmou o identificador do item criado.');
          if (type === 'group') {
            try { const code = await sock.groupInviteCode(gid); inviteLink = code ? `https://chat.whatsapp.com/${code}` : null; } catch (e) {}
          }
          if (type === 'channel') {
            // Canais criados não entram em waGroups. Somente habilitar após validar role admin.
            await saveVerifiedChannel(sessionId, sock, String(gid));
          }
          await ref.update({
            status: 'done', groupId: gid, inviteLink, warning: linkWarning,
            doneAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          if (type !== 'channel') await syncGroups(sessionId, sock);
          console.log(`✅ [Comando] ${type} criado no WhatsApp: ${gid}`);
        } else if (cmd.action === 'leaveGroup') {
          const gid = cmd.groupId;
          if (!gid) throw new Error('groupId ausente');
          if (!String(gid).endsWith('@g.us')) throw new Error('Identificador de grupo inválido.');
          // Erros devem ficar visíveis no waCommands e não virar sucesso falso.
          await sock.groupLeave(gid);
          await db.collection('users').doc(USER_UID).collection('waGroups').doc(`${sessionId}_${gid}`).delete();
          await ref.update({ status: 'done', doneAt: admin.firestore.FieldValue.serverTimestamp() });
          console.log(`✅ [Comando] Saiu do grupo: ${gid}`);
        } else {
          await ref.update({ status: 'failed', error: 'Ação desconhecida: ' + cmd.action });
        }
      } catch (e) {
        try { await ref.update({ status: 'failed', error: (e && e.message) || String(e), doneAt: admin.firestore.FieldValue.serverTimestamp() }); } catch (e2) {}
        console.error('⚠️ [Comando] Falhou:', (e && e.message) || e);
      }
    }
  } catch (err) {
    console.error('⚠️ Erro no processamento de comandos:', err.message);
  } finally {
    isProcessingCommands = false;
  }
}

// ------------------------------------------------------------------------------
// 8. TEMPORIZADORES (LOOPS)
// ------------------------------------------------------------------------------

async function main() {
  // Validação de acesso antes de alterar sessões ou executar campanhas.
  await db.collection('users').doc(USER_UID).get();
  console.log('✅ Firestore acessível. Confira sua conta pelo npm run doctor.');

  // 1. Migração se houver sessão legada
  await checkAndMigrateLegacySession();

  // 2. Iniciar gerenciador de sessões (carrega auth/ e escuta waSessions)
  startSessionsManager();

  // Sinal a cada 60 s: mesmo se o Termux morrer, o painel detecta em ~3 min.
  await updateWorkerHealth();
  setInterval(updateWorkerHealth, 60 * 1000);

  // 3. Sincronização periódica de grupos (a cada X minutos)
  const syncIntervalMs = (parseInt(process.env.SYNC_GROUPS_INTERVAL_MIN) || 5) * 60 * 1000;
  setInterval(syncAllGroups, syncIntervalMs);

  // 4. Geração e consumo de filas só após habilitação explícita.
  if (WA_SEND_ENABLED) {
    const campaignIntervalMs = (parseInt(process.env.CAMPAIGN_CYCLE_INTERVAL_MIN) || 1) * 60 * 1000;
    setInterval(runCampaignCycle, campaignIntervalMs);
    runCampaignCycle();
    setInterval(processSendQueue, 15 * 1000);
  }

  // 5. Registrar um canal é seguro; criar/sair de grupos exige autorização explícita.
  setInterval(processCommands, 8 * 1000);
  processCommands();
}

main().catch((err) => {
  console.error('❌ Erro fatal no worker:', err.message || err);
  process.exitCode = 1;
});
