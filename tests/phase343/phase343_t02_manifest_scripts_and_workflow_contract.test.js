'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase343: package scripts and audit workflow include audit-inputs checks', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['audit-inputs:generate']);
  assert.ok(pkg.scripts && pkg.scripts['audit-inputs:check']);

  const workflow = fs.readFileSync('.github/workflows/audit.yml', 'utf8');
  assert.ok(workflow.includes('npm run audit-inputs:check'));
});
