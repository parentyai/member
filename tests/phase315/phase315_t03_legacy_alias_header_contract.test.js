'use strict';

const assert = require('assert');
const fs = require('fs');
const { test } = require('node:test');

const DELETED_ALIAS = [
  'src/repos/firestore/phase18StatsRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsReadRepo.js',
  'src/repos/firestore/phase22KpiSnapshotsRepo.js',
  'src/repos/firestore/phase2ReadRepo.js',
  'src/repos/firestore/phase2ReportsRepo.js',
  'src/repos/firestore/phase2RunsRepo.js'
];

test('phase315: legacy alias repo files are removed after canonical convergence', () => {
  DELETED_ALIAS.forEach((file) => {
    assert.ok(!fs.existsSync(file), `${file}: expected deleted`);
  });
});
