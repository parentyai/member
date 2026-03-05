'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  parseArgs,
  buildReadinessReport
} = require('../../scripts/check_llm_rollout_readiness');

test('phase717: llm rollout check parser accepts fixture mode and require-ready flag', () => {
  const args = parseArgs([
    'node',
    'scripts/check_llm_rollout_readiness.js',
    '--config-json', 'tmp/config.json',
    '--summary-json', 'tmp/summary.json',
    '--require-ready'
  ]);
  assert.equal(args.configJsonPath, 'tmp/config.json');
  assert.equal(args.summaryJsonPath, 'tmp/summary.json');
  assert.equal(args.requireReady, true);
});

test('phase717: llm rollout report fails when required entryType or gate coverage is missing', () => {
  const report = buildReadinessReport({
    configStatus: {
      llmEnabled: true,
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: true
    },
    usageSummary: {
      releaseReadiness: { ready: false, blockedBy: ['accepted_rate'] },
      gateAuditBaseline: {
        callsTotal: 2,
        entryTypes: [{ entryType: 'webhook', count: 2 }],
        gatesCoverage: [{ gate: 'kill_switch', count: 2 }]
      }
    }
  }, { requireReady: true });

  assert.equal(report.ok, false);
  const failedIds = report.failedChecks.map((row) => row.id);
  assert.ok(failedIds.includes('release_ready_required'));
  assert.ok(failedIds.includes('entry_types_covered'));
  assert.ok(failedIds.includes('gate_coverage_present'));
});
