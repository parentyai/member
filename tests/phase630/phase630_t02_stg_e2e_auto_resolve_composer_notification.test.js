'use strict';

const assert = require('assert');
const { test } = require('node:test');

const {
  resolveComposerNotificationId,
  bootstrapRetryQueue
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

test('phase630: resolveComposerNotificationId auto-picks active notification without send-plan side effects', async () => {
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
              { id: 'n_regular', title: 'regular send', status: 'active' },
              { id: 'n_e2e', title: 'e2e smoke notification', status: 'active' }
            ]
          }
        };
      }
      throw new Error(`unexpected call: ${method} ${endpoint}`);
    }
  );

  assert.strictEqual(result.notificationId, 'n_e2e');
  assert.strictEqual(result.source, 'auto');
  assert.strictEqual(result.reason, null);
  assert.strictEqual(Array.isArray(result.attempts), true);
  assert.strictEqual(result.attempts.length, 1);
  assert.strictEqual(result.attempts[0].stage, 'active_candidate_selected');
  assert.strictEqual(calls[0].method, 'GET');
  assert.strictEqual(calls.length, 1);
});

test('phase630: resolveComposerNotificationId returns not_found when no active candidates and bootstrap fails', async () => {
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
            items: []
          }
        };
      }
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/list?limit=100') {
        return {
          okStatus: true,
          body: {
            ok: true,
            items: [{ id: 'n1', title: 'planned only', status: 'planned' }]
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
  assert.strictEqual(result.reason, 'composer_notification_not_found');
  assert.ok(result.attempts.length >= 1);
});

test('phase630: resolveComposerNotificationId ignores non-active candidates in fallback list', async () => {
  const calls = [];
  const result = await resolveComposerNotificationId(
    {},
    'trace-4',
    '',
    async (_ctx, method, endpoint, _traceId, body) => {
      calls.push({ method, endpoint, body });
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/list?status=active&limit=100') {
        return { okStatus: false, status: 500, body: { ok: false, error: 'error' } };
      }
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/list?limit=100') {
        return {
          okStatus: true,
          body: {
            ok: true,
            items: [
              { id: 'n_planned_e2e', title: 'e2e planned', status: 'planned' },
              { id: 'n_active_regular', title: 'regular active', status: 'active' }
            ]
          }
        };
      }
      throw new Error(`unexpected call: ${method} ${endpoint}`);
    }
  );

  assert.strictEqual(result.notificationId, 'n_active_regular');
  assert.strictEqual(result.source, 'auto');
  assert.strictEqual(result.reason, null);
  assert.strictEqual(calls.some((item) => item.method === 'POST' && item.endpoint === '/api/admin/os/notifications/send/plan'), false);
});

test('phase630: resolveComposerNotificationId bootstrap keeps notification active (no plan probe mutation)', async () => {
  const calls = [];
  const result = await resolveComposerNotificationId(
    {},
    'trace-5',
    '',
    async (_ctx, method, endpoint, traceId, body) => {
      calls.push({ method, endpoint, traceId, body });
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/list?status=active&limit=100') {
        return { okStatus: true, body: { ok: true, items: [] } };
      }
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/list?limit=100') {
        return { okStatus: true, body: { ok: true, items: [] } };
      }
      if (method === 'POST' && endpoint === '/admin/link-registry') {
        return { okStatus: true, body: { ok: true, id: 'link_1' } };
      }
      if (method === 'GET' && endpoint === '/api/phase5/ops/users-summary?limit=100&snapshotMode=prefer&fallbackMode=allow&fallbackOnEmpty=true') {
        return {
          okStatus: true,
          body: { ok: true, items: [{ lineUserId: 'U1', scenarioKey: 'A', stepKey: 'week' }] }
        };
      }
      if (method === 'POST' && endpoint === '/api/phase5/admin/users/review') {
        assert.strictEqual(body.lineUserId, 'U1');
        return { okStatus: true, body: { ok: true } };
      }
      if (method === 'POST' && endpoint === '/api/admin/os/notifications/draft') {
        return { okStatus: true, body: { ok: true, notificationId: 'n_bootstrap' } };
      }
      if (method === 'POST' && endpoint === '/api/admin/os/notifications/approve') {
        return { okStatus: true, body: { ok: true } };
      }
      if (method === 'GET' && endpoint === '/api/admin/os/notifications/status?notificationId=n_bootstrap') {
        return { okStatus: true, body: { ok: true, status: 'active' } };
      }
      throw new Error(`unexpected call: ${method} ${endpoint}`);
    }
  );

  assert.strictEqual(result.notificationId, 'n_bootstrap');
  assert.strictEqual(result.reason, null);
  assert.ok(!calls.some((call) => call.method === 'POST' && call.endpoint === '/api/admin/os/notifications/send/plan'));
});

test('phase630: bootstrapRetryQueue builds pending queue via synthetic segment execute when queue is empty', async () => {
  const result = await bootstrapRetryQueue(
    {},
    'trace-6',
    async (_ctx, method, endpoint, _traceId, body) => {
      if (method === 'GET' && endpoint === '/api/phase61/templates?status=active') {
        return { okStatus: true, body: { ok: true, items: [{ key: 'tmpl_active' }] } };
      }
      if (method === 'POST' && endpoint === '/api/phase67/send/plan') {
        assert.strictEqual(body.templateKey, 'tmpl_active');
        assert.ok(Array.isArray(body.segmentQuery.lineUserIds));
        assert.ok(body.segmentQuery.lineUserIds[0].startsWith('U_STG_E2E_RETRY_'));
        return { okStatus: true, body: { ok: true, planHash: 'plan_hash' } };
      }
      if (method === 'POST' && endpoint === '/api/phase81/segment-send/dry-run') {
        return { okStatus: true, body: { ok: true, confirmToken: 'confirm_token' } };
      }
      if (method === 'POST' && endpoint === '/api/phase68/send/execute') {
        return { okStatus: true, body: { ok: false, reason: 'send_failed' } };
      }
      if (method === 'GET' && endpoint === '/api/phase73/retry-queue?limit=10') {
        return { okStatus: true, body: { ok: true, items: [{ id: 'queue_1', status: 'PENDING' }] } };
      }
      throw new Error(`unexpected call: ${method} ${endpoint}`);
    }
  );

  assert.strictEqual(result.queueId, 'queue_1');
  assert.strictEqual(result.reason, null);
  assert.ok(Array.isArray(result.attempts));
  assert.ok(result.attempts.length >= 5);
});
