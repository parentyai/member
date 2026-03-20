'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function createResCapture() {
  const stagedHeaders = {};
  const result = { statusCode: null, headers: null, body: '' };
  return {
    setHeader(name, value) {
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

function withModuleStubs(stubMap, callback) {
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
  return Promise.resolve()
    .then(callback)
    .finally(() => {
      previous.forEach((entry, modulePath) => {
        if (entry) require.cache[modulePath] = entry;
        else delete require.cache[modulePath];
      });
    });
}

function makeReq(url) {
  return {
    url: url || '/api/admin/link-registry',
    headers: {
      'x-actor': 'tester',
      'x-trace-id': 'trace_phase900_t28',
      'x-request-id': 'req_phase900_t28'
    }
  };
}

test('phase900: link registry list success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/linkRegistry');
  const listPath = require.resolve('../../src/usecases/linkRegistry/listLinks');

  await withModuleStubs({
    [listPath]: {
      listLinks: async () => ([{ id: 'l1' }])
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleList } = require('../../src/routes/admin/linkRegistry');
    const res = createResCapture();
    await handleList(makeReq('/api/admin/link-registry?limit=5'), res);
    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.link_registry_list');
    delete require.cache[routePath];
  });
});

test('phase900: link registry create invalid json emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/linkRegistry');
  delete require.cache[routePath];
  const { handleCreate } = require('../../src/routes/admin/linkRegistry');
  const res = createResCapture();
  await handleCreate(makeReq(), res, '{');
  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.link_registry_create');
  delete require.cache[routePath];
});

test('phase900: link registry update validation failure emits normalized outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/linkRegistry');
  const updatePath = require.resolve('../../src/usecases/linkRegistry/updateLink');

  await withModuleStubs({
    [updatePath]: {
      updateLink: async () => {
        const err = new Error('duplicate_title');
        err.statusCode = 409;
        err.code = 'duplicate_title';
        throw err;
      }
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleUpdate } = require('../../src/routes/admin/linkRegistry');
    const res = createResCapture();
    await handleUpdate(makeReq(), res, JSON.stringify({ title: 'dup' }), 'l1');
    const body = res.readJson();
    assert.equal(res.result.statusCode, 409);
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'duplicate_title');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.link_registry_update');
    delete require.cache[routePath];
  });
});

test('phase900: link registry health success emits completed outcome metadata', async () => {
  const routePath = require.resolve('../../src/routes/admin/linkRegistry');
  const healthPath = require.resolve('../../src/usecases/linkRegistry/checkLinkHealth');
  const auditPath = require.resolve('../../src/usecases/audit/appendAuditLog');

  await withModuleStubs({
    [healthPath]: {
      checkLinkHealth: async () => ({ id: 'l1' })
    },
    [auditPath]: {
      appendAuditLog: async () => ({ id: 'audit_phase900_t28' })
    }
  }, async () => {
    delete require.cache[routePath];
    const { handleHealth } = require('../../src/routes/admin/linkRegistry');
    const res = createResCapture();
    await handleHealth(makeReq(), res, JSON.stringify({ state: 'OK' }), 'l1');
    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.link_registry_health');
    delete require.cache[routePath];
  });
});
