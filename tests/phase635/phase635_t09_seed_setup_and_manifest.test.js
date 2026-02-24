'use strict';

const assert = require('node:assert/strict');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const { runSeedSetup } = require('../../tools/seed/lib');

function listDocs(collectionState) {
  if (!collectionState || !collectionState.docs) return [];
  return Object.entries(collectionState.docs).map(([id, doc]) => Object.assign({ id }, doc.data || {}));
}

function countByType(rows, field) {
  return rows.reduce((acc, row) => {
    const key = row && row[field] ? row[field] : 'UNKNOWN';
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

test('phase635: setup writes templates/city packs/links/source refs and seed manifest', async () => {
  const seedRunId = 'seed_phase635_setup';
  const result = await runSeedSetup({
    seedRunId,
    seedKind: 'demo',
    envName: 'local'
  }, {
    now: new Date('2026-02-23T00:00:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.seedRunId, seedRunId);
  assert.equal(result.created.templates, 22);
  assert.equal(result.created.links, 12);
  assert.equal(result.created.cityPacks, 12);
  assert.equal(result.created.sourceRefs, 12);

  const db = require('../../src/infra/firestore').getDb();
  const notifications = listDocs(db._state.collections.notifications);
  const links = listDocs(db._state.collections.link_registry);
  const cityPacks = listDocs(db._state.collections.city_packs);
  const sourceRefs = listDocs(db._state.collections.source_refs);
  const seedRuns = listDocs(db._state.collections.seed_runs);

  assert.equal(notifications.length, 22);
  assert.equal(links.length, 12);
  assert.equal(cityPacks.length, 12);
  assert.equal(sourceRefs.length, 12);
  assert.equal(seedRuns.length, 1);

  notifications.forEach((row) => {
    assert.equal(row.status, 'draft');
    assert.ok(row.seed && row.seed.isSeed);
    assert.equal(row.seed.seedRunId, seedRunId);
    assert.equal(row.seed.seedKind, 'demo');
    assert.equal(row.seed.envName, 'local');
    assert.ok(row.linkRegistryId);
    assert.ok(row.scenarioKey === 'A' || row.scenarioKey === 'C');
    assert.ok(['3mo', '1mo', 'week', 'after1w'].includes(row.stepKey));
    assert.equal(row.url, undefined);
    assert.equal(row.linkUrl, undefined);
  });

  const typeCounts = countByType(notifications, 'notificationType');
  assert.equal(typeCounts.GENERAL, 4);
  assert.equal(typeCounts.ANNOUNCEMENT, 4);
  assert.equal(typeCounts.STEP, 8);
  assert.equal(typeCounts.VENDOR, 6);

  const vendorRows = notifications.filter((row) => row.notificationType === 'VENDOR');
  assert.equal(vendorRows.length, 6);
  vendorRows.forEach((row) => {
    assert.ok(row.notificationMeta && row.notificationMeta.vendorKey);
    assert.ok(row.notificationMeta && row.notificationMeta.vendorId);
  });

  links.forEach((row) => {
    assert.ok(row.seed && row.seed.isSeed);
    assert.equal(row.seed.seedRunId, seedRunId);
    assert.ok(row.lastHealth && row.lastHealth.state === 'OK');
    assert.equal(row.lastHealth.statusCode, 200);
  });

  const expectedCityPackKeys = [
    'nyc',
    'westchester',
    'long-island',
    'northern-nj',
    'boston',
    'la',
    'sf',
    'sj',
    'detroit',
    'chicago',
    'houston',
    'dallas'
  ];
  const actualCityPackKeys = cityPacks.map((row) => row.cityPackKey).sort();
  assert.deepEqual(actualCityPackKeys, expectedCityPackKeys.slice().sort());

  cityPacks.forEach((row) => {
    assert.equal(row.status, 'draft');
    assert.ok(Array.isArray(row.sourceRefs) && row.sourceRefs.length >= 1);
    assert.ok(row.metadata && Array.isArray(row.metadata.sources) && row.metadata.sources.length >= 1);
    assert.ok(row.metadata && Array.isArray(row.metadata.notes) && row.metadata.notes.length >= 1);
    assert.ok(row.seed && row.seed.seedRunId === seedRunId);
  });

  sourceRefs.forEach((row) => {
    assert.ok(row.seed && row.seed.seedRunId === seedRunId);
    assert.ok(Array.isArray(row.usedByCityPackIds));
    assert.ok(row.usedByCityPackIds.length >= 1);
  });

  const manifest = seedRuns[0];
  assert.equal(manifest.seedRunId, seedRunId);
  assert.equal(manifest.seedKind, 'demo');
  assert.equal(manifest.envName, 'local');
  assert.equal(manifest.status, 'completed');
  assert.equal(manifest.summary.templates, 22);
  assert.equal(manifest.summary.links, 12);
  assert.equal(manifest.summary.cityPacks, 12);
  assert.equal(manifest.summary.sourceRefs, 12);
  assert.equal(manifest.summary.targets, 58);
  assert.equal(Array.isArray(manifest.targets), true);
  assert.equal(manifest.targets.length, 58);

  assert.equal(Boolean(db._state.collections.users), false);
  assert.equal(Boolean(db._state.collections.user_checklists), false);
});

test('phase635: setup dry-run returns counts without writes', async () => {
  const result = await runSeedSetup({
    seedRunId: 'seed_phase635_dry_run',
    seedKind: 'demo',
    envName: 'local',
    dryRun: true
  }, {
    now: new Date('2026-02-23T00:00:00.000Z')
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.created.templates, 22);
  assert.equal(result.created.links, 12);
  assert.equal(result.created.cityPacks, 12);
  assert.equal(result.created.sourceRefs, 12);

  const db = require('../../src/infra/firestore').getDb();
  const notifications = db._state.collections.notifications
    ? Object.keys(db._state.collections.notifications.docs)
    : [];
  const links = db._state.collections.link_registry
    ? Object.keys(db._state.collections.link_registry.docs)
    : [];
  const cityPacks = db._state.collections.city_packs
    ? Object.keys(db._state.collections.city_packs.docs)
    : [];
  const sourceRefs = db._state.collections.source_refs
    ? Object.keys(db._state.collections.source_refs.docs)
    : [];
  const seedRuns = db._state.collections.seed_runs
    ? Object.keys(db._state.collections.seed_runs.docs)
    : [];

  assert.equal(notifications.length, 0);
  assert.equal(links.length, 0);
  assert.equal(cityPacks.length, 0);
  assert.equal(sourceRefs.length, 0);
  assert.equal(seedRuns.length, 0);
});
