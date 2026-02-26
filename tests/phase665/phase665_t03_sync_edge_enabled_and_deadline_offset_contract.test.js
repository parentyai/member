'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { syncJourneyDagCatalogToTodos } = require('../../src/usecases/journey/syncJourneyDagCatalogToTodos');

test('phase665: sync ignores disabled edges and applies deadline offsets add-only fields', async () => {
  const upserts = [];
  const result = await syncJourneyDagCatalogToTodos({
    lineUserId: 'U665SYNC',
    forceEnabled: true,
    skipRecompute: true,
    now: '2026-02-26T00:00:00.000Z',
    journeyGraphCatalog: {
      enabled: true,
      schemaVersion: 2,
      nodes: [
        { nodeKey: 'A', title: 'A', planTier: 'all' },
        { nodeKey: 'B', title: 'B', planTier: 'all', dueAt: '2026-03-10T00:00:00.000Z', defaultDeadlineOffset: 2 }
      ],
      edges: [
        { from: 'A', to: 'B', reasonType: 'address_dependency', reasonLabel: '住所依存', required: true, enabled: false }
      ],
      planUnlocks: {
        free: { includePlanTiers: ['all'], maxNextActions: 1 },
        pro: { includePlanTiers: ['all', 'pro'], maxNextActions: 3 }
      }
    },
    journeyPolicy: {
      reminder_offsets_days: [7, 3, 1],
      deadlineOffsets: {
        B: -1
      }
    }
  }, {
    journeyTodoItemsRepo: {
      async listJourneyTodoItemsByLineUserId() {
        return [];
      },
      async upsertJourneyTodoItem(lineUserId, todoKey, patch) {
        upserts.push({ lineUserId, todoKey, patch });
        return { lineUserId, todoKey, ...patch };
      }
    },
    resolvePlan: async () => ({ plan: 'free' })
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'synced');

  const rowB = upserts.find((item) => item.todoKey === 'B');
  assert.ok(rowB, 'node B should be upserted');
  assert.deepEqual(rowB.patch.dependsOn, []);
  assert.deepEqual(rowB.patch.dependencyReasonMap, {});
  assert.equal(rowB.patch.dueAt, '2026-03-11T00:00:00.000Z');
  assert.equal(rowB.patch.dueDate, '2026-03-11');
});
