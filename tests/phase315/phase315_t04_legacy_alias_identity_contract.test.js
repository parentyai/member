'use strict';

const assert = require('assert');
const path = require('path');
const { test } = require('node:test');

const ROOT = process.cwd();

const LEGACY_CANONICAL_PAIRS = [
  { alias: 'src/repos/firestore/phase2RunsRepo.js', canonical: 'src/repos/firestore/scenarioRunsRepo.js' },
  { alias: 'src/repos/firestore/phase18StatsRepo.js', canonical: 'src/repos/firestore/ctaStatsRepo.js' },
  { alias: 'src/repos/firestore/phase22KpiSnapshotsReadRepo.js', canonical: 'src/repos/firestore/kpiSnapshotsReadRepo.js' },
  { alias: 'src/repos/firestore/phase22KpiSnapshotsRepo.js', canonical: 'src/repos/firestore/kpiSnapshotsReadRepo.js' }
];

test('phase315: deleted legacy alias files are absent while canonical repos remain', () => {
  for (const { alias, canonical } of LEGACY_CANONICAL_PAIRS) {
    const aliasPath = path.join(ROOT, alias);
    const canonicalPath = path.join(ROOT, canonical);
    assert.ok(!require('fs').existsSync(aliasPath), `${alias}: expected deleted`);
    const canonicalModule = require(canonicalPath);
    assert.ok(canonicalModule && typeof canonicalModule === 'object', `${canonical}: canonical module missing`);
  }
});
