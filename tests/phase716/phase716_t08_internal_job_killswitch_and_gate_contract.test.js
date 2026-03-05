'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

function request({ port, method, path, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: '127.0.0.1', port, method, path, headers }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function listAuditRows(db) {
  const docs = (((db || {})._state || {}).collections || {});
  const audit = docs.audit_logs && docs.audit_logs.docs ? docs.audit_logs.docs : {};
  return Object.values(audit).map((entry) => entry && entry.data).filter(Boolean);
}

test('phase716: internal llm reward finalize job blocks on kill-switch and writes llm_gate.decision(job)', async (t) => {
  const prevToken = process.env.LLM_ACTION_JOB_TOKEN;
  process.env.LLM_ACTION_JOB_TOKEN = 'phase716_job_token';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: true }, { merge: true });

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.LLM_ACTION_JOB_TOKEN;
    else process.env.LLM_ACTION_JOB_TOKEN = prevToken;
  });

  const response = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/llm-action-reward-finalize',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-llm-action-job-token': 'phase716_job_token',
      'x-trace-id': 'phase716_job_trace_kill',
      'x-request-id': 'phase716_job_req_kill'
    },
    body: JSON.stringify({ dryRun: true, limit: 1 })
  });

  assert.equal(response.status, 409);
  const body = JSON.parse(response.body);
  assert.equal(body.error, 'kill switch on');

  const gateLog = listAuditRows(db).find((row) => row && row.action === 'llm_gate.decision' && row.payloadSummary && row.payloadSummary.entryType === 'job');
  assert.ok(gateLog);
  assert.equal(gateLog.payloadSummary.decision, 'blocked');
  assert.equal(gateLog.payloadSummary.blockedReason, 'kill_switch_on');
  assert.ok(Array.isArray(gateLog.payloadSummary.gatesApplied));
  assert.ok(gateLog.payloadSummary.gatesApplied.includes('kill_switch'));
  assert.ok(gateLog.payloadSummary.gatesApplied.includes('snapshot'));
});

test('phase716: internal llm reward finalize job allow path writes llm_gate.decision(job)', async (t) => {
  const prevToken = process.env.LLM_ACTION_JOB_TOKEN;
  process.env.LLM_ACTION_JOB_TOKEN = 'phase716_job_token_allow';

  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  await db.collection('system_flags').doc('phase0').set({ killSwitch: false }, { merge: true });

  const { createServer } = require('../../src/index.js');
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    clearDbForTest();
    clearServerTimestampForTest();
    if (prevToken === undefined) delete process.env.LLM_ACTION_JOB_TOKEN;
    else process.env.LLM_ACTION_JOB_TOKEN = prevToken;
  });

  const response = await request({
    port,
    method: 'POST',
    path: '/internal/jobs/llm-action-reward-finalize',
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'x-llm-action-job-token': 'phase716_job_token_allow',
      'x-trace-id': 'phase716_job_trace_allow',
      'x-request-id': 'phase716_job_req_allow'
    },
    body: JSON.stringify({ dryRun: true, limit: 1, now: '2026-01-05T00:00:00.000Z' })
  });

  assert.equal(response.status, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.ok, true);

  const gateLog = listAuditRows(db).find((row) => row && row.action === 'llm_gate.decision' && row.payloadSummary && row.payloadSummary.entryType === 'job' && row.payloadSummary.decision === 'allow');
  assert.ok(gateLog);
  assert.equal(gateLog.payloadSummary.intent, 'reward_finalize');
  assert.ok(Array.isArray(gateLog.payloadSummary.gatesApplied));
  assert.ok(gateLog.payloadSummary.gatesApplied.includes('kill_switch'));
  assert.ok(gateLog.payloadSummary.gatesApplied.includes('snapshot'));
});
