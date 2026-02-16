'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { ENV_KEY, isLlmFeatureEnabled } = require('../../src/llm/featureFlag');

test('phaseLLM1: feature flag disabled by default', () => {
  const env = {};
  assert.strictEqual(isLlmFeatureEnabled(env), false);
});

test('phaseLLM1: feature flag enabled values', () => {
  const truthy = ['1', 'true', 'TRUE', 'yes', 'on'];
  truthy.forEach((value) => {
    const env = { [ENV_KEY]: value };
    assert.strictEqual(isLlmFeatureEnabled(env), true);
  });
});

test('phaseLLM1: feature flag rejects other values', () => {
  const falsy = ['0', 'false', 'no', 'off', ''];
  falsy.forEach((value) => {
    const env = { [ENV_KEY]: value };
    assert.strictEqual(isLlmFeatureEnabled(env), false);
  });
});
