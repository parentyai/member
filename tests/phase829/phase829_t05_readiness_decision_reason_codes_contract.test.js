'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
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
  const readRepoFile = (...segments) => fs.readFileSync(path.resolve(__dirname, '..', '..', ...segments), 'utf8');
  const appendGate = readRepoFile('src', 'usecases', 'llm', 'appendLlmGateDecision.js');
  const llmAuditGuard = readRepoFile('src', 'domain', 'audit', 'llmAuditPayloadGuard.js');
  const faqAuditGuard = readRepoFile('src', 'domain', 'audit', 'faqAuditPayloadGuard.js');
  const llmActionRepo = readRepoFile('src', 'repos', 'firestore', 'llmActionLogsRepo.js');
  const summaryRoute = readRepoFile('src', 'routes', 'admin', 'osLlmUsageSummary.js');

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
