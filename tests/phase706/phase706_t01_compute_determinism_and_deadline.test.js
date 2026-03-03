'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { computeUserTasks } = require('../../src/usecases/tasks/computeUserTasks');

function findTask(result, ruleId) {
  return (result.tasks || []).find((task) => task.ruleId === ruleId) || null;
}

test('phase706: computeUserTasks remains deterministic and resolves before_deadline + dependsOn blockedReason', async () => {
  const now = '2026-03-03T09:00:00.000Z';
  const rules = [
    {
      ruleId: 'journey_us_v1__onboarding__visa_precheck',
      scenarioKey: 'US_ASSIGNMENT',
      stepKey: 'visa_precheck',
      trigger: { eventKey: 'assignment_created', source: 'admin' },
      leadTime: { kind: 'after', days: 1 },
      dependsOn: [],
      constraints: { quietHours: null, maxActions: null, planLimit: null },
      priority: 100,
      enabled: true,
      riskLevel: 'medium'
    },
    {
      ruleId: 'journey_us_v1__offboarding__return_flight_booking',
      scenarioKey: 'US_ASSIGNMENT',
      stepKey: 'return_flight_booking',
      trigger: { eventKey: 'assignment_return_window_opened', source: 'admin' },
      leadTime: { kind: 'before_deadline', days: 30 },
      dependsOn: [],
      constraints: { quietHours: null, maxActions: null, planLimit: null },
      priority: 120,
      enabled: true,
      riskLevel: 'high'
    },
    {
      ruleId: 'journey_us_v1__offboarding__departure_checklist',
      scenarioKey: 'US_ASSIGNMENT',
      stepKey: 'departure_checklist',
      trigger: { eventKey: 'assignment_return_window_opened', source: 'admin' },
      leadTime: { kind: 'before_deadline', days: 7 },
      dependsOn: ['journey_us_v1__offboarding__return_flight_booking'],
      constraints: { quietHours: null, maxActions: null, planLimit: null },
      priority: 80,
      enabled: true,
      riskLevel: 'medium'
    }
  ];

  const events = [
    {
      id: 'evt_1',
      eventKey: 'assignment_created',
      source: 'admin',
      occurredAt: '2026-01-10T00:00:00.000Z'
    },
    {
      id: 'evt_2',
      eventKey: 'assignment_return_window_opened',
      source: 'admin',
      occurredAt: '2026-05-01T00:00:00.000Z',
      deadlineAt: '2026-06-15T00:00:00.000Z'
    }
  ];

  const input = {
    userId: 'U_PHASE706',
    lineUserId: 'U_PHASE706',
    now,
    stepRules: rules,
    existingTasks: [],
    events,
    deliveries: [],
    killSwitch: false
  };

  const first = await computeUserTasks(input);
  const second = await computeUserTasks(input);

  const normalize = (result) => {
    return (result.tasks || []).map((task) => ({
      taskId: task.taskId,
      ruleId: task.ruleId,
      status: task.status,
      dueAt: task.dueAt,
      blockedReason: task.blockedReason,
      decisionHash: task.decisionHash
    }));
  };

  assert.deepEqual(normalize(first), normalize(second), 'same input must produce same output');

  const booking = findTask(first, 'journey_us_v1__offboarding__return_flight_booking');
  assert.ok(booking, 'return booking task missing');
  assert.equal(booking.dueAt, '2026-05-16T00:00:00.000Z', 'before_deadline must back-calculate deadline');

  const checklist = findTask(first, 'journey_us_v1__offboarding__departure_checklist');
  assert.ok(checklist, 'departure checklist task missing');
  assert.equal(checklist.status, 'blocked');
  assert.equal(checklist.blockedReason, 'dependency_unmet');
});
