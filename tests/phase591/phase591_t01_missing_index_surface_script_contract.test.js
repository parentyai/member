'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase591: missing index surface generator emits grouped surfaces and budget check hooks', () => {
  const file = path.join(process.cwd(), 'scripts/generate_missing_index_surface.js');
  const src = fs.readFileSync(file, 'utf8');
  assert.ok(src.includes('missing_index_surface.json'));
  assert.ok(src.includes('sourceDigest'));
  assert.ok(src.includes('surface_count'));
  assert.ok(src.includes('missing_index_surface_max'));
  assert.ok(src.includes('fallback_points'));
  assert.ok(src.includes('missingIndexFallback'));
  assert.ok(src.includes('delete comparableCurrent.generatedAt;'));
  assert.ok(src.includes('delete comparableNext.generatedAt;'));
});

test('phase591: package scripts expose missing-index-surface generate/check commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['missing-index-surface:generate'], 'node scripts/generate_missing_index_surface.js');
  assert.equal(pkg.scripts['missing-index-surface:check'], 'node scripts/generate_missing_index_surface.js --check');
});
