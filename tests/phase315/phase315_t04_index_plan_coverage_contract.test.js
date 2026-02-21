'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

const loadRisk = JSON.parse(fs.readFileSync('docs/REPO_AUDIT_INPUTS/load_risk.json', 'utf8'));
const indexPlan = fs.readFileSync('docs/INDEX_PLAN.md', 'utf8');

test('phase315: INDEX_PLAN covers all fallback source files from audit input', () => {
  const files = new Set((loadRisk.fallback_points || []).map((row) => row.file).filter(Boolean));
  files.forEach((file) => {
    assert.ok(indexPlan.includes(file), `INDEX_PLAN missing fallback file: ${file}`);
  });
});
