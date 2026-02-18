'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const runner = require('../../scripts/city_pack_source_audit_runner');

test('phase251 t01: parseArgs reads required env and trims service url', () => {
  const options = runner.parseArgs([], {
    CITY_PACK_SERVICE_URL: 'https://member-stg.example.com/',
    CITY_PACK_JOB_TOKEN: 'job-token-1'
  });

  assert.equal(options.serviceUrl, 'https://member-stg.example.com');
  assert.equal(options.jobToken, 'job-token-1');
  assert.equal(options.mode, 'scheduled');
  assert.ok(options.runId.startsWith('cp_run_'));
  assert.ok(options.traceId.startsWith('trace-city-pack-'));
});

test('phase251 t01: parseArgs supports canary mode and ids', () => {
  const options = runner.parseArgs([
    '--service-url', 'https://member-stg.example.com',
    '--job-token', 'job-token-2',
    '--mode', 'canary',
    '--target-source-ref-ids', 'sr1,sr2',
    '--run-id', 'run-251',
    '--trace-id', 'trace-251',
    '--request-id', 'req-251',
    '--timeout-ms', '15000'
  ], {});

  assert.equal(options.mode, 'canary');
  assert.deepEqual(options.targetSourceRefIds, ['sr1', 'sr2']);
  assert.equal(options.runId, 'run-251');
  assert.equal(options.traceId, 'trace-251');
  assert.equal(options.requestId, 'req-251');
  assert.equal(options.timeoutMs, 15000);
});

test('phase251 t01: parseArgs rejects invalid mode', () => {
  assert.throws(() => runner.parseArgs([
    '--service-url', 'https://member-stg.example.com',
    '--job-token', 'job-token-3',
    '--mode', 'write'
  ], {}), /mode must be scheduled\|canary/);
});

test('phase251 t01: parseArgs rejects unknown args', () => {
  assert.throws(() => runner.parseArgs([
    '--service-url', 'https://member-stg.example.com',
    '--job-token', 'job-token-4',
    '--unknown', 'value'
  ], {}), /unknown arg/);
});

