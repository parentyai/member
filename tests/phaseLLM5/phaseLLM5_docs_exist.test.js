'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

test('phaseLLM5: runbook and phase plan docs exist', () => {
  const runbook = readFileSync('docs/LLM_RUNBOOK.md', 'utf8');
  assert.ok(runbook.includes('# LLM_RUNBOOK'));
  assert.ok(runbook.includes('## Purpose'));
  assert.ok(runbook.includes('## Stop / Start'));
  assert.ok(runbook.includes('## Audit / Trace'));

  const plan = readFileSync('docs/LLM_PHASE_PLAN.md', 'utf8');
  assert.ok(plan.includes('# LLM_PHASE_PLAN'));
  assert.ok(plan.includes('## Overview'));
  assert.ok(plan.includes('## Dependencies'));
});
