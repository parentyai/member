'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');

test('phase233: ops explanation includes fixed template sections', async () => {
  const result = await getOpsExplanation(
    {
      lineUserId: 'U_PHASE233',
      traceId: 'TRACE_PHASE233_OPS',
      consoleResult: {
        readiness: { status: 'NOT_READY', blocking: ['registration:missing_step_key'] },
        blockingReasons: ['registration:missing_step_key'],
        riskLevel: 'HIGH',
        allowedNextActions: ['STOP_AND_ESCALATE'],
        recommendedNextAction: 'STOP_AND_ESCALATE',
        decisionDrift: { status: 'DRIFT', types: ['action_mismatch'] },
        executionStatus: { lastStage: 'PRECHECK_FAILED' },
        phaseResult: 'WARN',
        lastReactionAt: '2026-02-17T00:00:00.000Z'
      }
    },
    {
      env: {},
      getLlmEnabled: async () => false,
      appendAuditLog: async () => ({ id: 'audit-233-ops' })
    }
  );

  assert.strictEqual(result.ok, true);
  assert.ok(result.opsTemplate);
  assert.strictEqual(result.opsTemplate.templateVersion, 'ops_template_v1');
  assert.ok(result.opsTemplate.currentState);
  assert.ok(result.opsTemplate.recentDiff);
  assert.ok(Array.isArray(result.opsTemplate.missingItems));
  assert.ok(result.opsTemplate.timelineSummary);
  assert.ok(result.opsTemplate.proposal);
});
