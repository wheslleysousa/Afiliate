'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getCurrentWaWebVersion } = require('../waVersion');

test('accepts a live WA Web version and returns all parts', async () => {
  assert.deepEqual(
    await getCurrentWaWebVersion(async () => ({ version: [2, 3000, 1049999999], isLatest: true })),
    [2, 3000, 1049999999]
  );
});

test('blocks pairing if the live version cannot be verified', async () => {
  await assert.rejects(
    getCurrentWaWebVersion(async () => ({ version: [2, 3000, 1043857760], isLatest: false })),
    /versão atual/
  );
  await assert.rejects(
    getCurrentWaWebVersion(async () => ({ version: [2, 3000], isLatest: true })),
    /versão atual/
  );
  await assert.rejects(
    getCurrentWaWebVersion(async () => { throw new Error('sem rede'); }),
    /sem rede/
  );
});

test('fails closed for obsolete or missing fetch function', async () => {
  await assert.rejects(getCurrentWaWebVersion(undefined), /fetchLatestWaWebVersion/);
});
