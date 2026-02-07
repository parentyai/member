'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateOpsDecisionCompleteness } = require('../../src/usecases/phase24/opsDecisionCompleteness');

test('phase24 t09: missing opsState => WARN missing_ops_state', async () => {
  const result = await evaluateOpsDecisionCompleteness(null, {
    decisionLogsRepo: { getDecisionById: async () => null }
  });
  assert.deepStrictEqual(result, { status: 'WARN', missing: ['missing_ops_state'] });
});

test('phase24 t09: missing decision log => WARN missing_decision_log', async () => {
  const result = await evaluateOpsDecisionCompleteness({
    sourceDecisionLogId: 'd1',
    nextAction: 'NO_ACTION'
  }, {
    decisionLogsRepo: { getDecisionById: async () => null }
  });
  assert.deepStrictEqual(result, { status: 'WARN', missing: ['missing_decision_log'] });
});

test('phase24 t09: mismatched nextAction => WARN mismatched_next_action', async () => {
  const result = await evaluateOpsDecisionCompleteness({
    sourceDecisionLogId: 'd1',
    nextAction: 'FIX_AND_RERUN'
  }, {
    decisionLogsRepo: { getDecisionById: async () => ({ id: 'd1', nextAction: 'NO_ACTION' }) }
  });
  assert.deepStrictEqual(result, { status: 'WARN', missing: ['mismatched_next_action'] });
});

test('phase24 t09: matching decision log => OK', async () => {
  const result = await evaluateOpsDecisionCompleteness({
    sourceDecisionLogId: 'd1',
    nextAction: 'NO_ACTION'
  }, {
    decisionLogsRepo: { getDecisionById: async () => ({ id: 'd1', nextAction: 'NO_ACTION' }) }
  });
  assert.deepStrictEqual(result, { status: 'OK', missing: [] });
});
