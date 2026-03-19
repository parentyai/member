'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResCapture() {
  const stagedHeaders = {};
  const result = { statusCode: null, headers: null, body: '' };
  return {
    setHeader(name, value) {
      if (!name) return;
      stagedHeaders[String(name).toLowerCase()] = value;
    },
    writeHead(statusCode, headers) {
      result.statusCode = statusCode;
      const normalized = {};
      Object.keys(headers || {}).forEach((key) => {
        normalized[String(key).toLowerCase()] = headers[key];
      });
      result.headers = Object.assign({}, stagedHeaders, normalized);
    },
    end(chunk) {
      if (chunk) result.body += String(chunk);
    },
    readJson() {
      return JSON.parse(result.body || '{}');
    },
    result
  };
}

async function withModuleStubs(stubMap, callback) {
  const previous = new Map();
  Object.entries(stubMap || {}).forEach(([modulePath, exports]) => {
    previous.set(modulePath, require.cache[modulePath]);
    require.cache[modulePath] = {
      id: modulePath,
      filename: modulePath,
      loaded: true,
      exports
    };
  });
  try {
    return await callback();
  } finally {
    previous.forEach((entry, modulePath) => {
      if (entry) require.cache[modulePath] = entry;
      else delete require.cache[modulePath];
    });
  }
}

test('phase900: user timeline missing lineUserId emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/userTimeline');
  delete require.cache[routePath];
  const { handleUserTimeline } = require('../../src/routes/admin/userTimeline');
  const res = createResCapture();
  try {
    await handleUserTimeline({
      method: 'GET',
      url: '/api/admin/user-timeline',
      headers: { 'x-trace-id': 'trace_user_timeline_invalid' }
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'line_user_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.user_timeline');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_required');
});

test('phase900: user timeline success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/userTimeline');
  const deliveriesPath = require.resolve('../../src/repos/firestore/deliveriesRepo');
  const notificationsPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const timelinePath = require.resolve('../../src/repos/firestore/decisionTimelineRepo');
  const auditPath = require.resolve('../../src/repos/firestore/auditLogsRepo');
  const eventsPath = require.resolve('../../src/repos/firestore/eventsRepo');

  await withModuleStubs({
    [deliveriesPath]: {
      listDeliveriesByUser: async () => ([{ id: 'd1', notificationId: 'n1', delivered: true, deliveredAt: '2026-03-19T00:00:00.000Z' }])
    },
    [notificationsPath]: {
      getNotification: async () => ({ scenarioKey: 'A', stepKey: 'welcome' })
    },
    [timelinePath]: {
      listTimelineEntries: async () => ([{ traceId: 'trace_timeline_1', notificationId: 'n1' }])
    },
    [auditPath]: {
      listAuditLogsByTraceId: async () => ([])
    },
    [eventsPath]: {
      listEventsByUser: async () => ([])
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleUserTimeline } = require('../../src/routes/admin/userTimeline');
    const res = createResCapture();
    await handleUserTimeline({
      method: 'GET',
      url: '/api/admin/user-timeline?lineUserId=U1',
      headers: { 'x-trace-id': 'trace_user_timeline_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.user_timeline');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});

test('phase900: link registry lookup missing id emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osLinkRegistryLookup');
  delete require.cache[routePath];
  const { handleLookup } = require('../../src/routes/admin/osLinkRegistryLookup');
  const res = createResCapture();
  try {
    await handleLookup({
      method: 'GET',
      url: '/api/admin/os/link-registry/',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_link_lookup_invalid' }
    }, res);
  } finally {
    delete require.cache[routePath];
  }

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'link_registry_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_link_registry_lookup');
});

test('phase900: link registry lookup success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osLinkRegistryLookup');
  const repoPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [repoPath]: {
      getLink: async () => ({ id: 'l1', url: 'https://example.com', title: 'Example', lastHealth: { state: 'OK' }, tags: ['official'] })
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_LINK' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleLookup } = require('../../src/routes/admin/osLinkRegistryLookup');
    const res = createResCapture();
    await handleLookup({
      method: 'GET',
      url: '/api/admin/os/link-registry/l1',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_link_lookup_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_link_registry_lookup');
    delete require.cache[routePath];
  });
});

test('phase900: local preflight ready false emits degraded outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/localPreflight');
  const toolPath = require.resolve('../../tools/admin_local_preflight');

  await withModuleStubs({
    [toolPath]: {
      runLocalPreflight: async () => ({
        ready: false,
        checkedAt: '2026-03-19T00:00:00.000Z',
        checks: { firestoreProbe: { ok: false, code: 'FIRESTORE_PROJECT_ID_ERROR' } },
        summary: { code: 'FIRESTORE_PROJECT_ID_ERROR' }
      })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleLocalPreflight } = require('../../src/routes/admin/localPreflight');
    const res = createResCapture();
    await handleLocalPreflight({
      method: 'GET',
      url: '/api/admin/local-preflight',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_local_preflight_degraded' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.ready, false);
    assert.equal(body.outcome && body.outcome.state, 'degraded');
    assert.equal(body.outcome && body.outcome.reason, 'not_ready');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.local_preflight');
    assert.equal(res.result.headers['x-member-outcome-state'], 'degraded');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_ready');
    delete require.cache[routePath];
  });
});

test('phase900: local preflight ready true emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/localPreflight');
  const toolPath = require.resolve('../../tools/admin_local_preflight');

  await withModuleStubs({
    [toolPath]: {
      runLocalPreflight: async () => ({
        ready: true,
        checkedAt: '2026-03-19T00:00:00.000Z',
        checks: { firestoreProbe: { ok: true } },
        summary: { code: 'OK' }
      })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleLocalPreflight } = require('../../src/routes/admin/localPreflight');
    const res = createResCapture();
    await handleLocalPreflight({
      method: 'GET',
      url: '/api/admin/local-preflight',
      headers: { 'x-actor': 'tester', 'x-trace-id': 'trace_local_preflight_success' }
    }, res);

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(body.ready, true);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.local_preflight');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    delete require.cache[routePath];
  });
});
