'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase625: retention budgets include baseline markers and max values', () => {
  const file = path.join(process.cwd(), 'docs/RETENTION_BUDGETS.md');
  const text = fs.readFileSync(file, 'utf8');

  assert.ok(text.includes('## current_baseline_phase625'));
  assert.ok(text.includes('undefined_retention_max:'));
  assert.ok(text.includes('undefined_deletable_conditional_max:'));
  assert.ok(text.includes('undefined_recomputable_max:'));
});
