'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase355: load risk script parses and checks hotspots_count_max budget', () => {
  const file = path.join(process.cwd(), 'scripts/generate_load_risk.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('text.matchAll(/hotspots_count_max')); 
  assert.ok(src.includes('hotspotMatches[hotspotMatches.length - 1]'));
  assert.ok(src.includes('hotspots count exceeds budget'));
});
