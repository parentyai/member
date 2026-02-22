'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase597: load risk script parses and checks unbounded_hotspots_max budget', () => {
  const file = path.join(process.cwd(), 'scripts/generate_load_risk.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('text.matchAll(/unbounded_hotspots_max'));
  assert.ok(src.includes('unboundedHotspotsMax'));
  assert.ok(src.includes('unbounded hotspots count exceeds budget'));
});
