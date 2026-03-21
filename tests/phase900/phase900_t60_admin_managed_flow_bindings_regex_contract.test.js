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
    version: 'regex_v1',
    flows: [
      {
        flowId: 'flow_regex',
        writeActions: [
          {
            actionKey: 'special.path',
            method: 'GET',
            pathPattern: '/api/admin/os/special.v1/+alpha',
            handlerFile: 'src/routes/admin/legacyStatus.js'
          },
          {
            actionKey: 'root.health',
            method: 'GET',
            pathPattern: '/',
            handlerFile: 'src/routes/admin/legacyStatus.js'
          }
        ]
      }
    ]
  };
}

test('phase900: managed flow bindings escapes regex meta characters in static path segments', () => {
  const { bindingsModule, restore } = loadBindingsWithRegistry(createRegistry());
  try {
    const exact = bindingsModule.resolveActionByMethodAndPath('GET', '/api/admin/os/special.v1/+alpha');
    assert.ok(exact);
    assert.equal(exact.actionKey, 'special.path');

    const mismatch = bindingsModule.resolveActionByMethodAndPath('GET', '/api/admin/os/specialXv1/+alpha');
    assert.equal(mismatch, null);
  } finally {
    restore();
  }
});

test('phase900: managed flow bindings supports explicit root path patterns', () => {
  const { bindingsModule, restore } = loadBindingsWithRegistry(createRegistry());
  try {
    const root = bindingsModule.resolveActionByMethodAndPath('GET', '/');
    assert.ok(root);
    assert.equal(root.actionKey, 'root.health');

    const notRoot = bindingsModule.resolveActionByMethodAndPath('GET', '/health');
    assert.equal(notRoot, null);
  } finally {
    restore();
  }
});
