'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase597: load risk report includes unbounded/bounded hotspot counters', () => {
  const report = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/load_risk.json', 'utf8'));
  assert.ok(Number.isFinite(Number(report.unbounded_hotspots_count)));
  assert.ok(Number.isFinite(Number(report.bounded_hotspots_count)));
  assert.ok(Array.isArray(report.unbounded_hotspots));
  assert.ok(Array.isArray(report.bounded_hotspots));

  const unboundedFromHotspots = (report.hotspots || []).filter((row) => {
    return !Boolean(row && row.hotspot && row.hotspot.has_limit_arg);
  }).length;
  const boundedFromHotspots = (report.hotspots || []).filter((row) => {
    return Boolean(row && row.hotspot && row.hotspot.has_limit_arg);
  }).length;

  assert.strictEqual(Number(report.unbounded_hotspots_count), unboundedFromHotspots);
  assert.strictEqual(Number(report.bounded_hotspots_count), boundedFromHotspots);
});
