'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveWritebackPolicy } = require('../../src/v1/memory_fabric/writebackPolicy');
const { resolveMemoryReadPolicy } = require('../../src/v1/memory_fabric/readPolicy');

test('phase760: memory writeback policy disables profile/session on temporary mode', () => {
  const policy = resolveWritebackPolicy({ temporaryMode: true, groupMode: false });
  assert.equal(policy.session, false);
  assert.equal(policy.profile, false);
  assert.equal(policy.task, true);
});

test('phase760: group mode disables individualized profile recall by default', () => {
  const read = resolveMemoryReadPolicy({ lane: 'session', groupMode: true });
  assert.equal(read.includeProfile, false);
  assert.equal(read.includeCompliance, true);
});
