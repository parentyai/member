'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phase135: runbook and ssot index exist with required headings', () => {
  const runbook = readFileSync('docs/RUNBOOK_TRACE_AUDIT.md', 'utf8');
  assert.ok(runbook.includes('# RUNBOOK_TRACE_AUDIT'));
  assert.ok(runbook.includes('Purpose'));
  assert.ok(runbook.includes('Steps'));
  assert.ok(runbook.includes('Expected Output'));
  assert.ok(runbook.includes('Rollback'));

  const index = readFileSync('docs/SSOT_INDEX.md', 'utf8');
  assert.ok(index.includes('# SSOT_INDEX'));
  assert.ok(index.includes('SSOT_LINE_ONLY_DELTA'));
  assert.ok(index.includes('RUNBOOK_TRACE_AUDIT'));

  const evidence = readFileSync('docs/TRACE_SMOKE_EVIDENCE.md', 'utf8');
  assert.ok(evidence.includes('# TRACE_SMOKE_EVIDENCE'));
});

