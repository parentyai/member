'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { composeCityAndNationwidePacks } = require('../../src/usecases/nationwidePack/composeCityAndNationwidePacks');

test('phase575: composition orders regional first and filters nationwide by federal_only', async () => {
  const payload = await composeCityAndNationwidePacks({
    regionKey: 'tx::austin',
    language: 'ja',
    limit: 20
  }, {
    listCityPacks: async () => ([
      {
        id: 'cp_regional_match',
        name: 'Regional Match',
        status: 'active',
        packClass: 'regional',
        language: 'ja',
        targetingRules: [{ field: 'regionKey', op: 'in', value: ['tx::austin'], effect: 'include' }],
        updatedAt: '2026-02-20T00:00:00.000Z'
      },
      {
        id: 'cp_regional_other',
        name: 'Regional Other',
        status: 'active',
        packClass: 'regional',
        language: 'ja',
        targetingRules: [{ field: 'regionKey', op: 'in', value: ['wa::seattle'], effect: 'include' }],
        updatedAt: '2026-02-19T00:00:00.000Z'
      },
      {
        id: 'cp_nationwide_ok',
        name: 'Nationwide Federal',
        status: 'active',
        packClass: 'nationwide',
        language: 'ja',
        nationwidePolicy: 'federal_only',
        updatedAt: '2026-02-18T00:00:00.000Z'
      },
      {
        id: 'cp_nationwide_skip',
        name: 'Nationwide Skip',
        status: 'active',
        packClass: 'nationwide',
        language: 'ja',
        nationwidePolicy: 'other',
        updatedAt: '2026-02-17T00:00:00.000Z'
      }
    ])
  });

  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.items.length, 2);
  assert.strictEqual(payload.items[0].cityPackId, 'cp_regional_match');
  assert.strictEqual(payload.items[1].cityPackId, 'cp_nationwide_ok');
  assert.ok(payload.items.every((item) => item.language === 'ja'));
});

test('phase575: city pack composition route and index wiring exist', () => {
  const routeSrc = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/cityPacks.js'), 'utf8');
  const indexSrc = fs.readFileSync(path.join(process.cwd(), 'src/index.js'), 'utf8');

  assert.ok(routeSrc.includes("pathname === '/api/admin/city-packs/composition'"));
  assert.ok(routeSrc.includes("action: 'city_pack.composition.view'"));
  assert.ok(indexSrc.includes("pathname === '/api/admin/city-packs/composition'"));
});
