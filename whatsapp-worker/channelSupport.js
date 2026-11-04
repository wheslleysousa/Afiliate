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

function channelRole(metadata) {
  const viewer = metadata?.viewer_metadata || metadata?.viewerMetadata || {};
  return String(viewer.role || metadata?.role || '').trim().toUpperCase();
}

function canPublishToChannel(metadata) {
  return ['ADMIN', 'OWNER', 'CREATOR', 'SUPERADMIN'].includes(channelRole(metadata));
}

function getChannelId(metadata) {
  return normalizeChannelId(metadata?.id || metadata?.jid || metadata?.newsletterId);
}

module.exports = { normalizeChannelId, parseChannelReference, channelRole, canPublishToChannel, getChannelId };
