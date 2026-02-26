'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest,
  getDb
} = require('../../src/infra/firestore');
const emergencyProvidersRepo = require('../../src/repos/firestore/emergencyProvidersRepo');
const emergencySnapshotsRepo = require('../../src/repos/firestore/emergencySnapshotsRepo');
const { normalizeAndDiffProvider } = require('../../src/usecases/emergency/normalizeAndDiffProvider');

function listDocs(collectionName) {
  const col = getDb()._state.collections[collectionName];
  if (!col) return [];
  return Object.entries(col.docs).map(([id, row]) => Object.assign({ id }, row.data));
}

test('phase669: snapshot -> normalize -> diff creates CRITICAL draft bulletins only', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const providerKey = 'usgs_earthquakes';
  await emergencyProvidersRepo.createProviderIfMissing({
    providerKey,
    status: 'enabled',
    scheduleMinutes: 10,
    traceId: 'trace_phase669_norm_provider'
  });
  await emergencyProvidersRepo.upsertProvider(providerKey, {
    officialLinkRegistryId: 'lr_phase669_official',
    traceId: 'trace_phase669_norm_provider_link'
  });

  const payload = {
    type: 'FeatureCollection',
    features: [
      {
        id: 'eq_critical_1',
        properties: {
          mag: 6.1,
          place: 'Austin, TX',
          time: Date.parse('2026-02-26T00:00:00.000Z'),
          title: 'M 6.1 - Austin, TX'
        },
        geometry: { coordinates: [-97.74, 30.27] }
      },
      {
        id: 'eq_info_1',
        properties: {
          mag: 3.2,
          place: 'Dallas, TX',
          time: Date.parse('2026-02-26T00:05:00.000Z'),
          title: 'M 3.2 - Dallas, TX'
        },
        geometry: { coordinates: [-96.8, 32.78] }
      }
    ]
  };

  await emergencySnapshotsRepo.saveSnapshot('usgs_earthquakes__run_phase669_norm_1', {
    providerKey,
    fetchedAt: '2026-02-26T00:10:00.000Z',
    statusCode: 200,
    payloadHash: 'hash_phase669_norm_1',
    payloadSummary: { kind: 'object' },
    rawPayload: payload,
    runId: 'run_phase669_norm_1',
    traceId: 'trace_phase669_norm_1'
  });

  const first = await normalizeAndDiffProvider({
    providerKey,
    snapshotId: 'usgs_earthquakes__run_phase669_norm_1',
    runId: 'run_phase669_norm_1',
    traceId: 'trace_phase669_norm_1',
    actor: 'phase669_test'
  }, {
    getKillSwitch: async () => false
  });

  assert.equal(first.ok, true);
  assert.equal(first.createdCount, 2);
  assert.equal(first.updatedCount, 0);
  assert.equal(first.resolvedCount, 0);
  assert.equal(first.diffIds.length, 2);
  assert.equal(first.draftBulletinIds.length, 1);

  const events = listDocs('emergency_events_normalized');
  assert.equal(events.length, 2);
  assert.ok(events.every((item) => item.regionKey === 'TX::statewide'));

  const bulletins = listDocs('emergency_bulletins');
  assert.equal(bulletins.length, 1);
  assert.equal(bulletins[0].status, 'draft');
  assert.equal(bulletins[0].severity, 'CRITICAL');
  assert.equal(bulletins[0].linkRegistryId, 'lr_phase669_official');

  await emergencySnapshotsRepo.saveSnapshot('usgs_earthquakes__run_phase669_norm_2', {
    providerKey,
    fetchedAt: '2026-02-26T00:20:00.000Z',
    statusCode: 200,
    payloadHash: 'hash_phase669_norm_2',
    payloadSummary: { kind: 'object' },
    rawPayload: payload,
    runId: 'run_phase669_norm_2',
    traceId: 'trace_phase669_norm_2'
  });

  const second = await normalizeAndDiffProvider({
    providerKey,
    snapshotId: 'usgs_earthquakes__run_phase669_norm_2',
    runId: 'run_phase669_norm_2',
    traceId: 'trace_phase669_norm_2',
    actor: 'phase669_test'
  }, {
    getKillSwitch: async () => false
  });

  assert.equal(second.ok, true);
  assert.equal(second.createdCount, 0);
  assert.equal(second.updatedCount, 0);
  assert.equal(second.diffIds.length, 0);
});

