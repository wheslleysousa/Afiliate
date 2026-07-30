/**
 * ==============================================================================
 * WORKER DE AUTOMACÃO WHATSAPP DA PLATAFORMA AFILIATE
 * ==============================================================================
 * AVISO IMPORTANTE DE SEGURANÇA E TERMOS DE USO:
 * 1. Este worker utiliza a biblioteca não-oficial @whiskeysockets/baileys.
 * 2. O uso de automações não oficiais viola os Termos de Serviço do WhatsApp.
 * 3. RISCO DE BANIMENTO: Há risco real de bloqueio definitivo do número de telefone.
 * 4. RECOMENDAÇÃO ABSOLUTA: Use SEMPRE um NÚMERO EXCLUSIVO E DEDICADO para disparos,
 *    NUNCA utilize seu número pessoal ou principal de contatos/trabalho!
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

const AUTH_DIR = process.env.AUTH_DIR || './auth';
const FIRESTORE_DATABASE_ID = process.env.FIRESTORE_DATABASE_ID || '';

// Inicializar Firebase Admin SDK com suporte a Banco de Dados Nomeado
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

  // Corrigido: Usar getFirestore(app, databaseId) para bancos nomeados no Firestore
  return FIRESTORE_DATABASE_ID ? getFirestore(app, FIRESTORE_DATABASE_ID) : getFirestore(app);
}

const db = initFirebase();
console.log(`\n🚀 Worker Afiliate iniciado para o Usuário UID: ${USER_UID}`);

// Globais & Travas de Concorrência
let sock = null;
let isConnecting = false;
let isRunningCampaign = false;
let isProcessingQueue = false;
let commandListenerUnsub = null;

// ------------------------------------------------------------------------------
// HELPER PARA ATUALIZAR STATUS DA SESSÃO NO FIRESTORE (users/{uid}/waSession/current)
// ------------------------------------------------------------------------------

async function updateSessionDoc(data) {
  try {
    const docRef = db.collection('users').doc(USER_UID).collection('waSession').doc('current');
    await docRef.set(
      {
        ...data,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error('⚠️ Erro ao atualizar waSession/current no Firestore:', err.message);
  }
}

// Escutar comandos enviados pela interface web (ex: pedido de logout/desconexão)
function listenToSessionCommands() {
  if (commandListenerUnsub) return;
  const docRef = db.collection('users').doc(USER_UID).collection('waSession').doc('current');
  commandListenerUnsub = docRef.onSnapshot(
    (snap) => {
      if (snap.exists) {
        const data = snap.data();
        if (data.requestedLogout) {
          console.log('🚪 Solicitado logout do WhatsApp via aplicativo! Desconectando...');
          if (sock) {
            try {
              sock.logout();
            } catch (e) {
              console.error('Erro ao chamar sock.logout():', e.message);
            }
          }
          if (fs.existsSync(AUTH_DIR)) {
            try {
              fs.rmSync(AUTH_DIR, { recursive: true, force: true });
            } catch (rmErr) {
              console.error('Erro ao limpar pasta de auth:', rmErr.message);
            }
          }
          updateSessionDoc({
            status: 'disconnected',
            qr: null,
            phoneNumber: null,
            name: null,
            requestedLogout: false,
          });
        }
      }
    },
    (err) => {
      console.error('⚠️ Erro no listener de comandos de sessão do WhatsApp:', err.message);
    }
  );
}

// ------------------------------------------------------------------------------
// 2. LÓGICA DE CONEXÃO COM O BAILEYS (WHATSAPP)
// ------------------------------------------------------------------------------

async function connectToWhatsApp() {
  if (isConnecting) return;
  isConnecting = true;

  try {
    await updateSessionDoc({
      status: 'connecting',
      qr: null,
    });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version, isLatest } = await fetchLatestBaileysVersion();

    console.log(`\n📱 Iniciando WhatsApp Baileys (v${version.join('.')}, isLatest: ${isLatest})...`);

    sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      auth: state,
      printQRInTerminal: false,
      browser: ['Afiliate Worker', 'Chrome', '1.0.0'],
      syncFullHistory: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        console.log('\n================================================================');
        console.log('📲 ESCANEIE O QR CODE ABAIXO NO SEU WHATSAPP DEDICADO OU NO APP:');
        console.log('================================================================\n');
        qrcode.generate(qr, { small: true });
        console.log('\nAguardando leitura do QR Code...\n');

        // Transmitir QR code bruto para o documento no Firestore
        await updateSessionDoc({
          status: 'qr',
          qr: qr,
        });
      }

      if (connection === 'connecting') {
        await updateSessionDoc({
          status: 'connecting',
        });
      }

      if (connection === 'close') {
        isConnecting = false;
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        console.log(`⚠️ Conexão com o WhatsApp encerrada. Código: ${statusCode}. Reconectando: ${shouldReconnect}`);

        if (statusCode === DisconnectReason.loggedOut) {
          console.error('❌ O número foi desconectado/deslogado. Limpando sessão e pedindo novo QR Code...');
          if (fs.existsSync(AUTH_DIR)) {
            fs.rmSync(AUTH_DIR, { recursive: true, force: true });
          }
          await updateSessionDoc({
            status: 'disconnected',
            qr: null,
            phoneNumber: null,
            name: null,
          });
        } else {
          await updateSessionDoc({
            status: shouldReconnect ? 'connecting' : 'disconnected',
            qr: null,
          });
        }

        if (shouldReconnect) {
          setTimeout(connectToWhatsApp, 5000);
        }
      } else if (connection === 'open') {
        isConnecting = false;
        const userJid = sock.user?.id || '';
        const phoneNum = userJid ? userJid.split(':')[0].split('@')[0] : null;
        const name = sock.user?.name || sock.user?.notify || null;

        console.log(`\n✅ CONECTADO COM SUCESSO AO WHATSAPP! JID: ${userJid}`);
        console.log('----------------------------------------------------------------\n');

        await updateSessionDoc({
          status: 'connected',
          qr: null,
          phoneNumber: phoneNum,
          name: name,
          lastConnectedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Executar sincronização inicial de grupos
        await syncGroups();

        // Iniciar loop periódico de execução
        startWorkerLoops();
      }
    });
  } catch (err) {
    isConnecting = false;
    console.error('❌ Erro durante a inicialização do Baileys:', err);
    await updateSessionDoc({
      status: 'disconnected',
      qr: null,
    });
    setTimeout(connectToWhatsApp, 10000);
  }
}

// ------------------------------------------------------------------------------
// 3. SINCRONIZAÇÃO DE GRUPOS (users/{uid}/waGroups)
// ------------------------------------------------------------------------------

async function syncGroups() {
  if (!sock) return;
  console.log('🔄 Sincronizando grupos do WhatsApp com o Firestore...');

  try {
    const groupsMap = await sock.groupFetchAllParticipating();
    const groupList = Object.values(groupsMap);

    console.log(`📋 ${groupList.length} grupo(s) detectado(s). Atualizando Firestore...`);

    const botJid = sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';

    for (const group of groupList) {
      if (!group.id.endsWith('@g.us')) continue;

      // Pegar contagem de participantes (apenas contagem agregada para LGPD)
      const participants = group.participants || [];
      const participantsCount = participants.length;

      // Verificar se o bot é administrador
      const isBotAdmin = participants.some((p) => {
        const pJid = p.id ? p.id.split(':')[0] + '@s.whatsapp.net' : '';
        return pJid === botJid && (p.admin === 'admin' || p.admin === 'superadmin');
      });

      // Tentar buscar a foto do grupo
      let photoUrl = null;
      try {
        photoUrl = await sock.profilePictureUrl(group.id, 'image');
      } catch (e) {
        photoUrl = null;
      }

      const groupDocData = {
        groupId: group.id,
        name: group.subject || 'Grupo sem nome',
        photoUrl: photoUrl || null,
        size: participantsCount,
        participantsCount: participantsCount,
        description: group.desc || null,
        isAdmin: isBotAdmin,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      // Gravar na subcoleção do usuário no Firestore
      await db
        .collection('users')
        .doc(USER_UID)
        .collection('waGroups')
        .doc(group.id)
        .set(groupDocData, { merge: true });
    }

    console.log('✅ Sincronização de grupos concluída com sucesso!');
  } catch (err) {
    console.error('⚠️ Erro ao sincronizar grupos:', err.message);
  }
}

// ------------------------------------------------------------------------------
// 4. GERADOR DE LINK DE AFILIADO POR PLATAFORMA
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
    if (plat) {
      console.warn(`⚠️ ID de afiliado não configurado para a plataforma "${platform}". Usando link original sem comissão.`);
    }
    return rawUrl;
  }

  // Anexar parâmetro de rastreamento na URL
  try {
    const urlObj = new URL(rawUrl);
    urlObj.searchParams.set(tagParam, tagValue);
    return urlObj.toString();
  } catch (e) {
    const separator = rawUrl.includes('?') ? '&' : '?';
    return `${rawUrl}${separator}${tagParam}=${encodeURIComponent(tagValue)}`;
  }
}

// Formatar Copy do Produto com o Link de Afiliado
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

// ------------------------------------------------------------------------------
// 5. CHECAGEM DE HORÁRIO ATIVO (HH:mm em minutos inteiros)
// ------------------------------------------------------------------------------

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
    const dayOfWeek = localDate.getDay(); // 0 = Dom, 6 = Sáb

    if (Array.isArray(schedule.days) && schedule.days.length > 0) {
      if (!schedule.days.includes(dayOfWeek)) {
        return false;
      }
    }

    // Checar intervalo de hora usando comparação de minutos inteiros
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
          // Atravessa meia-noite (ex: 22:00 até 06:00)
          if (currentTotalMin < startMin && currentTotalMin > endMin) {
            return false;
          }
        }
      }
    }

    return true;
  } catch (err) {
    console.error('Erro ao verificar agendamento da campanha:', err);
    return true;
  }
}

// ------------------------------------------------------------------------------
// 6. MOTOR DE DISPARO E PROCESSAMENTO DE CAMPANHAS
// ------------------------------------------------------------------------------

async function runCampaignCycle() {
  if (!sock) return;

  // Trava de concorrência
  if (isRunningCampaign) {
    return;
  }
  isRunningCampaign = true;

  try {
    console.log('\n⚙️ Executando ciclo de campanhas de disparo...');

    // 1. Carregar chaves/tags de afiliados do usuário uma vez por ciclo
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

    // 2. Buscar campanhas ativas
    const campaignsSnap = await db
      .collection('users')
      .doc(USER_UID)
      .collection('campaigns')
      .where('enabled', '==', true)
      .get();

    if (campaignsSnap.empty) {
      console.log('ℹ️ Nenhuma campanha ativa encontrada.');
      return;
    }

    // 3. Buscar histórico dos últimos 24h para anti-duplicação
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

    // 4. Processar cada campanha ativa
    for (const campaignDoc of campaignsSnap.docs) {
      const campaign = { id: campaignDoc.id, ...campaignDoc.data() };

      // CHECAGEM DA CADÊNCIA DA CAMPANHA (windowMinutes)
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
            console.log(`⏳ Campanha "${campaign.name}" está dentro da janela de espera (${remainMin} min restantes). Pulando.`);
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

      console.log(`🎯 Processando campanha ativa: "${campaign.name}"`);

      // 5. Buscar produtos minerados do usuário
      const minedSnap = await db
        .collection('users')
        .doc(USER_UID)
        .collection('minedProducts')
        .get();

      if (minedSnap.empty) {
        console.log('ℹ️ Nenhum produto minerado no catálogo.');
        continue;
      }

      const minedRefs = minedSnap.docs.map((d) => d.data());

      // Buscar documentos completos em /products
      const candidateProducts = [];
      for (const ref of minedRefs) {
        if (!ref.productId) continue;
        const pDoc = await db.collection('products').doc(ref.productId).get();
        if (pDoc.exists) {
          candidateProducts.push({ id: pDoc.id, ...pDoc.data() });
        }
      }

      // Aplicar filtros da campanha
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

      // Ordenar conforme o objetivo da campanha
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

      // Selecionar até a quantidade configurada
      const qty = campaign.quantity || 30;
      const selectedProducts = filtered.slice(0, qty);

      if (selectedProducts.length === 0) {
        console.log(`ℹ️ Nenhuns novos produtos para enfileirar para a campanha "${campaign.name}".`);
        continue;
      }

      console.log(`📦 ${selectedProducts.length} produto(s) elegíveis selecionado(s) para a campanha "${campaign.name}".`);

      // Montar itens e agendar em sendQueue com Pacing
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

        // Montar link de afiliado e copy personalizada
        const rawLink = product.original_link || product.affiliate_link || '';
        const affiliateLink = buildAffiliateLink(rawLink, product.platform, apiKeys);
        const copyText = formatProductCopy(product, affiliateLink);

        // Agendar para cada grupo alvo
        for (const groupId of campaign.targetGroupIds) {
          const queueItemData = {
            productId: product.id,
            productTitle: product.title || 'Oferta Imperdível',
            groupId: groupId,
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

      // Atualizar lastRunAt na campanha
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
// 7. CONSUMIDOR DA FILA DE ENVIOS (sendQueue)
// ------------------------------------------------------------------------------

async function processSendQueue() {
  if (!sock) return;

  // Trava de concorrência
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    const nowTimestamp = admin.firestore.Timestamp.now();

    // Buscar itens pendentes onde scheduledAt <= agora
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

      try {
        console.log(`📤 Enviando oferta "${item.productTitle}" para o grupo ${item.groupId}...`);

        // Simular presença "Digitando..." (composing) por 1.5 a 3.5 segundos (Recurso Anti-ban)
        await sock.sendPresenceUpdate('composing', item.groupId);
        const typingDelay = Math.floor(Math.random() * 2000) + 1500;
        await new Promise((resolve) => setTimeout(resolve, typingDelay));

        // Enviar mensagem no WhatsApp com Imagem ou Texto
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

        // Marcar como 'sent' no sendQueue
        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendQueue')
          .doc(item.id)
          .update({
            status: 'sent',
            sentAt: admin.firestore.FieldValue.serverTimestamp(),
          });

        // Registrar no histórico sendLog
        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendLog')
          .add({
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

        console.log(`✅ Disparo concluído com sucesso para ${item.groupId}!`);

        // Pausa aleatória de segurança entre envios de grupos (3 a 8 segundos)
        const interMessageDelay = Math.floor(Math.random() * 5000) + 3000;
        await new Promise((resolve) => setTimeout(resolve, interMessageDelay));
      } catch (sendErr) {
        console.error(`❌ Erro ao enviar para o grupo ${item.groupId}:`, sendErr.message);

        // Marcar falha no sendQueue
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

        // Registrar falha no sendLog
        await db
          .collection('users')
          .doc(USER_UID)
          .collection('sendLog')
          .add({
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
// 8. INICIALIZAÇÃO DE TEMPORIZADORES (LOOPS)
// ------------------------------------------------------------------------------

function startWorkerLoops() {
  console.log('⏱️ Agendando tarefas do worker...');

  // 1. Sincronização periódica de grupos (a cada X minutos)
  const syncIntervalMs = (parseInt(process.env.SYNC_GROUPS_INTERVAL_MIN) || 15) * 60 * 1000;
  setInterval(syncGroups, syncIntervalMs);

  // 2. Ciclo de geração de campanhas (a cada X minutos)
  const campaignIntervalMs = (parseInt(process.env.CAMPAIGN_CYCLE_INTERVAL_MIN) || 1) * 60 * 1000;
  setInterval(runCampaignCycle, campaignIntervalMs);
  runCampaignCycle(); // Executar primeiro ciclo imediatamente

  // 3. Consumidor de fila em tempo real (a cada 15 segundos)
  setInterval(processSendQueue, 15 * 1000);
}

// Iniciar escuta de comandos no Firestore e conexão com WhatsApp
listenToSessionCommands();
connectToWhatsApp();
