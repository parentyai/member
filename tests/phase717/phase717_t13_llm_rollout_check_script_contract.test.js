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
    '--require-ready',
    '--require-job-entry',
    '--max-compat-share', '0.25'
  ]);
  assert.equal(args.configJsonPath, 'tmp/config.json');
  assert.equal(args.summaryJsonPath, 'tmp/summary.json');
  assert.equal(args.requireReady, true);
  assert.equal(args.requireJobEntry, true);
  assert.equal(args.maxCompatShare, 0.25);
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
  }, { requireReady: true, requireJobEntry: true });

  assert.equal(report.ok, false);
  const failedIds = report.failedChecks.map((row) => row.id);
  assert.ok(failedIds.includes('release_ready_required'));
  assert.ok(failedIds.includes('entry_types_covered'));
  assert.ok(failedIds.includes('job_entry_present'));
  assert.ok(failedIds.includes('gate_coverage_present'));
});

test('phase717: llm rollout report fails when compat share exceeds max limit', () => {
  const report = buildReadinessReport({
    configStatus: {
      llmEnabled: true,
      llmConciergeEnabled: true,
      llmWebSearchEnabled: true,
      llmStyleEngineEnabled: true,
      llmBanditEnabled: true
    },
    usageSummary: {
      releaseReadiness: { ready: true, blockedBy: [] },
      gateAuditBaseline: {
        callsTotal: 10,
        entryTypes: [
          { entryType: 'webhook', count: 2 },
          { entryType: 'admin', count: 2 },
          { entryType: 'compat', count: 6 },
          { entryType: 'job', count: 1 }
        ],
        gatesCoverage: [
          { gate: 'kill_switch', count: 10 },
          { gate: 'url_guard', count: 6 },
          { gate: 'injection', count: 8 }
        ]
      }
    }
  }, { requireReady: true, requireJobEntry: true, maxCompatShare: 0.4 });

  assert.equal(report.ok, false);
  const failedIds = report.failedChecks.map((row) => row.id);
  assert.ok(failedIds.includes('compat_share_within_limit'));
  assert.equal(report.summary.compatShare, 0.5455);
});
