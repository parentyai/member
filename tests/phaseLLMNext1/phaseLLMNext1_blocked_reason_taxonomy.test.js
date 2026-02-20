'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toBlockedReasonCategory } = require('../../src/llm/blockedReasonCategory');

test('taxonomy: contact_source_required → CONTACT_SOURCE_REQUIRED', () => {
  assert.equal(toBlockedReasonCategory('contact_source_required'), 'CONTACT_SOURCE_REQUIRED');
});

test('taxonomy: kb_schema_invalid → KB_SCHEMA_INVALID', () => {
  assert.equal(toBlockedReasonCategory('kb_schema_invalid'), 'KB_SCHEMA_INVALID');
});

test('taxonomy: llm_api_error → LLM_API_ERROR', () => {
  assert.equal(toBlockedReasonCategory('llm_api_error'), 'LLM_API_ERROR');
});

test('taxonomy: llm_timeout → LLM_API_ERROR', () => {
  assert.equal(toBlockedReasonCategory('llm_timeout'), 'LLM_API_ERROR');
});

test('taxonomy: adapter_missing → LLM_API_ERROR', () => {
  assert.equal(toBlockedReasonCategory('adapter_missing'), 'LLM_API_ERROR');
});

test('taxonomy: existing entries still correct', () => {
  assert.equal(toBlockedReasonCategory('kb_no_match'), 'NO_KB_MATCH');
  assert.equal(toBlockedReasonCategory('low_confidence'), 'LOW_CONFIDENCE');
  assert.equal(toBlockedReasonCategory('direct_url_forbidden'), 'DIRECT_URL_DETECTED');
  assert.equal(toBlockedReasonCategory('warn_link_blocked'), 'WARN_LINK_BLOCKED');
  assert.equal(toBlockedReasonCategory('consent_missing'), 'CONSENT_MISSING');
});

test('taxonomy: unknown reason → UNKNOWN', () => {
  assert.equal(toBlockedReasonCategory('completely_unknown_reason'), 'UNKNOWN');
});

test('taxonomy: llm_disabled with nullOnDisabled=true → null', () => {
  assert.equal(toBlockedReasonCategory('llm_disabled', { nullOnDisabled: true }), null);
});
