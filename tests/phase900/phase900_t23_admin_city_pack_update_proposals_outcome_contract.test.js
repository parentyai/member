'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { handleCityPackUpdateProposals } = require('../../src/routes/admin/cityPackUpdateProposals');

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

test('phase900: city pack update proposals list success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackUpdateProposals({
    method: 'GET',
    url: '/api/admin/city-pack-update-proposals?status=draft&limit=5',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_proposal_list_trace',
      'x-request-id': 'phase900_proposal_list_req'
    }
  }, res, '', {
    listProposals: async () => ([{ id: 'proposal_001', status: 'draft' }])
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_update_proposals_list');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
});

test('phase900: city pack update proposals detail missing emits proposal_not_found outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackUpdateProposals({
    method: 'GET',
    url: '/api/admin/city-pack-update-proposals/proposal_missing',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, '', {
    getProposal: async () => null
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'proposal not found');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'proposal_not_found');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_update_proposals_detail');
});

test('phase900: city pack update proposals create success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackUpdateProposals({
    method: 'POST',
    url: '/api/admin/city-pack-update-proposals',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_proposal_create_trace',
      'x-request-id': 'phase900_proposal_create_req'
    }
  }, res, JSON.stringify({
    cityPackId: 'cp_001',
    summary: 'proposal summary',
    proposalPatch: {
      metadata: {
        note: 'phase900'
      }
    }
  }), {
    createProposal: async () => ({ id: 'proposal_002' }),
    appendAuditLog: async () => ({ id: 'audit_proposal_create' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 201);
  assert.equal(body.ok, true);
  assert.equal(body.proposalId, 'proposal_002');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_update_proposals_create');
});

test('phase900: city pack update proposals approve blocked emits proposal_not_draft outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackUpdateProposals({
    method: 'POST',
    url: '/api/admin/city-pack-update-proposals/proposal_003/approve',
    headers: {
      'x-actor': 'phase900_actor'
    }
  }, res, '{}', {
    getProposal: async () => ({ id: 'proposal_003', status: 'approved', cityPackId: 'cp_001' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 409);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'proposal_not_draft');
  assert.equal(body.outcome && body.outcome.state, 'blocked');
  assert.equal(body.outcome && body.outcome.reason, 'proposal_not_draft');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_update_proposals_action');
});

test('phase900: city pack update proposals apply success emits completed outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackUpdateProposals({
    method: 'POST',
    url: '/api/admin/city-pack-update-proposals/proposal_004/apply',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_proposal_apply_trace',
      'x-request-id': 'phase900_proposal_apply_req'
    }
  }, res, '{}', {
    getProposal: async (proposalId) => {
      if (proposalId === 'proposal_004') {
        return {
          id: 'proposal_004',
          status: 'approved',
          cityPackId: 'cp_004',
          proposalPatch: { metadata: { note: 'apply' } }
        };
      }
      if (proposalId === 'cp_004') {
        return null;
      }
      return null;
    },
    getCityPack: async (cityPackId) => {
      if (cityPackId === 'cp_004') return { id: 'cp_004' };
      return null;
    },
    updateCityPack: async () => undefined,
    updateProposal: async () => undefined,
    appendAuditLog: async () => ({ id: 'audit_proposal_apply' })
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.proposalId, 'proposal_004');
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_update_proposals_action');
});

test('phase900: city pack update proposals list internal error emits normalized error outcome metadata', async () => {
  const res = createResCapture();
  await handleCityPackUpdateProposals({
    method: 'GET',
    url: '/api/admin/city-pack-update-proposals',
    headers: {
      'x-actor': 'phase900_actor',
      'x-trace-id': 'phase900_proposal_error_trace',
      'x-request-id': 'phase900_proposal_error_req'
    }
  }, res, '', {
    listProposals: async () => {
      throw new Error('boom');
    }
  });

  const body = res.readJson();
  assert.equal(res.result.statusCode, 500);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'error');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'error');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.city_pack_update_proposals_list');
});
