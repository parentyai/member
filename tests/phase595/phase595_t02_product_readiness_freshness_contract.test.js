'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase595: product readiness checks freshness thresholds from READ_PATH_BUDGETS.md', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'src/routes/admin/productReadiness.js'), 'utf8');
  assert.ok(src.includes('load_risk_freshness_max_hours'), 'missing load_risk_freshness_max_hours parse key');
  assert.ok(src.includes('missing_index_surface_freshness_max_hours'), 'missing missing_index_surface_freshness_max_hours parse key');
  assert.ok(src.includes('parseGeneratedAtHours(loadRisk && loadRisk.generatedAt)'), 'loadRisk freshness evaluation must parse generatedAt');
  assert.ok(src.includes('parseGeneratedAtHours(missingIndexSurface && missingIndexSurface.generatedAt)'), 'missingIndexSurface freshness evaluation must parse generatedAt');
  assert.ok(src.includes('load_risk_generated_at_stale'), 'stale blocker must exist for loadRisk');
  assert.ok(src.includes('missing_index_surface_generated_at_stale'), 'stale blocker must exist for missingIndexSurface');
  assert.ok(src.includes('freshnessHoursMax: loadRiskFreshnessMaxHours'), 'response should include loadRisk freshness max');
  assert.ok(src.includes('freshnessHoursMax: missingIndexSurfaceFreshnessMaxHours'), 'response should include missingIndexSurface freshness max');
});

