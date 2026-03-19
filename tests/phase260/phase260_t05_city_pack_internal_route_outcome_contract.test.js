'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleCityPackDraftGeneratorJob } = require('../../src/routes/internal/cityPackDraftGeneratorJob');
const { handleCityPackSourceAuditJob } = require('../../src/routes/internal/cityPackSourceAuditJob');

function createResponseRecorder() {
  return {
    statusCode: null,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = String(value);
    },
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      Object.entries(headers || {}).forEach(([name, value]) => {
        this.headers[String(name).toLowerCase()] = String(value);
      });
    },
    end(text) {
      this.body = typeof text === 'string' ? text : '';
    }
  };
}

test('phase260: city-pack draft generator emits blocked outcome when source candidates are missing', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase260_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/city-pack-draft-generator',
      headers: {
        'x-city-pack-job-token': 'phase260_job_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase260_draft_outcome'
      }
    };
    const res = createResponseRecorder();

    await handleCityPackDraftGeneratorJob(req, res, JSON.stringify({ requestId: 'cpr_260' }), {
      getKillSwitchFn: async () => false,
      runCityPackDraftJobFn: async () => ({
        ok: false,
        reason: 'source_candidates_missing',
        requestId: 'cpr_260',
        traceId: 'trace_phase260_draft_outcome'
      })
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'blocked');
    assert.equal(body.outcome && body.outcome.reason, 'source_candidates_missing');
    assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_city_pack_draft_generator_job');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.decision, 'block');
    assert.equal(res.headers['x-member-outcome-state'], 'blocked');
    assert.equal(res.headers['x-member-outcome-reason'], 'source_candidates_missing');
    assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});

test('phase260: city-pack draft generator emits not_found outcome for non-post requests', async () => {
  const req = {
    method: 'GET',
    url: '/internal/jobs/city-pack-draft-generator',
    headers: {}
  };
  const res = createResponseRecorder();

  await handleCityPackDraftGeneratorJob(req, res, '', {
    getKillSwitchFn: async () => false,
    runCityPackDraftJobFn: async () => ({ ok: true })
  });

  assert.equal(res.statusCode, 404);
  const body = JSON.parse(res.body);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'not found');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'not_found');
  assert.equal(body.outcome && body.outcome.routeType, 'internal_job');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'internal_city_pack_draft_generator_job');
  assert.equal(res.headers['x-member-outcome-state'], 'error');
  assert.equal(res.headers['x-member-outcome-reason'], 'not_found');
  assert.equal(res.headers['x-member-outcome-route-type'], 'internal_job');
});

test('phase260: city-pack source audit emits partial outcome when some sources fail', async () => {
  const prevToken = process.env.CITY_PACK_JOB_TOKEN;
  process.env.CITY_PACK_JOB_TOKEN = 'phase260_job_token';
  try {
    const req = {
      method: 'POST',
      url: '/internal/jobs/city-pack-source-audit',
      headers: {
        'x-city-pack-job-token': 'phase260_job_token',
        'content-type': 'application/json; charset=utf-8',
        'x-trace-id': 'trace_phase260_source_audit_outcome'
      }
    };
    const res = createResponseRecorder();

    await handleCityPackSourceAuditJob(req, res, '{}', {
      getKillSwitchFn: async () => false,
      runCityPackSourceAuditJobFn: async () => ({
        ok: true,
        runId: 'run_phase260_source_audit',
        processed: 3,
        succeeded: 2,
        failed: 1,
        traceId: 'trace_phase260_source_audit_outcome'
      })
    });

    assert.equal(res.statusCode, 200);
    const body = JSON.parse(res.body);
    assert.equal(body.outcome && body.outcome.state, 'partial');
    assert.equal(body.outcome && body.outcome.reason, 'completed_with_failures');
    assert.equal(res.headers['x-member-outcome-state'], 'partial');
    assert.equal(res.headers['x-member-outcome-reason'], 'completed_with_failures');
  } finally {
    if (prevToken === undefined) delete process.env.CITY_PACK_JOB_TOKEN;
    else process.env.CITY_PACK_JOB_TOKEN = prevToken;
  }
});
