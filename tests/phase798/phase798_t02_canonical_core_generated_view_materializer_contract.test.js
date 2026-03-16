'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  materializeGeneratedViewRecordFromEvent
} = require('../../src/domain/data/canonicalCoreGeneratedViewMapping');

test('phase798: generated_view materializer normalizes city_pack canonical payload when required fields exist', () => {
  const result = materializeGeneratedViewRecordFromEvent({
    objectType: 'generated_view',
    effectiveFrom: '2026-03-16T00:00:00.000Z',
    effectiveTo: null,
    materializationHints: {
      targetTables: ['generated_view']
    },
    canonicalPayload: {
      viewType: 'city_pack',
      canonicalKey: 'city_pack:cp_1:ja',
      viewKey: 'city_pack:cp_1',
      locale: 'ja',
      countryCode: 'US',
      scopeKey: 'tx::austin',
      title: 'Austin Pack',
      authorityFloor: 'T4',
      bindingLevel: 'informative',
      freshnessSlaDays: 120,
      renderPayload: {
        modules: ['schools']
      },
      fromObjectIds: ['cp_1']
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(result.row.viewType, 'city_pack');
  assert.equal(result.row.countryCode, 'US');
  assert.equal(result.row.scopeKey, 'tx::austin');
  assert.equal(result.row.freshnessSlaDays, 120);
});

test('phase798: generated_view materializer skips when countryCode is missing', () => {
  const result = materializeGeneratedViewRecordFromEvent({
    objectType: 'generated_view',
    materializationHints: {
      targetTables: ['generated_view']
    },
    canonicalPayload: {
      viewType: 'city_pack',
      canonicalKey: 'city_pack:cp_2:ja',
      viewKey: 'city_pack:cp_2',
      locale: 'ja',
      title: 'Draft Pack'
    }
  });

  assert.equal(result.skipped, true);
  assert.equal(result.reason, 'country_code_missing');
});
