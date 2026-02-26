'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

const DELETED_LEGACY_REPOS = [
  'src/repos/firestore/phase2ReportsRepo.js',
  'src/repos/firestore/phase2ReadRepo.js',
  'src/repos/firestore/phase2RunsRepo.js',
  'src/repos/firestore/phase18StatsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsReadRepo.js'
];

test('phase307: legacy duplicate repos are removed after canonicalization convergence', () => {
  for (const file of DELETED_LEGACY_REPOS) {
    assert.ok(!fs.existsSync(file), `${file}: expected deleted after canonicalization`);
  }
});
