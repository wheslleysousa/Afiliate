const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeChannelId, parseChannelReference, canPublishToChannel, getChannelId, listChannels } = require('../channelSupport');

test('accepts only newsletter JIDs and rejects group/user/invalid ids', () => {
  assert.equal(normalizeChannelId('120363123456789012@newsletter'), '120363123456789012@newsletter');
  assert.equal(normalizeChannelId('120363123456789012@g.us'), null);
  assert.equal(normalizeChannelId('user@s.whatsapp.net'), null);
  assert.equal(normalizeChannelId('../../abc@newsletter'), null);
});
test('accepts WhatsApp channel links but not lookalike domains', () => {
  assert.deepEqual(parseChannelReference('https://whatsapp.com/channel/0029Va123456abc'), { type: 'invite', value: '0029Va123456abc' });
  assert.equal(parseChannelReference('https://whatsapp.com.evil.tld/channel/0029Va123456abc'), null);
  assert.equal(parseChannelReference('javascript:alert(1)'), null);
});
test('does not treat follower or unknown as publisher', () => {
  assert.equal(canPublishToChannel({ viewer_metadata: { role: 'SUBSCRIBER' } }), false);
  assert.equal(canPublishToChannel({}), false);
  assert.equal(canPublishToChannel({ viewer_metadata: { role: 'ADMIN' } }), true);
  assert.equal(canPublishToChannel({ viewer_metadata: { role: 'OWNER' } }), true);
  assert.equal(getChannelId({ id: '120363123456789012@newsletter' }), '120363123456789012@newsletter');
  assert.equal(getChannelId({ id: '120363123456789012' }), '120363123456789012@newsletter');
});

test('lists followed and administered channels from maps or arrays', () => {
  const admin = { id: '120363123456789012@newsletter', viewer_metadata: { role: 'ADMIN' } };
  const following = { id: '120363123456789013@newsletter', viewer_metadata: { role: 'SUBSCRIBER' } };
  assert.deepEqual(listChannels({ [admin.id]: admin, [following.id]: following }), [admin, following]);
  assert.deepEqual(listChannels({ newsletters: [admin, following] }), [admin, following]);
  assert.deepEqual(listChannels([admin, following]), [admin, following]);
  assert.equal(canPublishToChannel(following), false);
  assert.deepEqual(listChannels({ nonsense: { id: 'invalid@g.us' } }), []);
});
