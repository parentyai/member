'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const {
  sanitizeSummaryInput,
  normalizeEntryType,
  normalizeGatesApplied
} = require('../../src/usecases/llm/appendLlmGateDecision');
const { buildGateAuditBaseline } = require('../../src/routes/admin/osLlmUsageSummary');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

test('phase717: llm gate writer normalizes entryType and gatesApplied', () => {
  assert.equal(normalizeEntryType('webhook'), 'webhook');
  assert.equal(normalizeEntryType('ADMIN'), 'admin');
  assert.equal(normalizeEntryType('unknown_value'), 'unknown');
  assert.deepEqual(normalizeGatesApplied(['kill_switch', 'INJECTION', 'invalid']), ['kill_switch', 'injection']);
});

test('phase717: llm gate writer payloadSummary uses allowlist and drops unknown keys', () => {
  const sanitized = sanitizeSummaryInput({
    lineUserId: 'U1',
    decision: 'allow',
    entryType: 'job',
    gatesApplied: ['kill_switch', 'snapshot'],
    conversationMode: 'casual',
    routerReason: 'greeting_detected',
    opportunityType: 'none',
    opportunityReasonKeys: ['greeting_detected'],
    interventionBudget: 0,
    sanitizeApplied: true,
    sanitizedCandidateCount: 3,
    lawfulBasis: 'consent',
    consentVerified: false,
    crossBorder: true,
    legalDecision: 'blocked',
    legalReasonCodes: ['consent_missing'],
    intentRiskTier: 'high',
    riskReasonCodes: ['intent_ssn', 'risk_high'],
    readinessDecision: 'clarify',
    readinessReasonCodes: ['source_readiness_clarify'],
    readinessSafeResponseMode: 'clarify',
    unsupportedClaimCount: 1,
    contradictionDetected: true,
    answerReadinessLogOnly: true,
    followupIntent: 'docs_required',
    conciseModeApplied: true,
    repetitionPrevented: true,
    directAnswerApplied: true,
    clarifySuppressed: true,
    contextCarryScore: 0.82,
    repeatRiskScore: 0.11,
    legacyTemplateHit: false,
    followupQuestionIncluded: true,
    actionCount: 1,
    pitfallIncluded: false,
    domainIntent: 'school',
    fallbackType: 'none',
    interventionSuppressedBy: 'cooldown',
    unknownField: 'drop_me'
  });
  assert.equal(sanitized.lineUserId, 'U1');
  assert.equal(sanitized.decision, 'allow');
  assert.equal(sanitized.conversationMode, 'casual');
  assert.equal(sanitized.routerReason, 'greeting_detected');
  assert.equal(sanitized.opportunityType, 'none');
  assert.deepEqual(sanitized.opportunityReasonKeys, ['greeting_detected']);
  assert.equal(sanitized.interventionBudget, 0);
  assert.equal(sanitized.sanitizeApplied, true);
  assert.equal(sanitized.sanitizedCandidateCount, 3);
  assert.equal(sanitized.lawfulBasis, 'consent');
  assert.equal(sanitized.consentVerified, false);
  assert.equal(sanitized.crossBorder, true);
  assert.equal(sanitized.legalDecision, 'blocked');
  assert.deepEqual(sanitized.legalReasonCodes, ['consent_missing']);
  assert.equal(sanitized.intentRiskTier, 'high');
  assert.deepEqual(sanitized.riskReasonCodes, ['intent_ssn', 'risk_high']);
  assert.equal(sanitized.readinessDecision, 'clarify');
  assert.deepEqual(sanitized.readinessReasonCodes, ['source_readiness_clarify']);
  assert.equal(sanitized.readinessSafeResponseMode, 'clarify');
  assert.equal(sanitized.unsupportedClaimCount, 1);
  assert.equal(sanitized.contradictionDetected, true);
  assert.equal(sanitized.answerReadinessLogOnly, true);
  assert.equal(sanitized.followupIntent, 'docs_required');
  assert.equal(sanitized.conciseModeApplied, true);
  assert.equal(sanitized.repetitionPrevented, true);
  assert.equal(sanitized.directAnswerApplied, true);
  assert.equal(sanitized.clarifySuppressed, true);
  assert.equal(sanitized.contextCarryScore, 0.82);
  assert.equal(sanitized.repeatRiskScore, 0.11);
  assert.equal(sanitized.legacyTemplateHit, false);
  assert.equal(sanitized.followupQuestionIncluded, true);
  assert.equal(sanitized.actionCount, 1);
  assert.equal(sanitized.pitfallIncluded, false);
  assert.equal(sanitized.domainIntent, 'school');
  assert.equal(sanitized.fallbackType, 'none');
  assert.equal(sanitized.interventionSuppressedBy, 'cooldown');
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, 'unknownField'), false);
});

