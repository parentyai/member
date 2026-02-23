'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase627: RETENTION_BUDGETS includes phase627 baseline with freshness threshold', () => {
  const file = path.join(process.cwd(), 'docs/RETENTION_BUDGETS.md');
  const text = fs.readFileSync(file, 'utf8');
  const marker = '## current_baseline_phase627';
  const start = text.lastIndexOf(marker);
  assert.ok(start >= 0, 'missing phase627 baseline marker');
  const block = text.slice(
    start,
    text.indexOf('\n## ', start + marker.length) > 0 ? text.indexOf('\n## ', start + marker.length) : undefined
  );
  assert.ok(block.includes('undefined_retention_max: 45'), 'phase627 undefined_retention_max must be present');
  assert.ok(
    block.includes('undefined_deletable_conditional_max: 11'),
    'phase627 undefined_deletable_conditional_max must be present'
  );
  assert.ok(block.includes('undefined_recomputable_max: 11'), 'phase627 undefined_recomputable_max must be present');
  assert.ok(block.includes('retention_risk_freshness_max_hours: 24'), 'phase627 freshness budget must be present');
});

