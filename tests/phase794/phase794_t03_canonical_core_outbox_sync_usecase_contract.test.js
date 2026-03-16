'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  runCanonicalCoreOutboxSyncJob
} = require('../../src/usecases/data/runCanonicalCoreOutboxSyncJob');

test('phase794: outbox sync usecase processes pending rows and writes summary', async () => {
  const calls = {
    synced: [],
    failed: [],
    audits: []
  };

  const result = await runCanonicalCoreOutboxSyncJob({
    dryRun: false,
    limit: 5,
    traceId: 'phase794_trace_sync',
    requestId: 'phase794_req_sync'
  }, {
    listEvents: async () => ([
      { id: 'cco_1', objectType: 'source_snapshot', objectId: 'sr_1', eventType: 'upsert', sinkStatus: 'pending' },
      { id: 'cco_2', objectType: 'source_snapshot', objectId: 'sr_2', eventType: 'upsert', sinkStatus: 'pending' },
      { id: 'cco_3', objectType: 'source_snapshot', objectId: 'sr_3', eventType: 'upsert', sinkStatus: 'pending' }
    ]),
    upsertEvent: async (row) => {
      if (row.id === 'cco_2') return { skipped: true, reason: 'postgres_sink_disabled' };
      if (row.id === 'cco_3') {
        const err = new Error('db down');
        err.code = 'ECONN';
        throw err;
      }
      return {
        skipped: false,
        canonicalRecordId: 'source_snapshot:sr_1',
        typedMaterialization: {
          enabled: true,
          strict: false,
          tables: [
            { table: 'source_registry', status: 'materialized', recordId: 'source_registry:sr_1' },
            { table: 'source_snapshot', status: 'materialized', recordId: 'source_snapshot:snap_1' }
          ]
        }
      };
    },
    markSynced: async (id, extras) => {
      calls.synced.push({ id, extras });
    },
    markFailed: async (id, error) => {
      calls.failed.push({ id, code: error && error.code ? error.code : null });
    },
    appendAuditLog: async (row) => {
      calls.audits.push(row);
    }
  });

  assert.equal(result.ok, false);
  assert.equal(result.scannedCount, 3);
  assert.equal(result.syncedCount, 1);
  assert.equal(result.skippedCount, 1);
  assert.equal(result.failedCount, 1);
  assert.equal(result.typedMaterializedCount, 2);
  assert.equal(result.typedSkippedCount, 0);
  assert.equal(result.skippedReasonCounts.postgres_sink_disabled, 1);
  assert.equal(calls.synced.length, 1);
  assert.equal(calls.synced[0].id, 'cco_1');
  assert.equal(calls.synced[0].extras.typedMaterialization.tables.length, 2);
  assert.equal(calls.failed.length, 1);
  assert.equal(calls.failed[0].id, 'cco_3');
  assert.equal(calls.audits.length, 1);
  assert.equal(calls.audits[0].action, 'canonical_core.outbox.sync');
  assert.equal(calls.audits[0].payloadSummary.typedMaterializedCount, 2);
});

test('phase794: outbox sync usecase keeps rows untouched in dry-run mode', async () => {
  const calls = {
    synced: 0,
    failed: 0
  };
  const result = await runCanonicalCoreOutboxSyncJob({
    dryRun: true,
    limit: 2,
    traceId: 'phase794_trace_dry'
  }, {
    listEvents: async () => ([
      { id: 'cco_10', objectType: 'knowledge_object', objectId: 'faq_10', eventType: 'upsert', sinkStatus: 'pending' }
    ]),
    upsertEvent: async () => {
      throw new Error('should not call upsert in dry run');
    },
    markSynced: async () => {
      calls.synced += 1;
    },
    markFailed: async () => {
      calls.failed += 1;
    },
    appendAuditLog: async () => null
  });

  assert.equal(result.ok, true);
  assert.equal(result.dryRun, true);
  assert.equal(result.scannedCount, 1);
  assert.equal(result.syncedCount, 0);
  assert.equal(result.failedCount, 0);
  assert.equal(calls.synced, 0);
  assert.equal(calls.failed, 0);
  assert.equal(result.items[0].outcome, 'dry_run');
});
