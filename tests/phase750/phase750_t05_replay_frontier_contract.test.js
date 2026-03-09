'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const { runReplay } = require('../../tools/llm_replay/trace_replayer');
const { runPerturbation } = require('../../tools/llm_replay/perturb_evidence_swap');
const { evaluateFrontier } = require('../../tools/llm_quality/frontier_eval');

test('phase750: replay and perturbation counters classify critical and warning failures', () => {
  const replay = runReplay([
    { id: 'a', expected: 'pass', observed: 'pass' },
    { id: 'b', expected: 'pass', observed: 'warning' },
    { id: 'c', expected: 'pass', observed: 'fail' }
  ]);
  assert.equal(replay.criticalFailures, 1);
  assert.equal(replay.warningFailures, 1);

  const perturbation = runPerturbation([
    { id: 'x', type: 'stale_source', expected: 'clarify', observed: 'allow' },
    { id: 'y', type: 'quote_noise', expected: 'pass', observed: 'warning' }
  ]);
  assert.equal(perturbation.criticalFailures, 1);
  assert.equal(perturbation.warningFailures, 1);
});

test('phase750: frontier evaluator blocks quality non-improving cost regression and ACK SLA violation', () => {
  const result = evaluateFrontier(
    { overallScore: 70, frontier: { latencyP95Ms: 1200, costPerTurnUsd: 0.02 } },
    { overallScore: 69, frontier: { latencyP95Ms: 1700, costPerTurnUsd: 0.03, ackSlaViolationRate: 0.03 } }
  );
  assert.equal(result.pass, false);
  assert.ok(result.failures.includes('quality_non_improving_with_cost_regression'));
  assert.ok(result.failures.includes('ack_sla_violation_rate_exceeded'));
});
