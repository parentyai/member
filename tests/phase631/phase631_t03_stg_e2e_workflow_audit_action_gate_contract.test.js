'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase631: workflow exposes trace_limit and fail_on_missing_audit_actions inputs', () => {
  const text = fs.readFileSync(path.join(process.cwd(), '.github/workflows/stg-notification-e2e.yml'), 'utf8');

  assert.ok(text.includes('trace_limit:'));
  assert.ok(text.includes('description: "Max trace bundle rows to fetch per scenario (1-500)"'));
  assert.ok(text.includes('default: "100"'));
  assert.ok(text.includes('fail_on_missing_audit_actions:'));
  assert.ok(text.includes('description: "Fail run when required audit actions are missing from trace bundle"'));
  assert.ok(text.includes('default: "true"'));
});

test('phase631: workflow passes trace limit and strict audit gate flags to runner', () => {
  const text = fs.readFileSync(path.join(process.cwd(), '.github/workflows/stg-notification-e2e.yml'), 'utf8');

  assert.ok(text.includes('--trace-limit "${{ github.event.inputs.trace_limit }}"'));
  assert.ok(text.includes('ARGS+=(--fail-on-missing-audit-actions)'));
  assert.ok(text.includes('github.event.inputs.fail_on_missing_audit_actions'));
});
