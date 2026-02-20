'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateKbArticle } = require('../../src/repos/firestore/faqArticlesRepo');

const VALID_ARTICLE = {
  status: 'active',
  riskLevel: 'low',
  version: '1.0.0',
  validUntil: '2099-12-31T00:00:00.000Z',
  allowedIntents: [],
  title: 'テスト記事',
  body: '内容',
  locale: 'ja'
};

test('validateKbArticle: all required fields → valid', () => {
  const result = validateKbArticle(VALID_ARTICLE);
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test('validateKbArticle: missing status → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { status: undefined });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('status:')), `errors: ${JSON.stringify(result.errors)}`);
});

test('validateKbArticle: invalid status → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { status: 'unknown' });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
});

test('validateKbArticle: missing riskLevel → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { riskLevel: undefined });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('riskLevel:')), `errors: ${JSON.stringify(result.errors)}`);
});

test('validateKbArticle: invalid riskLevel → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { riskLevel: 'critical' });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
});

test('validateKbArticle: missing both version and versionSemver → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { version: undefined, versionSemver: undefined });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('version:')), `errors: ${JSON.stringify(result.errors)}`);
});

test('validateKbArticle: versionSemver only (no version) → valid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { version: undefined, versionSemver: '2.1.0' });
  const result = validateKbArticle(data);
  assert.equal(result.valid, true);
});

test('validateKbArticle: invalid semver string → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { version: 'not-a-version', versionSemver: undefined });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
});

test('validateKbArticle: missing validUntil → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { validUntil: undefined });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('validUntil:')), `errors: ${JSON.stringify(result.errors)}`);
});

test('validateKbArticle: validUntil null → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { validUntil: null });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
});

test('validateKbArticle: allowedIntents undefined → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { allowedIntents: undefined });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.startsWith('allowedIntents:')), `errors: ${JSON.stringify(result.errors)}`);
});

test('validateKbArticle: allowedIntents null → invalid', () => {
  const data = Object.assign({}, VALID_ARTICLE, { allowedIntents: null });
  const result = validateKbArticle(data);
  assert.equal(result.valid, false);
});

test('validateKbArticle: allowedIntents empty array [] → valid (all intents allowed)', () => {
  const data = Object.assign({}, VALID_ARTICLE, { allowedIntents: [] });
  const result = validateKbArticle(data);
  assert.equal(result.valid, true);
});

test('validateKbArticle: multiple errors returned', () => {
  const result = validateKbArticle({ title: 'minimal' });
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 4, `expected >=4 errors, got: ${result.errors.length}`);
});
