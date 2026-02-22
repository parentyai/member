'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase346: load risk hotspots include endpoint mapping', () => {
  const loadRisk = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/load_risk.json', 'utf8'));
  assert.ok(Array.isArray(loadRisk.hotspots));
  assert.strictEqual(loadRisk.hotspots.length, Number(loadRisk.hotspots_count || 0));
  if (loadRisk.hotspots.length === 0) {
    assert.strictEqual(Number(loadRisk.estimated_worst_case_docs_scan || 0), 0);
    return;
  }
  const withEndpoints = loadRisk.hotspots.filter((row) => Array.isArray(row.endpoints) && row.endpoints.length > 0);
  assert.ok(withEndpoints.length > 0);
  withEndpoints.forEach((row) => {
    assert.strictEqual(row.endpoint_count, row.endpoints.length);
  });
});
