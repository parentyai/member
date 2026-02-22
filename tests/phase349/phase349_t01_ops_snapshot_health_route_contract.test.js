'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

test('phase349: ops snapshot repo and route contracts exist', () => {
  const repoFile = path.join(process.cwd(), 'src/repos/firestore/opsSnapshotsRepo.js');
  const routeFile = path.join(process.cwd(), 'src/routes/admin/opsSnapshotHealth.js');
  const repoSrc = fs.readFileSync(repoFile, 'utf8');
  const routeSrc = fs.readFileSync(routeFile, 'utf8');

  assert.ok(repoSrc.includes('async function listSnapshots(opts)'));
  assert.ok(repoSrc.includes('orderBy(\'updatedAt\', \'desc\')'));

  assert.ok(routeSrc.includes('async function handleOpsSnapshotHealth(req, res)'));
  assert.ok(routeSrc.includes("action: 'ops_snapshot.health.view'"));
  assert.ok(routeSrc.includes('staleAfterMinutes'));
});
