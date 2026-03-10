'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { main } = require('../../tools/llm_quality/register_top_failures');
const { JUDGE_RELIABILITY_POLICY } = require('../../tools/llm_quality/config');

function writeJson(filePath, payload) {
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`);
}

test('phase764: judge reliability policy uses stricter week3 thresholds', () => {
  assert.equal(JUDGE_RELIABILITY_POLICY.maxDisagreementRate, 0.12);
  assert.equal(JUDGE_RELIABILITY_POLICY.maxSensitivityDrift, 0.08);
});

test('phase764: quality failure register writes latest snapshot and keeps bounded history', () => {
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'phase764-register-'));
  const reportPath = path.join(workDir, 'report.json');
  const gatePath = path.join(workDir, 'gate.json');
  const outPath = path.join(workDir, 'register.json');

  writeJson(reportPath, {
    generatedAt: '2026-03-10T03:00:00.000Z',
    overall_quality_score: 91.99,
    hard_gate_failures: ['none'],
    top_10_quality_failures: [{ rank: 1, failure: 'dimension_fail:conversation_continuity' }],
    top_10_loop_cases: [{ signal: 'routerReason:default_casual', count: 5 }],
    top_10_context_loss_cases: [{ signal: 'followup:none', count: 7 }],
    top_10_japanese_service_failures: [{ signal: 'defaultCasualRate', value: 0.21 }],
    top_10_line_fit_failures: [{ signal: 'retrieveNeededRate', value: 0.33 }]
  });
  writeJson(gatePath, {
    failures: [],
    warnings: ['slice_warning:paid']
  });

  const run1 = main([
    'node',
    'register_top_failures.js',
    '--report',
    reportPath,
    '--gate',
    gatePath,
    '--output',
    outPath,
    '--maxHistory',
    '2',
    '--limit',
    '2'
  ]);
  assert.equal(run1, 0);

  const first = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(first.registerVersion, 'v1');
  assert.equal(Array.isArray(first.latest.entries), true);
  assert.equal(first.latest.entries.length > 0, true);
  assert.equal(first.history.length, 1);

  writeJson(reportPath, {
    generatedAt: '2026-03-10T04:00:00.000Z',
    overall_quality_score: 92.11,
    hard_gate_failures: ['none'],
    top_10_quality_failures: [{ rank: 1, failure: 'slice_fail:domain_continuation' }],
    top_10_loop_cases: [{ signal: 'fallbackType:clarify', count: 3 }],
    top_10_context_loss_cases: [{ signal: 'domain:general', count: 4 }],
    top_10_japanese_service_failures: [{ signal: 'legacyTemplateHitRate', value: 0.03 }],
    top_10_line_fit_failures: [{ signal: 'avgActionCountOverBudget', value: 0.25 }]
  });
  const run2 = main([
    'node',
    'register_top_failures.js',
    '--report',
    reportPath,
    '--gate',
    gatePath,
    '--output',
    outPath,
    '--maxHistory',
    '2',
    '--limit',
    '2'
  ]);
  assert.equal(run2, 0);

  const second = JSON.parse(fs.readFileSync(outPath, 'utf8'));
  assert.equal(second.history.length, 2);
  assert.equal(second.latest.overallQualityScore, 92.11);
  assert.equal(second.history[0].generatedAt, '2026-03-10T04:00:00.000Z');
});
