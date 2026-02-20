'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const { handleCreate, handleList, handleUpdate, handleDelete } = require('../../src/routes/admin/kbArticles');

function makeReq(overrides) {
  return Object.assign({
    headers: { 'x-actor': 'test_actor' },
    on: () => {}
  }, overrides || {});
}

function makeRes() {
  const res = {
    statusCode: null,
    headers: {},
    body: null,
    writeHead(code, hdrs) { this.statusCode = code; Object.assign(this.headers, hdrs || {}); },
    end(body) { this.body = body; }
  };
  return res;
}

function parseBody(res) {
  try { return JSON.parse(res.body); } catch { return null; }
}

const VALID_ARTICLE = JSON.stringify({
  status: 'active',
  riskLevel: 'low',
  version: '1.0.0',
  validUntil: '2099-12-31T00:00:00.000Z',
  allowedIntents: [],
  title: 'テスト記事',
  body: '内容',
  locale: 'ja'
});

const INVALID_ARTICLE = JSON.stringify({ title: 'タイトルのみ' });

test('handleCreate: missing x-actor → 400', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => { clearDbForTest(); clearServerTimestampForTest(); });

  const req = makeReq({ headers: {} });
  const res = makeRes();
  await handleCreate(req, res, VALID_ARTICLE);
  assert.equal(res.statusCode, 400);
  const body = parseBody(res);
  assert.equal(body.ok, false);
});

test('handleCreate: invalid article body → 422 with errors', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => { clearDbForTest(); clearServerTimestampForTest(); });

  const req = makeReq();
  const res = makeRes();
  await handleCreate(req, res, INVALID_ARTICLE);
  assert.equal(res.statusCode, 422);
  const body = parseBody(res);
  assert.equal(body.ok, false);
  assert.equal(body.error, 'kb_schema_invalid');
  assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
});

test('handleCreate: valid article → 200 with id', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => { clearDbForTest(); clearServerTimestampForTest(); });

  const req = makeReq();
  const res = makeRes();
  await handleCreate(req, res, VALID_ARTICLE);
  assert.equal(res.statusCode, 200);
  const body = parseBody(res);
  assert.equal(body.ok, true);
  assert.ok(typeof body.data.id === 'string' && body.data.id.length > 0);
});

test('handleList: returns articles → 200', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => { clearDbForTest(); clearServerTimestampForTest(); });

  // Pre-populate with a valid article
  const article = JSON.parse(VALID_ARTICLE);
  await db.collection('faq_articles').doc('a1').set(Object.assign({}, article, { updatedAt: '2026-01-01T00:00:00.000Z' }));

  const req = makeReq();
  const res = makeRes();
  await handleList(req, res);
  assert.equal(res.statusCode, 200);
  const body = parseBody(res);
  assert.equal(body.ok, true);
  assert.ok(Array.isArray(body.data));
});

test('handleUpdate: valid patch → 200 with id', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => { clearDbForTest(); clearServerTimestampForTest(); });

  const req = makeReq();
  const res = makeRes();
  await handleUpdate(req, res, JSON.stringify({ title: '更新タイトル' }), 'article-id-1');
  assert.equal(res.statusCode, 200);
  const body = parseBody(res);
  assert.equal(body.ok, true);
  assert.equal(body.data.id, 'article-id-1');
});

test('handleDelete: soft deletes article → 200 with id', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => { clearDbForTest(); clearServerTimestampForTest(); });

  const req = makeReq();
  const res = makeRes();
  await handleDelete(req, res, 'article-id-1');
  assert.equal(res.statusCode, 200);
  const body = parseBody(res);
  assert.equal(body.ok, true);
  assert.equal(body.data.id, 'article-id-1');
});
