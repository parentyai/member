'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  resolveComposerNotificationId
} = require('../../tools/run_stg_notification_e2e_checklist');

test('phase630: resolveComposerNotificationId uses explicit input when provided', async () => {
  let called = false;
  const result = await resolveComposerNotificationId(
    {},
    'trace-1',
    'n_manual',
    async () => {
      called = true;
      return { okStatus: false };
    }
  );
  assert.strictEqual(result.notificationId, 'n_manual');
  assert.strictEqual(result.source, 'input');
  assert.strictEqual(result.reason, null);
  assert.strictEqual(called, false);
});

test('phase630: resolveComposerNotificationId auto-picks plannable active notification', async () => {
  const calls = [];
  const result = await resolveComposerNotificationId(
    {},
    'trace-2',
    '',
    async (_ctx, method, endpoint, traceId, body) => {
      calls.push({ method, endpoint, traceId, body });
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/list?status=active&limit=100') {
        return {
          okStatus: true,
          body: {
            ok: true,
            items: [
              { id: 'n_regular', title: 'regular send' },
              { id: 'n_e2e', title: 'e2e smoke notification' }
            ]
          }
        };
      }
      if (method === 'POST' && endpoint === '/api/admin/os/notifications/send/plan') {
        if (body.notificationId === 'n_e2e') {
          return {
            okStatus: true,
            body: { ok: true, planHash: 'plan_hash_x', confirmToken: 'token_x' }
          };
        }
        return { okStatus: false, status: 400, body: { ok: false, reason: 'no_recipients' } };
      }
      throw new Error(`unexpected call: ${method} ${endpoint}`);
    }
  );

  assert.strictEqual(result.notificationId, 'n_e2e');
  assert.strictEqual(result.source, 'auto');
  assert.strictEqual(result.reason, null);
  assert.strictEqual(Array.isArray(result.attempts), true);
  assert.strictEqual(result.attempts.length, 1);
  assert.strictEqual(calls[0].method, 'GET');
  assert.strictEqual(calls[1].method, 'POST');
  assert.strictEqual(calls[1].traceId, 'trace-2');
});

test('phase630: resolveComposerNotificationId returns plannable_not_found when all active candidates fail plan', async () => {
  const result = await resolveComposerNotificationId(
    {},
    'trace-3',
    '',
    async (_ctx, method, endpoint, _traceId, body) => {
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/list?status=active&limit=100') {
        return {
          okStatus: true,
          body: {
            ok: true,
            items: [{ id: 'n1', title: 'normal' }]
          }
        };
      }
      if (method === 'POST' && endpoint === '/api/admin/os/notifications/send/plan') {
        assert.strictEqual(body.notificationId, 'n1');
        return { okStatus: false, status: 400, body: { ok: false, reason: 'no_recipients' } };
      }
      if (method === 'GET' && endpoint === '/api/phase5/ops/users-summary?limit=100&snapshotMode=prefer&fallbackMode=allow&fallbackOnEmpty=true') {
        return {
          okStatus: true,
          body: {
            ok: true,
            items: [
              { lineUserId: 'U1', scenarioKey: 'A', stepKey: 'week' }
            ]
          }
        };
      }
      if (method === 'POST' && endpoint === '/admin/link-registry') {
        return { okStatus: false, status: 500, body: { ok: false, error: 'error' } };
      }
      throw new Error(`unexpected call: ${method} ${endpoint}`);
    }
  );

  assert.strictEqual(result.notificationId, '');
  assert.strictEqual(result.source, 'auto');
  assert.strictEqual(result.reason, 'composer_notification_plannable_not_found');
  assert.ok(result.attempts.length >= 1);
});
