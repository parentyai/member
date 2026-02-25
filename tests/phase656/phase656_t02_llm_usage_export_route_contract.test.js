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
const { handleLlmUsageExport, toCsv } = require('../../src/routes/admin/osLlmUsageExport');

function createResCapture() {
  const out = {
    statusCode: null,
    headers: null,
    body: ''
  };
  return {
    result: out,
    writeHead(statusCode, headers) {
      out.statusCode = statusCode;
      out.headers = headers || null;
    },
    end(body) {
      out.body = body || '';
    }
  };
}

test('phase656: llm usage export requires x-actor header', async () => {
  const res = createResCapture();
  await handleLlmUsageExport({
    method: 'GET',
    url: '/api/admin/os/llm-usage/export?windowDays=7',
    headers: {}
  }, res);

  assert.equal(res.result.statusCode, 400);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'x-actor required');
});

test('phase656: llm usage export returns masked CSV and writes audit evidence', async () => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');

  try {
    const now = new Date();
    await db.collection('llm_usage_logs').doc('log_1').set({
      userId: 'U_EXPORT_USER_123456',
      plan: 'pro',
      decision: 'allow',
      tokenUsed: 120,
      createdAt: now
    }, { merge: true });
    await db.collection('llm_usage_logs').doc('log_2').set({
      userId: 'U_EXPORT_USER_123456',
      plan: 'pro',
      decision: 'blocked',
      tokenUsed: 80,
      createdAt: now
    }, { merge: true });
    await db.collection('llm_usage_logs').doc('log_3').set({
      userId: 'U_EXPORT_USER_ABCDE',
      plan: 'free',
      decision: 'blocked',
      tokenUsed: 10,
      createdAt: now
    }, { merge: true });

    const req = {
      method: 'GET',
      url: '/api/admin/os/llm-usage/export?windowDays=7&limit=10&scanLimit=500',
      headers: {
        'x-actor': 'phase656_test',
        'x-request-id': 'phase656_req_export',
        'x-trace-id': 'phase656_trace_export'
      }
    };
    const res = createResCapture();
    await handleLlmUsageExport(req, res);

    assert.equal(res.result.statusCode, 200, res.result.body);
    assert.ok((res.result.headers['content-type'] || '').includes('text/csv'));
    assert.ok((res.result.headers['content-disposition'] || '').includes('llm_usage_summary_'));

    const csv = String(res.result.body || '');
    assert.ok(csv.includes('userIdMasked,plan,calls,tokens,blocked,blockedRate'));
    assert.ok(csv.includes('***'));
    assert.ok(!csv.includes('U_EXPORT_USER_123456'));

    const auditDocs = Object.values((db._state.collections.audit_logs || { docs: {} }).docs || {});
    const audit = auditDocs.find((doc) => doc && doc.data && doc.data.action === 'llm_usage.summary.export');
    assert.ok(audit, 'llm_usage.summary.export audit should be recorded');
    assert.equal(audit.data.payloadSummary.piiMasked, true);
  } finally {
    clearDbForTest();
    clearServerTimestampForTest();
  }
});

test('phase656: llm usage export CSV escaping keeps commas and quotes safe', () => {
  const csv = toCsv([
    {
      userIdMasked: 'U12***45',
      plan: 'pro',
      calls: 2,
      tokens: 40,
      blocked: 1,
      blockedRate: 0.5
    },
    {
      userIdMasked: 'U",A***99',
      plan: 'free',
      calls: 1,
      tokens: 10,
      blocked: 1,
      blockedRate: 1
    }
  ]);
  assert.ok(csv.startsWith('userIdMasked,plan,calls,tokens,blocked,blockedRate'));
  assert.ok(csv.includes('"U"",A***99"'));
});
