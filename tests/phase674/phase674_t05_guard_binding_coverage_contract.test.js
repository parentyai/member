'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { getManagedFlowActionKeys } = require('../../src/domain/managedFlowRegistry');
const { getManagedFlowBindings } = require('../../src/routes/admin/managedFlowBindings');

function sorted(values) {
  return Array.from(new Set(values)).sort();
}

test('phase674: managed flow bindings cover all actionKeys and guard hooks are declared', () => {
  const docActionKeys = sorted(getManagedFlowActionKeys());
  const bindings = getManagedFlowBindings();
  const bindingActionKeys = sorted(bindings.map((entry) => entry.actionKey));

  assert.deepEqual(bindingActionKeys, docActionKeys, 'bindings/action keys mismatch');

  bindings.forEach((binding) => {
    const filePath = path.resolve(binding.handlerFile);
    assert.ok(fs.existsSync(filePath), `handler file missing: ${binding.handlerFile}`);
    const src = fs.readFileSync(filePath, 'utf8');
    assert.ok(src.includes('enforceManagedFlowGuard'), `guard not referenced in ${binding.handlerFile}`);
    assert.ok(src.includes(`'${binding.actionKey}'`) || src.includes(`\"${binding.actionKey}\"`), `actionKey not declared in ${binding.handlerFile}: ${binding.actionKey}`);
  });
});
