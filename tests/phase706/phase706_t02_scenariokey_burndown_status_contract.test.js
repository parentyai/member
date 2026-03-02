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

test('phase706: consistency status keeps scenario alias at zero and scenarioKey drift at or below 25', () => {
  const result = spawnSync(process.execPath, ['scripts/report_consistency_status.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'consistency status report failed');
  const report = parseStatusReport(result.stdout);
  const current = report && report.scenarioKeyDrift && report.scenarioKeyDrift.current
    ? report.scenarioKeyDrift.current
    : {};
  assert.equal(current.scenario, 0, 'scenario alias drift must remain zero');
  assert.ok(Number(current.scenarioKey) <= 25, `scenarioKey drift should be <= 25, got ${current.scenarioKey}`);
});
