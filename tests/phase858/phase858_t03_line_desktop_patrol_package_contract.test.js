'use strict';

const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase858: package scripts expose the PR2 patrol commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(pkg.scripts['line-desktop-patrol:probe']);
  assert.ok(pkg.scripts['line-desktop-patrol:dry-run']);
  assert.ok(pkg.scripts['test:phase858']);
});
