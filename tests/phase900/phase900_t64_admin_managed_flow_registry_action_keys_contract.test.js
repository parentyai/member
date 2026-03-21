'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const {
  getManagedFlowRegistry,
  getManagedFlowActionKeys
} = require('../../src/domain/managedFlowRegistry');

test('phase900: managed flow registry action keys helper stays sorted and registry-aligned', () => {
  const registry = getManagedFlowRegistry();
  const helperKeys = getManagedFlowActionKeys();
  const registryKeys = Object.keys(registry.actionByKey || {});
  const sortedRegistryKeys = [...registryKeys].sort();

  assert.deepEqual(helperKeys, sortedRegistryKeys);
  assert.equal(new Set(helperKeys).size, helperKeys.length);

  helperKeys.forEach((actionKey) => {
    const action = registry.actionByKey[actionKey];
    assert.ok(action, `actionByKey is missing ${actionKey}`);
    assert.equal(action.actionKey, actionKey);
    assert.equal(typeof action.flowId, 'string');
  });
});
