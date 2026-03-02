'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { evaluateDrift } = require('../../scripts/check_scenariokey_drift');

test('phase704: scenarioKey drift evaluator detects reintroduced resolved paths', () => {
  const result = evaluateDrift(
    { scenario: [], scenarioKey: ['src/a.js', 'src/b.js'] },
    { scenario: [], scenarioKey: ['src/a.js', 'src/b.js'] },
    { scenario: [], scenarioKey: ['src/b.js'] }
  );

  assert.deepEqual(result.scenarioAdded, []);
  assert.deepEqual(result.scenarioKeyAdded, []);
  assert.deepEqual(result.scenarioRevived, []);
  assert.deepEqual(result.scenarioKeyRevived, ['src/b.js']);
});
