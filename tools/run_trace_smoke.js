#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { execSync } = require('child_process');

function envString(name, fallback) {
  const value = process.env[name];
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  return fallback;
}

function envBool(name, fallback) {
  const value = process.env[name];
  if (value === undefined) return Boolean(fallback);
  return value === '1' || value === 'true' || value === 'yes';
}

function resolveHeadSha() {
  try {
    return execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString('utf8').trim();
  } catch (_err) {
    return null;
  }
}

function ensureFileHeader(filePath, header) {
  if (fs.existsSync(filePath)) return;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, header, 'utf8');
}

function appendEvidence(filePath, block) {
  ensureFileHeader(filePath, '# TRACE_SMOKE_EVIDENCE\n\n');
  fs.appendFileSync(filePath, block, 'utf8');
}

function httpRequest({ port, method, path: reqPath, headers, body }) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      method,
      path: reqPath,
      headers
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_err) {
    return null;
  }
}

function uniqueId(prefix) {
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

async function runTraceSmoke(options) {
  const opts = options || {};

  const mode = opts.mode || envString('TRACE_SMOKE_MODE', 'stub');
  const evidencePath = opts.evidencePath || envString('TRACE_SMOKE_EVIDENCE_PATH', path.join('docs', 'TRACE_SMOKE_EVIDENCE.md'));
  const writeEvidence = opts.writeEvidence !== undefined ? Boolean(opts.writeEvidence) : envBool('TRACE_SMOKE_WRITE_EVIDENCE', true);
  const startServer = opts.startServer !== undefined ? Boolean(opts.startServer) : !envBool('TRACE_SMOKE_NO_START_SERVER', false);

  if (mode !== 'stub' && mode !== 'emulator') {
    throw new Error(`invalid TRACE_SMOKE_MODE: ${mode}`);
  }

  let server = null;
  let port = null;
  let cleanupDb = null;

  try {
    if (mode === 'stub') {
      const { createDbStub } = require('../tests/phase0/firestoreStub');
      const {
        setDbForTest,
        clearDbForTest,
        setServerTimestampForTest,
        clearServerTimestampForTest
      } = require('../src/infra/firestore');
      const db = createDbStub();
      setDbForTest(db);
      setServerTimestampForTest('SERVER_TIMESTAMP');
      cleanupDb = () => {
        clearDbForTest();
        clearServerTimestampForTest();
      };
    }

    if (startServer) {
      const { createServer } = require('../src/index.js');
      server = createServer();
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      port = server.address().port;
    } else {
      port = Number(envString('TRACE_SMOKE_PORT', '0')) || null;
      if (!port) throw new Error('TRACE_SMOKE_PORT required when TRACE_SMOKE_NO_START_SERVER=1');
    }

    const lineUserId = envString('TRACE_SMOKE_LINE_USER_ID', 'TRACE_SMOKE_U1');
    const actor = envString('TRACE_SMOKE_ACTOR', 'trace_smoke');

    // Prepare a minimal user record for ops console.
    const usersRepo = require('../src/repos/firestore/usersRepo');
    await usersRepo.createUser(lineUserId, {
      memberNumber: envString('TRACE_SMOKE_MEMBER_NUMBER', 'TRACE_SMOKE_0001'),
      createdAt: '2000-01-01T00:00:00Z'
    });

    const requestIdView = uniqueId('trace-smoke-view');
    const consoleRes = await httpRequest({
      port,
      method: 'GET',
      path: `/api/phase25/ops/console?lineUserId=${encodeURIComponent(lineUserId)}`,
      headers: { 'x-actor': actor, 'x-request-id': requestIdView }
    });
    assert.strictEqual(consoleRes.status, 200);
    const consoleJson = safeJsonParse(consoleRes.body);
    assert.ok(consoleJson && consoleJson.ok === true);
    const traceId = consoleJson.traceId;
    assert.ok(typeof traceId === 'string' && traceId.trim().length > 0);

    const requestIdSubmit = uniqueId('trace-smoke-submit');
    const submitRes = await httpRequest({
      port,
      method: 'POST',
      path: '/api/phase25/ops/decision',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-actor': actor,
        'x-request-id': requestIdSubmit
      },
      body: JSON.stringify({
        lineUserId,
        traceId,
        decision: {
          nextAction: 'STOP_AND_ESCALATE',
          failure_class: 'UNKNOWN',
          note: 'trace_smoke'
        }
      })
    });
    assert.strictEqual(submitRes.status, 200);
    const submitJson = safeJsonParse(submitRes.body);
    assert.ok(submitJson && submitJson.ok === true);
    assert.strictEqual(submitJson.traceId, traceId);
    assert.ok(typeof submitJson.decisionLogId === 'string' && submitJson.decisionLogId.length > 0);

    const requestIdExecute = uniqueId('trace-smoke-execute');
    const execRes = await httpRequest({
      port,
      method: 'POST',
      path: '/api/phase33/ops-decision/execute',
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'x-actor': actor,
        'x-request-id': requestIdExecute
      },
      body: JSON.stringify({
        lineUserId,
        decisionLogId: submitJson.decisionLogId,
        action: 'NO_ACTION'
        // intentionally omit traceId: Phase132 guarantees fallback from decision audit
      })
    });
    const execJson = safeJsonParse(execRes.body);

    const requestIdTrace = uniqueId('trace-smoke-trace');
    const traceRes = await httpRequest({
      port,
      method: 'GET',
      path: `/api/admin/trace?traceId=${encodeURIComponent(traceId)}&limit=50`,
      headers: { 'x-actor': actor, 'x-request-id': requestIdTrace }
    });
    assert.strictEqual(traceRes.status, 200);
    const traceJson = safeJsonParse(traceRes.body);
    assert.ok(traceJson && traceJson.ok === true);
    assert.strictEqual(traceJson.traceId, traceId);
    assert.ok(Array.isArray(traceJson.audits));
    assert.ok(Array.isArray(traceJson.decisions));
    assert.ok(Array.isArray(traceJson.timeline));

    const auditActions = traceJson.audits.map((a) => a && a.action).filter(Boolean);
    const timelineActions = traceJson.timeline.map((e) => e && e.action).filter(Boolean);
    assert.ok(auditActions.includes('ops_console.view'));
    assert.ok(auditActions.includes('ops_decision.submit'));
    assert.ok(timelineActions.includes('DECIDE'));
    // execute may fail due to readiness; in that case we still require an EXECUTE attempt to be recorded.
    assert.ok(timelineActions.includes('EXECUTE'));

    const headSha = resolveHeadSha();
    const utc = new Date().toISOString();
    const summary = {
      ok: true,
      utc,
      headSha,
      mode,
      actor,
      lineUserId,
      traceId,
      endpoints: {
        console: '/api/phase25/ops/console',
        decision: '/api/phase25/ops/decision',
        execute: '/api/phase33/ops-decision/execute',
        trace: '/api/admin/trace'
      },
      counts: {
        audits: traceJson.audits.length,
        decisions: traceJson.decisions.length,
        timeline: traceJson.timeline.length
      },
      sample: {
        auditActions: auditActions.slice(0, 5),
        decisionSubjectTypes: traceJson.decisions.map((d) => d && d.subjectType).filter(Boolean).slice(0, 5),
        timelineActions: timelineActions.slice(0, 5)
      },
      execute: {
        status: execRes.status,
        ok: execJson ? Boolean(execJson.ok) : null,
        error: execJson && typeof execJson.error === 'string' ? execJson.error : null
      },
      evidencePath: writeEvidence ? evidencePath : null
    };

    if (writeEvidence) {
      const block = [
        '## TRACE_SMOKE\n',
        `UTC: ${utc}\n`,
        `HEAD: ${headSha || 'unknown'}\n`,
        `traceId: ${traceId}\n`,
        `result: PASS\n`,
        `counts: audits=${summary.counts.audits} decisions=${summary.counts.decisions} timeline=${summary.counts.timeline}\n`,
        `sample.auditActions: ${summary.sample.auditActions.join(',')}\n`,
        `sample.timelineActions: ${summary.sample.timelineActions.join(',')}\n`,
        '\n'
      ].join('');
      appendEvidence(evidencePath, block);
    }

    return summary;
  } finally {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (cleanupDb) cleanupDb();
  }
}

async function main() {
  try {
    const result = await runTraceSmoke();
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return 0;
  } catch (err) {
    const message = err && err.message ? err.message : 'error';
    process.stderr.write(`${message}\n`);
    return 1;
  }
}

module.exports = {
  runTraceSmoke
};

if (require.main === module) {
  main().then((code) => process.exit(code));
}

