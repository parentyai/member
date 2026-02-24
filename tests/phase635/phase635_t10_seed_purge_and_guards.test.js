'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest,
  getDb
} = require('../../src/infra/firestore');

const {
  parseSeedSetupArgs,
  parseSeedPurgeArgs,
  runSeedSetup,
  runSeedPurge
} = require('../../tools/seed/lib');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase635: setup and purge reject prod/production env', async () => {
  assert.throws(() => parseSeedSetupArgs([
    'node',
    'tools/seed_templates_and_citypacks.js'
  ], {
    ENV_NAME: 'production'
  }), /blocked when ENV_NAME is prod or production/);

  assert.throws(() => parseSeedPurgeArgs([
    'node',
    'tools/seed_purge.js',
    '--seedRunId',
    'seed_any',
    '--confirm',
    'SEED_DELETE'
  ], {
    ENV_NAME: 'prod'
  }), /blocked when ENV_NAME is prod or production/);

  await assert.rejects(() => runSeedSetup({
    seedRunId: 'seed_prod_block',
    envName: 'prod'
  }), /blocked when ENV_NAME is prod or production/);

  await assert.rejects(() => runSeedPurge({
    seedRunId: 'seed_prod_block',
    confirm: 'SEED_DELETE',
    envName: 'production'
  }), /blocked when ENV_NAME is prod or production/);
});

test('phase635: purge requires explicit confirm token', async () => {
  assert.throws(() => parseSeedPurgeArgs([
    'node',
    'tools/seed_purge.js',
    '--seedRunId',
    'seed_confirm_required'
  ], {
    ENV_NAME: 'local'
  }), /purge requires --confirm SEED_DELETE/);

  await assert.rejects(() => runSeedPurge({
    seedRunId: 'seed_confirm_required',
    confirm: 'DELETE',
    envName: 'local'
  }), /purge requires --confirm SEED_DELETE/);
});

test('phase635: purge deletes manifest targets only and removes manifest doc', async () => {
  const seedRunId = 'seed_phase635_purge';
  await runSeedSetup({
    seedRunId,
    seedKind: 'demo',
    envName: 'local'
  }, {
    now: new Date('2026-02-23T00:00:00.000Z')
  });

  const db = getDb();
  await db.collection('notifications').doc('keep_notification').set({ keep: true }, { merge: false });
  await db.collection('city_packs').doc('keep_city_pack').set({ keep: true }, { merge: false });

  const result = await runSeedPurge({
    seedRunId,
    confirm: 'SEED_DELETE',
    envName: 'local'
  });

  assert.equal(result.ok, true);
  assert.equal(result.seedRunId, seedRunId);
  assert.equal(result.deleted.targets, 58);
  assert.equal(result.deleted.manifest, 1);

  const notifications = db._state.collections.notifications
    ? Object.keys(db._state.collections.notifications.docs)
    : [];
  const cityPacks = db._state.collections.city_packs
    ? Object.keys(db._state.collections.city_packs.docs)
    : [];
  const sourceRefs = db._state.collections.source_refs
    ? Object.keys(db._state.collections.source_refs.docs)
    : [];
  const linkRegistry = db._state.collections.link_registry
    ? Object.keys(db._state.collections.link_registry.docs)
    : [];

  assert.deepEqual(notifications, ['keep_notification']);
  assert.deepEqual(cityPacks, ['keep_city_pack']);
  assert.equal(sourceRefs.length, 0);
  assert.equal(linkRegistry.length, 0);

  const seedRuns = db._state.collections.seed_runs
    ? Object.keys(db._state.collections.seed_runs.docs)
    : [];
  assert.equal(seedRuns.length, 0);
});

test('phase635: purge dry-run does not delete targets', async () => {
  const seedRunId = 'seed_phase635_purge_dry_run';
  await runSeedSetup({
    seedRunId,
    seedKind: 'demo',
    envName: 'local'
  }, {
    now: new Date('2026-02-23T00:00:00.000Z')
  });

  const dryRun = await runSeedPurge({
    seedRunId,
    confirm: 'SEED_DELETE',
    envName: 'local',
    dryRun: true
  });

  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.deleted.targets, 58);

  const db = getDb();
  assert.ok(db._state.collections.seed_runs.docs[seedRunId]);
  assert.ok(Object.keys(db._state.collections.notifications.docs).length > 0);
  assert.ok(Object.keys(db._state.collections.city_packs.docs).length > 0);
});
