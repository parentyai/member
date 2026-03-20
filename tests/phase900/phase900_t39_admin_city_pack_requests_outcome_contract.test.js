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

async function withCityPackRequestsHandler(overrides, run) {
  const repoPath = require.resolve('../../src/repos/firestore/cityPackRequestsRepo');
  const cityPacksRepoPath = require.resolve('../../src/repos/firestore/cityPacksRepo');
  const flagsPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const runDraftJobPath = require.resolve('../../src/usecases/cityPack/runCityPackDraftJob');
  const activatePath = require.resolve('../../src/usecases/cityPack/activateCityPack');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const guardPath = require.resolve('../../src/routes/admin/managedFlowGuard');
  const routePath = require.resolve('../../src/routes/admin/cityPackRequests');

  const originalRepo = require.cache[repoPath];
  const originalCityPacksRepo = require.cache[cityPacksRepoPath];
  const originalFlags = require.cache[flagsPath];
  const originalRunDraftJob = require.cache[runDraftJobPath];
  const originalActivate = require.cache[activatePath];
  const originalAudit = require.cache[auditPath];
  const originalGuard = require.cache[guardPath];
  const originalRoute = require.cache[routePath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: Object.assign({
      listRequests: async () => [],
      getRequest: async () => null,
      updateRequest: async () => ({ ok: true })
    }, overrides && overrides.cityPackRequestsRepo || {})
  };
  require.cache[cityPacksRepoPath] = {
    id: cityPacksRepoPath,
    filename: cityPacksRepoPath,
    loaded: true,
    exports: Object.assign({
      getCityPack: async () => null
    }, overrides && overrides.cityPacksRepo || {})
  };
  require.cache[flagsPath] = {
    id: flagsPath,
    filename: flagsPath,
    loaded: true,
    exports: Object.assign({
      getKillSwitch: async () => false
    }, overrides && overrides.systemFlagsRepo || {})
  };
  require.cache[runDraftJobPath] = {
    id: runDraftJobPath,
    filename: runDraftJobPath,
    loaded: true,
    exports: Object.assign({
      runCityPackDraftJob: async () => ({ ok: true })
    }, overrides && overrides.runCityPackDraftJob || {})
  };
  require.cache[activatePath] = {
    id: activatePath,
    filename: activatePath,
    loaded: true,
    exports: Object.assign({
      activateCityPack: async () => ({ ok: true })
    }, overrides && overrides.activateCityPack || {})
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_stub' })
    }, overrides && overrides.appendAuditLog || {})
  };
  require.cache[guardPath] = {
    id: guardPath,
    filename: guardPath,
    loaded: true,
    exports: Object.assign({
      enforceManagedFlowGuard: async () => ({
        ok: true,
        actor: 'phase900_actor',
        traceId: 'trace_phase900_city_pack_guard'
      })
    }, overrides && overrides.managedFlowGuard || {})
  };
  delete require.cache[routePath];

  try {
    const { handleCityPackRequests } = require('../../src/routes/admin/cityPackRequests');
    await run(handleCityPackRequests);
  } finally {
    if (originalRepo) require.cache[repoPath] = originalRepo;
    else delete require.cache[repoPath];
    if (originalCityPacksRepo) require.cache[cityPacksRepoPath] = originalCityPacksRepo;
    else delete require.cache[cityPacksRepoPath];
    if (originalFlags) require.cache[flagsPath] = originalFlags;
    else delete require.cache[flagsPath];
    if (originalRunDraftJob) require.cache[runDraftJobPath] = originalRunDraftJob;
    else delete require.cache[runDraftJobPath];
    if (originalActivate) require.cache[activatePath] = originalActivate;
    else delete require.cache[activatePath];
    if (originalAudit) require.cache[auditPath] = originalAudit;
    else delete require.cache[auditPath];
    if (originalGuard) require.cache[guardPath] = originalGuard;
    else delete require.cache[guardPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: city pack requests list success emits completed outcome metadata', async () => {
  await withCityPackRequestsHandler({
    cityPackRequestsRepo: {
      listRequests: async () => ([
        { id: 'cpr_phase900_01', status: 'pending', regionKey: 'tokyo' }
      ])
    }
  }, async (handleCityPackRequests) => {
    const res = createResCapture();
    await handleCityPackRequests({
      method: 'GET',
      url: '/api/admin/city-pack-requests?limit=1',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_city_pack_list',
        'x-request-id': 'req_phase900_city_pack_list'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_requests_list');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  });
});

test('phase900: city pack requests request-changes invalid json emits normalized error outcome metadata', async () => {
  await withCityPackRequestsHandler({
    cityPackRequestsRepo: {
      getRequest: async () => ({
        id: 'cpr_phase900_req',
        status: 'pending',
        regionKey: 'tokyo',
        requestClass: 'regional',
        requestedLanguage: 'ja'
      })
    }
  }, async (handleCityPackRequests) => {
    const res = createResCapture();
    await handleCityPackRequests({
      method: 'POST',
      url: '/api/admin/city-pack-requests/cpr_phase900_req/request-changes',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_city_pack_invalid_json'
      }
    }, res, '{');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid json');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_requests_request_changes');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
  });
});

test('phase900: city pack requests unmatched path emits normalized not_found outcome metadata', async () => {
  await withCityPackRequestsHandler({}, async (handleCityPackRequests) => {
    const res = createResCapture();
    await handleCityPackRequests({
      method: 'GET',
      url: '/api/admin/city-pack-requests/unsupported/path',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_city_pack_not_found'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'not found');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'not_found');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_requests');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_found');
  });
});
