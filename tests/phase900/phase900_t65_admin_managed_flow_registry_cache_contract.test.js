'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  loadManagedFlowTableFromDocs,
  getManagedFlowRegistry
} = require('../../src/domain/managedFlowRegistry');

test('phase900: managed flow registry loader reuses cache and keeps frozen contract objects', () => {
  const first = loadManagedFlowTableFromDocs();
  const second = loadManagedFlowTableFromDocs();
  const viaGetter = getManagedFlowRegistry();

  assert.strictEqual(first, second);
  assert.strictEqual(second, viaGetter);

  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.flows));
  assert.ok(Object.isFrozen(first.flowById));
  assert.ok(Object.isFrozen(first.actionByKey));
  assert.ok(first.flows.length > 0);
  assert.ok(first.flows.every((flow) => Object.isFrozen(flow)));
});
