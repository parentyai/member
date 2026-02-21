'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { execFileSync } = require('child_process');
const { test } = require('node:test');

function countMissingIndexFallbackPoints() {
  const output = execFileSync('rg', ['-n', 'isMissingIndexError\\(', 'src/repos/firestore', '-S'], { encoding: 'utf8' });
  return output
    .trim()
    .split('\n')
    .filter((line) => line && !line.includes('queryFallback.js'))
    .length;
}

test('phase307: missing-index fallback points do not exceed audit baseline', () => {
  const baseline = JSON.parse(readFileSync('docs/REPO_AUDIT_INPUTS/load_risk.json', 'utf8'));
  const baselineCount = Number(baseline && baseline.fallback_risk);
  assert.ok(Number.isFinite(baselineCount), 'load_risk.json must provide numeric fallback_risk baseline');

  const currentCount = countMissingIndexFallbackPoints();
  assert.ok(
    currentCount <= baselineCount,
    `fallback points increased beyond baseline: current=${currentCount} baseline=${baselineCount}`
  );
});

test('phase307: newly added structural files do not introduce fallback catches', () => {
  const files = [
    'src/domain/normalizers/scenarioKeyNormalizer.js',
    'src/domain/normalizers/opsStateNormalizer.js',
    'src/domain/security/protectionMatrix.js',
    'src/routes/internal/retentionDryRunJob.js'
  ];
  files.forEach((file) => {
    const source = readFileSync(file, 'utf8');
    assert.ok(!source.includes('isMissingIndexError('), `${file}: must not add missing-index fallback branch`);
  });
});
