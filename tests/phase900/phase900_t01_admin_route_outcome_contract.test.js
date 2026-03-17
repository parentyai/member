'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleRunPhase2 } = require('../../src/routes/admin/phase2Automation');
const { handleJourneyKpi } = require('../../src/routes/admin/osJourneyKpi');
const structDrift = require('../../src/routes/admin/structDriftBackfill');

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

function withEnv(patch) {
  const prev = {};
  Object.keys(patch).forEach((key) => {
    prev[key] = process.env[key];
    if (patch[key] === null || patch[key] === undefined) delete process.env[key];
    else process.env[key] = String(patch[key]);
  });
  return () => {
    Object.keys(patch).forEach((key) => {
      if (prev[key] === undefined) delete process.env[key];
      else process.env[key] = prev[key];
    });
  };
}

test('phase900: phase2 automation rejects invalid fallbackMode with outcome metadata', async () => {
  const req = { method: 'POST', url: '/api/admin/phase2/automation', headers: { 'x-actor': 'tester' } };
  const res = createResCapture();
  await handleRunPhase2(req, res, JSON.stringify({ fallbackMode: 'reject' }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_fallback_mode');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_fallback_mode');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: phase2 automation success emits completed outcome with guard metadata', async () => {
  const req = {
    method: 'POST',
    url: '/api/admin/phase2/automation',
    headers: { 'x-actor': 'tester' }
  };
  const res = createResCapture();
  const summary = { processed: 1 };
  await handleRunPhase2(req, res, JSON.stringify({ runId: 'run-1', targetDate: '2026-03-16', dryRun: true, fallbackMode: 'allow' }), {
    runPhase2Automation: async (options) => {
      assert.equal(options.fallbackMode, 'allow');
      return { ok: true, summary };
    },
    logger: () => {}
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.deepEqual(body.summary, summary);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.phase2.automation');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: os journey kpi route returns blocked outcome when feature disabled', async () => {
  const restoreEnv = withEnv({ ENABLE_JOURNEY_KPI: '0' });
  const req = { method: 'GET', url: '/api/admin/os/journey-kpi', headers: { 'x-actor': 'tester' } };
  const res = createResCapture();
  try {
    await handleJourneyKpi(req, res);
  } finally {
    restoreEnv();
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 503);
  assert.equal(body.outcome && body.outcome.state, 'blocked');
  assert.equal(body.outcome && body.outcome.reason, 'journey_kpi_disabled');
  assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'journey_kpi_disabled');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: os journey kpi route surfaces success outcome and guard metadata', async () => {
  const req = { method: 'GET', url: '/api/admin/os/journey-kpi', headers: { 'x-actor': 'tester' } };
  const res = createResCapture();
  const stubRepo = {
    getLatestJourneyKpiDaily: async () => null,
    getJourneyKpiDaily: async () => null
  };
  const stubAggregate = async () => ({ dateKey: '2026-03-16', totalUsers: 42 });
  const auditCalls = [];
  await handleJourneyKpi(req, res, {
    journeyKpiDailyRepo: stubRepo,
    aggregateJourneyKpis: stubAggregate,
    appendAuditLog: async (...args) => {
      auditCalls.push(args);
    }
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.source, 'computed');
  assert.equal(body.kpi && body.kpi.dateKey, '2026-03-16');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_journey_kpi');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  assert.ok(auditCalls.length > 0);
});

test('phase900: struct drift response helper attaches outcome and guard headers', () => {
  const res = createResCapture();
  structDrift._test.writeStructDriftResponse(res, 200, { ok: true, traceId: 'trace' });
  const body = res.readJson();
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.struct_drift.backfill');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});
