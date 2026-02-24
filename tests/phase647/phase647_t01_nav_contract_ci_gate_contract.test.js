'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

test('phase647: package script exposes admin nav contract test suite', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['test:admin-nav-contract']);
  assert.ok(pkg.scripts['test:admin-nav-contract'].includes('tests/phase638/*.test.js'));
  assert.ok(pkg.scripts['test:admin-nav-contract'].includes('tests/phase647/*.test.js'));
});

test('phase647: audit workflow requires nav-contract in aggregate gate', () => {
  const workflow = fs.readFileSync('.github/workflows/audit.yml', 'utf8');
  assert.ok(workflow.includes('nav-contract:'));
  assert.ok(workflow.includes('Run admin nav contract tests'));
  assert.ok(workflow.includes('- nav-contract'));
  assert.ok(workflow.includes('NAV_CONTRACT_RESULT="${{ needs.nav-contract.result }}"'));
  assert.ok(workflow.includes('nav-contract=${NAV_CONTRACT_RESULT}'));
});
