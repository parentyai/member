'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase584: load risk script emits hotspots_count field', () => {
  const file = path.join(process.cwd(), 'scripts/generate_load_risk.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('hotspots_count: hotspots.length'));
});

test('phase584: load risk artifact has hotspots_count and hotspots array', () => {
  const file = path.join(process.cwd(), 'docs/REPO_AUDIT_INPUTS/load_risk.json');
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.ok(Number.isInteger(json.hotspots_count));
  assert.ok(Array.isArray(json.hotspots));
});

