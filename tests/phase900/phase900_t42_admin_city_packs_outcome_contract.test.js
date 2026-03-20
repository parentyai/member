'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResCapture() {
  const stagedHeaders = {};
  const result = { statusCode: null, headers: null, body: '' };
  return {
    setHeader(name, value) {
      if (!name) return;
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      result.headers = Object.assign({}, stagedHeaders, normalized);
    },
    end(chunk) {
      if (chunk) result.body += String(chunk);
    },
    readJson() {
      return JSON.parse(result.body || '{}');
    },
    result
  };
}

async function withCityPacksHandler(overrides, run) {
  const cityPacksRepoPath = require.resolve('../../src/repos/firestore/cityPacksRepo');
  const confirmTokenPath = require.resolve('../../src/domain/confirmToken');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const activatePath = require.resolve('../../src/usecases/cityPack/activateCityPack');
  const adapterPath = require.resolve('../../src/usecases/cityPack/singleSheetCityPackImportAdapter');
  const composePath = require.resolve('../../src/usecases/nationwidePack/composeCityAndNationwidePacks');
  const routePath = require.resolve('../../src/routes/admin/cityPacks');

  const originals = new Map();
  [
    cityPacksRepoPath,
    confirmTokenPath,
    auditPath,
    activatePath,
    adapterPath,
    composePath,
    routePath
  ].forEach((modulePath) => {
    originals.set(modulePath, require.cache[modulePath]);
  });

  require.cache[cityPacksRepoPath] = {
    id: cityPacksRepoPath,
    filename: cityPacksRepoPath,
    loaded: true,
    exports: Object.assign({
      listCityPacks: async () => ([]),
      getCityPack: async () => null,
      createCityPack: async (payload) => Object.assign({ id: 'cp_phase900_t42' }, payload || {}),
      updateCityPack: async () => ({ ok: true }),
      normalizePackClass: () => 'regional',
      normalizeLanguage: () => 'ja',
      normalizeNationwidePolicy: () => null,
      normalizeBasePackId: () => null,
      normalizeOverrides: () => null,
      normalizeModules: () => [],
      normalizeRecommendedTasks: () => [],
      normalizeCityPackStructurePatch: () => ({ targetingRules: [], slots: [] }),
      normalizeCityPackContentPatch: () => ({}),
      validateBasePackDepth: () => ({ ok: true })
    }, overrides && overrides.cityPacksRepo || {})
  };
  require.cache[confirmTokenPath] = {
    id: confirmTokenPath,
    filename: confirmTokenPath,
    loaded: true,
    exports: Object.assign({
      createConfirmToken: () => 'confirm_token_phase900_t42',
      verifyConfirmToken: () => true
    }, overrides && overrides.confirmToken || {})
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_phase900_t42' })
    }, overrides && overrides.appendAuditLog || {})
  };
  require.cache[activatePath] = {
    id: activatePath,
    filename: activatePath,
    loaded: true,
    exports: Object.assign({
      activateCityPack: async () => ({ ok: true, cityPackId: 'cp_phase900_t42' })
    }, overrides && overrides.activateCityPack || {})
  };
  require.cache[adapterPath] = {
    id: adapterPath,
    filename: adapterPath,
    loaded: true,
    exports: Object.assign({
      adaptSingleSheetCityPackTemplate: () => ({ template: null })
    }, overrides && overrides.singleSheetAdapter || {})
  };
  require.cache[composePath] = {
    id: composePath,
    filename: composePath,
    loaded: true,
    exports: Object.assign({
      composeCityAndNationwidePacks: async () => ({ summary: { total: 0, regional: 0, nationwide: 0 }, items: [] })
    }, overrides && overrides.composeCityAndNationwidePacks || {})
  };
  delete require.cache[routePath];

  try {
    const { handleCityPacks } = require('../../src/routes/admin/cityPacks');
    await run(handleCityPacks);
  } finally {
    originals.forEach((entry, modulePath) => {
      if (entry) require.cache[modulePath] = entry;
      else delete require.cache[modulePath];
    });
  }
}

test('phase900: city packs list success emits completed outcome metadata', async () => {
  await withCityPacksHandler({
    cityPacksRepo: {
      listCityPacks: async () => ([
        { id: 'cp_phase900_t42_01', status: 'draft', packClass: 'regional', language: 'ja' }
      ])
    }
  }, async (handleCityPacks) => {
    const res = createResCapture();
    await handleCityPacks({
      method: 'GET',
      url: '/api/admin/city-packs?limit=1',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t42_list',
        'x-request-id': 'req_phase900_t42_list'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_packs');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: city packs create invalid json emits normalized error outcome metadata', async () => {
  await withCityPacksHandler({}, async (handleCityPacks) => {
    const res = createResCapture();
    await handleCityPacks({
      method: 'POST',
      url: '/api/admin/city-packs',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t42_invalid_json'
      }
    }, res, '{');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid json');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_packs');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: city packs unmatched path emits normalized not_found outcome metadata', async () => {
  await withCityPacksHandler({}, async (handleCityPacks) => {
    const res = createResCapture();
    await handleCityPacks({
      method: 'GET',
      url: '/api/admin/city-packs/unsupported/path',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t42_not_found'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'not found');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'not_found');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_packs');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_found');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
