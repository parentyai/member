'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase344: load risk report keeps required keys', () => {
  const report = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/load_risk.json', 'utf8'));
  assert.ok(Number.isFinite(Number(report.estimated_worst_case_docs_scan)));
  assert.ok(Number.isFinite(Number(report.fallback_risk)));
  assert.ok(Array.isArray(report.hotspots));
  assert.ok(Array.isArray(report.fallback_points));
});
