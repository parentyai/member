'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase596: latest read-path budget includes snapshot stale ratio and fallback spike', () => {
  const text = fs.readFileSync('docs/READ_PATH_BUDGETS.md', 'utf8');
  const match = text.match(/current_baseline_phase596[\s\S]*/);
  const block = match ? match[0] : '';

  assert.ok(block.length > 0, 'missing current_baseline_phase596 block');
  const snapshot = block.match(/snapshot_stale_ratio_max:\s*([0-9]+(?:\.[0-9]+)?)/);
  const fallback = block.match(/fallback_spike_max:\s*(\d+)/);

  assert.ok(snapshot, 'missing snapshot_stale_ratio_max');
  assert.ok(fallback, 'missing fallback_spike_max');
  assert.ok(Number(snapshot[1]) > 0 && Number(snapshot[1]) <= 1, 'snapshot_stale_ratio_max must be in (0,1]');
  assert.ok(Number(fallback[1]) > 0, 'fallback_spike_max must be positive');
});

