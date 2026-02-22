'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

test('phase344: load risk scripts, budgets doc, and workflow check are wired', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.ok(pkg.scripts && pkg.scripts['load-risk:generate']);
  assert.ok(pkg.scripts && pkg.scripts['load-risk:check']);

  const budgets = fs.readFileSync('docs/READ_PATH_BUDGETS.md', 'utf8');
  assert.ok(budgets.includes('worst_case_docs_scan_max:'));
  assert.ok(budgets.includes('fallback_points_max:'));

  const workflow = fs.readFileSync('.github/workflows/audit.yml', 'utf8');
  assert.ok(workflow.includes('npm run load-risk:check'));
});
