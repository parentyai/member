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

async function withImplementationTargetsHandler(overrides, run) {
  const targetsPath = require.resolve('../../src/domain/implementationTargets');
  const routePath = require.resolve('../../src/routes/admin/implementationTargets');
  const originalTargets = require.cache[targetsPath];
  const originalRoute = require.cache[routePath];

  require.cache[targetsPath] = {
    id: targetsPath,
    filename: targetsPath,
    loaded: true,
    exports: Object.assign({
      listImplementationTargets: () => ([
        { id: 'CO1-D-001-A01', name: 'Outcome Contract', tag: 'admin', status: 'IN' }
      ])
    }, overrides && overrides.implementationTargets || {})
  };
  delete require.cache[routePath];

  try {
    const { handleImplementationTargets } = require('../../src/routes/admin/implementationTargets');
    await run(handleImplementationTargets);
  } finally {
    if (originalTargets) require.cache[targetsPath] = originalTargets;
    else delete require.cache[targetsPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: implementation targets success keeps array payload and emits completed outcome headers', async () => {
  await withImplementationTargetsHandler({}, async (handleImplementationTargets) => {
    const res = createResCapture();
    await handleImplementationTargets({
      method: 'GET',
      url: '/admin/implementation-targets'
    }, res);

    const payload = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(Array.isArray(payload), true);
    assert.equal(payload.length, 1);
    assert.equal(payload[0].id, 'CO1-D-001-A01');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});

test('phase900: implementation targets internal error emits error outcome headers', async () => {
  await withImplementationTargetsHandler({
    implementationTargets: {
      listImplementationTargets: () => {
        throw new Error('boom');
      }
    }
  }, async (handleImplementationTargets) => {
    const res = createResCapture();
    await handleImplementationTargets({
      method: 'GET',
      url: '/admin/implementation-targets'
    }, res);

    assert.equal(res.result.statusCode, 500);
    assert.equal(res.result.body, 'error');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
    assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
  });
});
