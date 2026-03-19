'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleList, handleCreate, handleUpdate, handleDelete } = require('../../src/routes/admin/kbArticles');

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

test('phase900: kb articles list success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleList({
    method: 'GET',
    url: '/api/admin/kb/articles',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_kb_list_trace_ok',
      'x-request-id': 'phase900_kb_list_req_ok'
    }
  }, res, {
    searchActiveArticles: async () => ([{ id: 'kb_001', title: 'Article 1' }]),
    appendAuditLog: async () => ({ id: 'audit_kb_list_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.data));
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.kb_articles_list');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: kb articles create invalid schema emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleCreate({
    method: 'POST',
    url: '/api/admin/kb/articles',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, JSON.stringify({ title: 'invalid only' }), {
    validateKbArticle: () => ({
      valid: false,
      errors: ['status: must be one of active|draft|disabled']
    }),
    appendAuditLog: async () => ({ id: 'audit_kb_create_invalid' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 422);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'kb_schema_invalid');
  assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'kb_schema_invalid');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.kb_articles_create');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'kb_schema_invalid');
});

test('phase900: kb articles create success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCreate({
    method: 'POST',
    url: '/api/admin/kb/articles',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_kb_create_trace_ok',
      'x-request-id': 'phase900_kb_create_req_ok'
    }
  }, res, JSON.stringify({
    status: 'active',
    riskLevel: 'low',
    version: '1.0.0',
    validUntil: '2099-12-31T00:00:00.000Z',
    allowedIntents: [],
    title: 'KB Article',
    body: 'KB body',
    locale: 'ja'
  }), {
    validateKbArticle: () => ({ valid: true, errors: [] }),
    createArticle: async () => ({ id: 'kb_created_001' }),
    appendAuditLog: async () => ({ id: 'audit_kb_create_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data && body.data.id, 'kb_created_001');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.kb_articles_create');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: kb articles update missing article id emits normalized not_found outcome metadata', async () => {
  const res = createResCapture();
  await handleUpdate({
    method: 'PATCH',
    url: '/api/admin/kb/articles',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, JSON.stringify({ title: 'Updated' }), '');

  const body = res.readJson();
  assert.equal(res.result.statusCode, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'not found');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'not_found');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.kb_articles_update');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'not_found');
});

test('phase900: kb articles update success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleUpdate({
    method: 'PATCH',
    url: '/api/admin/kb/articles/kb_123',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_kb_update_trace_ok',
      'x-request-id': 'phase900_kb_update_req_ok'
    }
  }, res, JSON.stringify({ title: 'Updated KB' }), 'kb_123', {
    updateArticle: async () => ({ id: 'kb_123' }),
    appendAuditLog: async () => ({ id: 'audit_kb_update_ok' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.data && body.data.id, 'kb_123');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.kb_articles_update');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: kb articles delete internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleDelete({
    method: 'DELETE',
    url: '/api/admin/kb/articles/kb_999',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, 'kb_999', {
    deleteArticle: async () => {
      throw new Error('boom');
    },
    appendAuditLog: async () => ({ id: 'audit_kb_delete_error' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'error');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.kb_articles_delete');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
});
