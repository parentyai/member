'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { syncJourneyTodoPlan } = require('../../src/usecases/journey/syncJourneyTodoPlan');

function withEnv(key, value) {
  const prev = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
  return () => {
    if (prev === undefined) delete process.env[key];
    else process.env[key] = prev;
  };
}

test('phase707: syncJourneyTodoPlan derives legacy todos from journey templates when flag is enabled', async () => {
  const restoreDerive = withEnv('ENABLE_LEGACY_TODO_DERIVE_FROM_TEMPLATES_V1', '1');
  const restoreEmit = withEnv('ENABLE_LEGACY_TODO_EMIT_DISABLED_V1', '0');

  const todoStore = new Map();

  try {
    const result = await syncJourneyTodoPlan({
      lineUserId: 'U_PHASE707',
      now: '2026-03-03T09:00:00.000Z',
      source: 'phase707_test'
    }, {
      userJourneyProfilesRepo: {
        getUserJourneyProfile: async () => ({ householdType: 'single', scenarioKey: 'US_ASSIGNMENT' })
      },
      userJourneySchedulesRepo: {
        getUserJourneySchedule: async () => ({ departureDate: '2026-06-01', assignmentDate: '2026-04-10', stage: 'pre_departure' })
      },
      journeyPolicyRepo: {
        getJourneyPolicy: async () => ({ reminder_offsets_days: [7, 3, 1] })
      },
      journeyTemplatesRepo: {
        listEnabledJourneyTemplatesNow: async () => [{
          templateId: 'journey_us_v1',
          version: 1,
          enabled: true,
          phases: [
            {
              phaseKey: 'onboarding',
              steps: [
                {
                  stepKey: 'visa_precheck',
                  title: 'ビザ確認',
                  leadTime: { kind: 'after', days: 14 },
                  dependsOn: [],
                  priority: 100,
                  riskLevel: 'high',
                  meaning: {
                    meaningKey: 'visa_precheck',
                    title: 'ビザ確認',
                    whyNow: '渡航遅延を防ぐため',
                    doneDefinition: '必要書類の最終確認'
                  }
                }
              ]
            },
            {
              phaseKey: 'offboarding',
              steps: [
                {
                  stepKey: 'return_flight_booking',
                  title: '帰任便手配',
                  leadTime: { kind: 'before_deadline', days: 30 },
                  dependsOn: [],
                  priority: 120,
                  riskLevel: 'high',
                  meaning: {
                    meaningKey: 'return_flight_booking',
                    title: '帰任便手配',
                    whyNow: '繁忙期は空席が不足するため',
                    doneDefinition: '帰任便を確保して共有'
                  }
                }
              ]
            }
          ]
        }]
      },
      journeyTodoItemsRepo: {
        getJourneyTodoItem: async (_lineUserId, todoKey) => todoStore.get(todoKey) || null,
        upsertJourneyTodoItem: async (_lineUserId, todoKey, patch) => {
          const merged = Object.assign({}, todoStore.get(todoKey) || {}, patch);
          todoStore.set(todoKey, merged);
          return merged;
        },
        listJourneyTodoItemsByLineUserId: async () => Array.from(todoStore.values()),
        patchJourneyTodoItem: async (_lineUserId, todoKey, patch) => {
          const merged = Object.assign({}, todoStore.get(todoKey) || {}, patch);
          todoStore.set(todoKey, merged);
          return merged;
        }
      },
      journeyTodoStatsRepo: {
        upsertUserJourneyTodoStats: async (_lineUserId, patch) => patch
      },
      taskNodesRepo: {
        upsertTaskNodesBulk: async () => ({ ok: true })
      },
      syncJourneyDagCatalogToTodos: async () => ({ ok: true, syncedCount: 0 })
    });

    assert.equal(result.ok, true);
    assert.equal(result.legacyTodoDerivedFromTemplates, true);
    assert.equal(result.legacyTodoEmitDisabled, false);
    assert.ok(result.syncedCount >= 2);

    const keys = Array.from(todoStore.keys()).sort();
    assert.ok(keys.includes('journey_us_v1__onboarding__visa_precheck'));
    assert.ok(keys.includes('journey_us_v1__offboarding__return_flight_booking'));

    const onboardingTodo = todoStore.get('journey_us_v1__onboarding__visa_precheck');
    assert.equal(onboardingTodo.meaningKey, 'visa_precheck');
    assert.equal(onboardingTodo.whyNow, '渡航遅延を防ぐため');
  } finally {
    restoreDerive();
    restoreEmit();
  }
});
