'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { buildRepoScanReport } = require('../../tools/run_llm_repo_scan');

test('phase820: repo scan report exposes required dimensions and file:path:line evidence', () => {
  const report = buildRepoScanReport({ rootDir: process.cwd(), baselineRef: 'test-ref' });

  assert.equal(report.scanVersion, 'v3');
  assert.equal(report.baselineRef, 'test-ref');
  [
    'routerCoverage',
    'readinessIntegration',
    'knowledgeIntegration',
    'telemetryCoverage',
    'traceJoinCoverage'
  ].forEach((key) => {
    assert.ok(report.dimensions[key], key);
    assert.ok(['present', 'partial', 'missing'].includes(report.dimensions[key].status));
    assert.equal(typeof report.dimensions[key].coverageScore, 'number');
  });

  const evidence = Object.values(report.dimensions).flatMap((row) => row.evidence);
  assert.ok(evidence.length > 0);
  evidence.forEach((row) => {
    assert.match(row, /^file:.+:\d+$/);
  });

  assert.ok(Array.isArray(report.topGaps));
  assert.ok(report.summary && typeof report.summary.coverageScore === 'number');
});
