'use strict';

const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

function parseReport(output) {
  const text = String(output || '');
  const idx = text.indexOf('\n');
  if (idx < 0) throw new Error('report header missing');
  return JSON.parse(text.slice(idx + 1));
}

test('phase704: scenariokey drift details report includes resolved lock and zero revived paths', () => {
  const result = spawnSync(process.execPath, ['scripts/report_scenariokey_drift_details.js'], {
    cwd: process.cwd(),
    encoding: 'utf8'
  });
  assert.equal(result.status, 0, result.stderr || result.stdout || 'scenariokey drift details report failed');
  const report = parseReport(result.stdout);
  const scenarioKey = (report.aliases || []).find((row) => row.alias === 'scenarioKey');
  assert.ok(scenarioKey, 'scenarioKey section missing');
  assert.ok(scenarioKey.counts.resolved >= 1, 'resolved count should be present');
  assert.equal(scenarioKey.counts.revivedResolved, 0, 'resolved path should not be reintroduced');
  assert.ok(Array.isArray(scenarioKey.details.resolvedLockPaths), 'resolved lock paths missing');
  assert.ok(Array.isArray(scenarioKey.details.revivedResolvedPaths), 'revived paths array missing');
});
