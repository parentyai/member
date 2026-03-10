'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { enforceActionGateway } = require('../../src/v1/action_gateway/actionGateway');

test('phase760: assist requires confirmation token', () => {
  const result = enforceActionGateway({ actionClass: 'assist', toolName: 'assist', confirmationToken: '' });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'assist_confirmation_required');
});

test('phase760: human_only blocks tool exposure', () => {
  const result = enforceActionGateway({ actionClass: 'human_only', toolName: 'lookup' });
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'human_only_action_blocked');
});

test('phase760: lookup remains allowed by default', () => {
  const result = enforceActionGateway({ actionClass: 'lookup', toolName: 'lookup' });
  assert.equal(result.allowed, true);
  assert.equal(result.reason, 'action_allowed');
});
