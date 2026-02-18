'use strict';

const crypto = require('crypto');

const { getOpsConsole } = require('../phase25/getOpsConsole');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { DEFAULT_ALLOW_LISTS } = require('../../llm/allowList');
const { OPS_EXPLANATION_SCHEMA_ID } = require('../../llm/schemas');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { getDisclaimer } = require('../../llm/disclaimers');
const { toBlockedReasonCategory } = require('../../llm/blockedReasonCategory');
const { POLICY_SNAPSHOT_VERSION, buildRegulatoryProfile } = require('../../llm/regulatoryProfile');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { buildLlmInputView } = require('../llm/buildLlmInputView');
const { guardLlmOutput } = require('../llm/guardLlmOutput');

const DEFAULT_TIMEOUT_MS = 2500;
const PROMPT_VERSION = 'ops_explanation_v2';
const SYSTEM_PROMPT = [
  'You are an ops assistant.',
  'Explain the current ops state using the OpsExplanation.v1 schema.',
  'Advisory only.',
  'Do not emit direct URLs or execution commands.'
].join('\n');

const OPS_FIELD_CATEGORIES = Object.freeze({
  readiness: 'Internal',
  blockingReasons: 'Internal',
  riskLevel: 'Internal',
  notificationHealthSummary: 'Internal',
  mitigationSuggestion: 'Internal',
  allowedNextActions: 'Internal',
  recommendedNextAction: 'Internal',
  executionStatus: 'Internal',
  decisionDrift: 'Internal',
  closeDecision: 'Internal',
  closeReason: 'Internal',
  phaseResult: 'Internal',
  lastReactionAt: 'Internal',
  dangerFlags: 'Internal'
});

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function toText(value) {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  try {
    return JSON.stringify(value);
  } catch (_err) {
    return String(value);
  }
}

function pushFact(target, id, label, value, sourceType) {
  if (value === null || value === undefined) return;
  target.push({
    id,
    label,
    value: toText(value),
    sourceType
  });
}

function buildFacts(input) {
  const facts = [];
  if (!input) return facts;

  if (input.readiness) {
    pushFact(facts, 'readiness.status', 'readiness.status', input.readiness.status, 'read_model');
    if (Array.isArray(input.readiness.blocking)) {
      pushFact(facts, 'readiness.blocking', 'readiness.blocking', input.readiness.blocking.join(', '), 'read_model');
    }
  }
  if (Array.isArray(input.blockingReasons)) {
    pushFact(facts, 'blockingReasons', 'blockingReasons', input.blockingReasons.join(', '), 'read_model');
  }
  pushFact(facts, 'riskLevel', 'riskLevel', input.riskLevel, 'read_model');
  pushFact(facts, 'allowedNextActions', 'allowedNextActions', input.allowedNextActions, 'ops_state');
  pushFact(facts, 'recommendedNextAction', 'recommendedNextAction', input.recommendedNextAction, 'ops_state');

  if (input.executionStatus) {
    pushFact(facts, 'executionStatus.lastExecutionResult', 'executionStatus.lastExecutionResult', input.executionStatus.lastExecutionResult, 'decision_log');
    pushFact(facts, 'executionStatus.lastFailureClass', 'executionStatus.lastFailureClass', input.executionStatus.lastFailureClass, 'decision_log');
    pushFact(facts, 'executionStatus.lastReasonCode', 'executionStatus.lastReasonCode', input.executionStatus.lastReasonCode, 'decision_log');
    pushFact(facts, 'executionStatus.lastStage', 'executionStatus.lastStage', input.executionStatus.lastStage, 'decision_log');
  }

  if (input.decisionDrift) {
    pushFact(facts, 'decisionDrift.status', 'decisionDrift.status', input.decisionDrift.status, 'decision_log');
    pushFact(facts, 'decisionDrift.types', 'decisionDrift.types', input.decisionDrift.types, 'decision_log');
  }

  pushFact(facts, 'closeDecision', 'closeDecision', input.closeDecision, 'read_model');
  pushFact(facts, 'closeReason', 'closeReason', input.closeReason, 'read_model');
  pushFact(facts, 'phaseResult', 'phaseResult', input.phaseResult, 'read_model');
  pushFact(facts, 'lastReactionAt', 'lastReactionAt', input.lastReactionAt, 'read_model');

  if (input.dangerFlags) {
    pushFact(facts, 'dangerFlags.notReady', 'dangerFlags.notReady', input.dangerFlags.notReady, 'read_model');
    pushFact(facts, 'dangerFlags.staleMemberNumber', 'dangerFlags.staleMemberNumber', input.dangerFlags.staleMemberNumber, 'read_model');
  }

  if (input.notificationHealthSummary) {
    pushFact(facts, 'notificationHealthSummary.totalNotifications', 'notificationHealthSummary.totalNotifications', input.notificationHealthSummary.totalNotifications, 'read_model');
    pushFact(facts, 'notificationHealthSummary.unhealthyCount', 'notificationHealthSummary.unhealthyCount', input.notificationHealthSummary.unhealthyCount, 'read_model');
    pushFact(facts, 'notificationHealthSummary.countsByHealth', 'notificationHealthSummary.countsByHealth', input.notificationHealthSummary.countsByHealth, 'read_model');
  }

  if (input.mitigationSuggestion) {
    pushFact(facts, 'mitigationSuggestion', 'mitigationSuggestion', input.mitigationSuggestion, 'read_model');
  }

  return facts;
}

