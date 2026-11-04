'use strict';

/**
 * WhatsApp Channels (newsletters) have distinct identifiers from groups.
 * Never infer posting rights merely from following a channel.
 */
function normalizeChannelId(value) {
  const jid = String(value || '').trim();
  return /^[a-zA-Z0-9_-]{6,80}@newsletter$/.test(jid) ? jid : null;
}

function parseChannelReference(value) {
  const input = String(value || '').trim();
  const jid = normalizeChannelId(input);
  if (jid) return { type: 'jid', value: jid };
  try {
    const url = new URL(input);
    if (url.protocol !== 'https:' || !['whatsapp.com', 'www.whatsapp.com'].includes(url.hostname)) return null;
    const match = url.pathname.match(/^\/channel\/([A-Za-z0-9_-]{6,100})\/?$/);
    return match ? { type: 'invite', value: match[1] } : null;
  } catch {
    return null;
  }
}

// A lista do Baileys pode vir como array, mapa por JID ou objeto embrulhado.
function listChannels(response) {
  const source = Array.isArray(response) ? response :
    (response?.newsletters || response?.channels || response?.data || response);
  const entries = Array.isArray(source) ? source : Object.values(source || {});
  return entries.filter(item => item && typeof item === 'object' && getChannelId(item));
}

function channelRole(metadata) {
  const viewer = metadata?.viewer_metadata || metadata?.viewerMetadata || {};
  return String(viewer.role || metadata?.role || '').trim().toUpperCase();
}

function canPublishToChannel(metadata) {
  return ['ADMIN', 'OWNER', 'CREATOR', 'SUPERADMIN'].includes(channelRole(metadata));
}

function getChannelId(metadata) {
  const raw = String(metadata?.id || metadata?.jid || metadata?.newsletterId || '').trim();
  if (/^[0-9]{6,80}$/.test(raw)) return raw + '@newsletter';
  return normalizeChannelId(raw);
}

module.exports = { normalizeChannelId, parseChannelReference, channelRole, canPublishToChannel, getChannelId, listChannels };
