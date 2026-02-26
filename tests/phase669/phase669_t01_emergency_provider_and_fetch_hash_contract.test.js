'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const emergencyProvidersRepo = require('../../src/repos/firestore/emergencyProvidersRepo');
const emergencySnapshotsRepo = require('../../src/repos/firestore/emergencySnapshotsRepo');
const { ensureEmergencyProviders } = require('../../src/usecases/emergency/ensureEmergencyProviders');
const { fetchProviderSnapshot } = require('../../src/usecases/emergency/fetchProviderSnapshot');

function makeResponse(status, body, headers) {
  const headerMap = headers || {};
  return {
    status,
    async text() {
      return body;
    },
    headers: {
      get(name) {
        const key = String(name || '').toLowerCase();
        return Object.prototype.hasOwnProperty.call(headerMap, key) ? headerMap[key] : null;
      }
    }
  };
}

test('phase669: emergency provider defaults persist and fetch hash diff is deterministic', async (t) => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('SERVER_TIMESTAMP');

  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const ensured = await ensureEmergencyProviders({ traceId: 'trace_phase669_providers' });
  assert.equal(ensured.ok, true);
  assert.equal(ensured.count >= 6, true);

  const providerKey = 'nws_alerts';
  const provider = await emergencyProvidersRepo.getProvider(providerKey);
  assert.ok(provider);
  assert.equal(provider.providerKey, providerKey);
  assert.equal(provider.status, 'enabled');

  await emergencyProvidersRepo.upsertProvider(providerKey, {
    status: 'disabled',
    scheduleMinutes: 30,
    traceId: 'trace_phase669_provider_toggle'
  });
  const toggled = await emergencyProvidersRepo.getProvider(providerKey);
  assert.equal(toggled.status, 'disabled');
  assert.equal(toggled.scheduleMinutes, 30);

  await emergencyProvidersRepo.upsertProvider(providerKey, {
    status: 'enabled',
    traceId: 'trace_phase669_provider_toggle_back'
  });

  const payload = JSON.stringify({
    type: 'FeatureCollection',
    features: []
  });
  const responseHeaders = {
    etag: '"etag-phase669"',
    'last-modified': 'Thu, 26 Feb 2026 00:00:00 GMT'
  };

  const first = await fetchProviderSnapshot({
    providerKey,
    runId: 'run_phase669_fetch_1',
    traceId: 'trace_phase669_fetch_1',
    actor: 'phase669_test'
  }, {
    getKillSwitch: async () => false,
    fetchFn: async () => makeResponse(200, payload, responseHeaders)
  });

  assert.equal(first.ok, true);
  assert.equal(first.changed, true);
  assert.equal(typeof first.payloadHash, 'string');
  assert.ok(first.snapshotId);

  const second = await fetchProviderSnapshot({
    providerKey,
    runId: 'run_phase669_fetch_2',
    traceId: 'trace_phase669_fetch_2',
    actor: 'phase669_test'
  }, {
    getKillSwitch: async () => false,
    fetchFn: async () => makeResponse(200, payload, responseHeaders)
  });

  assert.equal(second.ok, true);
  assert.equal(second.changed, false);
  assert.equal(second.payloadHash, first.payloadHash);

  const latest = await emergencySnapshotsRepo.getSnapshot(second.snapshotId);
  assert.ok(latest);
  assert.equal(latest.providerKey, providerKey);
  assert.equal(latest.payloadHash, first.payloadHash);
});

