'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { syncJourneyDagCatalogToTodos } = require('../../src/usecases/journey/syncJourneyDagCatalogToTodos');

test('phase664: sync applies only required edges and stores dependencyReasonMap add-only field', async () => {
  const upserts = [];
  const catalog = {
    enabled: true,
    schemaVersion: 2,
    nodes: [
      { nodeKey: 'A', title: 'A', planTier: 'all' },
      { nodeKey: 'B', title: 'B', planTier: 'all' }
    ],
    edges: [
      { from: 'A', to: 'B', reasonType: 'address_dependency', reasonLabel: '住所確定', required: true },
      { from: 'C', to: 'B', reasonType: 'reaction_branch', required: false }
    ],
    planUnlocks: {
      free: { includePlanTiers: ['all'], maxNextActions: 1 },
      pro: { includePlanTiers: ['all', 'pro'], maxNextActions: 3 }
    }
  };

  const result = await syncJourneyDagCatalogToTodos({
    lineUserId: 'U664',
    forceEnabled: true,
    skipRecompute: true,
    journeyGraphCatalog: catalog,
    now: '2026-02-25T10:00:00.000Z'
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
    journeyPolicyRepo: {
      async getJourneyPolicy() {
        return { reminder_offsets_days: [7, 3, 1] };
      }
    },
    resolvePlan: async () => ({ plan: 'free' })
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, 'synced');
  const target = upserts.find((entry) => entry.todoKey === 'B');
  assert.ok(target, 'node B should be upserted');
  assert.deepEqual(target.patch.dependsOn, ['A']);
  assert.deepEqual(target.patch.dependencyReasonMap, {
    A: 'address_dependency:住所確定'
  });
});
