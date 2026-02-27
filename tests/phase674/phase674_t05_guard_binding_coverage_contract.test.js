'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const {
  getManagedFlowBindings,
  resolveActionByMethodAndPath
} = require('../../src/routes/admin/managedFlowBindings');

function samplePathFromPattern(pathPattern) {
  return String(pathPattern || '').replace(/:[^/]+/g, 'sample-id');
}

function staticPathSegments(pathPattern) {
  return String(pathPattern || '')
    .split('/')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith(':'));
}

test('phase674: managed flow bindings are docs-derived and each write route is guard-bound in handler', () => {
  const bindings = getManagedFlowBindings();
  assert.ok(Array.isArray(bindings));
  assert.ok(bindings.length > 0, 'bindings should not be empty');

  const actionKeys = new Set();
  const methodPathKeys = new Set();

  bindings.forEach((binding) => {
    assert.equal(typeof binding.actionKey, 'string');
    assert.equal(typeof binding.method, 'string');
    assert.equal(typeof binding.pathPattern, 'string');
    assert.equal(typeof binding.handlerFile, 'string');
    assert.ok(binding.pathRegex instanceof RegExp);
    assert.ok(!actionKeys.has(binding.actionKey), `duplicate actionKey: ${binding.actionKey}`);
    actionKeys.add(binding.actionKey);
    const methodPathKey = `${binding.method.toUpperCase()} ${binding.pathPattern}`;
    assert.ok(!methodPathKeys.has(methodPathKey), `duplicate method/path: ${methodPathKey}`);
    methodPathKeys.add(methodPathKey);

    const filePath = path.resolve(binding.handlerFile);
    assert.ok(fs.existsSync(filePath), `handler file missing: ${binding.handlerFile}`);
    const src = fs.readFileSync(filePath, 'utf8');
    assert.ok(src.includes('enforceManagedFlowGuard'), `guard not referenced in ${binding.handlerFile}`);
    assert.ok(src.includes(`'${binding.actionKey}'`) || src.includes(`\"${binding.actionKey}\"`), `actionKey not declared in ${binding.handlerFile}: ${binding.actionKey}`);

    const samplePath = samplePathFromPattern(binding.pathPattern);
    const resolved = resolveActionByMethodAndPath(binding.method, samplePath);
    assert.ok(resolved, `binding resolver failed for ${binding.actionKey}`);
    assert.equal(resolved.actionKey, binding.actionKey, `binding resolver mismatch for ${binding.actionKey}`);

    const segments = staticPathSegments(binding.pathPattern).filter((segment) => segment !== 'api' && segment !== 'admin');
    const criticalSegments = segments.length > 1 ? segments.slice(-2) : segments;
    assert.ok(
      criticalSegments.every((segment) => src.includes(segment)),
      `route path segments missing in ${binding.handlerFile}: ${binding.pathPattern}`
    );
  });
});
