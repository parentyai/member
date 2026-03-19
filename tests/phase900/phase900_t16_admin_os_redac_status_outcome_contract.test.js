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

function createDbStub({ canonicalDocs = [], legacyDocs = [] } = {}) {
  return {
    collection(name) {
      const docs = name === 'redac_membership_links' ? canonicalDocs : name === 'ridac_membership_links' ? legacyDocs : [];
      return {
        limit() {
          return {
            async get() {
              return {
                docs: docs.map((item) => ({
                  id: item.id,
                  data() {
                    return Object.assign({}, item.data);
                  }
                }))
              };
            }
          };
        }
      };
    }
  };
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

test('phase900: os redac status success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osRedacStatus');
  const firestorePath = require.resolve('../../src/infra/firestore');
  const usersRepoPath = require.resolve('../../src/repos/firestore/usersRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.ADMIN_OS_TOKEN = 'phase900_admin_token';
  process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = 'phase900_redac_secret';

  try {
    await withModuleStubs({
      [firestorePath]: {
        getDb: () => createDbStub({
          canonicalDocs: [
            { id: 'HASH_1', data: { lineUserId: 'U1', redacMembershipIdHash: 'HASH_1' } }
          ],
          legacyDocs: []
        })
      },
      [usersRepoPath]: {
        listUsers: async () => ([
          { id: 'U1', redacMembershipIdHash: 'HASH_1', redacMembershipIdLast4: '0001' }
        ])
      },
      [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T16_SUCCESS' }) }
    }, async () => {
      delete require.cache[routePath];
      const { handleStatus } = require('../../src/routes/admin/osRedacStatus');
      const res = createResCapture();
      await handleStatus(createReq('/api/admin/os/redac/status?limit=50', 'trace_phase900_t16_success'), res);

      const body = res.readJson();
      assert.equal(res.result.statusCode, 200);
      assert.equal(body.ok, true);
      assert.equal(body.summary.status, 'OK');
      assert.equal(body.outcome && body.outcome.state, 'success');
      assert.equal(body.outcome && body.outcome.reason, 'completed');
      assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_redac_status');
      assert.equal(res.result.headers['x-member-outcome-state'], 'success');
      assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
      assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
      delete require.cache[routePath];
    });
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
    else process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevSecret;
  }
});

test('phase900: os redac status warn summary emits degraded outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osRedacStatus');
  const firestorePath = require.resolve('../../src/infra/firestore');
  const usersRepoPath = require.resolve('../../src/repos/firestore/usersRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.ADMIN_OS_TOKEN = 'phase900_admin_token';
  delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;

  try {
    await withModuleStubs({
      [firestorePath]: {
        getDb: () => createDbStub({
          canonicalDocs: [],
          legacyDocs: []
        })
      },
      [usersRepoPath]: {
        listUsers: async () => ([])
      },
      [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T16_DEGRADED' }) }
    }, async () => {
      delete require.cache[routePath];
      const { handleStatus } = require('../../src/routes/admin/osRedacStatus');
      const res = createResCapture();
      await handleStatus(createReq('/api/admin/os/redac/status?limit=25', 'trace_phase900_t16_degraded'), res);

      const body = res.readJson();
      assert.equal(res.result.statusCode, 200);
      assert.equal(body.ok, true);
      assert.equal(body.summary.status, 'WARN');
      assert.ok(Array.isArray(body.summary.issues));
      assert.ok(body.summary.issues.includes('secret_not_configured'));
      assert.equal(body.outcome && body.outcome.state, 'degraded');
      assert.equal(body.outcome && body.outcome.reason, 'issues_detected');
      assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_redac_status');
      assert.equal(res.result.headers['x-member-outcome-state'], 'degraded');
      assert.equal(res.result.headers['x-member-outcome-reason'], 'issues_detected');
      assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
      delete require.cache[routePath];
    });
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
    else process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevSecret;
  }
});

test('phase900: os redac status internal error emits normalized error outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/osRedacStatus');
  const firestorePath = require.resolve('../../src/infra/firestore');
  const usersRepoPath = require.resolve('../../src/repos/firestore/usersRepo');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');
  const prevToken = process.env.ADMIN_OS_TOKEN;
  const prevSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.ADMIN_OS_TOKEN = 'phase900_admin_token';
  process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = 'phase900_redac_secret';

  try {
    await withModuleStubs({
      [firestorePath]: {
        getDb: () => createDbStub()
      },
      [usersRepoPath]: {
        listUsers: async () => {
          throw new Error('boom');
        }
      },
      [auditPath]: { appendAuditLog: async () => ({ id: 'AUDIT_PHASE900_T16_ERROR' }) }
    }, async () => {
      delete require.cache[routePath];
      const { handleStatus } = require('../../src/routes/admin/osRedacStatus');
      const res = createResCapture();
      await handleStatus(createReq('/api/admin/os/redac/status?limit=10', 'trace_phase900_t16_error'), res);

      const body = res.readJson();
      assert.equal(res.result.statusCode, 500);
      assert.equal(body.ok, false);
      assert.equal(body.error, 'error');
      assert.equal(body.outcome && body.outcome.state, 'error');
      assert.equal(body.outcome && body.outcome.reason, 'error');
      assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.os_redac_status');
      assert.equal(res.result.headers['x-member-outcome-state'], 'error');
      assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
      assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
      delete require.cache[routePath];
    });
  } finally {
    if (prevToken === undefined) delete process.env.ADMIN_OS_TOKEN;
    else process.env.ADMIN_OS_TOKEN = prevToken;
    if (prevSecret === undefined) delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
    else process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevSecret;
  }
});
