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

async function withReviewInboxHandler(overrides, run) {
  const sourceRefsRepoPath = require.resolve('../../src/repos/firestore/sourceRefsRepo');
  const sourceEvidenceRepoPath = require.resolve('../../src/repos/firestore/sourceEvidenceRepo');
  const sourceAuditRunsRepoPath = require.resolve('../../src/repos/firestore/sourceAuditRunsRepo');
  const cityPackMetricsDailyRepoPath = require.resolve('../../src/repos/firestore/cityPackMetricsDailyRepo');
  const cityPacksRepoPath = require.resolve('../../src/repos/firestore/cityPacksRepo');
  const flagsRepoPath = require.resolve('../../src/repos/firestore/systemFlagsRepo');
  const readPathMetricPath = require.resolve('../../src/ops/readPathLoadMetric');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const decisionPath = require.resolve('../../src/usecases/cityPack/reviewSourceRefDecision');
  const runAuditJobPath = require.resolve('../../src/usecases/cityPack/runCityPackSourceAuditJob');
  const metricsPath = require.resolve('../../src/usecases/cityPack/computeCityPackMetrics');
  const routePath = require.resolve('../../src/routes/admin/cityPackReviewInbox');

  const originals = new Map();
  [
    sourceRefsRepoPath,
    sourceEvidenceRepoPath,
    sourceAuditRunsRepoPath,
    cityPackMetricsDailyRepoPath,
    cityPacksRepoPath,
    flagsRepoPath,
    readPathMetricPath,
    auditPath,
    decisionPath,
    runAuditJobPath,
    metricsPath,
    routePath
  ].forEach((modulePath) => {
    originals.set(modulePath, require.cache[modulePath]);
  });

  require.cache[sourceRefsRepoPath] = {
    id: sourceRefsRepoPath,
    filename: sourceRefsRepoPath,
    loaded: true,
    exports: Object.assign({
      listSourceRefs: async () => ([]),
      getSourceRef: async () => null,
      updateSourceRef: async () => ({ ok: true }),
      normalizeSourcePolicyPatch: () => ({})
    }, overrides && overrides.sourceRefsRepo || {})
  };
  require.cache[sourceEvidenceRepoPath] = {
    id: sourceEvidenceRepoPath,
    filename: sourceEvidenceRepoPath,
    loaded: true,
    exports: Object.assign({
      getEvidence: async () => null,
      listEvidenceByTraceId: async () => ([])
    }, overrides && overrides.sourceEvidenceRepo || {})
  };
  require.cache[sourceAuditRunsRepoPath] = {
    id: sourceAuditRunsRepoPath,
    filename: sourceAuditRunsRepoPath,
    loaded: true,
    exports: Object.assign({
      listRuns: async () => ([]),
      getRun: async () => null
    }, overrides && overrides.sourceAuditRunsRepo || {})
  };
  require.cache[cityPackMetricsDailyRepoPath] = {
    id: cityPackMetricsDailyRepoPath,
    filename: cityPackMetricsDailyRepoPath,
    loaded: true,
    exports: Object.assign({
      upsertMetricRows: async () => ({ ok: true })
    }, overrides && overrides.cityPackMetricsDailyRepo || {})
  };
  require.cache[cityPacksRepoPath] = {
    id: cityPacksRepoPath,
    filename: cityPacksRepoPath,
    loaded: true,
    exports: Object.assign({
      getCityPack: async () => null
    }, overrides && overrides.cityPacksRepo || {})
  };
  require.cache[flagsRepoPath] = {
    id: flagsRepoPath,
    filename: flagsRepoPath,
    loaded: true,
    exports: Object.assign({
      getKillSwitch: async () => false
    }, overrides && overrides.systemFlagsRepo || {})
  };
  require.cache[readPathMetricPath] = {
    id: readPathMetricPath,
    filename: readPathMetricPath,
    loaded: true,
    exports: Object.assign({
      logReadPathLoadMetric: () => {}
    }, overrides && overrides.readPathLoadMetric || {})
  };
  require.cache[auditPath] = {
    id: auditPath,
    filename: auditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_phase900_t43' })
    }, overrides && overrides.appendAuditLog || {})
  };
  require.cache[decisionPath] = {
    id: decisionPath,
    filename: decisionPath,
    loaded: true,
    exports: Object.assign({
      reviewSourceRefDecision: async () => ({ ok: true })
    }, overrides && overrides.reviewSourceRefDecision || {})
  };
  require.cache[runAuditJobPath] = {
    id: runAuditJobPath,
    filename: runAuditJobPath,
    loaded: true,
    exports: Object.assign({
      runCityPackSourceAuditJob: async () => ({ ok: true })
    }, overrides && overrides.runCityPackSourceAuditJob || {})
  };
  require.cache[metricsPath] = {
    id: metricsPath,
    filename: metricsPath,
    loaded: true,
    exports: Object.assign({
      computeCityPackMetrics: async () => ({ ok: true, summary: {}, items: [], dailyRows: [] }),
      normalizeWindowDays: () => 30,
      normalizeLimit: () => 30
    }, overrides && overrides.computeCityPackMetrics || {})
  };
  delete require.cache[routePath];

  try {
    const { handleCityPackReviewInbox } = require('../../src/routes/admin/cityPackReviewInbox');
    await run(handleCityPackReviewInbox);
  } finally {
    originals.forEach((entry, modulePath) => {
      if (entry) require.cache[modulePath] = entry;
      else delete require.cache[modulePath];
    });
  }
}

test('phase900: city pack review inbox list success emits completed outcome metadata', async () => {
  await withReviewInboxHandler({
    sourceRefsRepo: {
      listSourceRefs: async () => ([
        {
          id: 'sr_phase900_t43_01',
          url: 'https://example.com/source',
          status: 'needs_review',
          validUntil: '2026-04-01T00:00:00.000Z'
        }
      ])
    }
  }, async (handleCityPackReviewInbox) => {
    const res = createResCapture();
    await handleCityPackReviewInbox({
      method: 'GET',
      url: '/api/admin/review-inbox?limit=10',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t43_list',
        'x-request-id': 'req_phase900_t43_list'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_review_inbox');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: city pack review inbox source-ref decision invalid json emits normalized error outcome metadata', async () => {
  await withReviewInboxHandler({}, async (handleCityPackReviewInbox) => {
    const res = createResCapture();
    await handleCityPackReviewInbox({
      method: 'POST',
      url: '/api/admin/source-refs/sr_phase900_t43_02/confirm',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t43_invalid_json'
      }
    }, res, '{');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid json');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_review_inbox');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: city pack review inbox run detail missing emits normalized not_found outcome metadata', async () => {
  await withReviewInboxHandler({
    sourceAuditRunsRepo: {
      getRun: async () => null
    }
  }, async (handleCityPackReviewInbox) => {
    const res = createResCapture();
    await handleCityPackReviewInbox({
      method: 'GET',
      url: '/api/admin/city-pack-source-audit/runs/run_missing_phase900_t43',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_t43_not_found'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'source audit run not found');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'not_found');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_review_inbox');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_found');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
