'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase363: fallback_risk equals unique fallback file/call surfaces', () => {
  const report = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'docs/REPO_AUDIT_INPUTS/load_risk.json'), 'utf8'));
  const points = Array.isArray(report.fallback_points) ? report.fallback_points : [];
  const uniqueSurfaceCount = new Set(points.map((row) => `${row.file}::${row.call}`)).size;

  assert.strictEqual(Number(report.fallback_risk), uniqueSurfaceCount);
  assert.strictEqual(Number(report.fallback_surface_count), uniqueSurfaceCount);
  assert.ok(uniqueSurfaceCount <= points.length);
});
