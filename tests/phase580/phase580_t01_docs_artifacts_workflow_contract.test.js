'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase580: docs artifacts scripts and audit workflow wiring exist', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['docs-artifacts:generate']);
  assert.ok(pkg.scripts && pkg.scripts['docs-artifacts:check']);

  const workflow = fs.readFileSync('.github/workflows/audit.yml', 'utf8');
  assert.ok(workflow.includes('npm run docs-artifacts:check'));
});

