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

function createReq(url, traceId) {
  return {
    method: 'GET',
    url,
    headers: {
      'x-admin-token': 'phase900_admin_token',
      'x-actor': 'tester',
      'x-trace-id': traceId
    }
  };
}

test('phase900: os link registry impact success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osLinkRegistryImpact');
  const linkRegistryRepoPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const taskContentsRepoPath = require.resolve('../../src/repos/firestore/taskContentsRepo');
  const notificationsRepoPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const cityPacksRepoPath = require.resolve('../../src/repos/firestore/cityPacksRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const featureFlagsPath = require.resolve('../../src/domain/tasks/featureFlags');
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase900_admin_token';

  try {
    await withModuleStubs({
      [featureFlagsPath]: { isLinkRegistryImpactMapEnabled: () => true },
      [linkRegistryRepoPath]: {
        listLinks: async () => ([
          { id: 'L1', enabled: true, lastHealth: { state: 'OK' } },
          { id: 'L2', enabled: false, lastHealth: { state: 'WARN' } }
        ])
      },
      [taskContentsRepoPath]: {
        listTaskContents: async () => ([
          { taskKey: 'task.a', videoLinkId: 'L1', actionLinkId: 'L2', recommendedVendorLinkIds: [] }
        ])
      },
      [notificationsRepoPath]: {
        listNotifications: async () => ([
          { id: 'N1', linkRegistryId: 'L1', secondaryCtas: [], cityPackFallback: { fallbackLinkRegistryId: 'L2' } }
        ])
      },
      [cityPacksRepoPath]: {
        listCityPacks: async () => ([
          { id: 'CP1', slotContents: { hero: { linkRegistryId: 'L1' } } }
        ])
      },
      [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T17_SUCCESS' }) }
    }, async () => {
      delete require.cache[routePath];
      const { handleImpact } = require('../../src/routes/admin/osLinkRegistryImpact');
      const res = createResCapture();
      await handleImpact(createReq('/api/admin/os/link-registry-impact?limit=20', 'trace_phase900_t17_success'), res);

      const body = res.readJson();
      assert.equal(res.result.statusCode, 200);
      assert.equal(body.ok, true);
      assert.equal(body.summary.total, 2);
      assert.equal(body.summary.sharedIdCount, 2);
      assert.equal(body.outcome && body.outcome.state, 'success');
      assert.equal(body.outcome && body.outcome.reason, 'completed');
      assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_link_registry_impact');
      assert.equal(res.result.headers['x-member-outcome-state'], 'success');
      assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
      assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
      delete require.cache[routePath];
    });
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  }
});

test('phase900: os link registry impact disabled emits blocked outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osLinkRegistryImpact');
  const featureFlagsPath = require.resolve('../../src/domain/tasks/featureFlags');
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase900_admin_token';

  try {
    await withModuleStubs({
      [featureFlagsPath]: { isLinkRegistryImpactMapEnabled: () => false }
    }, async () => {
      delete require.cache[routePath];
      const { handleImpact } = require('../../src/routes/admin/osLinkRegistryImpact');
      const res = createResCapture();
      await handleImpact(createReq('/api/admin/os/link-registry-impact?limit=5', 'trace_phase900_t17_blocked'), res);

      const body = res.readJson();
      assert.equal(res.result.statusCode, 409);
      assert.equal(body.ok, false);
      assert.equal(body.error, 'link_registry_impact_map_disabled');
      assert.equal(body.outcome && body.outcome.state, 'blocked');
      assert.equal(body.outcome && body.outcome.reason, 'link_registry_impact_map_disabled');
      assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_link_registry_impact');
      assert.equal(res.result.headers['x-member-outcome-state'], 'blocked');
      assert.equal(res.result.headers['x-member-outcome-reason'], 'link_registry_impact_map_disabled');
      assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
      delete require.cache[routePath];
    });
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  }
});

test('phase900: os link registry impact internal error emits normalized error outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osLinkRegistryImpact');
  const linkRegistryRepoPath = require.resolve('../../src/repos/firestore/linkRegistryRepo');
  const taskContentsRepoPath = require.resolve('../../src/repos/firestore/taskContentsRepo');
  const notificationsRepoPath = require.resolve('../../src/repos/firestore/notificationsRepo');
  const cityPacksRepoPath = require.resolve('../../src/repos/firestore/cityPacksRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const featureFlagsPath = require.resolve('../../src/domain/tasks/featureFlags');
  const prevToken = process.env.ADMIN_OS_TOKEN;
  process.env.ADMIN_OS_TOKEN = 'phase900_admin_token';

  try {
    await withModuleStubs({
      [featureFlagsPath]: { isLinkRegistryImpactMapEnabled: () => true },
      [linkRegistryRepoPath]: {
        listLinks: async () => {
          throw new Error('boom');
        }
      },
      [taskContentsRepoPath]: { listTaskContents: async () => ([]) },
      [notificationsRepoPath]: { listNotifications: async () => ([]) },
      [cityPacksRepoPath]: { listCityPacks: async () => ([]) },
      [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T17_ERROR' }) }
    }, async () => {
      delete require.cache[routePath];
      const { handleImpact } = require('../../src/routes/admin/osLinkRegistryImpact');
      const res = createResCapture();
      await handleImpact(createReq('/api/admin/os/link-registry-impact?limit=10', 'trace_phase900_t17_error'), res);

      const body = res.readJson();
      assert.equal(res.result.statusCode, 500);
      assert.equal(body.ok, false);
      assert.equal(body.error, 'error');
      assert.equal(body.outcome && body.outcome.state, 'error');
      assert.equal(body.outcome && body.outcome.reason, 'error');
      assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_link_registry_impact');
      assert.equal(res.result.headers['x-member-outcome-state'], 'error');
      assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
      assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
      delete require.cache[routePath];
    });
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
  }
});
