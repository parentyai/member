'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase627: audit runner includes retention risk budget check step', () => {
  const src = fs.readFileSync(path.join(process.cwd(), 'tools/audit/run_audit.sh'), 'utf8');
  assert.ok(src.includes('retention risk budget check'));
  assert.ok(src.includes('npm run retention-risk:check'));
  assert.ok(src.includes('retention-risk-check.txt'));
});

