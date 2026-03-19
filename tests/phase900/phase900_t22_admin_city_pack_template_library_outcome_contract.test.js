'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleCityPackTemplateLibrary } = require('../../src/routes/admin/cityPackTemplateLibrary');

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

test('phase900: city pack template library list success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackTemplateLibrary({
    method: 'GET',
    url: '/api/admin/city-pack-template-library?limit=5',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_template_list_trace',
      'x-request-id': 'phase900_template_list_req'
    }
  }, res, '', {
    listTemplates: async () => ([{ id: 'tpl_001', name: 'Template 1', status: 'active' }]),
    appendAuditLog: async () => ({ id: 'audit_template_list' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.items));
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_template_library_list');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
});

test('phase900: city pack template library detail missing emits template_not_found outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackTemplateLibrary({
    method: 'GET',
    url: '/api/admin/city-pack-template-library/tpl_missing',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, '', {
    getTemplate: async () => null
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'template not found');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'template_not_found');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_template_library_detail');
});

test('phase900: city pack template library create success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackTemplateLibrary({
    method: 'POST',
    url: '/api/admin/city-pack-template-library',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_template_create_trace',
      'x-request-id': 'phase900_template_create_req'
    }
  }, res, JSON.stringify({
    name: 'New Template',
    template: { slots: [] },
    status: 'draft',
    requestId: 'req_create'
  }), {
    createTemplate: async () => ({ id: 'tpl_002' }),
    appendAuditLog: async () => ({ id: 'audit_template_create' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 201);
  assert.equal(body.ok, true);
  assert.equal(body.templateId, 'tpl_002');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_template_library_create');
});

test('phase900: city pack template library action success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackTemplateLibrary({
    method: 'POST',
    url: '/api/admin/city-pack-template-library/tpl_003/activate',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_template_action_trace',
      'x-request-id': 'phase900_template_action_req'
    }
  }, res, '', {
    getTemplate: async () => ({ id: 'tpl_003', status: 'draft' }),
    updateTemplate: async () => undefined,
    appendAuditLog: async () => ({ id: 'audit_template_action' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.templateId, 'tpl_003');
  assert.equal(body.status, 'active');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_template_library_action');
});

test('phase900: city pack template library list internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackTemplateLibrary({
    method: 'GET',
    url: '/api/admin/city-pack-template-library',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_template_error_trace',
      'x-request-id': 'phase900_template_error_req'
    }
  }, res, '', {
    listTemplates: async () => {
      throw new Error('boom');
    }
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'boom');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_template_library_list');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'error');
});
