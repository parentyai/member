'use strict';

const assert = require('assert');
const { test, beforeEach, afterEach } = require('node:test');

const { createDbStub } = require('../phase0/firestoreStub');
const {
  setDbForTest,
  clearDbForTest,
  setServerTimestampForTest,
  clearServerTimestampForTest
} = require('../../src/infra/firestore');

const { submitOpsDecision } = require('../../src/usecases/phase25/submitOpsDecision');
const { getTraceBundle } = require('../../src/usecases/admin/getTraceBundle');

beforeEach(() => {
  setDbForTest(createDbStub());
  setServerTimestampForTest('2026-02-09T00:00:00Z');
});

afterEach(() => {
  clearDbForTest();
  clearServerTimestampForTest();
});

test('phase142: trace bundle includes notification_mitigation.decision audit + decision log snapshot', async () => {
  const deps = {
    getOpsConsole: async () => ({
      serverTime: '2026-02-09T00:00:00.000Z',
      readiness: { status: 'READY', blocking: [] },
      consistency: { status: 'OK', issues: [] },
      allowedNextActions: ['NO_ACTION', 'RERUN_MAIN', 'FIX_AND_RERUN', 'STOP_AND_ESCALATE'],
      recommendedNextAction: 'NO_ACTION',
      closeDecision: 'NO_CLOSE',
      closeReason: 'not_closed',
      phaseResult: null,
      mitigationSuggestion: { actionType: 'PAUSE_AND_REVIEW', requiredHumanCheck: true }
    })
  };

  const traceId = 'TRACE1';
  const result = await submitOpsDecision({
    lineUserId: 'U1',
    actor: 'ops_readonly',
    requestId: 'REQ1',
    traceId,
    decision: { nextAction: 'NO_ACTION', failure_class: 'PASS', note: '' },
    notificationMitigationDecision: {
      decision: 'ADOPT',
      note: 'pause and review',
      actionType: 'PAUSE_AND_REVIEW',
      targetNotificationId: 'N1'
    }
  }, deps);

  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.traceId, traceId);

  const bundle = await getTraceBundle({ traceId, limit: 50 });
  assert.strictEqual(bundle.ok, true);
  assert.ok(bundle.audits.some((a) => a.action === 'notification_mitigation.decision'));
  assert.ok(bundle.decisions.some((d) => d.audit && d.audit.notificationMitigationDecision && d.audit.notificationMitigationDecision.decision === 'ADOPT'));
});

