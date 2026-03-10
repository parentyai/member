'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleLiffSyntheticEvent } = require('../../src/routes/liffSyntheticEvent');

function createMockResponse() {
  const state = {
    status: null,
    headers: null,
    body: ''
  };
  return {
    writeHead(status, headers) {
      state.status = status;
      state.headers = headers;
    },
    end(body) {
      state.body = typeof body === 'string' ? body : '';
    },
    snapshot() {
      return {
        status: state.status,
        headers: state.headers,
        body: state.body
      };
    }
  };
}

test('phase760: LIFF synthetic route processes normalized event through webhook pipeline', async () => {
  const created = [];
  const audits = [];
  const req = { method: 'POST' };
  const res = createMockResponse();
  await handleLiffSyntheticEvent(
    req,
    res,
    JSON.stringify({ lineUserId: 'U100', text: '学校の手続き' }),
    {
      createEvent: async (row) => created.push(row),
      appendAuditLog: async (row) => audits.push(row),
      processSyntheticEvent: async (payload) => {
        assert.equal(payload.normalized.syntheticEvent._synthetic, true);
        return { status: 200, body: 'ok' };
      }
    }
  );
  const snapshot = res.snapshot();
  assert.equal(snapshot.status, 200);
  const parsed = JSON.parse(snapshot.body);
  assert.equal(parsed.ok, true);
  assert.equal(parsed.processed, true);
  assert.equal(created.length, 1);
  assert.equal(audits.length, 2);
  assert.equal(audits[0].action, 'line_liff.synthetic_event.accepted');
  assert.equal(audits[1].action, 'line_liff.synthetic_event.processed');
});

test('phase760: LIFF synthetic route returns 502 when synthetic processing fails', async () => {
  const audits = [];
  const req = { method: 'POST' };
  const res = createMockResponse();
  await handleLiffSyntheticEvent(
    req,
    res,
    JSON.stringify({ lineUserId: 'U200', text: '必要書類' }),
    {
      createEvent: async () => null,
      appendAuditLog: async (row) => audits.push(row),
      processSyntheticEvent: async () => ({ status: 503, body: 'failed' })
    }
  );
  const snapshot = res.snapshot();
  assert.equal(snapshot.status, 502);
  const parsed = JSON.parse(snapshot.body);
  assert.equal(parsed.ok, false);
  assert.equal(parsed.reason, 'synthetic_processing_failed');
  assert.equal(audits.length, 2);
  assert.equal(audits[1].action, 'line_liff.synthetic_event.processing_failed');
});
