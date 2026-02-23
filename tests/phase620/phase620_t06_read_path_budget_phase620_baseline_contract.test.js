'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase620 batch: READ_PATH_BUDGETS ratchets fallback and missing-index surface budgets to zero', () => {
  const file = path.join(process.cwd(), 'docs/READ_PATH_BUDGETS.md');
  const text = fs.readFileSync(file, 'utf8');

  const marker = '## current_baseline_phase620';
  const start = text.lastIndexOf(marker);
  assert.ok(start >= 0, 'missing phase620 baseline marker');

  const block = text.slice(
    start,
    text.indexOf('\n## ', start + marker.length) > 0 ? text.indexOf('\n## ', start + marker.length) : undefined
  );
  assert.ok(block.includes('fallback_points_max: 0'), 'phase620 fallback_points_max must be 0');
  assert.ok(block.includes('missing_index_surface_max: 0'), 'phase620 missing_index_surface_max must be 0');
});
