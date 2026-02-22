'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { validateCityPackSources, SOURCE_BLOCK_REASONS } = require('../../src/usecases/cityPack/validateCityPackSources');

test('phase373: nationwide city pack enforces federal official source policy', async () => {
  const refs = new Map([
    ['sr_ok', {
      status: 'active',
      validUntil: '2099-01-01T00:00:00.000Z',
      sourceType: 'official',
      authorityLevel: 'federal',
      requiredLevel: 'required'
    }],
    ['sr_bad_type', {
      status: 'active',
      validUntil: '2099-01-01T00:00:00.000Z',
      sourceType: 'community',
      authorityLevel: 'federal',
      requiredLevel: 'required'
    }],
    ['sr_bad_authority', {
      status: 'active',
      validUntil: '2099-01-01T00:00:00.000Z',
      sourceType: 'official',
      authorityLevel: 'state',
      requiredLevel: 'required'
    }]
  ]);

  const blocked = await validateCityPackSources({
    sourceRefs: ['sr_ok', 'sr_bad_type', 'sr_bad_authority'],
    packClass: 'nationwide',
    now: new Date('2026-03-01T00:00:00.000Z')
  }, {
    getSourceRef: async (sourceRefId) => refs.get(sourceRefId) || null
  });
  assert.strictEqual(blocked.ok, false);
  assert.strictEqual(blocked.blockedReasonCategory, SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED);
  assert.ok(blocked.policyInvalidSourceRefs.some((item) => item.sourceRefId === 'sr_bad_type'));
  assert.ok(blocked.policyInvalidSourceRefs.some((item) => item.sourceRefId === 'sr_bad_authority'));

  const regional = await validateCityPackSources({
    sourceRefs: ['sr_ok', 'sr_bad_type'],
    packClass: 'regional',
    now: new Date('2026-03-01T00:00:00.000Z')
  }, {
    getSourceRef: async (sourceRefId) => refs.get(sourceRefId) || null
  });
  assert.strictEqual(regional.ok, true);
});
