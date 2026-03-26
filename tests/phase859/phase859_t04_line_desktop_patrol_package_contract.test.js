'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase859: package exposes the desktop patrol evaluator entrypoint', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['line-desktop-patrol:evaluate'], 'node tools/quality_patrol/run_desktop_patrol_eval.js');
  assert.equal(pkg.scripts['test:phase859'], 'node --test tests/phase859/*.test.js');
});
