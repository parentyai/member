'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase628: package scripts expose structure-risk generate/check commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['structure-risk:generate'], 'node scripts/generate_structure_risk.js');
  assert.equal(pkg.scripts['structure-risk:check'], 'node scripts/generate_structure_risk.js --check');
});
