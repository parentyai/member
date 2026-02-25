'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  evaluateGraph,
  resolveTaskNodeStatus
} = require('../../src/domain/journey/taskGraphRules');

test('phase654: task graph locks unresolved dependencies and keeps top actionable tasks within 3', () => {
  const nowMs = Date.parse('2026-03-01T00:00:00.000Z');
  const result = evaluateGraph([
    {
      todoKey: 'visa_documents',
      title: 'ビザ書類確認',
      status: 'open',
      dueAt: '2026-03-02T00:00:00.000Z',
      priority: 5,
      riskLevel: 'high'
    },
    {
      todoKey: 'housing_setup',
      title: '住居準備',
      status: 'open',
      dependsOn: ['visa_documents'],
      dueAt: '2026-03-04T00:00:00.000Z',
      priority: 4,
      riskLevel: 'high'
    },
    {
      todoKey: 'bank_opening',
      title: '銀行口座開設',
      status: 'open',
      dueAt: '2026-03-05T00:00:00.000Z',
      priority: 3,
      riskLevel: 'medium'
    },
    {
      todoKey: 'school_registration',
      title: '学校手続き',
      status: 'open',
      dueAt: '2026-03-06T00:00:00.000Z',
      priority: 5,
      riskLevel: 'high'
    },
    {
      todoKey: 'insurance_plan',
      title: '保険見直し',
      status: 'open',
      dueAt: '2026-03-08T00:00:00.000Z',
      priority: 2,
      riskLevel: 'low'
    },
    {
      todoKey: 'arrival_registration',
      title: '到着後登録',
      status: 'open',
      progressState: 'in_progress',
      dueAt: '2026-03-10T00:00:00.000Z',
      priority: 3,
      riskLevel: 'medium'
    }
  ], { nowMs });

  assert.equal(result.ok, true);
  const lockedNode = result.nodes.find((node) => node.todoKey === 'housing_setup');
  assert.ok(lockedNode, 'housing_setup node should exist');
  assert.equal(lockedNode.graphStatus, 'locked');
  assert.ok((lockedNode.lockReasons || []).some((reason) => reason.includes('依存未完了:visa_documents')));

  assert.ok(Array.isArray(result.topActionableTasks));
  assert.ok(result.topActionableTasks.length <= 3);
  const topKeys = result.topActionableTasks.map((item) => item.todoKey);
  assert.ok(!topKeys.includes('housing_setup'), 'locked task should not appear in actionable top list');

  for (let i = 1; i < result.topActionableTasks.length; i += 1) {
    const prev = Number(result.topActionableTasks[i - 1].riskScore || 0);
    const curr = Number(result.topActionableTasks[i].riskScore || 0);
    assert.ok(prev >= curr, 'top actionable tasks must be sorted by riskScore desc');
  }

  assert.equal(resolveTaskNodeStatus({ graphStatus: 'done' }), 'done');
  assert.equal(resolveTaskNodeStatus({ graphStatus: 'locked' }), 'locked');
  assert.equal(resolveTaskNodeStatus({ graphStatus: 'actionable', progressState: 'in_progress' }), 'in_progress');
  assert.equal(resolveTaskNodeStatus({ graphStatus: 'actionable', progressState: 'not_started' }), 'not_started');
});

test('phase654: task graph detects cyclic dependency and rejects evaluation', () => {
  const result = evaluateGraph([
    {
      todoKey: 'cycle_a',
      status: 'open',
      dependsOn: ['cycle_b']
    },
    {
      todoKey: 'cycle_b',
      status: 'open',
      dependsOn: ['cycle_a']
    }
  ], { nowMs: Date.parse('2026-03-01T00:00:00.000Z') });

  assert.equal(result.ok, false);
  assert.equal(result.reason, 'cycle_detected');
  assert.ok(Array.isArray(result.cycles));
  assert.ok(result.cycles.length >= 1);
});
