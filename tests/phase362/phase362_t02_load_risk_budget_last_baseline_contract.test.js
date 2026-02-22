'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase362: load-risk budget parser uses last baseline entries', () => {
  const file = path.join(process.cwd(), 'scripts/generate_load_risk.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('const worstMatches = [...text.matchAll(/worst_case_docs_scan_max:\\s*(\\d+)/g)];'));
  assert.ok(src.includes('const fallbackMatches = [...text.matchAll(/fallback_points_max:\\s*(\\d+)/g)];'));
  assert.ok(src.includes('const hotspotMatches = [...text.matchAll(/hotspots_count_max:\\s*(\\d+)/g)];'));
  assert.ok(src.includes('const worstMatch = worstMatches.length ? worstMatches[worstMatches.length - 1] : null;'));
});

