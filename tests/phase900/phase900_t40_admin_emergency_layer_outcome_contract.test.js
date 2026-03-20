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

async function withEmergencyLayerHandler(overrides, run) {
  const adminLayerPath = require.resolve('../../src/usecases/emergency/adminEmergencyLayer');
  const providerRepoPath = require.resolve('../../src/repos/firestore/emergencyProvidersRepo');
  const rulesRepoPath = require.resolve('../../src/repos/firestore/emergencyRulesRepo');
  const fetchProviderPath = require.resolve('../../src/usecases/emergency/fetchProviderSnapshot');
  const normalizeDiffPath = require.resolve('../../src/usecases/emergency/normalizeAndDiffProvider');
  const summarizePath = require.resolve('../../src/usecases/emergency/summarizeDraftWithLLM');
  const approvePath = require.resolve('../../src/usecases/emergency/approveEmergencyBulletin');
  const previewPath = require.resolve('../../src/usecases/emergency/previewEmergencyRule');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const guardPath = require.resolve('../../src/routes/admin/managedFlowGuard');
  const routePath = require.resolve('../../src/routes/admin/emergencyLayer');

  const originalAdminLayer = require.cache[adminLayerPath];
  const originalProviderRepo = require.cache[providerRepoPath];
  const originalRulesRepo = require.cache[rulesRepoPath];
  const originalFetchProvider = require.cache[fetchProviderPath];
  const originalNormalizeDiff = require.cache[normalizeDiffPath];
  const originalSummarize = require.cache[summarizePath];
  const originalApprove = require.cache[approvePath];
  const originalPreview = require.cache[previewPath];
  const originalAudit = require.cache[auditPath];
  const originalGuard = require.cache[guardPath];
  const originalRoute = require.cache[routePath];

  require.cache[adminLayerPath] = {
    id: adminLayerPath,
    filename: adminLayerPath,
    loaded: true,
    exports: Object.assign({
      listEmergencyProviders: async () => ({ ok: true, items: [] }),
      updateEmergencyProvider: async () => ({ ok: true }),
      listEmergencyBulletins: async () => ({ ok: true, items: [] }),
      getEmergencyBulletin: async () => ({ ok: true, item: null }),
      rejectEmergencyBulletin: async () => ({ ok: true }),
      getEmergencyEvidence: async () => ({ ok: true, items: [] })
    }, overrides && overrides.adminEmergencyLayer || {})
  };
  require.cache[providerRepoPath] = {
    id: providerRepoPath,
    filename: providerRepoPath,
    loaded: true,
    exports: Object.assign({
      getProvider: async () => ({ providerKey: 'nws_alerts', status: 'enabled' })
    }, overrides && overrides.emergencyProvidersRepo || {})
  };
  require.cache[rulesRepoPath] = {
    id: rulesRepoPath,
    filename: rulesRepoPath,
    loaded: true,
    exports: Object.assign({
      listRules: async () => [],
      upsertRule: async () => ({ ruleId: 'emr_stub', providerKey: 'nws_alerts', enabled: true })
    }, overrides && overrides.emergencyRulesRepo || {})
  };
  require.cache[fetchProviderPath] = {
    id: fetchProviderPath,
    filename: fetchProviderPath,
    loaded: true,
    exports: Object.assign({
      fetchProviderSnapshot: async () => ({ ok: true, changed: false, statusCode: 304 })
    }, overrides && overrides.fetchProviderSnapshot || {})
  };
  require.cache[normalizeDiffPath] = {
    id: normalizeDiffPath,
    filename: normalizeDiffPath,
    loaded: true,
    exports: Object.assign({
      normalizeAndDiffProvider: async () => ({ ok: true, diffIds: [] })
    }, overrides && overrides.normalizeAndDiffProvider || {})
  };
  require.cache[summarizePath] = {
    id: summarizePath,
    filename: summarizePath,
    loaded: true,
    exports: Object.assign({
      summarizeDraftWithLLM: async () => ({ ok: true })
    }, overrides && overrides.summarizeDraftWithLLM || {})
  };
  require.cache[approvePath] = {
    id: approvePath,
    filename: approvePath,
    loaded: true,
    exports: Object.assign({
      approveEmergencyBulletin: async () => ({ ok: true, bulletinId: 'emb_stub' })
    }, overrides && overrides.approveEmergencyBulletin || {})
  };
  require.cache[previewPath] = {
    id: previewPath,
    filename: previewPath,
    loaded: true,
    exports: Object.assign({
      previewEmergencyRule: async () => ({ ok: true, matchCount: 0, items: [] })
    }, overrides && overrides.previewEmergencyRule || {})
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
        traceId: 'trace_phase900_emergency_guard'
      })
    }, overrides && overrides.managedFlowGuard || {})
  };
  delete require.cache[routePath];

  try {
    const { handleEmergencyLayer } = require('../../src/routes/admin/emergencyLayer');
    await run(handleEmergencyLayer);
  } finally {
    if (originalAdminLayer) require.cache[adminLayerPath] = originalAdminLayer;
    else delete require.cache[adminLayerPath];
    if (originalProviderRepo) require.cache[providerRepoPath] = originalProviderRepo;
    else delete require.cache[providerRepoPath];
    if (originalRulesRepo) require.cache[rulesRepoPath] = originalRulesRepo;
    else delete require.cache[rulesRepoPath];
    if (originalFetchProvider) require.cache[fetchProviderPath] = originalFetchProvider;
    else delete require.cache[fetchProviderPath];
    if (originalNormalizeDiff) require.cache[normalizeDiffPath] = originalNormalizeDiff;
    else delete require.cache[normalizeDiffPath];
    if (originalSummarize) require.cache[summarizePath] = originalSummarize;
    else delete require.cache[summarizePath];
    if (originalApprove) require.cache[approvePath] = originalApprove;
    else delete require.cache[approvePath];
    if (originalPreview) require.cache[previewPath] = originalPreview;
    else delete require.cache[previewPath];
    if (originalAudit) require.cache[auditPath] = originalAudit;
    else delete require.cache[auditPath];
    if (originalGuard) require.cache[guardPath] = originalGuard;
    else delete require.cache[guardPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: emergency providers list success emits completed outcome metadata', async () => {
  await withEmergencyLayerHandler({
    adminEmergencyLayer: {
      listEmergencyProviders: async () => ({
        ok: true,
        traceId: 'trace_phase900_emergency_list',
        items: [{ providerKey: 'nws_alerts', status: 'enabled' }]
      })
    }
  }, async (handleEmergencyLayer) => {
    const res = createResCapture();
    await handleEmergencyLayer({
      method: 'GET',
      url: '/api/admin/emergency/providers',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_emergency_list'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.emergency_providers_list');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  });
});

test('phase900: emergency bulletin approve partial send emits partial outcome metadata', async () => {
  await withEmergencyLayerHandler({
    approveEmergencyBulletin: {
      approveEmergencyBulletin: async () => ({
        ok: false,
        partial: true,
        reason: 'send_partial_failure',
        bulletinId: 'emb_phase900_partial',
        deliveredCount: 2
      })
    }
  }, async (handleEmergencyLayer) => {
    const res = createResCapture();
    await handleEmergencyLayer({
      method: 'POST',
      url: '/api/admin/emergency/bulletins/emb_phase900_partial/approve',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_emergency_partial'
      }
    }, res, JSON.stringify({}));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 207);
    assert.equal(body.ok, false);
    assert.equal(body.partial, true);
    assert.equal(body.reason, 'send_partial_failure');
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'send_partial_failure');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.emergency_bulletin_approve');
    assert.equal(res.result.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'send_partial_failure');
  });
});

test('phase900: emergency unmatched path emits normalized not_found outcome metadata', async () => {
  await withEmergencyLayerHandler({}, async (handleEmergencyLayer) => {
    const res = createResCapture();
    await handleEmergencyLayer({
      method: 'GET',
      url: '/api/admin/emergency/not-supported',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_emergency_not_found'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'not found');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'not_found');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.emergency_layer');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_found');
  });
});
