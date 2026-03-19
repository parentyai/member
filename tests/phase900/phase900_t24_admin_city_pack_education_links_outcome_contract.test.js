'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleCityPackEducationLinks } = require('../../src/routes/admin/cityPackEducationLinks');

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

test('phase900: city pack education links list success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackEducationLinks({
    method: 'GET',
    url: '/api/admin/city-pack-education-links?limit=5',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_education_list_trace',
      'x-request-id': 'phase900_education_list_req'
    }
  }, res, '', {
    listSchoolCalendarLinks: async () => ([{
      id: 'edu_001',
      linkRegistryId: 'link_001',
      sourceRefId: 'sr_001',
      status: 'active'
    }]),
    getLink: async () => ({
      id: 'link_001',
      title: 'Public Calendar',
      url: 'https://example.org/public-calendar',
      domainClass: 'school_public',
      schoolType: 'public',
      eduScope: 'calendar',
      tags: []
    }),
    getSourceRef: async () => ({
      id: 'sr_001',
      status: 'needs_review',
      validUntil: null,
      lastResult: null,
      confidenceScore: 0.9
    }),
    appendAuditLog: async () => ({ id: 'audit_education_list' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_education_links_list');
});

test('phase900: city pack education links create success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackEducationLinks({
    method: 'POST',
    url: '/api/admin/city-pack-education-links',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_education_create_trace',
      'x-request-id': 'phase900_education_create_req'
    }
  }, res, JSON.stringify({
    regionKey: 'ny::new-york',
    schoolYear: '2025-2026',
    linkRegistryId: 'link_002'
  }), {
    getLink: async () => ({
      id: 'link_002',
      url: 'https://example.org/public-calendar',
      schoolType: 'public',
      eduScope: 'calendar',
      domainClass: 'school_public'
    }),
    createSourceRef: async () => ({ id: 'sr_002' }),
    createSchoolCalendarLink: async () => ({ id: 'edu_002' }),
    appendAuditLog: async () => ({ id: 'audit_education_create' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 201);
  assert.equal(body.ok, true);
  assert.equal(body.schoolCalendarLinkId, 'edu_002');
  assert.equal(body.sourceRefId, 'sr_002');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_education_links_create');
});

test('phase900: city pack education links replace missing replacement id emits normalized outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackEducationLinks({
    method: 'POST',
    url: '/api/admin/city-pack-education-links/edu_003/replace',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, '{}', {
    getSchoolCalendarLink: async () => ({
      id: 'edu_003',
      regionKey: 'ny::new-york',
      schoolYear: '2025-2026',
      sourceRefId: 'sr_003'
    })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'replacementLinkRegistryId required');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'replacement_link_registry_id_required');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_education_links_action');
});

test('phase900: city pack education links replace success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackEducationLinks({
    method: 'POST',
    url: '/api/admin/city-pack-education-links/edu_004/replace',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_education_replace_trace',
      'x-request-id': 'phase900_education_replace_req'
    }
  }, res, JSON.stringify({
    replacementLinkRegistryId: 'link_004'
  }), {
    getSchoolCalendarLink: async () => ({
      id: 'edu_004',
      regionKey: 'ny::new-york',
      schoolYear: '2025-2026',
      sourceRefId: 'sr_004',
      validUntil: null,
      linkRegistryId: 'link_old'
    }),
    updateSchoolCalendarLink: async () => undefined,
    updateSourceRef: async () => undefined,
    getLink: async () => ({
      id: 'link_004',
      url: 'https://example.org/replacement-calendar',
      schoolType: 'public',
      eduScope: 'calendar',
      domainClass: 'school_public'
    }),
    createSourceRef: async () => ({ id: 'sr_005' }),
    createSchoolCalendarLink: async () => ({ id: 'edu_005' }),
    appendAuditLog: async () => ({ id: 'audit_education_replace' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.archivedId, 'edu_004');
  assert.equal(body.replacementId, 'edu_005');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_education_links_action');
});

test('phase900: city pack education links internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackEducationLinks({
    method: 'GET',
    url: '/api/admin/city-pack-education-links',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_education_error_trace',
      'x-request-id': 'phase900_education_error_req'
    }
  }, res, '', {
    listSchoolCalendarLinks: async () => {
      throw new Error('boom');
    }
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'boom');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_education_links_list');
});