function buildInputFromConsole(consoleResult) {
  const payload = consoleResult || {};
  return {
    readiness: payload.readiness
      ? {
        status: payload.readiness.status || null,
        blocking: Array.isArray(payload.readiness.blocking) ? payload.readiness.blocking : []
      }
      : null,
    blockingReasons: Array.isArray(payload.blockingReasons) ? payload.blockingReasons : [],
    riskLevel: payload.riskLevel || null,
    notificationHealthSummary: payload.notificationHealthSummary
      ? {
        totalNotifications: payload.notificationHealthSummary.totalNotifications || null,
        countsByHealth: payload.notificationHealthSummary.countsByHealth || null,
        unhealthyCount: payload.notificationHealthSummary.unhealthyCount || null
      }
      : null,
    mitigationSuggestion: payload.mitigationSuggestion || null,
    allowedNextActions: Array.isArray(payload.allowedNextActions) ? payload.allowedNextActions : [],
    recommendedNextAction: payload.recommendedNextAction || null,
    executionStatus: payload.executionStatus
      ? {
        lastExecutionResult: payload.executionStatus.lastExecutionResult || null,
        lastFailureClass: payload.executionStatus.lastFailureClass || null,
        lastReasonCode: payload.executionStatus.lastReasonCode || null,
        lastStage: payload.executionStatus.lastStage || null
      }
      : null,
    decisionDrift: payload.decisionDrift
      ? {
        status: payload.decisionDrift.status || null,
        types: Array.isArray(payload.decisionDrift.types) ? payload.decisionDrift.types : []
      }
      : null,
    closeDecision: payload.closeDecision || null,
    closeReason: payload.closeReason || null,
    phaseResult: payload.phaseResult || null,
    lastReactionAt: payload.lastReactionAt || null,
    dangerFlags: payload.dangerFlags
      ? {
        notReady: Boolean(payload.dangerFlags.notReady),
        staleMemberNumber: Boolean(payload.dangerFlags.staleMemberNumber)
      }
      : null
  };
}

function buildFallbackExplanation(input, nowIso) {
  return {
    schemaId: OPS_EXPLANATION_SCHEMA_ID,
    generatedAt: nowIso,
    advisoryOnly: true,
    facts: buildFacts(input),
    interpretations: []
  };
}

function hashJson(value) {
  if (!value) return null;
  try {
    return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
  } catch (_err) {
    return null;
  }
}

