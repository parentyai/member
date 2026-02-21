'use strict';

// Tests verifying that consent gate in LLM usecases correctly blocks/unblocks
// guide mode based on the llmPolicy.consentVerified state.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getOpsExplanation } = require('../../src/usecases/phaseLLM2/getOpsExplanation');
const { getNextActionCandidates } = require('../../src/usecases/phaseLLM3/getNextActionCandidates');

const BASE_CONSOLE_OPS = {
  readiness: { status: 'NOT_READY', blocking: ['missingDoc'] },
  blockingReasons: ['missingDoc'],
  riskLevel: 'medium',
  allowedNextActions: ['ESCALATE', 'REVIEW'],
  recommendedNextAction: 'ESCALATE',
  executionStatus: { lastExecutionResult: null, lastFailureClass: null, lastReasonCode: null, lastStage: null },
  decisionDrift: { status: null, types: [] },
  closeDecision: null,
  closeReason: null,
  phaseResult: null,
  lastReactionAt: null,
  dangerFlags: { notReady: false, staleMemberNumber: false },
  // Provide object (not null) so buildInputFromConsole expands sub-fields covered by allow list
  notificationHealthSummary: { totalNotifications: null, countsByHealth: null, unhealthyCount: null },
  mitigationSuggestion: null
};

const BASE_CONSOLE_NEXT = {
  readiness: { status: 'NOT_READY', blocking: ['missingDoc'] },
  opsState: { nextAction: 'REVIEW', failure_class: null, reasonCode: null, stage: 'PENDING' },
  latestDecisionLog: { nextAction: 'REVIEW', createdAt: '2024-01-01T00:00:00.000Z' },
  allowedNextActions: ['ESCALATE', 'REVIEW', 'NO_ACTION']
};

function makeOpsDeps(policy, llmEnabled) {
  return {
    getOpsConsole: async () => BASE_CONSOLE_OPS,
    appendAuditLog: async () => ({ id: 'audit-1' }),
    getLlmEnabled: async () => llmEnabled !== false,
    getLlmPolicy: async () => Object.assign(
      { lawfulBasis: 'unspecified', consentVerified: false, crossBorder: false },
      policy || {}
    ),
    env: { LLM_FEATURE_FLAG: llmEnabled !== false ? '1' : '0' }
  };
}

function makeNextDeps(policy, llmEnabled) {
  return {
    getOpsConsole: async () => BASE_CONSOLE_NEXT,
    appendAuditLog: async () => ({ id: 'audit-1' }),
    getLlmEnabled: async () => llmEnabled !== false,
    getLlmPolicy: async () => Object.assign(
      { lawfulBasis: 'unspecified', consentVerified: false, crossBorder: false },
      policy || {}
    ),
    env: { LLM_FEATURE_FLAG: llmEnabled !== false ? '1' : '0' }
  };
}

// --- getOpsExplanation consent gate ---

test('ops explain: consent_missing blocks LLM when lawfulBasis=consent and unverified', async () => {
  const deps = makeOpsDeps({ lawfulBasis: 'consent', consentVerified: false });
  const result = await getOpsExplanation({ lineUserId: 'U1', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'consent_missing');
});

test('ops explain: LLM available after consent verified (lawfulBasis=consent, consentVerified=true)', async () => {
  const fakeExplanation = {
    schemaId: 'OpsExplanation.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    facts: [],
    interpretations: [
      { statement: 'State is normal', basedOn: ['readiness.status'], confidence: 0.85 }
    ]
  };
  const deps = makeOpsDeps({ lawfulBasis: 'consent', consentVerified: true });
  deps.llmAdapter = {
    explainOps: async () => ({ explanation: fakeExplanation, model: 'gpt-4o-mini' })
  };
  const result = await getOpsExplanation({ lineUserId: 'U1', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
});

test('ops explain: LLM available with legitimate_interest (no consent needed)', async () => {
  const fakeExplanation = {
    schemaId: 'OpsExplanation.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    facts: [],
    interpretations: [
      { statement: 'Legitimate interest applies', basedOn: ['riskLevel'], confidence: 0.7 }
    ]
  };
  const deps = makeOpsDeps({ lawfulBasis: 'legitimate_interest', consentVerified: false });
  deps.llmAdapter = {
    explainOps: async () => ({ explanation: fakeExplanation, model: 'gpt-4o-mini' })
  };
  const result = await getOpsExplanation({ lineUserId: 'U1', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
});

test('ops explain: llmStatus=disabled overrides consent when LLM flag is off', async () => {
  const deps = makeOpsDeps({ lawfulBasis: 'consent', consentVerified: false }, false);
  const result = await getOpsExplanation({ lineUserId: 'U1', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  // consent_missing is only reached when LLM is enabled; when disabled, status is 'disabled'
  assert.equal(result.llmStatus, 'disabled');
});

// --- getNextActionCandidates consent gate ---

test('next actions: consent_missing blocks LLM when lawfulBasis=consent and unverified', async () => {
  const deps = makeNextDeps({ lawfulBasis: 'consent', consentVerified: false });
  const result = await getNextActionCandidates({ lineUserId: 'U2', traceId: 'tr2', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, false);
  assert.equal(result.llmStatus, 'consent_missing');
});

test('next actions: LLM available after consent verified', async () => {
  const fakeOutput = {
    schemaId: 'NextActionCandidates.v1',
    generatedAt: new Date().toISOString(),
    advisoryOnly: true,
    candidates: [
      { action: 'ESCALATE', reason: 'not ready', confidence: 0.8, safety: { status: 'OK', reasons: [] } }
    ]
  };
  const deps = makeNextDeps({ lawfulBasis: 'consent', consentVerified: true });
  deps.llmAdapter = {
    suggestNextActionCandidates: async () => ({ nextActionCandidates: fakeOutput, model: 'gpt-4o-mini' })
  };
  const result = await getNextActionCandidates({ lineUserId: 'U2', traceId: 'tr2', actor: 'admin' }, deps);
  assert.equal(result.ok, true);
  assert.equal(result.llmUsed, true);
  assert.equal(result.llmStatus, 'ok');
});

test('next actions: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING', async () => {
  const auditedLogs = [];
  const deps = makeNextDeps({ lawfulBasis: 'consent', consentVerified: false });
  deps.appendAuditLog = async (entry) => { auditedLogs.push(entry); return { id: 'a-1' }; };
  const result = await getNextActionCandidates({ lineUserId: 'U2', traceId: 'tr2', actor: 'admin' }, deps);
  assert.equal(result.llmStatus, 'consent_missing');
  const mainLog = auditedLogs.find((e) => e.action === 'llm_next_actions_blocked');
  assert.ok(mainLog, 'llm_next_actions_blocked audit log should exist');
  assert.equal(mainLog.payloadSummary.blockedReasonCategory, 'CONSENT_MISSING');
});

test('ops explain: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING', async () => {
  const auditedLogs = [];
  const deps = makeOpsDeps({ lawfulBasis: 'consent', consentVerified: false });
  deps.appendAuditLog = async (entry) => { auditedLogs.push(entry); return { id: 'a-2' }; };
  const result = await getOpsExplanation({ lineUserId: 'U1', traceId: 'tr1', actor: 'admin' }, deps);
  assert.equal(result.llmStatus, 'consent_missing');
  const mainLog = auditedLogs.find((e) => e.action === 'llm_ops_explain_blocked');
  assert.ok(mainLog, 'llm_ops_explain_blocked audit log should exist');
  assert.equal(mainLog.payloadSummary.blockedReasonCategory, 'CONSENT_MISSING');
});
