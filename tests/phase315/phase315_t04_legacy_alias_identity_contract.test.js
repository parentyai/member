'use strict';

const assert = require('assert');
const path = require('path');
const { test } = require('node:test');

const ROOT = process.cwd();

const LEGACY_CANONICAL_PAIRS = [
  {
    alias: 'src/repos/firestore/phase2RunsRepo.js',
    canonical: 'src/repos/firestore/scenarioRunsRepo.js'
  },
  {
    alias: 'src/repos/firestore/phase18StatsRepo.js',
    canonical: 'src/repos/firestore/ctaStatsRepo.js'
  },
  {
    alias: 'src/repos/firestore/phase22KpiSnapshotsReadRepo.js',
    canonical: 'src/repos/firestore/kpiSnapshotsReadRepo.js'
  },
  {
    alias: 'src/repos/firestore/phase22KpiSnapshotsRepo.js',
    canonical: 'src/repos/firestore/kpiSnapshotsRepo.js'
  }
];

test('phase315: remaining legacy repos are strict runtime aliases', () => {
  for (const { alias, canonical } of LEGACY_CANONICAL_PAIRS) {
    const aliasPath = path.join(ROOT, alias);
    const canonicalPath = path.join(ROOT, canonical);

    const aliasModule = require(aliasPath);
    const canonicalModule = require(canonicalPath);

    assert.strictEqual(
      aliasModule,
      canonicalModule,
      `${alias} must return the same module object as ${canonical}`
    );

    const aliasKeys = Object.keys(aliasModule || {}).sort();
    const canonicalKeys = Object.keys(canonicalModule || {}).sort();
    assert.deepStrictEqual(aliasKeys, canonicalKeys, `${alias} keys must match ${canonical}`);
  }
});
