'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildLlmInputView } = require('../../src/usecases/llm/buildLlmInputView');

test('phaseLLM6: allow-list blocks out-of-scope secret field', () => {
  const result = buildLlmInputView({
    input: {
      readiness: { status: 'READY' },
      adminToken: 'SECRET_VALUE'
    },
    allowList: ['readiness.status'],
    fieldCategories: {
      readiness: 'Internal',
      adminToken: 'Secret'
    }
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'allow_list_violation');
  assert.ok(Array.isArray(result.blockedPaths));
  assert.ok(result.blockedPaths.includes('adminToken'));
});

test('phaseLLM6: restricted category is blocked when not allowed', () => {
  const result = buildLlmInputView({
    input: {
      lineUserId: 'U123'
    },
    allowList: ['lineUserId'],
    fieldCategories: {
      lineUserId: 'Restricted'
    },
    allowRestricted: false
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blockedReason, 'restricted_field_detected');
});
