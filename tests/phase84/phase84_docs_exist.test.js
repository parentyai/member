'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase84: docs exist with required headings', () => {
  const plan = readFileSync('docs/archive/phases/PHASE80_84_PLAN.md', 'utf8');
  assert.ok(plan.includes('# PHASE80_84_PLAN'));
  assert.ok(plan.includes('Purpose'));
  assert.ok(plan.includes('Scope In'));
  assert.ok(plan.includes('Done Definition'));

  const log = readFileSync('docs/archive/phases/PHASE80_84_EXECUTION_LOG.md', 'utf8');
  assert.ok(log.includes('# PHASE80_84_EXECUTION_LOG'));
  assert.ok(log.includes('main SHA'));

  const runbookDryRun = readFileSync('docs/RUNBOOK_dryrun_execute_flow.md', 'utf8');
  assert.ok(runbookDryRun.includes('# RUNBOOK_dryrun_execute_flow'));

  const runbookCursor = readFileSync('docs/RUNBOOK_cursor_signing.md', 'utf8');
  assert.ok(runbookCursor.includes('# RUNBOOK_cursor_signing'));
});
