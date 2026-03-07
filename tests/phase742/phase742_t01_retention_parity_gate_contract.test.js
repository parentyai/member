'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase742: package scripts include retention parity gate in catchup drift-check', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['audit:retention-parity:check'], 'node scripts/check_retention_policy_parity.js');
  assert.ok(String(pkg.scripts['catchup:drift-check'] || '').includes('audit:retention-parity:check'));
});

test('phase742: retention parity check script passes on repo baseline', () => {
  const result = spawnSync(process.execPath, [path.join('scripts', 'check_retention_policy_parity.js')], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'retention parity check failed');
});

