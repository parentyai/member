'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');
const sourceRefsRepo = require('../../src/repos/firestore/sourceRefsRepo');
const { runCityPackSourceAuditJob } = require('../../src/usecases/cityPack/runCityPackSourceAuditJob');

function listDocs(db, collectionName) {
  const collection = db && db._state && db._state.collections ? db._state.collections[collectionName] : null;
  if (!collection || !collection.docs) return [];
  return Object.entries(collection.docs).map(([id, doc]) => Object.assign({ id }, doc.data || {}));
}

test('phase250: canary run stores run summary, evidence and audit logs with traceId', async (t) => {
  const db = createDbStub();
  setDbForTest(db);
  setServerTimestampForTest('SERVER_TIMESTAMP');
  t.after(() => {
    clearDbForTest();
    clearServerTimestampForTest();
  });

  const sourceRef = await sourceRefsRepo.createSourceRef({
    id: 'sr_canary',
    url: 'https://example.com/canary',
    status: 'needs_review',
    validFrom: '2026-02-10T00:00:00.000Z',
    validUntil: '2026-06-10T00:00:00.000Z',
    riskLevel: 'medium'
  });

  const result = await runCityPackSourceAuditJob(
    {
      runId: 'run_canary_001',
      mode: 'canary',
      targetSourceRefIds: [sourceRef.id],
      traceId: 'trace_canary_001',
      actor: 'phase250_test',
      now: new Date('2026-02-18T00:00:00.000Z')
    },
    {
      fetchFn: async () => ({
        status: 200,
        ok: true,
        redirected: false,
        url: 'https://example.com/canary',
        text: async () => 'canary page'
      }),
      captureScreenshots: async () => ['gs://bucket/city-pack/sr_canary_001.png']
    }
  );

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.mode, 'canary');
  assert.strictEqual(result.processed, 1);
  assert.strictEqual(result.traceId, 'trace_canary_001');

  const runs = listDocs(db, 'source_audit_runs');
  const evidences = listDocs(db, 'source_evidence');
  const audits = listDocs(db, 'audit_logs');

  assert.ok(runs.some((row) => row.id === 'run_canary_001' && row.traceId === 'trace_canary_001'));
  assert.ok(evidences.some((row) => row.sourceRefId === 'sr_canary' && row.traceId === 'trace_canary_001'));
  assert.ok(audits.some((row) => row.action === 'city_pack.source_audit.run' && row.traceId === 'trace_canary_001'));
});
