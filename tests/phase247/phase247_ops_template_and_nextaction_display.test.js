'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { test } = require('node:test');

const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

test('phase247: ops template sections order is fixed', async () => {
  const result = await getOpsExplanation(
    {
      lineUserId: 'U_PHASE247',
      consoleResult: {
        readiness: { status: 'READY', blocking: [] },
        blockingReasons: ['missing_ops_state'],
        riskLevel: 'WARN'
      }
    },
    {
      env: { LLM_FEATURE_FLAG: 'false' },
      getLlmEnabled: async () => false,
      appendAuditLog: async () => ({ id: 'audit-247' })
    }
  );
  assert.strictEqual(result.ok, true);
  assert.deepStrictEqual(Object.keys(result.opsTemplate), [
    'templateVersion',
    'currentState',
    'recentDiff',
    'missingItems',
    'timelineSummary',
    'proposal'
  ]);
});

test('phase247: next action internal enum stays uppercase', async () => {
  const result = await getNextActionCandidates(
    {
      lineUserId: 'U_PHASE247',
      consoleResult: {
        readiness: { status: 'READY', blocking: [] },
        opsState: { nextAction: 'REVIEW' },
        latestDecisionLog: { nextAction: 'REVIEW', createdAt: '2026-02-18T00:00:00.000Z' },
        allowedNextActions: ['MONITOR', 'REVIEW']
      }
    },
    {
      env: { LLM_FEATURE_FLAG: 'false' },
      getLlmEnabled: async () => false,
      appendAuditLog: async () => ({ id: 'audit-247-next' })
    }
  );
  assert.ok(result.nextActionCandidates.candidates.length > 0);
  result.nextActionCandidates.candidates.forEach((item) => {
    assert.strictEqual(item.action, item.action.toUpperCase());
  });
});

test('phase247: admin app lowercases next actions for display only', () => {
  const jsPath = path.resolve(__dirname, '../../apps/admin/assets/admin_app.js');
  const source = fs.readFileSync(jsPath, 'utf8');
  assert.match(source, /normalizeNextActionsForDisplay/);
  assert.match(source, /normalized\.action = normalized\.action\.toLowerCase\(\)/);
});
