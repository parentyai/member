'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateOverallDecisionReadiness } = require('../../src/usecases/phase24/overallDecisionReadiness');

test('phase24 t10: all OK => READY', () => {
  const result = evaluateOverallDecisionReadiness({
    registrationCompleteness: { ok: true, missing: [] },
    userSummaryCompleteness: { ok: true, missing: [] },
    notificationSummaryCompleteness: { ok: true, missing: [] },
    checklistCompleteness: { ok: true, missing: [] },
    opsStateCompleteness: { status: 'OK', missing: [] },
    opsDecisionCompleteness: { status: 'OK', missing: [] }
  });
  assert.deepStrictEqual(result, { status: 'READY', blocking: [] });
});

test('phase24 t10: warn missing in opsStateCompleteness => NOT_READY', () => {
  const result = evaluateOverallDecisionReadiness({
    registrationCompleteness: { ok: true, missing: [] },
    userSummaryCompleteness: { ok: true, missing: [] },
    notificationSummaryCompleteness: { ok: true, missing: [] },
    checklistCompleteness: { ok: true, missing: [] },
    opsStateCompleteness: { status: 'WARN', missing: ['missing_ops_state'] },
    opsDecisionCompleteness: { status: 'OK', missing: [] }
  });
  assert.strictEqual(result.status, 'NOT_READY');
  assert.deepStrictEqual(result.blocking, ['ops_state:missing_ops_state']);
});
