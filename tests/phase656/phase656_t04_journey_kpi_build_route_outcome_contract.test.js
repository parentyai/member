'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleJourneyKpiBuildJob } = require('../../src/routes/internal/journeyKpiBuildJob');

function createResCapture() {
  const stagedHeaders = {};
  const out = {
    statusCode: null,
    headers: null,
    body: ''
  };
  return {
    setHeader(name, value) {
      if (!name) return;
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      out.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      out.headers = Object.assign({}, stagedHeaders, normalized);
    },
    end(chunk) {
      if (chunk) out.body += String(chunk);
    },
    readJson() {
      return JSON.parse(out.body || '{}');
    },
    result: out
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

test('phase656: journey kpi build route returns blocked outcome when disabled', async () => {
  const restoreEnv = withEnv({
    CITY_PACK_JOB_TOKEN: 'phase656_kpi_token',
    ENABLE_JOURNEY_KPI: '0'
  });

  try {
    const res = createResCapture();
    await handleJourneyKpiBuildJob({
      method: 'POST',
      headers: { 'x-city-pack-job-token': 'phase656_kpi_token' }
    }, res, '{}');

    assert.equal(res.result.statusCode, 503);
    const body = res.readJson();
    assert.equal(body.ok, false);
    assert.equal(body.error, 'journey_kpi_disabled');
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'journey_kpi_disabled');
    assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'journey_kpi_disabled');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'internal_job');
  } finally {
    restoreEnv();
  }
});

test('phase656: journey kpi build route returns success outcome and writes KPI audit evidence', async () => {
  const restoreEnv = withEnv({
    CITY_PACK_JOB_TOKEN: 'phase656_kpi_token',
    ENABLE_JOURNEY_KPI: '1'
  });
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const res = createResCapture();
    await handleJourneyKpiBuildJob({
      method: 'POST',
      headers: {
        'x-city-pack-job-token': 'phase656_kpi_token',
        'x-trace-id': 'trace_phase656_kpi'
      }
    }, res, JSON.stringify({ dryRun: true }));

    assert.equal(res.result.statusCode, 200);
    const body = res.readJson();
    assert.equal(body.ok, true);
    assert.equal(body.dryRun, true);
    assert.equal(body.traceId, 'trace_phase656_kpi');
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'internal_job');
    assert.equal(typeof body.result.dateKey, 'string');

    const auditSnap = await db.collection('audit_logs').get();
    const actions = auditSnap.docs.map((doc) => doc.data().action);
    assert.ok(actions.includes('journey_kpi.built'));
  } finally {
    restoreEnv();
    clearDbForTest();
    clearServerTimestampForTest();
  }
});
