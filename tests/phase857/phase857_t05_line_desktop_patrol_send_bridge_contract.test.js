'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  deriveRetryKey,
  sendTextViaLineClient
} = require('../../tools/line_desktop_patrol/send_text_bridge');

test('phase857: line desktop patrol send bridge uses deterministic retry key and text payload', async () => {
  let captured = null;
  const result = await sendTextViaLineClient({
    lineUserId: 'U1234567890',
    text: 'patrol hello',
    runId: 'line-patrol-run-001'
  }, {
    pushFn: async (lineUserId, message, options) => {
      captured = { lineUserId, message, options };
      return { status: 200, body: '{"ok":true}' };
    }
  });

  assert.equal(captured.lineUserId, 'U1234567890');
  assert.deepEqual(captured.message, { type: 'text', text: 'patrol hello' });
  assert.equal(captured.options.retryKey, deriveRetryKey('line-patrol-run-001'));
  assert.equal(result.ok, true);
  assert.equal(result.providerStatus, 200);
  assert.equal(result.textLength, 'patrol hello'.length);
});

test('phase857: line desktop patrol send bridge validates required args', async () => {
  await assert.rejects(
    () => sendTextViaLineClient({ lineUserId: '', text: 'hello', runId: 'run-2' }, { pushFn: async () => ({ status: 200 }) }),
    /lineUserId required/
  );
  await assert.rejects(
    () => sendTextViaLineClient({ lineUserId: 'U1', text: '', runId: 'run-2' }, { pushFn: async () => ({ status: 200 }) }),
    /text required/
  );
});