function buildOpsTemplate(input) {
  const data = input || {};
  const readinessStatus = data.readiness && data.readiness.status ? String(data.readiness.status) : 'UNKNOWN';
  const riskLevel = data.riskLevel ? String(data.riskLevel) : 'UNKNOWN';
  const blockingReasons = Array.isArray(data.blockingReasons) ? data.blockingReasons.filter(Boolean) : [];
  const driftTypes = data.decisionDrift && Array.isArray(data.decisionDrift.types)
    ? data.decisionDrift.types.filter(Boolean)
    : [];
  const lastStage = data.executionStatus && data.executionStatus.lastStage
    ? String(data.executionStatus.lastStage)
    : null;
  const lastReactionAt = data.lastReactionAt ? String(data.lastReactionAt) : null;
  const recommended = data.recommendedNextAction ? String(data.recommendedNextAction) : null;
  const allowed = Array.isArray(data.allowedNextActions) ? data.allowedNextActions.filter(Boolean) : [];

  return {
    templateVersion: 'ops_template_v1',
    currentState: {
      readinessStatus,
      riskLevel,
      executionStage: lastStage
    },
    recentDiff: {
      driftStatus: data.decisionDrift && data.decisionDrift.status ? String(data.decisionDrift.status) : 'NONE',
      driftTypes
    },
    missingItems: blockingReasons,
    timelineSummary: {
      lastReactionAt,
      phaseResult: data.phaseResult ? String(data.phaseResult) : null
    },
    proposal: {
      recommendedNextAction: recommended,
      allowedNextActions: allowed
    }
  };
}

function resolveLlmPolicySnapshot(policy) {
  const normalized = systemFlagsRepo.normalizeLlmPolicy(policy);
  if (normalized === null) return Object.assign({}, systemFlagsRepo.DEFAULT_LLM_POLICY);
  return normalized;
}

function isConsentMissingByPolicy(policy) {
  return Boolean(policy && policy.lawfulBasis === 'consent' && policy.consentVerified !== true);
}

async function callAdapter(adapter, payload, timeoutMs) {
  if (!adapter || typeof adapter.explainOps !== 'function') throw new Error('adapter_missing');
  const exec = adapter.explainOps(payload);
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm_timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

async function appendDisclaimerRenderedAudit(params, deps) {
  const payload = params || {};
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  if (!auditFn) return null;
  const result = await auditFn({
    actor: payload.actor || 'unknown',
    action: 'llm_disclaimer_rendered',
    eventType: 'LLM_DISCLAIMER_RENDERED',
    entityType: 'llm_disclaimer',
    entityId: payload.purpose || 'ops_explain',
    lineUserId: payload.lineUserId || null,
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      purpose: payload.purpose || 'ops_explain',
      surface: payload.surface || 'api',
      disclaimerVersion: payload.disclaimerVersion || null,
      disclaimerShown: payload.disclaimerShown !== false,
      llmStatus: payload.llmStatus || null,
      inputFieldCategoriesUsed: []
    }
  });
  return result && result.id ? result.id : null;
}

