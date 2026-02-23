'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase632: productReadiness uses the declared missingIndexGeneratedAtHours variable', () => {
  const filePath = path.join(process.cwd(), 'src', 'routes', 'admin', 'productReadiness.js');
  const content = fs.readFileSync(filePath, 'utf8');

  assert.match(content, /const missingIndexGeneratedAtHours = parseGeneratedAtHours/);
  assert.doesNotMatch(content, /\bmissingIndexSurfaceGeneratedAtHours\b/);
});
