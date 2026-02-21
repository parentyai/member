'use strict';

const assert = require('assert');
const { readFileSync } = require('fs');
const { test } = require('node:test');

const LEGACY_FORWARDERS = [
  { file: 'src/repos/firestore/phase2ReportsRepo.js', canonical: './scenarioReportsRepo' },
  { file: 'src/repos/firestore/phase2ReadRepo.js', canonical: './analyticsReadRepo' },
  { file: 'src/repos/firestore/phase2RunsRepo.js', canonical: './scenarioRunsRepo' },
  { file: 'src/repos/firestore/phase18StatsRepo.js', canonical: './ctaStatsRepo' },
  { file: 'src/repos/firestore/phase22KpiSnapshotsRepo.js', canonical: './kpiSnapshotsRepo' },
  { file: 'src/repos/firestore/phase22KpiSnapshotsReadRepo.js', canonical: './kpiSnapshotsReadRepo' }
];

test('phase307: legacy duplicate repos are frozen as canonical forwarders (no direct db write)', () => {
  for (const entry of LEGACY_FORWARDERS) {
    const source = readFileSync(entry.file, 'utf8');
    assert.ok(source.includes('DEPRECATED'), `${entry.file}: missing DEPRECATED marker`);
    assert.ok(source.includes(`module.exports = require('${entry.canonical}')`), `${entry.file}: must forward to canonical repo`);
    assert.ok(!source.includes('getDb('), `${entry.file}: must not access firestore directly`);
    assert.ok(!source.includes('.collection('), `${entry.file}: must not contain direct collection writes/reads`);
  }
});