test('phase717: gate baseline aggregates entryType, gates coverage, and entry quality signals', () => {
  const baseline = buildGateAuditBaseline([
    {
      payloadSummary: {
        decision: 'allow',
        entryType: 'webhook',
        gatesApplied: ['kill_switch', 'url_guard'],
        directAnswerApplied: true,
        conciseModeApplied: true,
        contextCarryScore: 0.8
      }
    },
    {
      payloadSummary: {
        decision: 'blocked',
        blockedReason: 'citation_missing',
        entryType: 'admin',
        gatesApplied: ['kill_switch'],
        repetitionPrevented: true
      }
    },
    {
      payloadSummary: {
        decision: 'blocked',
        blockedReason: 'template_violation',
        entryType: 'compat',
        gatesApplied: ['kill_switch', 'injection'],
        legacyTemplateHit: true
      }
    }
  ]);

  assert.equal(baseline.callsTotal, 3);
  const entryTypes = Object.fromEntries((baseline.entryTypes || []).map((row) => [row.entryType, row.count]));
  const gatesCoverage = Object.fromEntries((baseline.gatesCoverage || []).map((row) => [row.gate, row.count]));
  assert.equal(entryTypes.webhook, 1);
  assert.equal(entryTypes.admin, 1);
  assert.equal(entryTypes.compat, 1);
  assert.equal(entryTypes.job, 0);
  assert.equal(gatesCoverage.kill_switch, 3);
  assert.equal(gatesCoverage.url_guard, 1);
  assert.equal(gatesCoverage.injection, 1);
  assert.equal(gatesCoverage.snapshot, 0);
  const entrySignals = Object.fromEntries((baseline.entryQualitySignals || []).map((row) => [row.entryType, row]));
  assert.equal(entrySignals.webhook.directAnswerAppliedRate, 1);
  assert.equal(entrySignals.webhook.conciseModeAppliedRate, 1);
  assert.equal(entrySignals.admin.repetitionPreventedRate, 1);
  assert.equal(entrySignals.compat.legacyTemplateHitRate, 1);
});

test('phase717: webhook/admin/compat routes set entryType and gatesApplied for llm_gate.decision', () => {
  const webhook = read('src/routes/webhookLine.js');
  const adminFaq = read('src/routes/admin/llmFaq.js');
  const adminOps = read('src/routes/admin/llmOps.js');
  const compat2 = read('src/routes/phaseLLM2OpsExplain.js');
  const compat3 = read('src/routes/phaseLLM3OpsNextActions.js');
  const compat4 = read('src/routes/phaseLLM4FaqAnswer.js');
  const internalJob = read('src/routes/internal/llmActionRewardFinalizeJob.js');

  assert.ok(webhook.includes("entryType: 'webhook'"));
  assert.ok(webhook.includes("gatesApplied: ['kill_switch', 'injection', 'url_guard']"));

  assert.ok(adminFaq.includes("entryType: 'admin'"));
  assert.ok(adminFaq.includes("gatesApplied: ['kill_switch', 'injection', 'url_guard']"));
  assert.ok(adminOps.includes("entryType: 'admin'"));
  assert.ok(adminOps.includes("gatesApplied: ['kill_switch']"));

  assert.ok(compat2.includes("entryType: 'compat'"));
  assert.ok(compat2.includes("gatesApplied: ['kill_switch']"));
  assert.ok(compat3.includes("entryType: 'compat'"));
  assert.ok(compat3.includes("gatesApplied: ['kill_switch']"));
  assert.ok(compat4.includes("entryType: 'compat'"));
  assert.ok(compat4.includes("gatesApplied: ['kill_switch', 'injection', 'url_guard']"));

  assert.ok(internalJob.includes("entryType: ENTRY_TYPE"));
  assert.ok(internalJob.includes("gatesApplied: GATES_APPLIED"));
});
