'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const runner = require('../../scripts/city_pack_source_audit_runner');

function makeOptions(overrides) {
  return Object.assign({
    serviceUrl: 'https://member-stg.example.com',
    jobToken: 'job-token',
    mode: 'scheduled',
    targetSourceRefIds: ['sr1'],
    runId: 'run-1',
    traceId: 'trace-1',
    requestId: 'req-1',
    timeoutMs: 2000
  }, overrides || {});
}

test('phase251 t02: invokeCityPackAudit returns ok on 200/ok:true', async () => {
  let seenUrl = '';
  let seenHeaders = null;
  let seenBody = '';
  const fetchFn = async (url, request) => {
    seenUrl = url;
    seenHeaders = request.headers;
    seenBody = request.body;
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, runId: 'run-1' })
    };
  };

  const result = await runner.invokeCityPackAudit(makeOptions(), { fetchFn });
  assert.equal(result.ok, true);
  assert.equal(result.status, 200);
  assert.equal(seenUrl, 'https://member-stg.example.com/internal/jobs/city-pack-source-audit');
  assert.equal(seenHeaders['x-city-pack-job-token'], 'job-token');
  assert.equal(seenHeaders['x-trace-id'], 'trace-1');

  const parsed = JSON.parse(seenBody);
  assert.equal(parsed.runId, 'run-1');
  assert.equal(parsed.mode, 'scheduled');
  assert.deepEqual(parsed.targetSourceRefIds, ['sr1']);
});

test('phase251 t02: invokeCityPackAudit returns fail on non-2xx', async () => {
  const fetchFn = async () => ({
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ ok: false, error: 'unauthorized' })
  });

  const result = await runner.invokeCityPackAudit(makeOptions(), { fetchFn });
  assert.equal(result.ok, false);
  assert.equal(result.status, 401);
  assert.equal(result.response.error, 'unauthorized');
});

test('phase251 t02: invokeCityPackAudit falls back on invalid json response', async () => {
  const fetchFn = async () => ({
    ok: true,
    status: 200,
    text: async () => 'not-json'
  });

  const result = await runner.invokeCityPackAudit(makeOptions(), { fetchFn });
  assert.equal(result.ok, false);
  assert.equal(result.status, 200);
  assert.equal(result.response.error, 'invalid_json_response');
});

