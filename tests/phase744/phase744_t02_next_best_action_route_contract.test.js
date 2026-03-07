'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleNextBestAction } = require('../../src/routes/admin/nextBestAction');

function createResCapture() {
  const result = {
    statusCode: null,
    headers: null,
    body: ''
  };
  return {
    result,
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      result.headers = headers || null;
    },
    end(body) {
      result.body = body || '';
    }
  };
}

test('phase744: next-best-action route requires x-actor header', async () => {
  const res = createResCapture();
  await handleNextBestAction({
    method: 'GET',
    url: '/api/admin/os/next-best-action?lineUserId=U744',
    headers: {}
  }, res);

  assert.equal(res.result.statusCode, 400);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.error, 'x-actor required');
});

test('phase744: next-best-action route requires lineUserId query', async () => {
  const res = createResCapture();
  await handleNextBestAction({
    method: 'GET',
    url: '/api/admin/os/next-best-action',
    headers: {
      'x-actor': 'phase744_actor',
      'x-request-id': 'phase744_req_1',
      'x-trace-id': 'phase744_trace_1'
    }
  }, res, {
    getNextBestAction: async () => ({ ok: true }),
    appendAuditLog: async () => ({ id: 'audit_1' })
  });

  assert.equal(res.result.statusCode, 400);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.error, 'lineUserId required');
  assert.equal(payload.traceId, 'phase744_trace_1');
});

test('phase744: next-best-action route is read-only and records audit with trace/request', async () => {
  let auditPayload = null;
  let computeCalls = 0;
  const res = createResCapture();
  await handleNextBestAction({
    method: 'GET',
    url: '/api/admin/os/next-best-action?lineUserId=U744_2',
    headers: {
      'x-actor': 'phase744_actor',
      'x-request-id': 'phase744_req_2',
      'x-trace-id': 'phase744_trace_2'
    }
  }, res, {
    getNextBestAction: async (params) => {
      computeCalls += 1;
      return {
        ok: true,
        enabled: true,
        authority: 'compute_next_tasks',
        lineUserId: params.lineUserId,
        nextBestAction: { taskId: 'task_744_1', title: 'Task 744' },
        fallbackReason: null
      };
    },
    appendAuditLog: async (payload) => {
      auditPayload = payload;
      return { id: 'audit_744' };
    }
  });

  assert.equal(computeCalls, 1);
  assert.equal(res.result.statusCode, 200, res.result.body);
  const payload = JSON.parse(res.result.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.traceId, 'phase744_trace_2');
  assert.equal(payload.requestId, 'phase744_req_2');
  assert.equal(payload.result.authority, 'compute_next_tasks');
  assert.equal(payload.result.nextBestAction.taskId, 'task_744_1');
  assert.ok(auditPayload);
  assert.equal(auditPayload.action, 'uxos.next_best_action.view');
  assert.equal(auditPayload.entityId, 'U744_2');
  assert.equal(auditPayload.traceId, 'phase744_trace_2');
  assert.equal(auditPayload.requestId, 'phase744_req_2');
});
