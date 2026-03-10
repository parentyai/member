'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { buildUserContextSnapshot } = require('../../src/usecases/context/buildUserContextSnapshot');

test('phase788: context snapshot builder shadow-writes memory lanes', async () => {
  const writes = {
    task: [],
    session: [],
    profile: [],
    compliance: []
  };
  const result = await buildUserContextSnapshot(
    {
      lineUserId: 'U_PHASE788',
      write: true,
      updatedAt: '2026-03-10T12:00:00.000Z'
    },
    {
      usersRepo: {
        getUser: async () => ({
          lineUserId: 'U_PHASE788',
          city: 'New York',
          state: 'NY',
          priorities: ['speed', 'cost'],
          family: { spouse: true, kidsAges: [4] },
          updatedAt: '2026-03-09T00:00:00.000Z'
        })
      },
      analyticsReadRepo: {
        listEventsByLineUserIdAndCreatedAtRange: async () => []
      },
      journeyTodoItemsRepo: {
        listJourneyTodoItemsByLineUserId: async () => ([
          { taskKey: 'school_docs', dueAt: '2026-03-20T00:00:00.000Z', status: 'open' }
        ])
      },
      userContextSnapshotsRepo: {
        upsertUserContextSnapshot: async () => null
      },
      taskMemoryRepo: {
        putTaskMemory: async (_id, payload) => writes.task.push(payload)
      },
      sessionMemoryRepo: {
        putSessionMemory: async (_id, payload) => writes.session.push(payload)
      },
      profileMemoryRepo: {
        putProfileMemory: async (_id, payload) => writes.profile.push(payload)
      },
      complianceMemoryRepo: {
        putComplianceMemory: async (_id, payload) => writes.compliance.push(payload)
      }
    }
  );

  assert.equal(result.ok, true);
  assert.equal(writes.task.length, 1);
  assert.equal(writes.session.length, 1);
  assert.equal(writes.profile.length, 1);
  assert.equal(writes.compliance.length, 1);
  assert.equal(Array.isArray(writes.task[0].current_selected_options), true);
  assert.equal(Array.isArray(writes.session[0].shown_options), true);
  assert.equal(Array.isArray(writes.profile[0].recurring_destinations), true);
  assert.equal(Array.isArray(writes.compliance[0].source_snapshot_refs), true);
});
