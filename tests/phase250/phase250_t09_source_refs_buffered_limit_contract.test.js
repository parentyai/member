'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');

test('phase250: sourceRefs buffered limit prevents post-filter drop under limit', async () => {
  const prevFlag = process.env.ENABLE_CITY_PACK_SOURCE_REFS_BUFFERED_LIMIT_V1;
  const prevMultiplier = process.env.CITY_PACK_SOURCE_REFS_BUFFER_MULTIPLIER;
  const prevScanMax = process.env.CITY_PACK_SOURCE_REFS_SCAN_MAX;
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    process.env.CITY_PACK_SOURCE_REFS_BUFFER_MULTIPLIER = '5';
    process.env.CITY_PACK_SOURCE_REFS_SCAN_MAX = '1000';
    for (let i = 1; i <= 5; i += 1) {
      await sourceRefsRepo.createSourceRef({
        id: `sr_buffer_other_${i}`,
        url: `https://example.com/other/${i}`,
        status: 'needs_review',
        regionKey: 'tx::austin',
        schoolType: 'public',
        eduScope: 'calendar'
      });
    }
    await sourceRefsRepo.createSourceRef({
      id: 'sr_buffer_target_001',
      url: 'https://example.com/target',
      status: 'needs_review',
      regionKey: 'ny::new-york',
      schoolType: 'public',
      eduScope: 'calendar'
    });

    process.env.ENABLE_CITY_PACK_SOURCE_REFS_BUFFERED_LIMIT_V1 = '0';
    const withoutBuffer = await sourceRefsRepo.listSourceRefs({
      status: 'needs_review',
      regionKey: 'ny::new-york',
      limit: 2
    });
    assert.strictEqual(withoutBuffer.length, 0);

    process.env.ENABLE_CITY_PACK_SOURCE_REFS_BUFFERED_LIMIT_V1 = '1';
    const withBuffer = await sourceRefsRepo.listSourceRefs({
      status: 'needs_review',
      regionKey: 'ny::new-york',
      limit: 2
    });
    assert.strictEqual(withBuffer.length, 1);
    assert.strictEqual(withBuffer[0].id, 'sr_buffer_target_001');
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevFlag === undefined) delete process.env.ENABLE_CITY_PACK_SOURCE_REFS_BUFFERED_LIMIT_V1;
    else process.env.ENABLE_CITY_PACK_SOURCE_REFS_BUFFERED_LIMIT_V1 = prevFlag;
    if (prevMultiplier === undefined) delete process.env.CITY_PACK_SOURCE_REFS_BUFFER_MULTIPLIER;
    else process.env.CITY_PACK_SOURCE_REFS_BUFFER_MULTIPLIER = prevMultiplier;
    if (prevScanMax === undefined) delete process.env.CITY_PACK_SOURCE_REFS_SCAN_MAX;
    else process.env.CITY_PACK_SOURCE_REFS_SCAN_MAX = prevScanMax;
  }
});