async function getOpsExplanation(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  const getLlmEnabled = deps && deps.getLlmEnabled ? deps.getLlmEnabled : systemFlagsRepo.getLlmEnabled;
  const getLlmPolicy = deps && Object.prototype.hasOwnProperty.call(deps, 'getLlmPolicy')
    ? deps.getLlmPolicy
    : (deps ? async () => Object.assign({}, systemFlagsRepo.DEFAULT_LLM_POLICY) : systemFlagsRepo.getLlmPolicy);
  const env = deps && deps.env ? deps.env : process.env;
  const envEnabled = isLlmFeatureEnabled(env);
  const dbEnabled = await getLlmEnabled();
  const llmPolicy = resolveLlmPolicySnapshot(await getLlmPolicy());
  const llmEnabled = Boolean(envEnabled && dbEnabled);
  const nowIso = new Date().toISOString();
  const disclaimer = getDisclaimer('ops_explain');

  const consoleResult = payload.consoleResult
    ? payload.consoleResult
    : await consoleFn({ lineUserId, auditView: false }, deps);

  const input = buildInputFromConsole(consoleResult || {});
  const opsTemplate = buildOpsTemplate(input);
  const view = buildLlmInputView({
    input,
    allowList: DEFAULT_ALLOW_LISTS.opsExplanation,
    fieldCategories: OPS_FIELD_CATEGORIES,
    allowRestricted: false
  });

  let llmStatus = 'disabled';
  let llmUsed = false;
  let llmModel = null;
  let explanation = buildFallbackExplanation(input, nowIso);
  let schemaErrors = [];

  if (!view.ok) {
    llmStatus = view.blockedReason;
  } else if (!llmEnabled) {
    llmStatus = 'disabled';
  } else if (isConsentMissingByPolicy(llmPolicy)) {
    llmStatus = 'consent_missing';
  } else {
    try {
      const adapterResult = await callAdapter(
        deps && deps.llmAdapter,
        {
          schemaId: OPS_EXPLANATION_SCHEMA_ID,
          promptVersion: PROMPT_VERSION,
          system: SYSTEM_PROMPT,
          input: view.data
        },
        deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS
      );
      const candidate = adapterResult && isPlainObject(adapterResult.explanation)
        ? adapterResult.explanation
        : adapterResult;
      const guard = await guardLlmOutput({
        purpose: 'ops_explain',
        schemaId: OPS_EXPLANATION_SCHEMA_ID,
        output: candidate
      }, deps);
      if (guard.ok) {
        explanation = candidate;
        llmUsed = true;
        llmStatus = 'ok';
        llmModel = adapterResult && typeof adapterResult.model === 'string' ? adapterResult.model : null;
      } else {
        llmStatus = guard.blockedReason || 'invalid_schema';
        schemaErrors = Array.isArray(guard.schemaErrors) ? guard.schemaErrors : [];
      }
    } catch (err) {
      llmStatus = err && err.message ? String(err.message) : 'error';
    }
  }

  let auditId = null;
  if (auditFn) {
    try {
      const auditResult = await auditFn({
        actor: payload.actor || 'unknown',
        action: llmUsed ? 'llm_ops_explain_generated' : 'llm_ops_explain_blocked',
        eventType: 'LLM_OPS_EXPLAIN',
        entityType: 'llm_ops_explain',
        entityId: lineUserId,
        lineUserId,
        traceId: payload.traceId || null,
        schemaId: OPS_EXPLANATION_SCHEMA_ID,
        llmStatus,
        llmUsed,
        llmModel,
        payloadSummary: {
          purpose: 'ops_explain',
          llmEnabled,
          envLlmFeatureFlag: envEnabled,
          dbLlmEnabled: dbEnabled,
          policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
          lawfulBasis: llmPolicy.lawfulBasis,
          consentVerified: llmPolicy.consentVerified,
          crossBorder: llmPolicy.crossBorder,
          disclaimerVersion: disclaimer.version,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
          fieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
          blockedReason: llmUsed ? null : llmStatus,
          blockedReasonCategory: llmUsed ? null : toBlockedReasonCategory(llmStatus, { nullOnDisabled: true }),
          regulatoryProfile: buildRegulatoryProfile({
            policy: llmPolicy,
            fieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
            blockedReasonCategory: llmUsed ? null : toBlockedReasonCategory(llmStatus, { nullOnDisabled: true })
          }),
          inputHash: hashJson(view.ok ? view.data : input),
          outputHash: hashJson(explanation)
        }
      });
      auditId = auditResult && auditResult.id ? auditResult.id : null;
    } catch (_err) {
      auditId = null;
    }
  }
  await appendDisclaimerRenderedAudit(
    {
      actor: payload.actor || 'unknown',
      lineUserId,
      traceId: payload.traceId || null,
      requestId: payload.requestId || null,
      purpose: 'ops_explain',
      surface: 'api',
      disclaimerVersion: disclaimer.version,
      llmStatus,
      disclaimerShown: true
    },
    deps
  ).catch(() => null);

  return {
    ok: true,
    lineUserId,
    serverTime: nowIso,
    explanation,
    llmUsed,
    llmStatus,
    llmModel,
    policySnapshotVersion: POLICY_SNAPSHOT_VERSION,
    disclaimerVersion: disclaimer.version,
    disclaimer: disclaimer.text,
    opsTemplate,
    schemaErrors: schemaErrors.length ? schemaErrors : null,
    auditId
  };
}

module.exports = {
  getOpsExplanation
};
