'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  getDb,
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleRedacMembershipUnlink } = require('../../src/routes/admin/redacMembershipUnlink');
const { normalizeRedacMembershipId, computeRedacMembershipIdHash } = require('../../src/domain/redacMembershipId');
const { REDAC_LEGACY_LINK_COLLECTION } = require('../../src/domain/canonicalAuthority');

let prevSecret;

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

beforeEach(() => {
  prevSecret = process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
  process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = 'test-redac-membership-hmac-secret';
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
  if (typeof prevSecret === 'string') process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET = prevSecret;
  else delete process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET;
});

test('phase900: redac membership unlink returns completed outcome on success', async () => {
  const db = getDb();
  const normalized = normalizeRedacMembershipId('22-2222');
  const hash = computeRedacMembershipIdHash(normalized, process.env.REDAC_MEMBERSHIP_ID_HMAC_SECRET);

  await db.collection('users').doc('U_LINKED').set({
    createdAt: '2026-03-01T00:00:00.000Z',
    ridacMembershipIdHash: hash,
    ridacMembershipIdLast4: '2222'
  }, { merge: false });
  await db.collection(REDAC_LEGACY_LINK_COLLECTION).doc(hash).set({
    lineUserId: 'U_LINKED',
    ridacMembershipIdHash: hash,
    ridacMembershipIdLast4: '2222',
    linkedAt: '2026-03-01T00:00:00.000Z'
  }, { merge: false });

  const req = {
    method: 'POST',
    url: '/api/admin/redac-membership/unlink',
    headers: {
      'x-actor': 'admin_test',
      'x-request-id': 'req_phase900_redac_success'
    }
  };
  const res = createResCapture();
  await handleRedacMembershipUnlink(req, res, JSON.stringify({ redacMembershipId: '22-2222' }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 200);
  assert.equal(body.ok, true);
  assert.equal(body.outcome && body.outcome.state, 'success');
  assert.equal(body.outcome && body.outcome.reason, 'completed');
  assert.equal(body.outcome && body.outcome.guard && body.outcome.guard.routeKey, 'admin.redac_membership_unlink');
  assert.equal(res.result.headers['x-member-outcome-state'], 'success');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'completed');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: redac membership unlink reports invalid format with outcome metadata', async () => {
  const req = {
    method: 'POST',
    url: '/api/admin/redac-membership/unlink',
    headers: {
      'x-actor': 'admin_test',
      'x-request-id': 'req_phase900_redac_invalid'
    }
  };
  const res = createResCapture();
  await handleRedacMembershipUnlink(req, res, JSON.stringify({ redacMembershipId: 'bad-format' }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 400);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'invalid redacMembershipId format');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'invalid_redac_membership_id_format');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'invalid_redac_membership_id_format');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});

test('phase900: redac membership unlink reports not found with outcome metadata', async () => {
  const req = {
    method: 'POST',
    url: '/api/admin/redac-membership/unlink',
    headers: {
      'x-actor': 'admin_test',
      'x-request-id': 'req_phase900_redac_not_found'
    }
  };
  const res = createResCapture();
  await handleRedacMembershipUnlink(req, res, JSON.stringify({ redacMembershipId: '22-2222' }));

  const body = res.readJson();
  assert.equal(res.result.statusCode, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'not_found');
  assert.equal(body.outcome && body.outcome.state, 'error');
  assert.equal(body.outcome && body.outcome.reason, 'redac_membership_not_found');
  assert.equal(res.result.headers['x-member-outcome-state'], 'error');
  assert.equal(res.result.headers['x-member-outcome-reason'], 'redac_membership_not_found');
  assert.equal(res.result.headers['x-member-outcome-route-type'], 'admin_route');
});
