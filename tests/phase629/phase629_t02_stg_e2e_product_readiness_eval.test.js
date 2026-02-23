'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { evaluateProductReadinessBody } = require('../../tools/run_stg_notification_e2e_checklist');

test('phase629: product readiness evaluator returns ok for GO with retention/structure checks', () => {
  const result = evaluateProductReadinessBody({
    status: 'GO',
    checks: {
      retentionRisk: { ok: true },
      structureRisk: { ok: true }
    }
  });
  assert.deepStrictEqual(result, { ok: true, reason: null });
});

test('phase629: product readiness evaluator returns no-go code list', () => {
  const result = evaluateProductReadinessBody({
    status: 'NO_GO',
    blockers: [{ code: 'retention_risk_generated_at_stale' }, { code: 'structure_risk_generated_at_stale' }]
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(
    result.reason,
    'product_readiness_no_go:retention_risk_generated_at_stale,structure_risk_generated_at_stale'
  );
});

test('phase629: product readiness evaluator fails when retention check is not ok', () => {
  const result = evaluateProductReadinessBody({
    status: 'GO',
    checks: {
      retentionRisk: { ok: false },
      structureRisk: { ok: true }
    }
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'product_readiness_retention_not_ok');
});

test('phase629: product readiness evaluator fails when structure check is not ok', () => {
  const result = evaluateProductReadinessBody({
    status: 'GO',
    checks: {
      retentionRisk: { ok: true },
      structureRisk: { ok: false }
    }
  });
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.reason, 'product_readiness_structure_not_ok');
});
