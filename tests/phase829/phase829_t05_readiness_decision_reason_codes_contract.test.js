'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { runAnswerReadinessGateV2 } = require('../../src/domain/llm/quality/runAnswerReadinessGateV2');

test('phase829: readiness gate telemetry exposes decision source and hardening version', () => {
  const gate = runAnswerReadinessGateV2({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.95,
    sourceFreshnessScore: 0.95,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    officialOnlySatisfiedObserved: true,
    evidenceCoverage: 0.75,
    evidenceCoverageObserved: true,
    enforceV2: false
  });

  assert.equal(gate.readinessV2.decisionSource, 'high_risk_evidence_guard');
  assert.equal(gate.telemetry.readinessDecisionSourceV2, 'high_risk_evidence_guard');
  assert.equal(gate.telemetry.readinessHardeningVersion, 'r829');
});

test('phase829: sinks preserve readiness decision source fields additively', () => {
  const appendGate = fs.readFileSync('/Volumes/Arumamihs/Member-pr5-data-relations/src/usecases/llm/appendLlmGateDecision.js', 'utf8');
  const llmAuditGuard = fs.readFileSync('/Volumes/Arumamihs/Member-pr5-data-relations/src/domain/audit/llmAuditPayloadGuard.js', 'utf8');
  const faqAuditGuard = fs.readFileSync('/Volumes/Arumamihs/Member-pr5-data-relations/src/domain/audit/faqAuditPayloadGuard.js', 'utf8');
  const llmActionRepo = fs.readFileSync('/Volumes/Arumamihs/Member-pr5-data-relations/src/repos/firestore/llmActionLogsRepo.js', 'utf8');
  const summaryRoute = fs.readFileSync('/Volumes/Arumamihs/Member-pr5-data-relations/src/routes/admin/osLlmUsageSummary.js', 'utf8');

  assert.ok(appendGate.includes("'readinessDecisionSource'"));
  assert.ok(appendGate.includes("'readinessDecisionSourceV2'"));
  assert.ok(appendGate.includes("'readinessHardeningVersion'"));

  assert.ok(llmAuditGuard.includes("'readinessDecisionSource'"));
  assert.ok(llmAuditGuard.includes("'readinessDecisionSourceV2'"));
  assert.ok(llmAuditGuard.includes("'readinessHardeningVersion'"));

  assert.ok(faqAuditGuard.includes("'readinessDecisionSource'"));
  assert.ok(faqAuditGuard.includes("'readinessDecisionSourceV2'"));
  assert.ok(faqAuditGuard.includes("'readinessHardeningVersion'"));

  assert.ok(llmActionRepo.includes('readinessDecisionSource: normalizeString(payload.readinessDecisionSource, null)'));
  assert.ok(llmActionRepo.includes('readinessDecisionSourceV2: normalizeString(payload.readinessDecisionSourceV2, null)'));
  assert.ok(llmActionRepo.includes('readinessHardeningVersion: normalizeString(payload.readinessHardeningVersion, null)'));

  assert.ok(summaryRoute.includes('decisionSourceBreakdown'));
  assert.ok(summaryRoute.includes('hardeningVersionBreakdown'));
});
