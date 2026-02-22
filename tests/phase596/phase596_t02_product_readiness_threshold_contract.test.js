'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase596: product readiness uses budget-based snapshot/fallback thresholds', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes('snapshot_stale_ratio_max'), 'parse budgets should read snapshot_stale_ratio_max');
  assert.ok(src.includes('fallback_spike_max'), 'parse budgets should read fallback_spike_max');
  assert.ok(src.includes('snapshotStaleRatioThreshold'), 'snapshot stale ratio threshold variable should exist');
  assert.ok(src.includes('fallbackSpikeThreshold'), 'fallback spike threshold variable should exist');
  assert.ok(src.includes('Number(process.env.READ_PATH_SNAPSHOT_STALE_RATIO_MAX)'), 'snapshot threshold should allow env override');
  assert.ok(src.includes('fallbackEventsCount > fallbackSpikeThreshold'), 'fallback spike check should use threshold variable');
  assert.ok(src.includes('staleRatio > snapshotStaleRatioThreshold'), 'snapshot stale ratio check should use threshold variable');
  assert.ok(src.includes('staleRatioThreshold'), 'snapshot health response should expose threshold');
});

