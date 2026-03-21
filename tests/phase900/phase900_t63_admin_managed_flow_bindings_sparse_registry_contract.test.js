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
    version: 'sparse_v1',
    flows: [
      {
        flowId: 'flow_without_actions'
      },
      {
        flowId: 'flow_with_null_actions',
        writeActions: null
      },
      {
        flowId: 'flow_valid',
        writeActions: [
          {
            actionKey: 'ops.backfill.run',
            method: 'POST',
            pathPattern: '/api/admin/os/delivery/backfill/run',
            handlerFile: 'src/routes/admin/osDeliveryBackfill.js'
          }
        ]
      }
    ]
  };
}

test('phase900: managed flow bindings tolerates sparse registry entries and keeps valid bindings', () => {
  const { bindingsModule, restore } = loadBindingsWithRegistry(createRegistry());
  try {
    const bindings = bindingsModule.getManagedFlowBindings();
    assert.equal(bindings.length, 1);
    assert.equal(bindings[0].flowId, 'flow_valid');
    assert.equal(bindings[0].actionKey, 'ops.backfill.run');

    const resolved = bindingsModule.resolveActionByMethodAndPath(
      'POST',
      '/api/admin/os/delivery/backfill/run'
    );
    assert.ok(resolved);
    assert.equal(resolved.actionKey, 'ops.backfill.run');
  } finally {
    restore();
  }
});
