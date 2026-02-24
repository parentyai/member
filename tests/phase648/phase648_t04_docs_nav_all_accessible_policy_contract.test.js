'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase648: SSOT and runbook describe nav all-accessible policy as latest', () => {
  const ssot = fs.readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  const runbook = fs.readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');

  assert.ok(ssot.includes('Phase648 更新・最新'));
  assert.ok(ssot.includes('| operator | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |'));
  assert.ok(ssot.includes('ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=1'));

  assert.ok(runbook.includes('Phase648 更新・最新'));
  assert.ok(runbook.includes('| operator | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |'));
  assert.ok(runbook.includes('ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=1'));
});
