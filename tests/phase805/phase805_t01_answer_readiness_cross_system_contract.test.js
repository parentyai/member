'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { runAnswerReadinessGateV2 } = require('../../src/domain/llm/quality/runAnswerReadinessGateV2');
const { resolveSharedAnswerReadiness } = require('../../src/domain/llm/quality/resolveSharedAnswerReadiness');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase805: emergency official-source miss is shadow-refused while legacy path stays unchanged', () => {
  const gate = runAnswerReadinessGateV2({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'high',
    sourceAuthorityScore: 0.92,
    sourceFreshnessScore: 0.92,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.92,
    emergencyContext: true,
    emergencySeverity: 'warning',
    emergencyOfficialSourceSatisfied: false,
    enforceV2: false
  });

  assert.equal(gate.readiness.decision, 'allow');
  assert.equal(gate.readinessV2.decision, 'refuse');
  assert.equal(gate.answerReadinessVersion, 'v2');
  assert.equal(gate.answerReadinessLogOnlyV2, true);
  assert.equal(gate.telemetry.emergencyContextActive, true);
  assert.equal(gate.telemetry.emergencyOfficialSourceSatisfied, false);
});

test('phase805: journey blocker conflict clarifies in v2 readiness', () => {
  const gate = runAnswerReadinessGateV2({
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    intentRiskTier: 'medium',
    sourceAuthorityScore: 0.86,
    sourceFreshnessScore: 0.88,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.9,
    journeyContext: true,
    journeyPhase: 'arrival_0_30',
    taskBlockerDetected: true,
    journeyAlignedAction: false,
    enforceV2: false
  });

  assert.equal(gate.readinessV2.decision, 'clarify');
  assert.ok(gate.readinessV2.reasonCodes.includes('journey_task_conflict'));
  assert.equal(gate.telemetry.taskBlockerDetected, true);
  assert.equal(gate.telemetry.journeyAlignedAction, false);
});

test('phase805: shared readiness returns v2 shadow decision for saved FAQ high-risk reuse', () => {
  const result = resolveSharedAnswerReadiness({
    domainIntent: 'ssn',
    llmUsed: true,
    replyText: '回答',
    lawfulBasis: 'contract',
    consentVerified: true,
    crossBorder: false,
    legalDecision: 'allow',
    sourceAuthorityScore: 0.88,
    sourceFreshnessScore: 0.9,
    sourceReadinessDecision: 'allow',
    officialOnlySatisfied: true,
    evidenceCoverage: 0.88,
    savedFaqReused: true,
    savedFaqReusePass: false,
    savedFaqValid: false,
    savedFaqAllowedIntent: false,
    savedFaqAuthorityScore: 0.4
  });

  assert.equal(result.readiness.decision, 'allow');
  assert.equal(result.readinessV2.decision, 'refuse');
  assert.equal(result.answerReadinessVersion, 'v2');
  assert.equal(result.answerReadinessLogOnlyV2, true);
  assert.equal(result.readinessTelemetryV2.savedFaqReused, true);
  assert.equal(result.readinessTelemetryV2.savedFaqReusePass, false);
});

test('phase805: webhook and audit sinks preserve v2 readiness shadow fields', () => {
  const webhookRoute = read('src/routes/webhookLine.js');
  const appendGate = read('src/usecases/llm/appendLlmGateDecision.js');
  const llmAuditGuard = read('src/domain/audit/llmAuditPayloadGuard.js');
  const faqAuditGuard = read('src/domain/audit/faqAuditPayloadGuard.js');
  const llmActionRepo = read('src/repos/firestore/llmActionLogsRepo.js');

  assert.ok(webhookRoute.includes('readinessDecisionV2'));
  assert.ok(webhookRoute.includes('answerReadinessVersion'));
  assert.ok(webhookRoute.includes('crossSystemConflictDetected'));

  assert.ok(appendGate.includes("'readinessDecisionV2'"));
  assert.ok(appendGate.includes("'answerReadinessV2Mode'"));
  assert.ok(appendGate.includes("'cityPackGrounded'"));
  assert.ok(appendGate.includes("'savedFaqValid'"));

  assert.ok(llmAuditGuard.includes("'readinessDecisionV2'"));
  assert.ok(llmAuditGuard.includes("'answerReadinessV2Stage'"));
  assert.ok(llmAuditGuard.includes("'journeyPhase'"));
  assert.ok(llmAuditGuard.includes("'crossSystemConflictDetected'"));

  assert.ok(faqAuditGuard.includes("'readinessDecisionV2'"));
  assert.ok(faqAuditGuard.includes("'answerReadinessV2EnforcementReason'"));
  assert.ok(faqAuditGuard.includes("'savedFaqValid'"));
  assert.ok(faqAuditGuard.includes("'cityPackAuthorityScore'"));

  assert.ok(llmActionRepo.includes('readinessDecisionV2: normalizeReadinessDecision(payload.readinessDecisionV2)'));
  assert.ok(llmActionRepo.includes('answerReadinessV2Stage: normalizeString(payload.answerReadinessV2Stage, null)'));
  assert.ok(llmActionRepo.includes('cityPackGrounded: payload.cityPackGrounded === true'));
  assert.ok(llmActionRepo.includes('crossSystemConflictDetected: payload.crossSystemConflictDetected === true'));
});
