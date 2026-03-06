'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { navCore } = require('../../apps/admin/assets/admin_ui_core.js');

test('phase637: navCore resolves role-normalized visible nav groups deterministically', () => {
  assert.equal(navCore.normalizeRole('operator'), 'operator');
  assert.equal(navCore.normalizeRole('admin'), 'admin');
  assert.equal(navCore.normalizeRole('developer'), 'developer');
  assert.equal(navCore.normalizeRole('unknown'), 'operator');

  assert.deepEqual(navCore.resolveVisibleGroupKeys('operator'), ['dashboard', 'run', 'control']);
  assert.deepEqual(navCore.resolveVisibleGroupKeys('admin'), ['dashboard', 'run', 'control']);
  assert.deepEqual(navCore.resolveVisibleGroupKeys('developer'), ['dashboard', 'run', 'control', 'developer']);

  assert.equal(navCore.isGroupVisible('operator', 'operations'), false);
  assert.equal(navCore.isGroupVisible('developer', 'developer'), true);
});
