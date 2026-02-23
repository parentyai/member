'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase625: package scripts expose retention-risk generate/check commands', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['retention-risk:generate'], 'node scripts/generate_retention_risk.js');
  assert.equal(pkg.scripts['retention-risk:check'], 'node scripts/generate_retention_risk.js --check');
});
