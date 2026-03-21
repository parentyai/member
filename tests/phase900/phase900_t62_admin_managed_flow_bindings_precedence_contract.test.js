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
    version: 'precedence_v1',
    flows: [
      {
        flowId: 'flow_precedence',
        writeActions: [
          {
            actionKey: 'config.plan.static',
            method: 'POST',
            pathPattern: '/api/admin/os/config/plan',
            handlerFile: 'src/routes/admin/osConfig.js'
          },
          {
            actionKey: 'config.section.dynamic',
            method: 'POST',
            pathPattern: '/api/admin/os/config/:section',
            handlerFile: 'src/routes/admin/osConfig.js'
          }
        ]
      }
    ]
  };
}

test('phase900: managed flow bindings resolves overlapping patterns using registry action order', () => {
  const { bindingsModule, restore } = loadBindingsWithRegistry(createRegistry());
  try {
    const staticHit = bindingsModule.resolveActionByMethodAndPath('post', '/api/admin/os/config/plan');
    assert.ok(staticHit);
    assert.equal(staticHit.actionKey, 'config.plan.static');

    const dynamicHit = bindingsModule.resolveActionByMethodAndPath('POST', '/api/admin/os/config/runtime');
    assert.ok(dynamicHit);
    assert.equal(dynamicHit.actionKey, 'config.section.dynamic');
  } finally {
    restore();
  }
});
