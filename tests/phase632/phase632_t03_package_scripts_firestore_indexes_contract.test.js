'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase632: package scripts expose firestore index check/plan commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.strictEqual(pkg.scripts['firestore-indexes:check'], 'node scripts/check_firestore_indexes.js --check');
  assert.strictEqual(pkg.scripts['firestore-indexes:plan'], 'node scripts/check_firestore_indexes.js --plan');
});
