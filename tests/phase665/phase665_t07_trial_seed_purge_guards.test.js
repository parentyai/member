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
  parseTrialSeedSetupArgs,
  parseTrialSeedPurgeArgs,
  runTrialSeedSetup,
  runTrialSeedPurge
} = require('../../tools/seed/lib/trialSeed');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase665: trial setup/purge reject prod and production env', async () => {
  assert.throws(() => parseTrialSeedSetupArgs([
    'node',
    'tools/seed_trial_setup.js'
  ], {
    ENV_NAME: 'prod'
  }), /blocked when ENV_NAME is prod or production/);

  assert.throws(() => parseTrialSeedPurgeArgs([
    'node',
    'tools/seed_trial_purge.js',
    '--seedRunId',
    'trial_any',
    '--confirm',
    'SEED_DELETE'
  ], {
    ENV_NAME: 'production'
  }), /blocked when ENV_NAME is prod or production/);

  await assert.rejects(() => runTrialSeedSetup({
    seedRunId: 'trial_prod_block_setup',
    seedKind: 'trial',
    envName: 'prod'
  }), /blocked when ENV_NAME is prod or production/);

  await assert.rejects(() => runTrialSeedPurge({
    seedRunId: 'trial_prod_block_purge',
    confirm: 'SEED_DELETE',
    envName: 'production'
  }), /blocked when ENV_NAME is prod or production/);
});

test('phase665: trial purge requires --confirm SEED_DELETE', async () => {
  assert.throws(() => parseTrialSeedPurgeArgs([
    'node',
    'tools/seed_trial_purge.js',
    '--seedRunId',
    'trial_confirm_required'
  ], {
    ENV_NAME: 'local'
  }), /SEED_DELETE/);

  await assert.rejects(() => runTrialSeedPurge({
    seedRunId: 'trial_confirm_required',
    confirm: 'DELETE',
    envName: 'local'
  }), /SEED_DELETE/);
});

test('phase665: trial purge deletes manifest targets only and removes manifest doc', async () => {
  const seedRunId = 'trial_phase665_purge';
  const setup = await runTrialSeedSetup({
    seedRunId,
    seedKind: 'trial',
    envName: 'local',
    users: 12
  }, {
    now: new Date('2026-02-26T00:00:00.000Z')
  });

  const db = getDb();
  await db.collection('users').doc('keep_user').set({
    lineUserId: 'keep_user',
    scenarioKey: 'A',
    stepKey: 'week',
    createdAt: 'KEEP',
    seed: { isSeed: false }
  }, { merge: false });
  await db.collection('notifications').doc('keep_notification').set({
    title: 'keep',
    ctaText: 'keep',
    linkRegistryId: 'keep',
    scenarioKey: 'A',
    stepKey: 'week'
  }, { merge: false });

  const purge = await runTrialSeedPurge({
    seedRunId,
    confirm: 'SEED_DELETE',
    envName: 'local'
  });

  assert.equal(purge.ok, true);
  assert.equal(purge.seedRunId, seedRunId);
  assert.equal(purge.deleted.targets, setup.summary.targets);
  assert.equal(purge.deleted.manifest, 1);

  const users = db._state.collections.users ? Object.keys(db._state.collections.users.docs) : [];
  const notifications = db._state.collections.notifications ? Object.keys(db._state.collections.notifications.docs) : [];
  const links = db._state.collections.link_registry ? Object.keys(db._state.collections.link_registry.docs) : [];
  const sourceRefs = db._state.collections.source_refs ? Object.keys(db._state.collections.source_refs.docs) : [];
  const cityPacks = db._state.collections.city_packs ? Object.keys(db._state.collections.city_packs.docs) : [];
  const checklists = db._state.collections.checklists ? Object.keys(db._state.collections.checklists.docs) : [];
  const deliveries = db._state.collections.notification_deliveries ? Object.keys(db._state.collections.notification_deliveries.docs) : [];
  const events = db._state.collections.events ? Object.keys(db._state.collections.events.docs) : [];
  const seedRuns = db._state.collections.seed_runs ? Object.keys(db._state.collections.seed_runs.docs) : [];

  assert.deepEqual(users, ['keep_user']);
  assert.deepEqual(notifications, ['keep_notification']);
  assert.equal(links.length, 0);
  assert.equal(sourceRefs.length, 0);
  assert.equal(cityPacks.length, 0);
  assert.equal(checklists.length, 0);
  assert.equal(deliveries.length, 0);
  assert.equal(events.length, 0);
  assert.equal(seedRuns.length, 0);
});

test('phase665: trial purge dry-run does not delete targets', async () => {
  const seedRunId = 'trial_phase665_purge_dry_run';
  const setup = await runTrialSeedSetup({
    seedRunId,
    seedKind: 'trial',
    envName: 'local',
    users: 10
  }, {
    now: new Date('2026-02-26T00:00:00.000Z')
  });

  const dryRun = await runTrialSeedPurge({
    seedRunId,
    confirm: 'SEED_DELETE',
    envName: 'local',
    dryRun: true
  });

  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.deleted.targets, setup.summary.targets);
  assert.equal(dryRun.deleted.manifest, 1);

  const db = getDb();
  assert.ok(db._state.collections.seed_runs.docs[seedRunId]);
  assert.ok(Object.keys(db._state.collections.users.docs).length > 0);
  assert.ok(Object.keys(db._state.collections.notifications.docs).length > 0);
});
