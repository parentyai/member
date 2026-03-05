'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { syncCityPackRecommendedTasks } = require('../../src/usecases/cityPack/syncCityPackRecommendedTasks');

test('phase741: syncCityPackRecommendedTasks creates missing tasks only for subscribed modules', async () => {
  const prevFlag = process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
  process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = '1';
  try {
    const upserted = [];
    const result = await syncCityPackRecommendedTasks({
      lineUserId: 'U_CITYPACK',
      now: '2026-03-05T00:00:00.000Z',
      actor: 'test'
    }, {
      usersRepo: {
        getUser: async () => ({ lineUserId: 'U_CITYPACK', regionKey: 'us-ca-sanfrancisco' })
      },
      userCityPackPreferencesRepo: {
        getUserCityPackPreference: async () => ({ modulesSubscribed: ['schools'] })
      },
      composeCityAndNationwidePacks: async () => ({
        items: [{ cityPackId: 'cp_sf' }]
      }),
      cityPacksRepo: {
        ALLOWED_MODULES: ['schools', 'healthcare', 'driving', 'housing', 'utilities'],
        getCityPack: async () => ({
          id: 'cp_sf',
          recommendedTasks: [
            { ruleId: 'school_enrollment', module: 'schools', priorityBoost: 20 },
            { ruleId: 'housing_search', module: 'housing', priorityBoost: 10 }
          ]
        })
      },
      tasksRepo: {
        buildTaskId: (lineUserId, ruleId) => `${lineUserId}__${ruleId}`,
        getTask: async (taskId) => (taskId.endsWith('__school_enrollment') ? null : { taskId }),
        upsertTask: async (taskId, payload) => {
          upserted.push({ taskId, payload });
          return payload;
        }
      },
      stepRulesRepo: {
        getStepRule: async (ruleId) => ({
          ruleId,
          enabled: true,
          stepKey: 'step_school',
          meaning: { title: '学校手続き' },
          leadTime: { days: 2 },
          priority: 12,
          riskLevel: 'medium'
        })
      }
    });

    assert.equal(result.ok, true);
    assert.equal(result.status, 'synced');
    assert.equal(result.createdCount, 1);
    assert.equal(result.skippedCount, 0);
    assert.equal(upserted.length, 1);
    assert.equal(upserted[0].taskId, 'U_CITYPACK__school_enrollment');
    assert.equal(upserted[0].payload.ruleId, 'school_enrollment');
  } finally {
    if (prevFlag === undefined) delete process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1;
    else process.env.ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 = prevFlag;
  }
});
