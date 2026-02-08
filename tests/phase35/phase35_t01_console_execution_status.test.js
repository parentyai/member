'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { getOpsConsole } = require('../../src/usecases/phase25/getOpsConsole');

test('phase35 t01: console execution status reflects latest execution log', async () => {
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: { status: 'READY', blocking: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: {
        failure_class: 'IMPL',
        reasonCode: 'RC1',
        stage: 'ST1',
        note: 'note'
      }
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: {
      getLatestDecision: async (subjectType) => {
        if (subjectType === 'user') return { id: 'd1' };
        if (subjectType === 'ops_execution') {
          return {
            id: 'exec1',
            decidedAt: '2026-02-08T01:00:00Z',
            audit: {
              execution: {
                result: 'SUCCESS',
                executedAt: '2026-02-08T01:00:00Z'
              },
              executionContext: {
                failure_class: 'IMPL',
                reasonCode: 'RC1',
                stage: 'ST1',
                note: 'note'
              }
            }
          };
        }
        return null;
      }
    },
    decisionDriftsRepo: { getLatestDecisionDrift: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U1' }, deps);
  assert.deepStrictEqual(result.executionStatus, {
    lastExecutedAt: '2026-02-08T01:00:00.000Z',
    lastExecutionResult: 'OK',
    lastFailureClass: 'IMPL',
    lastReasonCode: 'RC1',
    lastStage: 'ST1',
    lastNote: 'note'
  });
});

test('phase35 t01: console execution status defaults to UNKNOWN when missing', async () => {
  const deps = {
    getUserStateSummary: async () => ({
      overallDecisionReadiness: { status: 'READY', blocking: [] },
      checklist: { completeness: { ok: true, missing: [] } },
      opsState: null
    }),
    getMemberSummary: async () => ({ ok: true }),
    getOpsDecisionConsistency: async () => ({ status: 'OK', issues: [] }),
    decisionLogsRepo: { getLatestDecision: async () => null },
    decisionDriftsRepo: { getLatestDecisionDrift: async () => null }
  };

  const result = await getOpsConsole({ lineUserId: 'U2' }, deps);
  assert.deepStrictEqual(result.executionStatus, {
    lastExecutedAt: null,
    lastExecutionResult: 'UNKNOWN',
    lastFailureClass: null,
    lastReasonCode: null,
    lastStage: null,
    lastNote: null
  });
});
