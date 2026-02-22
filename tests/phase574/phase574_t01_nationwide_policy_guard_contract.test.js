'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { validateCityPackSources, SOURCE_BLOCK_REASONS } = require('../../src/usecases/cityPack/validateCityPackSources');

test('phase574: nationwide policy guard blocks non federal_only policy', async () => {
  const result = await validateCityPackSources({
    sourceRefs: ['sr_1'],
    packClass: 'nationwide',
    language: 'ja',
    nationwidePolicy: 'invalid_policy',
    now: new Date('2026-02-22T00:00:00.000Z')
  }, {
    getSourceRef: async () => ({
      status: 'active',
      validUntil: '2099-01-01T00:00:00.000Z',
      sourceType: 'official',
      authorityLevel: 'federal',
      requiredLevel: 'required'
    })
  });

  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReasonCategory, SOURCE_BLOCK_REASONS.SOURCE_POLICY_BLOCKED);
  assert.ok(Array.isArray(result.policyGuardViolations));
  assert.ok(result.policyGuardViolations.some((item) => item && item.reason === 'nationwide_policy_invalid'));
});

test('phase574: activate city pack and route carry policy guard fields in audit/response payload', () => {
  const activateSrc = fs.readFileSync(path.join(process.cwd(), 'src/usecases/cityPack/activateCityPack.js'), 'utf8');
  const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/cityPacks.js'), 'utf8');

  assert.ok(activateSrc.includes('policyGuardViolations'));
  assert.ok(activateSrc.includes('language,'));
  assert.ok(routeSrc.includes('normalizedPackClass'));
  assert.ok(routeSrc.includes('normalizedLanguage'));
  assert.ok(routeSrc.includes('normalizedNationwidePolicy'));
});
