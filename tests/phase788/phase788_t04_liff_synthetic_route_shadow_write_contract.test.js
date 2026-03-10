'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleLiffSyntheticEvent } = require('../../src/routes/liffSyntheticEvent');

function createMockResponse() {
  const state = { status: null, body: '' };
  return {
    writeHead(status) {
      state.status = status;
    },
    end(body) {
      state.body = typeof body === 'string' ? body : '';
    },
    snapshot() {
      return { status: state.status, body: state.body };
    }
  };
}

test('phase788: liff synthetic route writes synthetic event record on accepted and processed states', async () => {
  const syntheticWrites = [];
  const res = createMockResponse();
  await handleLiffSyntheticEvent(
    { method: 'POST' },
    res,
    JSON.stringify({ lineUserId: 'U_PHASE788', text: '学校' }),
    {
      createEvent: async () => null,
      appendAuditLog: async () => null,
      appendLiffSyntheticEventRecord: async (entry) => {
        syntheticWrites.push(entry);
      },
      processSyntheticEvent: async () => ({ status: 200, body: 'ok' })
    }
  );
  const snapshot = res.snapshot();
  assert.equal(snapshot.status, 200);
  assert.equal(syntheticWrites.length, 2);
  assert.equal(syntheticWrites[0].processStatus, 202);
  assert.equal(syntheticWrites[1].processStatus, 200);
  assert.equal(typeof syntheticWrites[0].webhookEventId, 'string');
  assert.equal(syntheticWrites[0].webhookEventId.length > 0, true);
});
