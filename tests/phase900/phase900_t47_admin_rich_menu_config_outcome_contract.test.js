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

async function withRichMenuHandlers(overrides, run) {
  const policyRepoPath = require.resolve('../../src/repos/firestore/richMenuPolicyRepo');
  const appendAuditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const routePath = require.resolve('../../src/routes/admin/richMenuConfig');

  const originalPolicyRepo = require.cache[policyRepoPath];
  const originalAppendAudit = require.cache[appendAuditPath];
  const originalRoute = require.cache[routePath];

  require.cache[policyRepoPath] = {
    id: policyRepoPath,
    filename: policyRepoPath,
    loaded: true,
    exports: Object.assign({
      normalizeRichMenuPolicy: (input) => Object.assign({
        enabled: true,
        updateEnabled: true,
        defaultTemplateId: 'default_ja',
        fallbackTemplateId: 'default_ja',
        cooldownSeconds: 21600,
        maxAppliesPerMinute: 60,
        maxTargetsPerApply: 200,
        allowLegacyJourneyPolicyFallback: true
      }, input || {}),
      setRichMenuPolicy: async (policy, actor) => Object.assign({ updatedBy: actor || 'unknown' }, policy || {})
    }, overrides && overrides.richMenuPolicyRepo || {})
  };
  require.cache[appendAuditPath] = {
    id: appendAuditPath,
    filename: appendAuditPath,
    loaded: true,
    exports: Object.assign({
      appendAuditLog: async () => ({ id: 'audit_phase900_t47' })
    }, overrides && overrides.appendAuditLog || {})
  };
  delete require.cache[routePath];

  try {
    const route = require('../../src/routes/admin/richMenuConfig');
    await run(route);
  } finally {
    if (originalPolicyRepo) require.cache[policyRepoPath] = originalPolicyRepo;
    else delete require.cache[policyRepoPath];
    if (originalAppendAudit) require.cache[appendAuditPath] = originalAppendAudit;
    else delete require.cache[appendAuditPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

function req(url, traceId) {
  return {
    method: 'POST',
    url,
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': traceId,
      'x-request-id': traceId
    }
  };
}

test('phase900: rich menu plan success emits completed outcome metadata', async () => {
  await withRichMenuHandlers({}, async ({ handlePlan }) => {
    const res = createResCapture();
    await handlePlan(req('/api/admin/os/rich-menu/plan', 'trace_phase900_t47_plan'), res, JSON.stringify({
      action: 'set_policy',
      payload: {
        enabled: true
      }
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.action, 'set_policy');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.rich_menu_config');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: rich menu plan invalid json emits normalized error outcome metadata', async () => {
  await withRichMenuHandlers({}, async ({ handlePlan }) => {
    const res = createResCapture();
    await handlePlan(req('/api/admin/os/rich-menu/plan', 'trace_phase900_t47_invalid_json'), res, '{');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid json');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.rich_menu_config');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
  });
});

test('phase900: rich menu set plan hash mismatch emits normalized error outcome metadata', async () => {
  await withRichMenuHandlers({}, async ({ handleSet }) => {
    const res = createResCapture();
    await handleSet(req('/api/admin/os/rich-menu/set', 'trace_phase900_t47_plan_hash_mismatch'), res, JSON.stringify({
      action: 'set_policy',
      payload: { enabled: true },
      planHash: 'richmenu_deadbeefdeadbeefdead',
      confirmToken: 'confirm_token_value'
    }));

    const body = res.readJson();
    assert.equal(res.result.statusCode, 409);
    assert.equal(body.ok, false);
    assert.equal(body.reason, 'plan_hash_mismatch');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'plan_hash_mismatch');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.rich_menu_config');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'plan_hash_mismatch');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
