'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase628: audit runner includes structure risk budget check step', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'tools/audit/run_audit.sh'), 'utf8');
  assert.ok(src.includes('structure risk budget check'));
  assert.ok(src.includes('npm run structure-risk:check'));
  assert.ok(src.includes('structure-risk-check.txt'));
});
