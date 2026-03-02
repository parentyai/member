'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('phase702: package script exposes scenariokey remediation queue command', () => {
  const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts['audit:scenariokey-drift:queue'], 'node scripts/report_scenariokey_remediation_queue.js');
});

test('phase702: scenariokey remediation queue report prints required sections', () => {
  const result = spawnSync(process.execPath, ['scripts/report_scenariokey_remediation_queue.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'scenariokey remediation queue report failed');
  const out = result.stdout || '';
  assert.ok(out.includes('[scenariokey-remediation-queue] report'));
  assert.ok(out.includes('"topQueue"'));
  assert.ok(out.includes('"priorityBand"'));
  assert.ok(out.includes('"items"'));
  assert.ok(out.includes('"scenarioKeyPathCount"'));
});
