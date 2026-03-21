'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

function loadBindingsWithRegistry(registry) {
  const registryPath = require.resolve('../../src/domain/managedFlowRegistry');
  const bindingsPath = require.resolve('../../src/routes/admin/managedFlowBindings');
  const originalRegistry = require.cache[registryPath];
  const originalBindings = require.cache[bindingsPath];

  require.cache[registryPath] = {
    id: registryPath,
    filename: registryPath,
    loaded: true,
    exports: {
      getManagedFlowRegistry: () => registry
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

function createRegistry() {
  return {
    version: 'export_v1',
    flows: [
      {
        flowId: 'flow_export',
        writeActions: [
          {
            actionKey: 'config.set',
            method: 'POST',
            pathPattern: '/api/admin/os/config/set',
            handlerFile: 'src/routes/admin/osConfig.js'
          }
        ]
      }
    ]
  };
}

test('phase900: managed flow bindings export getter mirrors cache and remains immutable', () => {
  const { bindingsModule, restore } = loadBindingsWithRegistry(createRegistry());
  try {
    const fromGetter = bindingsModule.MANAGED_FLOW_BINDINGS;
    const fromMethod = bindingsModule.getManagedFlowBindings();

    assert.strictEqual(fromGetter, fromMethod);
    assert.equal(fromGetter.length, 1);
    assert.ok(Object.isFrozen(fromGetter));
    assert.ok(Object.isFrozen(fromGetter[0]));

    assert.throws(() => {
      fromGetter.push({});
    }, TypeError);

    assert.throws(() => {
      fromGetter[0].actionKey = 'tampered.action';
    }, TypeError);
  } finally {
    restore();
  }
});
