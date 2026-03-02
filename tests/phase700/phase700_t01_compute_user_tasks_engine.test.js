'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { computeUserTasks } = require('../../src/usecases/tasks/computeUserTasks');

test('phase700: computeUserTasks resolves trigger/dependsOn/quietHours and explain keys deterministically', async () => {
  const now = '2026-03-02T10:00:00.000Z';
  const rules = [
    {
      ruleId: 'rule_a',
      scenarioKey: 'A',
      stepKey: '3mo',
      trigger: { eventKey: 'journey_reaction', source: 'line_webhook' },
      leadTime: { kind: 'after', days: 2 },
      dependsOn: [],
      constraints: {},
      priority: 100,
      enabled: true,
      riskLevel: 'medium'
    },
    {
      ruleId: 'rule_b',
      scenarioKey: 'A',
      stepKey: '6mo',
      trigger: { eventKey: 'journey_reaction', source: 'line_webhook' },
      leadTime: { kind: 'after', days: 3 },
      dependsOn: ['rule_a'],
      constraints: {},
      priority: 90,
      enabled: true,
      riskLevel: 'high'
    },
    {
      ruleId: 'rule_c',
      scenarioKey: 'A',
      stepKey: '12mo',
      trigger: { eventKey: 'journey_reaction', source: 'line_webhook' },
      leadTime: { kind: 'after', days: 1 },
      dependsOn: [],
      constraints: { quietHours: { startHourUtc: 9, endHourUtc: 12 } },
      priority: 80,
      enabled: true,
      riskLevel: 'low'
    },
    {
      ruleId: 'rule_not_triggered',
      scenarioKey: 'A',
      stepKey: '24mo',
      trigger: { eventKey: 'not_observed', source: 'line_webhook' },
      leadTime: { kind: 'after', days: 1 },
      dependsOn: [],
      constraints: {},
      priority: 10,
      enabled: true,
      riskLevel: 'low'
    }
  ];

  const events = [
    {
      id: 'evt_1',
      eventKey: 'journey_reaction',
      source: 'line_webhook',
      occurredAt: now
    }
  ];

  const result = await computeUserTasks({
    userId: 'U_PHASE700',
    now,
    stepRules: rules,
    events,
    existingTasks: [],
    deliveries: [],
    killSwitch: false
  });

  assert.equal(result.userId, 'U_PHASE700');
  assert.equal(result.tasks.length, 3);
  assert.equal(result.killSwitch, false);

  const taskA = result.tasks.find((item) => item.ruleId === 'rule_a');
  const taskB = result.tasks.find((item) => item.ruleId === 'rule_b');
  const taskC = result.tasks.find((item) => item.ruleId === 'rule_c');
  assert.ok(taskA);
  assert.ok(taskB);
  assert.ok(taskC);

  assert.equal(taskA.status, 'todo');
  assert.equal(taskA.blockedReason, null);
  assert.equal(taskA.dueAt, '2026-03-04T10:00:00.000Z');

  assert.equal(taskB.status, 'blocked');
  assert.equal(taskB.blockedReason, 'dependency_unmet');

  assert.equal(taskC.status, 'snoozed');
  assert.equal(taskC.blockedReason, 'quiet_hours');

  assert.ok(Array.isArray(result.nextActions));
  assert.equal(result.nextActions.length, 1);
  assert.equal(result.nextActions[0].ruleId, 'rule_a');

  const skipped = result.explain.find((item) => item.ruleId === 'rule_not_triggered');
  assert.ok(skipped);
  assert.equal(skipped.decisionKey, 'skip_not_triggered');
});

test('phase700: computeUserTasks marks active tasks as kill_switch blocked when kill switch is on', async () => {
  const now = '2026-03-02T10:00:00.000Z';
  const rules = [
    {
      ruleId: 'rule_kill_switch',
      scenarioKey: 'A',
      stepKey: '3mo',
      trigger: { eventKey: 'journey_reaction', source: 'line_webhook' },
      leadTime: { kind: 'after', days: 0 },
      dependsOn: [],
      constraints: {},
      priority: 1,
      enabled: true,
      riskLevel: 'medium'
    }
  ];

  const result = await computeUserTasks({
    userId: 'U_PHASE700',
    now,
    stepRules: rules,
    events: [{ id: 'evt_1', eventKey: 'journey_reaction', source: 'line_webhook', occurredAt: now }],
    existingTasks: [],
    deliveries: [],
    killSwitch: true
  });

  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].status, 'blocked');
  assert.equal(result.tasks[0].blockedReason, 'kill_switch');
});
