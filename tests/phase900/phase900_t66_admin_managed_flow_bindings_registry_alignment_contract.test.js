'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { getManagedFlowRegistry } = require('../../src/domain/managedFlowRegistry');
const {
  getManagedFlowBindings,
  resolveActionByMethodAndPath
} = require('../../src/routes/admin/managedFlowBindings');

function concretePathFromPattern(pathPattern) {
  const raw = String(pathPattern || '').trim();
  if (!raw || raw === '/') return '/';
  const normalized = raw.endsWith('/') ? raw.slice(0, -1) : raw;
  return normalized.replace(/:([A-Za-z0-9_]+)/g, 'sample');
}

test('phase900: managed flow bindings stay aligned with registry actions and resolve representative paths', () => {
  const registry = getManagedFlowRegistry();
  const bindings = getManagedFlowBindings();

  const bindingKeys = bindings.map((binding) => binding.actionKey).sort();
  const registryKeys = Object.keys(registry.actionByKey || {}).sort();
  assert.deepEqual(bindingKeys, registryKeys);

  bindings.forEach((binding) => {
    const action = registry.actionByKey[binding.actionKey];
    assert.ok(action, `missing registry action for ${binding.actionKey}`);
    assert.equal(binding.flowId, action.flowId);
    assert.equal(binding.method, String(action.method).trim().toUpperCase());
    assert.equal(binding.pathPattern, action.pathPattern);
    assert.equal(binding.handlerFile, action.handlerFile);

    const concrete = concretePathFromPattern(action.pathPattern);
    const probePath = concrete === '/' ? '/' : `${concrete}/`;
    const resolved = resolveActionByMethodAndPath(` ${binding.method.toLowerCase()} `, ` ${probePath} `);
    assert.ok(resolved, `failed to resolve ${binding.actionKey} via ${probePath}`);
    assert.equal(resolved.actionKey, binding.actionKey);
  });
});
