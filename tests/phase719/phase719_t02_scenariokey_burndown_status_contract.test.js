'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function parseStatusReport(output) {
  const text = String(output || '');
  const lineBreak = text.indexOf('\n');
  if (lineBreak < 0) throw new Error('status header missing');
  return JSON.parse(text.slice(lineBreak + 1));
}

test('phase719: consistency status keeps scenario/scenarioKey drift at zero', () => {
  const result = spawnSync(process.execPath, ['scripts/report_consistency_status.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'consistency status report failed');
  const report = parseStatusReport(result.stdout);
  const current = report && report.scenarioKeyDrift && report.scenarioKeyDrift.current
    ? report.scenarioKeyDrift.current
    : {};
  assert.equal(current.scenario, 0, `scenario alias drift should be 0, got ${current.scenario}`);
  assert.equal(current.scenarioKey, 0, `scenarioKey drift should be 0, got ${current.scenarioKey}`);
});
