'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase631: runbook documents strict audit-action gate options', () => {
  const text = fs.readFileSync(path.join(process.cwd(), 'docs/RUNBOOK_STG_NOTIFICATION_E2E_CHECKLIST.md'), 'utf8');

  assert.ok(text.includes('--fail-on-missing-audit-actions'));
  assert.ok(text.includes('--trace-limit 100'));
  assert.ok(text.includes('-f trace_limit=100'));
  assert.ok(text.includes('-f fail_on_missing_audit_actions=true'));
  assert.ok(text.includes('fail_on_missing_audit_actions'));
  assert.ok(text.includes('必須 audit action 欠落を FAIL'));
});
