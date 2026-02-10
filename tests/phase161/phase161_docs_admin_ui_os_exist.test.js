'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase161: docs exist for admin UI OS + data model + runbook', () => {
  const os = readFileSync('docs/SSOT_ADMIN_UI_OS.md', 'utf8');
  assert.ok(os.includes('# SSOT_ADMIN_UI_OS'));
  assert.ok(os.includes('ServicePhase 1'));
  assert.ok(os.includes('/admin/ops'));
  assert.ok(os.includes('/admin/composer'));

  const model = readFileSync('docs/SSOT_ADMIN_UI_DATA_MODEL.md', 'utf8');
  assert.ok(model.includes('# SSOT_ADMIN_UI_DATA_MODEL'));
  assert.ok(model.includes('Draft / Active Rules'));
  assert.ok(model.includes('confirm token'));

  const runbook = readFileSync('docs/RUNBOOK_ADMIN_OPS.md', 'utf8');
  assert.ok(runbook.includes('# RUNBOOK_ADMIN_OPS'));
  assert.ok(runbook.includes('Daily Ops'));
  assert.ok(runbook.includes('Incident Response'));

  const index = readFileSync('docs/SSOT_INDEX.md', 'utf8');
  assert.ok(index.includes('docs/SSOT_ADMIN_UI_OS.md'));
  assert.ok(index.includes('docs/SSOT_ADMIN_UI_DATA_MODEL.md'));
  assert.ok(index.includes('docs/RUNBOOK_ADMIN_OPS.md'));
});

