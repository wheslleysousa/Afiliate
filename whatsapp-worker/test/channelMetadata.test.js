'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { channelPresentation } = require('../channelMetadata');
test('metadata de canal extrai informações reais sem inventar seguidores', () => {
  assert.deepEqual(channelPresentation({name:{text:'Ofertas'},subscribersCount:1200,picture:{url:'https://example.com/photo.jpg'}}),
    {name:'Ofertas',description:'',followersCount:1200,photoUrl:'https://example.com/photo.jpg'});
  assert.equal(channelPresentation({name:'Sem métrica'}).followersCount,null);
  assert.equal(channelPresentation({picture:'javascript:alert(1)'}).photoUrl,null);
});
