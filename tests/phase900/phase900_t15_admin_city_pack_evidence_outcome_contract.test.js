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

async function withModuleStubs(stubMap, callback) {
  const previous = new Map();
  Object.entries(stubMap || {}).forEach(([modulePath, exports]) => {
    previous.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports
    };
  });
  try {
    return await callback();
  } finally {
    previous.forEach((entry, modulePath) => {
      if (entry) require.cache[modulePath] = entry;
      else delete require.cache[modulePath];
    });
  }
}

test('phase900: admin city pack evidence success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/cityPackEvidence');
  const evidenceRepoPath = require.resolve('../../src/repos/firestore/sourceEvidenceRepo');
  const refsRepoPath = require.resolve('../../src/repos/firestore/sourceRefsRepo');
  const cityPacksRepoPath = require.resolve('../../src/repos/firestore/cityPacksRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [evidenceRepoPath]: {
      getEvidence: async () => ({
        id: 'ev_900',
        sourceRefId: 'sr_900',
        title: 'Evidence'
      }),
      listEvidenceBySourceRef: async () => ([
        { id: 'ev_older', title: 'Older evidence' },
        { id: 'ev_900', title: 'Evidence' }
      ])
    },
    [refsRepoPath]: {
      getSourceRef: async () => ({
        id: 'sr_900',
        usedByCityPackIds: ['cp_1']
      })
    },
    [cityPacksRepoPath]: {
      getCityPack: async () => ({
        id: 'cp_1',
        name: 'Tokyo Pack',
        status: 'draft'
      })
    },
    [auditPath]: {
      appendAuditLog: async () => {}
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleCityPackEvidence } = require('../../src/routes/admin/cityPackEvidence');
    const res = createResCapture();

    await handleCityPackEvidence({
      method: 'GET',
      url: '/api/admin/source-evidence/ev_900',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_citypack',
        'x-request-id': 'req_phase900_citypack'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.traceId, 'trace_phase900_citypack');
    assert.equal(body.requestId, 'req_phase900_citypack');
    assert.equal(body.evidence && body.evidence.id, 'ev_900');
    assert.equal(body.previousEvidence && body.previousEvidence.id, 'ev_older');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_evidence');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
    delete require.cache[routePath];
  });
});

test('phase900: admin city pack evidence missing evidence emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/cityPackEvidence');
  const evidenceRepoPath = require.resolve('../../src/repos/firestore/sourceEvidenceRepo');

  await withModuleStubs({
    [evidenceRepoPath]: {
      getEvidence: async () => null
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleCityPackEvidence } = require('../../src/routes/admin/cityPackEvidence');
    const res = createResCapture();

    await handleCityPackEvidence({
      method: 'GET',
      url: '/api/admin/source-evidence/ev_missing',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_citypack_missing',
        'x-request-id': 'req_phase900_citypack_missing'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'source evidence not found');
    assert.equal(body.traceId, 'trace_phase900_citypack_missing');
    assert.equal(body.requestId, 'req_phase900_citypack_missing');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'source_evidence_not_found');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_evidence');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'source_evidence_not_found');
    delete require.cache[routePath];
  });
});

test('phase900: admin city pack evidence internal error emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/cityPackEvidence');
  const evidenceRepoPath = require.resolve('../../src/repos/firestore/sourceEvidenceRepo');

  await withModuleStubs({
    [evidenceRepoPath]: {
      getEvidence: async () => {
        throw new Error('boom');
      }
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleCityPackEvidence } = require('../../src/routes/admin/cityPackEvidence');
    const res = createResCapture();

    await handleCityPackEvidence({
      method: 'GET',
      url: '/api/admin/source-evidence/ev_error',
      headers: {
        'x-actor': 'tester',
        'x-trace-id': 'trace_phase900_citypack_error',
        'x-request-id': 'req_phase900_citypack_error'
      }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 500);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'boom');
    assert.equal(body.traceId, 'trace_phase900_citypack_error');
    assert.equal(body.requestId, 'req_phase900_citypack_error');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'error');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_evidence');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    delete require.cache[routePath];
  });
});
