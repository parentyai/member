'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase350: load risk budget parser uses last matching budget values', () => {
  const file = path.join(process.cwd(), 'scripts/generate_load_risk.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('text.matchAll(/worst_case_docs_scan_max'));
  assert.ok(src.includes('worstMatches[worstMatches.length - 1]'));
  assert.ok(src.includes('fallbackMatches[fallbackMatches.length - 1]'));
});
