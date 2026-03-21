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

function createRegistry(version) {
  return {
    version,
    flows: [
      {
        flowId: 'flow_delivery',
        writeActions: [
          {
            actionKey: 'delivery.send',
            method: 'post',
            pathPattern: '/api/admin/os/delivery/:deliveryId/send',
            handlerFile: 'src/routes/admin/notificationDeliveries.js'
          }
        ]
      }
    ]
  };
}

test('phase900: managed flow bindings resolves dynamic path with method/path normalization', () => {
  const state = { current: createRegistry('v1') };
  const { bindingsModule, restore } = loadBindingsWithRegistryState(state);
  try {
    const resolved = bindingsModule.resolveActionByMethodAndPath(
      ' post ',
      ' /api/admin/os/delivery/dlv_001/send/ '
    );
    assert.ok(resolved);
    assert.equal(resolved.actionKey, 'delivery.send');
    assert.equal(resolved.method, 'POST');
    assert.equal(resolved.pathPattern, '/api/admin/os/delivery/:deliveryId/send');
  } finally {
    restore();
  }
});

test('phase900: managed flow bindings returns null for method mismatch', () => {
  const state = { current: createRegistry('v1') };
  const { bindingsModule, restore } = loadBindingsWithRegistryState(state);
  try {
    const resolved = bindingsModule.resolveActionByMethodAndPath(
      'GET',
      '/api/admin/os/delivery/dlv_001/send'
    );
    assert.equal(resolved, null);
  } finally {
    restore();
  }
});
