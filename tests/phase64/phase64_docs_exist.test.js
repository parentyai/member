'use strict';

const assert = require('assert');
const { test } = require('node:test');
const fs = require('fs');
const path = require('path');

test('phase64: docs exist with headers', () => {
  const files = [
    'docs/PHASE60_64_PLAN.md',
    'docs/PHASE60_64_EXECUTION_LOG.md',
    'docs/RUNBOOK_OPS_TEMPLATES.md',
    'docs/RUNBOOK_OPS_DAILY_REPORT.md'
  ];

  for (const file of files) {
    const fullPath = path.resolve(__dirname, '..', '..', file);
    const content = fs.readFileSync(fullPath, 'utf8');
    assert.ok(content.startsWith('# '));
  }
});
