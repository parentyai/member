'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase356: fallback policy module defines env-driven default and resolver', () => {
  const file = path.join(process.cwd(), 'src/domain/readModel/fallbackPolicy.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes("const FALLBACK_MODE_ALLOW = 'allow';"));
  assert.ok(src.includes("const FALLBACK_MODE_BLOCK = 'block';"));
  assert.ok(src.includes('function resolveFallbackModeDefault()'));
  assert.ok(src.includes('process.env.READ_PATH_FALLBACK_MODE_DEFAULT'));
  assert.ok(src.includes('function resolveFallbackMode(value)'));
});
