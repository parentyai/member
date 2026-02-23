'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

function countMissingIndexFallbackPoints() {
  const rootDir = path.join(process.cwd(), 'src', 'repos', 'firestore');
  const stack = [rootDir];
  let count = 0;
  while (stack.length) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith('.js')) continue;
      if (entry.name === 'queryFallback.js') continue;
      const source = fs.readFileSync(fullPath, 'utf8');
      const matches = source.match(/isMissingIndexError\(/g);
      if (matches && matches.length) count += matches.length;
    }
  }
  return count;
}

test('phase307: missing-index fallback points do not exceed audit baseline', () => {
  const baseline = JSON.parse(readFileSync('docs/REPO_AUDIT_INPUTS/load_risk.json', 'utf8'));
  const riskCount = Number(baseline && baseline.fallback_risk);
  const pointCount = Array.isArray(baseline && baseline.fallback_points) ? baseline.fallback_points.length : NaN;
  const baselineCount = Math.max(
    Number.isFinite(riskCount) ? riskCount : 0,
    Number.isFinite(pointCount) ? pointCount : 0
  );
  assert.ok(Number.isFinite(baselineCount) && baselineCount >= 0, 'load_risk.json must provide fallback baseline');

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
