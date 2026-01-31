'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { listImplementationTargets } = require('../../src/domain/implementationTargets');

test('implementation targets: single fixed entry', () => {
  const targets = listImplementationTargets();
  assert.strictEqual(Array.isArray(targets), true);
  assert.strictEqual(targets.length, 1);
  assert.strictEqual(targets[0].id, 'CO1-D-001-A01');
  assert.strictEqual(targets[0].status, 'IN');
});
