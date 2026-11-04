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

const { checkGroupMembership } = require('../groupMembership');

test('keeps group inactive when current account is absent', () => {
  const me = { user: { id: '1234567890:1@s.whatsapp.net' } };
  assert.equal(checkGroupMembership({ participants: [{ id: '2345678901@s.whatsapp.net' }] }, me).member, false);
  assert.equal(checkGroupMembership({ participants: [{ id: '1234567890@s.whatsapp.net' }] }, me).member, true);
  assert.equal(checkGroupMembership({ participants: [] }, me).verified, false);
});

test('supports own LID identity without guessing other LIDs', () => {
  const me = { user: { id: '1234567890@s.whatsapp.net' } };
  const group = { participants: [{ id: '2222222222@lid' }] };
  assert.equal(checkGroupMembership(group, me).member, false);
  assert.equal(checkGroupMembership(group, me, { creds: { me: { lid: '2222222222@lid' } } }).member, true);
});

const { getProductImageUrl, createDispatchPayload, normalizeImageUrl } = require('../channelMedia');

test('canal opt-in monta imagem e legenda na mesma postagem', () => {
  const msg = createDispatchPayload({
    imageUrl: 'https://cdn.example.com/p.jpg',
    copyText: 'Oferta com link',
    isChannel: true, channelMediaEnabled: true,
  });
  assert.equal(msg.kind, 'image');
  assert.deepEqual(msg.content.image, { url: 'https://cdn.example.com/p.jpg' });
  assert.equal(msg.content.caption, 'Oferta com link');
  assert.equal(msg.content.text, undefined);
});

test('canal com mídia ativa não substitui imagem ausente por texto', () => {
  assert.throws(() => createDispatchPayload({
    imageUrl: null, copyText: 'Oferta', isChannel: true, channelMediaEnabled: true,
  }), /Imagem HTTPS válida/);
  const textPayload = createDispatchPayload({
    imageUrl: null, copyText: 'Oferta', isChannel: true, channelMediaEnabled: false,
  });
  assert.equal(textPayload.kind, 'text');
});

test('encontra URL de imagem em formatos antigos ou novos', () => {
  assert.equal(getProductImageUrl({ images: [{ url: 'https://cdn.example.com/a.jpg' }] }),
    'https://cdn.example.com/a.jpg');
  assert.equal(getProductImageUrl({ image_url: 'https://cdn.example.com/b.jpg' }),
    'https://cdn.example.com/b.jpg');
  assert.equal(normalizeImageUrl('http://cdn.example.com/c.jpg'), null);
  assert.equal(normalizeImageUrl('https://127.0.0.1/c.jpg'), null);
});
