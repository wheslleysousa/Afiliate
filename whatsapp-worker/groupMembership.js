'use strict';

// Only trust an explicitly confirmed member identity. WhatsApp uses both
// phone-number (@s.whatsapp.net) and LID (@lid) JIDs, sometimes with a device.
function normalizedJid(input) {
  const value = String(input || '').trim().toLowerCase();
  if (/^\d{8,20}$/.test(value)) return value + '@s.whatsapp.net';
  const match = value.match(/^(\d{6,30})(?::\d+)?@(s\.whatsapp\.net|lid)$/);
  return match ? match[1] + '@' + match[2] : null;
}

function selfJids(sock, authState) {
  const creds = authState?.creds?.me || sock?.authState?.creds?.me || {};
  const values = [
    sock?.user?.id, sock?.user?.lid, sock?.user?.phoneNumber,
    creds.id, creds.lid, creds.phoneNumber,
  ];
  return new Set(values.map(normalizedJid).filter(Boolean));
}

function checkGroupMembership(group, sock, authState) {
  const participants = group?.participants;
  if (!Array.isArray(participants) || !participants.length) {
    return { member: false, verified: false, reason: 'participants_unavailable' };
  }
  const self = selfJids(sock, authState);
  if (!self.size) return { member: false, verified: false, reason: 'identity_unavailable' };
  const ids = participants.flatMap(person => [
    person?.id, person?.jid, person?.phoneNumber, person?.phoneNumberJid, person?.lid,
  ]).map(normalizedJid).filter(Boolean);
  if (ids.some(id => self.has(id))) return { member: true, verified: true, reason: null };
  // Can't compare private @lid participants to an unknown self LID; fail
  // closed without claiming the account definitely left the group.
  if (ids.some(id => id.endsWith('@lid')) &&
      ![...self].some(id => id.endsWith('@lid'))) {
    return { member: false, verified: false, reason: 'self_lid_unknown' };
  }
  return { member: false, verified: true, reason: 'self_not_participant' };
}

module.exports = { normalizedJid, selfJids, checkGroupMembership };
