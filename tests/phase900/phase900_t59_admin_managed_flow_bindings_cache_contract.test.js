'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadBindingsWithRegistryState(state) {
  const registryPath = require.resolve('../../src/domain/managedFlowRegistry');
  const bindingsPath = require.resolve('../../src/routes/admin/managedFlowBindings');
  const originalRegistry = require.cache[registryPath];
  const originalBindings = require.cache[bindingsPath];

  require.cache[registryPath] = {
    id: registryPath,
    filename: registryPath,
    loaded: true,
    exports: {
      getManagedFlowRegistry: () => state.current
    }
  };
  delete require.cache[bindingsPath];

  const bindingsModule = require('../../src/routes/admin/managedFlowBindings');
  return {
    bindingsModule,
    restore() {
      if (originalRegistry) require.cache[registryPath] = originalRegistry;
      else delete require.cache[registryPath];
      if (originalBindings) require.cache[bindingsPath] = originalBindings;
      else delete require.cache[bindingsPath];
    }
  };
}

function createRegistry(version, includeSecondAction) {
  const writeActions = [
    {
      actionKey: 'config.set',
      method: 'POST',
      pathPattern: '/api/admin/os/config/set',
      handlerFile: 'src/routes/admin/osConfig.js'
    }
  ];
  if (includeSecondAction) {
    writeActions.push({
      actionKey: 'config.plan',
      method: 'POST',
      pathPattern: '/api/admin/os/config/plan',
      handlerFile: 'src/routes/admin/osConfig.js'
    });
  }
  return {
    version,
    flows: [{ flowId: 'flow_config', writeActions }]
  };
}

test('phase900: managed flow bindings reuses cached bindings while version is unchanged', () => {
  const state = { current: createRegistry('v1', false) };
  const { bindingsModule, restore } = loadBindingsWithRegistryState(state);
  try {
    const first = bindingsModule.getManagedFlowBindings();
    const second = bindingsModule.getManagedFlowBindings();
    assert.strictEqual(first, second);
    assert.equal(first.length, 1);

    state.current = createRegistry('v1', true);
    const third = bindingsModule.getManagedFlowBindings();
    assert.strictEqual(second, third);
    assert.equal(third.length, 1);
  } finally {
    restore();
  }
});

test('phase900: managed flow bindings rebuilds cache when registry version changes', () => {
  const state = { current: createRegistry('v1', false) };
  const { bindingsModule, restore } = loadBindingsWithRegistryState(state);
  try {
    const before = bindingsModule.getManagedFlowBindings();
    assert.equal(before.length, 1);

    state.current = createRegistry('v2', true);
    const after = bindingsModule.getManagedFlowBindings();
    assert.notStrictEqual(before, after);
    assert.equal(after.length, 2);
  } finally {
    restore();
  }
});
