'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ensureCampaignShortLink, replaceProductUrl } = require('../campaignShortLinks');
test('cria URL curta pública mantendo destino afiliado e sem link longo na copy', async () => {
  const docs = new Map();
  const db = { collection: name => ({
    doc: id => name === 'shortLinks' ? ({
      create: async data => { if (docs.has(id)) throw Error('exists'); docs.set(id, data); },
      get: async () => ({ exists: docs.has(id), data: () => docs.get(id) })
    }) : ({ collection: () => ({ doc: () => ({
      get: async () => ({ data: () => ({ shortStyle: 'custom_random', defaultCustomPrefix: 'achados' }) })
    }) }) })
  }) };
  const product = { id: 'prod123', title: 'Oferta', platform: 'shopee' };
  const link = 'https://s.shopee.com.br/123?affiliate_id=123';
  const result = await ensureCampaignShortLink({db, uid: 'u1', product, affiliateLink: link});
  assert.match(result.shortUrl, /^https:\/\/lkrm\.site\/achados\/[a-f0-9]{14}$/);
  assert.equal(docs.get(result.docId).targetUrl, link);
  const text = replaceProductUrl('Oferta\n' + link, link, result.shortUrl);
  assert.ok(text.includes(result.shortUrl));
  assert.ok(!text.includes(link));
  assert.equal((await ensureCampaignShortLink({db, uid: 'u1', product, affiliateLink: link})).shortUrl, result.shortUrl);
});
test('copy antiga sem endereço ganha apenas o link curto', () => {
  assert.match(replaceProductUrl('Oferta especial', 'https://exemplo.com/item', 'https://lkrm.site/a'), /https:\/\/lkrm\.site\/a$/);
});
