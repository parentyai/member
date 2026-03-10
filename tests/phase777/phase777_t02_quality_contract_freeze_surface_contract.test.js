'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { buildQualityFrameworkSummary } = require('../../src/routes/admin/osLlmUsageSummary');

test('phase777: usage summary quality payload includes contract freeze metadata', () => {
  const summary = buildQualityFrameworkSummary({
    conversationQuality: {
      sampleCount: 40,
      legacyTemplateHitRate: 0.01,
      defaultCasualRate: 0.01,
      contradictionRate: 0.01,
      avgSourceAuthorityScore: 0.8,
      avgSourceFreshnessScore: 0.8,
      conciseModeAppliedRate: 0.8,
      repetitionPreventedRate: 0.8,
      directAnswerAppliedRate: 0.8
    },
    gateAuditBaseline: { acceptedRate: 0.9 },
    releaseReadiness: { ready: true, metrics: { avgEvidenceCoverage: 0.9 } },
    byPlan: { free: { blockedRate: 0.1 }, pro: { blockedRate: 0.05 } },
    actionRows: []
  });

  assert.ok(summary.contractFreeze && typeof summary.contractFreeze === 'object');
  assert.equal(typeof summary.contractFreeze.registryVersion, 'string');
  assert.equal(typeof summary.contractFreeze.registryHash, 'string');
  assert.equal(Number.isFinite(Number(summary.contractFreeze.blockingConflictCount)), true);
});

test('phase777: admin UI benchmark board renders contract freeze fields', () => {
  const uiPath = path.join(__dirname, '..', '..', 'apps', 'admin', 'assets', 'admin_app.js');
  const src = fs.readFileSync(uiPath, 'utf8');
  assert.ok(src.includes('contractRegistryVersion'));
  assert.ok(src.includes('contractRegistryHash'));
  assert.ok(src.includes('blockingConflictCount'));
});
