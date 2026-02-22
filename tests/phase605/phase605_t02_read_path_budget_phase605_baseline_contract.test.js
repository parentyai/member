'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase605: READ_PATH_BUDGETS ratchets fallback and missing-index surface budgets', () => {
  const file = path.join(process.cwd(), 'docs/READ_PATH_BUDGETS.md');
  const text = fs.readFileSync(file, 'utf8');

  const marker = '## current_baseline_phase605';
  const start = text.lastIndexOf(marker);
  assert.ok(start >= 0, 'missing phase605 baseline marker');

  const block = text.slice(start, text.indexOf('\n## ', start + marker.length) > 0 ? text.indexOf('\n## ', start + marker.length) : undefined);
  assert.ok(block.includes('fallback_points_max: 15'), 'phase605 fallback_points_max must be 15');
  assert.ok(block.includes('missing_index_surface_max: 15'), 'phase605 missing_index_surface_max must be 15');
});
