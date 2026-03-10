'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { normalizeEntries, buildSnapshot } = require('../../tools/llm_quality/register_top_failures');
const { buildQueue } = require('../../tools/llm_quality/build_counterexample_queue');

test('phase770: register emits runtime_signal_gap when quality signal coverage is missing', () => {
  const entries = normalizeEntries({
    top_10_quality_failures: [],
    top_10_loop_cases: [],
    top_10_context_loss_cases: [],
    top_10_japanese_service_failures: [],
    top_10_line_fit_failures: [],
    signal_coverage: {
      missingSignalCount: 3,
      missingSignals: ['defaultCasualRate', 'directAnswerAppliedRate', 'avgRepeatRiskScore']
    }
  }, 10);

  const runtimeGap = entries.find((row) => row.category === 'runtime_signal_gap');
  assert.ok(runtimeGap);
  assert.equal(runtimeGap.count, 3);
  assert.match(runtimeGap.signal, /runtime_signal_missing:/);
});

test('phase770: runtime_signal_gap appears in counterexample queue for operational follow-up', () => {
  const snapshot = buildSnapshot({
    report: {
      generatedAt: '2026-03-10T06:00:00.000Z',
      overall_quality_score: 91.99,
      hard_gate_failures: [],
      top_10_quality_failures: [],
      top_10_loop_cases: [],
      top_10_context_loss_cases: [],
      top_10_japanese_service_failures: [],
      top_10_line_fit_failures: [],
      signal_coverage: {
        missingSignalCount: 2,
        missingSignals: ['defaultCasualRate', 'directAnswerAppliedRate']
      }
    },
    gate: { failures: [] },
    limit: 10
  });
  const registerPayload = {
    registerVersion: 'v1',
    updatedAt: '2026-03-10T06:00:00.000Z',
    latest: snapshot,
    history: [snapshot]
  };

  const queue = buildQueue(registerPayload, 20);
  const runtimeGap = queue.find((row) => row.category === 'runtime_signal_gap');
  assert.ok(runtimeGap);
  assert.equal(runtimeGap.counterexampleId, 'CE-02');
  assert.equal(runtimeGap.owner, 'audit_traceability');
});

test('phase770: report -> register -> queue roundtrip keeps runtime gap entry', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase770-register-'));
  const registerPath = path.join(workDir, 'register.json');
  const report = {
    generatedAt: '2026-03-10T06:30:00.000Z',
    overall_quality_score: 92.0,
    hard_gate_failures: [],
    top_10_quality_failures: [],
    top_10_loop_cases: [],
    top_10_context_loss_cases: [],
    top_10_japanese_service_failures: [],
    top_10_line_fit_failures: [],
    signal_coverage: {
      missingSignalCount: 1,
      missingSignals: ['avgRepeatRiskScore']
    }
  };
  const latest = buildSnapshot({
    report,
    gate: { failures: [] },
    limit: 10
  });
  const payload = {
    registerVersion: 'v1',
    updatedAt: '2026-03-10T06:30:00.000Z',
    latest,
    history: [latest]
  };
  fs.writeFileSync(registerPath, `${JSON.stringify(payload, null, 2)}\n`);

  const queue = buildQueue(payload, 10);
  assert.equal(queue.some((row) => row.category === 'runtime_signal_gap'), true);
});

