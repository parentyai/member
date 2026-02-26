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
const { runTrialSeedSetup } = require('../../tools/seed/lib/trialSeed');

function listDocs(collectionState) {
  if (!collectionState || !collectionState.docs) return [];
  return Object.entries(collectionState.docs).map(([id, doc]) => Object.assign({ id }, doc.data || {}));
}

function countByType(rows, fieldName) {
  return (rows || []).reduce((acc, row) => {
    const key = row && row[fieldName] ? row[fieldName] : 'UNKNOWN';
    acc[key] = Number(acc[key] || 0) + 1;
    return acc;
  }, {});
}

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase665: trial setup writes full bundle + manifest targets with seed metadata', async () => {
  const seedRunId = 'trial_phase665_setup_manifest';
  const result = await runTrialSeedSetup({
    seedRunId,
    seedKind: 'trial',
    envName: 'local',
    users: 24,
    templates: true,
    cityPacks: true,
    links: true,
    vendors: 6
  }, {
    now: new Date('2026-02-26T00:00:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.seedRunId, seedRunId);
  assert.equal(result.created.users, 24);
  assert.equal(result.created.notifications, 26);
  assert.equal(result.created.links, 12);
  assert.equal(result.created.vendors, 6);
  assert.equal(result.created.cityPacks, 12);
  assert.equal(result.created.sourceRefs, 12);
  assert.equal(result.created.checklists, 8);
  assert.equal(result.created.notificationDeliveries, 24);
  assert.equal(result.created.events, 32);
  assert.equal(result.summary.targets, 150);

  const db = getDb();
  const users = listDocs(db._state.collections.users);
  const notifications = listDocs(db._state.collections.notifications);
  const links = listDocs(db._state.collections.link_registry);
  const checklists = listDocs(db._state.collections.checklists);
  const sourceRefs = listDocs(db._state.collections.source_refs);
  const cityPacks = listDocs(db._state.collections.city_packs);
  const deliveries = listDocs(db._state.collections.notification_deliveries);
  const events = listDocs(db._state.collections.events);
  const seedRuns = listDocs(db._state.collections.seed_runs);

  assert.equal(users.length, 24);
  assert.equal(notifications.length, 26);
  assert.equal(links.length, 12);
  assert.equal(checklists.length, 8);
  assert.equal(sourceRefs.length, 12);
  assert.equal(cityPacks.length, 12);
  assert.equal(deliveries.length, 24);
  assert.equal(events.length, 32);
  assert.equal(seedRuns.length, 1);

  users.forEach((row) => {
    assert.equal(typeof row.lineUserId, 'string');
    assert.ok(['A', 'C'].includes(row.scenarioKey));
    assert.ok(['3mo', '1mo', 'week', 'after1w'].includes(row.stepKey));
    assert.ok(row.seed && row.seed.isSeed === true);
    assert.equal(row.seed.seedRunId, seedRunId);
    assert.equal(row.seed.seedKind, 'trial');
    assert.equal(row.seed.envName, 'local');
  });

  notifications.forEach((row) => {
    assert.equal(typeof row.title, 'string');
    assert.equal(typeof row.body, 'string');
    assert.equal(typeof row.ctaText, 'string');
    assert.equal(typeof row.linkRegistryId, 'string');
    assert.ok(['A', 'C'].includes(row.scenarioKey));
    assert.ok(['3mo', '1mo', 'week', 'after1w'].includes(row.stepKey));
    assert.equal(row.url, undefined);
    assert.equal(row.linkUrl, undefined);
    assert.ok(row.seed && row.seed.isSeed === true);
  });

  const notificationTypeCounts = countByType(notifications, 'notificationType');
  assert.equal(notificationTypeCounts.GENERAL, 6);
  assert.equal(notificationTypeCounts.ANNOUNCEMENT, 6);
  assert.equal(notificationTypeCounts.STEP, 8);
  assert.equal(notificationTypeCounts.VENDOR, 6);

  checklists.forEach((row) => {
    assert.ok(row.scenario);
    assert.ok(row.step);
    assert.ok(row.scenarioKey);
    assert.ok(row.stepKey);
    assert.ok(Array.isArray(row.items) && row.items.length === 4);
    assert.ok(row.seed && row.seed.isSeed === true);
  });

  sourceRefs.forEach((row) => {
    assert.ok(Array.isArray(row.usedByCityPackIds));
    assert.ok(row.usedByCityPackIds.length === 1);
    assert.ok(row.seed && row.seed.isSeed === true);
  });

  cityPacks.forEach((row) => {
    assert.ok(Array.isArray(row.sourceRefs) && row.sourceRefs.length === 1);
    assert.ok(Array.isArray(row.allowedIntents) && row.allowedIntents.includes('CITY_PACK'));
    assert.ok(row.seed && row.seed.isSeed === true);
  });

  deliveries.forEach((row) => {
    assert.equal(row.delivered, true);
    assert.equal(row.state, 'delivered');
    assert.ok(row.notificationId);
    assert.ok(row.lineUserId);
    assert.ok(row.seed && row.seed.isSeed === true);
  });

  events.forEach((row) => {
    assert.ok(row.lineUserId);
    assert.ok(['open', 'click'].includes(row.type));
    assert.ok(row.ref && row.ref.notificationId);
    assert.ok(row.seed && row.seed.isSeed === true);
  });

  const manifest = seedRuns[0];
  assert.equal(manifest.seedRunId, seedRunId);
  assert.equal(manifest.seedKind, 'trial');
  assert.equal(manifest.envName, 'local');
  assert.equal(manifest.status, 'completed');
  assert.equal(manifest.summary.users, 24);
  assert.equal(manifest.summary.notifications, 26);
  assert.equal(manifest.summary.links, 12);
  assert.equal(manifest.summary.cityPacks, 12);
  assert.equal(manifest.summary.vendors, 6);
  assert.equal(manifest.summary.checklists, 8);
  assert.equal(manifest.summary.notificationDeliveries, 24);
  assert.equal(manifest.summary.events, 32);
  assert.equal(manifest.summary.sourceRefs, 12);
  assert.equal(manifest.summary.targets, 150);
  assert.ok(Array.isArray(manifest.targets));
  assert.equal(manifest.targets.length, 150);
});

test('phase665: trial setup dry-run and planOnly do not write data', async () => {
  const dryRun = await runTrialSeedSetup({
    seedRunId: 'trial_phase665_dry_run',
    seedKind: 'trial',
    envName: 'local',
    users: 12,
    dryRun: true
  }, {
    now: new Date('2026-02-26T00:00:00.000Z')
  });

  assert.equal(dryRun.ok, true);
  assert.equal(dryRun.dryRun, true);
  assert.equal(dryRun.created.users, 12);
  assert.equal(dryRun.created.notifications, 26);

  const planOnly = await runTrialSeedSetup({
    seedRunId: 'trial_phase665_plan_only',
    seedKind: 'trial',
    envName: 'local',
    users: 7,
    planOnly: true
  }, {
    now: new Date('2026-02-26T00:00:00.000Z')
  });

  assert.equal(planOnly.ok, true);
  assert.equal(planOnly.planOnly, true);
  assert.equal(planOnly.created.users, 7);
  assert.equal(planOnly.created.notifications, 26);

  const db = getDb();
  const docCount = (collectionName) => {
    const state = db._state.collections[collectionName];
    if (!state || !state.docs) return 0;
    return Object.keys(state.docs).length;
  };
  assert.equal(docCount('users'), 0);
  assert.equal(docCount('notifications'), 0);
  assert.equal(docCount('link_registry'), 0);
  assert.equal(docCount('checklists'), 0);
  assert.equal(docCount('seed_runs'), 0);
});
