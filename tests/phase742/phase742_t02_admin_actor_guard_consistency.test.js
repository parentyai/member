'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleAdminLlmOpsExplain, handleAdminLlmNextActions } = require('../../src/routes/admin/llmOps');
const { handleVendors } = require('../../src/routes/admin/vendors');

function createCapture() {
  const capture = { status: null, body: null };
  const res = {
    writeHead(code) {
      capture.status = code;
    },
    end(text) {
      capture.body = text;
    }
  };
  return { capture, res };
}

test('phase742: llm ops routes require x-actor header', async () => {
  {
    const { capture, res } = createCapture();
    await handleAdminLlmOpsExplain({ url: '/api/admin/llm/ops-explain?lineUserId=U742', headers: {} }, res, {
      llmAdapter: { responsesCreate: async () => ({}) }
    });
    assert.equal(capture.status, 400);
    assert.equal(JSON.parse(capture.body).error, 'x-actor required');
  }
  {
    const { capture, res } = createCapture();
    await handleAdminLlmNextActions({ url: '/api/admin/llm/next-actions?lineUserId=U742', headers: {} }, res, {
      llmAdapter: { responsesCreate: async () => ({}) }
    });
    assert.equal(capture.status, 400);
    assert.equal(JSON.parse(capture.body).error, 'x-actor required');
  }
});

test('phase742: vendors facade requires x-actor header on GET list route', async () => {
  const { capture, res } = createCapture();
  await handleVendors({
    method: 'GET',
    url: '/api/admin/vendors?limit=1',
    headers: {}
  }, res, '');
  assert.equal(capture.status, 400);
  assert.equal(JSON.parse(capture.body).error, 'x-actor required');
});

