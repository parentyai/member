'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');
const {
  MASTER_TABLE_BEGIN,
  MASTER_TABLE_END,
  loadManagedFlowTableFromDocs,
  getManagedFlowDocPath
} = require('../../src/domain/managedFlowRegistry');

test('phase674: master table loader contract (docs JSON is single SSOT)', () => {
  const docPath = getManagedFlowDocPath();
  const text = fs.readFileSync(docPath, 'utf8');

  assert.ok(text.includes(MASTER_TABLE_BEGIN), 'missing MASTER_TABLE_BEGIN');
  assert.ok(text.includes(MASTER_TABLE_END), 'missing MASTER_TABLE_END');

  const registry = loadManagedFlowTableFromDocs();
  assert.ok(registry && typeof registry === 'object');
  assert.equal(typeof registry.version, 'string');
  assert.ok(Array.isArray(registry.flows));
  assert.ok(registry.flows.length > 0, 'flows should not be empty');

  const actionKeys = Object.keys(registry.actionByKey || {});
  assert.ok(actionKeys.length > 0, 'actionByKey should not be empty');
  assert.equal(new Set(actionKeys).size, actionKeys.length, 'duplicate actionKey detected');

  actionKeys.forEach((actionKey) => {
    const action = registry.actionByKey[actionKey];
    assert.equal(typeof action.flowId, 'string');
    assert.equal(typeof action.method, 'string');
    assert.equal(typeof action.pathPattern, 'string');
    assert.equal(action.workbenchZoneRequired, true);
  });
});
