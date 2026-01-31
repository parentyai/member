'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const usersRepo = require('../../src/repos/firestore/usersRepo');
const { handlePhase6MemberSummary } = require('../../src/routes/phase6MemberSummary');

function createRes() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(code, headers) {
      this.statusCode = code;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-01-01T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase6 member summary: 400 when lineUserId missing', async () => {
  const res = createRes();
  const req = { url: '/api/phase6/member/summary' };

  await handlePhase6MemberSummary(req, res);

  assert.strictEqual(res.statusCode, 400);
  assert.strictEqual(res.body, 'lineUserId required');
});

test('phase6 member summary: 404 when user not found', async () => {
  const res = createRes();
  const req = { url: '/api/phase6/member/summary?lineUserId=U404' };

  await handlePhase6MemberSummary(req, res);

  assert.strictEqual(res.statusCode, 404);
  assert.strictEqual(res.body, 'user not found');
});

test('phase6 member summary: returns minimal summary', async () => {
  await usersRepo.createUser('U1', { memberNumber: 'ABC1234', createdAt: '2000-01-01T00:00:00Z' });
  const res = createRes();
  const req = { url: '/api/phase6/member/summary?lineUserId=U1' };

  await handlePhase6MemberSummary(req, res);

  assert.strictEqual(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.strictEqual(payload.ok, true);
  assert.strictEqual(payload.lineUserId, 'U1');
  assert.deepStrictEqual(payload.member, {
    hasMemberNumber: true,
    memberNumberMasked: '****1234',
    memberNumberStale: false
  });
  assert.deepStrictEqual(payload.ops, {
    needsAttention: false,
    reasonCodes: []
  });
  assert.strictEqual(payload.meta.source, 'phase5-derived');
  assert.ok(typeof payload.meta.generatedAt === 'string');
});
