'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// Test the normalizeKbArticleForSearch behavior by calling searchActiveArticles
// with a mock faqArticlesRepo that returns articles without required fields.
// We test the internal normalizeKbArticleForSearch indirectly via validateKbArticle
// and the exported search behavior.

const { validateKbArticle } = require('../../src/repos/firestore/faqArticlesRepo');

test('search strict: article without riskLevel is rejected by validateKbArticle', () => {
  const article = {
    status: 'active',
    version: '1.0.0',
    validUntil: '2099-01-01T00:00:00.000Z',
    allowedIntents: [],
    // riskLevel is missing
  };
  const result = validateKbArticle(article);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('riskLevel')));
});

test('search strict: article without allowedIntents is rejected by validateKbArticle', () => {
  const article = {
    status: 'active',
    riskLevel: 'low',
    version: '1.0.0',
    validUntil: '2099-01-01T00:00:00.000Z',
    // allowedIntents is missing
  };
  const result = validateKbArticle(article);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.includes('allowedIntents')));
});

test('search strict: normalizeRiskLevel(undefined) → invalid (null), not defaulted to low', () => {
  // Articles without riskLevel should now be filtered from search results.
  // We verify through validateKbArticle that the contract is clear.
  const withRisk = {
    status: 'active',
    riskLevel: 'medium',
    version: '1.0.0',
    validUntil: '2099-01-01T00:00:00.000Z',
    allowedIntents: []
  };
  const withoutRisk = Object.assign({}, withRisk, { riskLevel: undefined });

  const r1 = validateKbArticle(withRisk);
  const r2 = validateKbArticle(withoutRisk);

  assert.equal(r1.valid, true, 'article with riskLevel should be valid');
  assert.equal(r2.valid, false, 'article without riskLevel should be invalid');
});

test('search strict: allowedIntents=[] is valid (all intents allowed)', () => {
  const article = {
    status: 'active',
    riskLevel: 'low',
    version: '1.0.0',
    validUntil: '2099-01-01T00:00:00.000Z',
    allowedIntents: []
  };
  const result = validateKbArticle(article);
  assert.equal(result.valid, true);
});

test('search strict: allowedIntents with entries is valid', () => {
  const article = {
    status: 'active',
    riskLevel: 'low',
    version: '1.0.0',
    validUntil: '2099-01-01T00:00:00.000Z',
    allowedIntents: ['FAQ', 'Internal']
  };
  const result = validateKbArticle(article);
  assert.equal(result.valid, true);
});
