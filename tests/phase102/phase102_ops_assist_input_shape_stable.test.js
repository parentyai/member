'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildOpsAssistInput, PROMPT_VERSION } = require('../../src/usecases/phase102/buildOpsAssistInput');

test('phase102: ops assist input shape is stable', () => {
  const result = buildOpsAssistInput({
    opsConsoleView: {
      readiness: { status: 'READY', blocking: ['x'] },
      opsState: { nextAction: 'NO_ACTION', failure_class: 'PASS', updatedAt: '2026-02-08T00:00:00Z' },
      latestDecisionLog: { nextAction: 'NO_ACTION', createdAt: '2026-02-08T00:00:00Z', audit: { ok: true } },
      userStateSummary: { checklist: { completeness: { ok: true } }, registrationCompleteness: { ok: true } },
      memberSummary: { member: { hasMemberNumber: true, memberNumberStale: false } },
      allowedNextActions: ['NO_ACTION', 'STOP_AND_ESCALATE']
    }
  });

  assert.strictEqual(result.promptVersion, PROMPT_VERSION);
  assert.strictEqual(result.readiness.status, 'READY');
  assert.deepStrictEqual(result.readiness.blocking, ['x']);
  assert.strictEqual(result.opsState.nextAction, 'NO_ACTION');
  assert.strictEqual(result.latestDecisionLog.nextAction, 'NO_ACTION');
  assert.ok(result.userStateSummary.checklistCompleteness);
  assert.ok(result.memberSummary.memberNumberStatus);
  assert.deepStrictEqual(result.constraints.allowedNextActions, ['NO_ACTION', 'STOP_AND_ESCALATE']);
});
