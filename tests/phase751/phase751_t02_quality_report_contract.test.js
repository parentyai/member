'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');

test('phase751: quality report script emits required top_10 outputs', () => {
  const summaryPath = path.join(ROOT, 'tmp', 'phase751_usage_summary.json');
  fs.mkdirSync(path.dirname(summaryPath), { recursive: true });
  fs.writeFileSync(summaryPath, `${JSON.stringify({
    summary: {
      conversationQuality: {
        routerReasons: [{ routerReason: 'default_casual', count: 3 }],
        fallbackTypes: [{ fallbackType: 'paid_domain_concierge', count: 2 }],
        followupIntents: [{ followupIntent: 'none', count: 4 }],
        domainIntents: [{ domainIntent: 'ssn', count: 4 }],
        legacyTemplateHitRate: 0.1,
        defaultCasualRate: 0.2,
        followupQuestionIncludedRate: 0.7,
        conciseModeAppliedRate: 0.6,
        retrieveNeededRate: 0.3,
        avgActionCount: 2,
        directAnswerAppliedRate: 0.81,
        avgRepeatRiskScore: 0.22,
        formatComplianceRate: 0.99,
        detailCarryRate: 0.97,
        correctionRecoveryRate: 0.96,
        mixedDomainRetentionRate: 0.95,
        citySpecificityResolvedRate: 0.94,
        cityOverclaimRate: 0,
        transformSourceCarryRate: 0.97,
        depthResetRate: 0.02,
        followupOveraskRate: 0.02,
        internalLabelLeakRate: 0,
        parrotEchoRate: 0,
        commandBoundaryCollisionRate: 0,
        domainIntentConciergeRate: 0.92,
        officialOnlySatisfiedRate: 0.94,
        followupResolutionRate: 0.89,
        contextualResumeHandledRate: 0.88,
        avgUnsupportedClaimCount: 0.01
      }
    }
  }, null, 2)}\n`);

  const run = spawnSync('node', [
    'tools/llm_quality/build_quality_report.js',
    '--baseline', 'tools/llm_quality/fixtures/baseline_metrics.v1.json',
    '--candidate', 'tools/llm_quality/fixtures/candidate_metrics.v1.json',
    '--summary', 'tmp/phase751_usage_summary.json',
    '--output', 'tmp/phase751_quality_report.json'
  ], {
    cwd: ROOT,
    encoding: 'utf8'
  });

  assert.equal(run.status, 0, run.stderr || run.stdout);
  const report = JSON.parse(fs.readFileSync(path.join(ROOT, 'tmp', 'phase751_quality_report.json'), 'utf8'));
  assert.equal(typeof report.overall_quality_score, 'number');
  assert.ok(Array.isArray(report.top_10_quality_failures));
  assert.ok(Array.isArray(report.top_10_loop_cases));
  assert.ok(Array.isArray(report.top_10_context_loss_cases));
  assert.ok(Array.isArray(report.top_10_japanese_service_failures));
  assert.ok(Array.isArray(report.top_10_line_fit_failures));
  assert.equal(report.signal_coverage.missingSignalCount, 0);
  assert.equal(report.signal_coverage.availableSignalCount, report.signal_coverage.requiredSignalCount);
});
