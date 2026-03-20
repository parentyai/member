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

async function withCityPackBulletinsHandler(repoOverrides, run) {
  const repoPath = require.resolve('../../src/repos/firestore/cityPackBulletinsRepo');
  const routePath = require.resolve('../../src/routes/admin/cityPackBulletins');
  const originalRepo = require.cache[repoPath];
  const originalRoute = require.cache[routePath];

  require.cache[repoPath] = {
    id: repoPath,
    filename: repoPath,
    loaded: true,
    exports: Object.assign({
      listBulletins: async () => [],
      getBulletin: async () => null,
      createBulletin: async () => ({ id: 'bulletin_stub' }),
      updateBulletin: async () => ({ ok: true })
    }, repoOverrides || {})
  };
  delete require.cache[routePath];

  try {
    const { handleCityPackBulletins } = require('../../src/routes/admin/cityPackBulletins');
    await run(handleCityPackBulletins);
  } finally {
    if (originalRepo) require.cache[repoPath] = originalRepo;
    else delete require.cache[repoPath];
    if (originalRoute) require.cache[routePath] = originalRoute;
    else delete require.cache[routePath];
  }
}

test('phase900: city pack bulletins list success emits completed outcome metadata', async () => {
  await withCityPackBulletinsHandler({
    listBulletins: async () => ([
      { id: 'cpb_001', status: 'draft' },
      { id: 'cpb_002', status: 'approved' }
    ])
  }, async (handleCityPackBulletins) => {
    const res = createResCapture();
    await handleCityPackBulletins({
      method: 'GET',
      url: '/api/admin/city-pack-bulletins?limit=2',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_city_pack_list'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 200);
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.items), true);
    assert.equal(body.items.length, 2);
    assert.equal(body.outcome && body.outcome.state, 'success');
    assert.equal(body.outcome && body.outcome.reason, 'completed');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_bulletins_list');
    assert.equal(res.result.headers['x-member-outcome-state'], 'success');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  });
});

test('phase900: city pack bulletins create invalid json emits normalized error outcome metadata', async () => {
  await withCityPackBulletinsHandler({}, async (handleCityPackBulletins) => {
    const res = createResCapture();
    await handleCityPackBulletins({
      method: 'POST',
      url: '/api/admin/city-pack-bulletins',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_city_pack_invalid_json'
      }
    }, res, '{');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 400);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'invalid json');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'invalid_json');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_bulletins_create');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_json');
  });
});

test('phase900: city pack bulletins unmatched path emits normalized not_found outcome metadata', async () => {
  await withCityPackBulletinsHandler({}, async (handleCityPackBulletins) => {
    const res = createResCapture();
    await handleCityPackBulletins({
      method: 'GET',
      url: '/api/admin/city-pack-bulletins/not-supported/path',
      headers: {
        'x-actor': 'phase900_actor',
        'x-trace-id': 'trace_phase900_city_pack_not_found'
      }
    }, res, '');

    const body = res.readJson();
    assert.equal(res.result.statusCode, 404);
    assert.equal(body.ok, false);
    assert.equal(body.error, 'not found');
    assert.equal(body.outcome && body.outcome.state, 'error');
    assert.equal(body.outcome && body.outcome.reason, 'not_found');
    assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_bulletins');
    assert.equal(res.result.headers['x-member-outcome-state'], 'error');
    assert.equal(res.result.headers['x-member-outcome-reason'], 'not_found');
  });
});
