'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase311: audit workflow and package scripts enforce repo-map drift checks', () => {
  const workflow = fs.readFileSync('.github/workflows/audit.yml', 'utf8');
  assert.ok(workflow.includes('npm run repo-map:check'));

  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['repo-map:generate']);
  assert.ok(pkg.scripts && pkg.scripts['repo-map:check']);
});
