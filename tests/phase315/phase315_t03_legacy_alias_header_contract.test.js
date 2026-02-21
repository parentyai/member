'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

const LEGACY_ALIAS = [
  { file: 'src/repos/firestore/phase18StatsRepo.js', canonical: './ctaStatsRepo' },
  { file: 'src/repos/firestore/phase22KpiSnapshotsReadRepo.js', canonical: './kpiSnapshotsReadRepo' },
  { file: 'src/repos/firestore/phase22KpiSnapshotsRepo.js', canonical: './kpiSnapshotsRepo' },
  { file: 'src/repos/firestore/phase2ReadRepo.js', canonical: './analyticsReadRepo' },
  { file: 'src/repos/firestore/phase2ReportsRepo.js', canonical: './scenarioReportsRepo' },
  { file: 'src/repos/firestore/phase2RunsRepo.js', canonical: './scenarioRunsRepo' }
];

test('phase315: legacy aliases carry LEGACY_HEADER and canonical forwarding', () => {
  LEGACY_ALIAS.forEach((entry) => {
    const source = fs.readFileSync(entry.file, 'utf8');
    assert.ok(source.includes('LEGACY_HEADER'), `${entry.file}: missing LEGACY_HEADER`);
    assert.ok(source.includes('LEGACY_ALIAS'), `${entry.file}: missing LEGACY_ALIAS`);
    assert.ok(source.includes(`module.exports = require('${entry.canonical}')`), `${entry.file}: forwarding mismatch`);
  });
});
