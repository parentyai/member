'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const linkRegistryRepo = require('../../src/repos/firestore/linkRegistryRepo');
const { handleVendors } = require('../../src/routes/admin/vendors');

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

function createHeaders(requestId, traceId) {
  return {
    'x-actor': 'phase900_vendor_tester',
    'x-request-id': requestId,
    'x-trace-id': traceId
  };
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase900: vendors list returns completed outcome metadata', async () => {
  await linkRegistryRepo.createLink({
    title: 'Vendor Link',
    url: 'https://vendor.example.com/path',
    vendorKey: 'vendor_example',
    vendorLabel: 'Vendor Example'
  });

  const res = createResCapture();
  await handleVendors({
    method: 'GET',
    url: '/api/admin/vendors?limit=5',
    headers: createHeaders('req_phase900_vendors_list', 'trace_phase900_vendors_list')
  }, res, '');

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.vendors_list');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: vendors shadow relevance rejects missing lineUserId with outcome metadata', async () => {
  const res = createResCapture();
  await handleVendors({
    method: 'GET',
    url: '/api/admin/vendors/shadow-relevance?limit=5',
    headers: createHeaders('req_phase900_vendors_shadow_missing', 'trace_phase900_vendors_shadow_missing')
  }, res, '');

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'lineUserId required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'line_user_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.vendors_shadow_relevance');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'line_user_id_required');
});

test('phase900: vendors edit rejects empty patch with outcome metadata', async () => {
  const res = createResCapture();
  await handleVendors({
    method: 'POST',
    url: '/api/admin/vendors/vendor_phase900/edit',
    headers: createHeaders('req_phase900_vendors_edit', 'trace_phase900_vendors_edit')
  }, res, '{}');

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'patch fields required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'patch_fields_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.vendors_edit');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'patch_fields_required');
});

test('phase900: vendors disable returns completed outcome metadata', async () => {
  const link = await linkRegistryRepo.createLink({
    title: 'Vendor Link',
    url: 'https://vendor.example.com/path',
    vendorKey: 'vendor_example',
    vendorLabel: 'Vendor Example'
  });

  const res = createResCapture();
  await handleVendors({
    method: 'POST',
    url: `/api/admin/vendors/${encodeURIComponent(link.id)}/disable`,
    headers: createHeaders('req_phase900_vendors_disable', 'trace_phase900_vendors_disable')
  }, res, '{}');

  const body = res.readJson();
  const updated = await linkRegistryRepo.getLink(link.id);
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.id, link.id);
  assert.equal(updated.lastHealth && updated.lastHealth.state, 'WARN');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.vendors_disable');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: vendors unknown route returns not_found outcome metadata', async () => {
  const res = createResCapture();
  await handleVendors({
    method: 'GET',
    url: '/api/admin/vendors/unknown',
    headers: createHeaders('req_phase900_vendors_not_found', 'trace_phase900_vendors_not_found')
  }, res, '');

  const body = res.readJson();
  assert.equal(res.result.statusCode, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'not found');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'not_found');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.vendors');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'not_found');
});
