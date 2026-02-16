'use strict';

const crypto = require('crypto');

const { getOpsConsole } = require('../phase25/getOpsConsole');
const { DEFAULT_ALLOW_LISTS, sanitizeInput } = require('../../llm/allowList');
const { validateSchema } = require('../../llm/validateSchema');
const { OPS_EXPLANATION_SCHEMA_ID } = require('../../llm/schemas');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { appendAuditLog } = require('../audit/appendAuditLog');

const DEFAULT_TIMEOUT_MS = 2500;
const PROMPT_VERSION = 'ops_explanation_v1';
const SYSTEM_PROMPT = [
  'You are an ops assistant.',
  'Explain the current ops state using the OpsExplanation.v1 schema.',
  'Do not suggest actions beyond abstract reasoning.',
  'Advisory only.'
].join('\n');

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
      pushFact(
        facts,
        'readiness.blocking',
        'readiness.blocking',
        input.readiness.blocking.join(', '),
        'read_model'
      );
    }
  }

  if (Array.isArray(input.blockingReasons)) {
    pushFact(facts, 'blockingReasons', 'blockingReasons', input.blockingReasons.join(', '), 'read_model');
  }

  pushFact(facts, 'riskLevel', 'riskLevel', input.riskLevel, 'read_model');
  pushFact(facts, 'allowedNextActions', 'allowedNextActions', input.allowedNextActions, 'ops_state');
  pushFact(facts, 'recommendedNextAction', 'recommendedNextAction', input.recommendedNextAction, 'ops_state');

  if (input.executionStatus) {
    pushFact(
      facts,
      'executionStatus.lastExecutionResult',
      'executionStatus.lastExecutionResult',
      input.executionStatus.lastExecutionResult,
      'decision_log'
    );
    pushFact(
      facts,
      'executionStatus.lastFailureClass',
      'executionStatus.lastFailureClass',
      input.executionStatus.lastFailureClass,
      'decision_log'
    );
    pushFact(
      facts,
      'executionStatus.lastReasonCode',
      'executionStatus.lastReasonCode',
      input.executionStatus.lastReasonCode,
      'decision_log'
    );
    pushFact(
      facts,
      'executionStatus.lastStage',
      'executionStatus.lastStage',
      input.executionStatus.lastStage,
      'decision_log'
    );
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
    pushFact(
      facts,
      'dangerFlags.staleMemberNumber',
      'dangerFlags.staleMemberNumber',
      input.dangerFlags.staleMemberNumber,
      'read_model'
    );
  }

  if (input.notificationHealthSummary) {
    pushFact(
      facts,
      'notificationHealthSummary.totalNotifications',
      'notificationHealthSummary.totalNotifications',
      input.notificationHealthSummary.totalNotifications,
      'read_model'
    );
    pushFact(
      facts,
      'notificationHealthSummary.unhealthyCount',
      'notificationHealthSummary.unhealthyCount',
      input.notificationHealthSummary.unhealthyCount,
      'read_model'
    );
    pushFact(
      facts,
      'notificationHealthSummary.countsByHealth',
      'notificationHealthSummary.countsByHealth',
      input.notificationHealthSummary.countsByHealth,
      'read_model'
    );
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

async function callAdapter(adapter, payload, timeoutMs) {
  if (!adapter || typeof adapter.explainOps !== 'function') return null;
  const exec = adapter.explainOps(payload);
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

async function getOpsExplanation(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  const env = deps && deps.env ? deps.env : process.env;
  const llmEnabled = isLlmFeatureEnabled(env);
  const nowIso = new Date().toISOString();

  const consoleResult = payload.consoleResult
    ? payload.consoleResult
    : await consoleFn({ lineUserId, auditView: false }, deps);

  const input = buildInputFromConsole(consoleResult || {});
  const sanitized = sanitizeInput({ input, allowList: DEFAULT_ALLOW_LISTS.opsExplanation });

  let llmStatus = 'disabled';
  let llmUsed = false;
  let llmModel = null;
  let explanation = buildFallbackExplanation(input, nowIso);
  let schemaErrors = [];

  if (!sanitized.ok) {
    llmStatus = 'allow_list_violation';
    explanation = buildFallbackExplanation(input, nowIso);
  } else if (!llmEnabled) {
    llmStatus = 'disabled';
  } else if (!deps || !deps.llmAdapter || typeof deps.llmAdapter.explainOps !== 'function') {
    llmStatus = 'adapter_missing';
  } else {
    try {
      const adapterResult = await callAdapter(
        deps.llmAdapter,
        {
          schemaId: OPS_EXPLANATION_SCHEMA_ID,
          promptVersion: PROMPT_VERSION,
          system: SYSTEM_PROMPT,
          input: sanitized.data
        },
        deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS
      );
      const candidate = adapterResult && isPlainObject(adapterResult.explanation)
        ? adapterResult.explanation
        : adapterResult;
      const validation = validateSchema(OPS_EXPLANATION_SCHEMA_ID, candidate);
      if (validation.ok) {
        explanation = candidate;
        llmUsed = true;
        llmStatus = 'ok';
        llmModel = adapterResult && typeof adapterResult.model === 'string' ? adapterResult.model : null;
      } else {
        schemaErrors = validation.errors;
        llmStatus = 'invalid_schema';
      }
    } catch (_err) {
      llmStatus = 'error';
    }
  }

  let auditId = null;
  if (auditFn) {
    try {
      const auditResult = await auditFn({
        action: 'LLM_EXPLANATION',
        eventType: 'LLM_EXPLANATION',
        type: 'OPS_EXPLANATION',
        lineUserId,
        traceId: payload.traceId || null,
        schemaId: OPS_EXPLANATION_SCHEMA_ID,
        llmStatus,
        llmUsed,
        llmModel,
        inputHash: hashJson(sanitized.ok ? sanitized.data : input),
        outputHash: hashJson(explanation)
      });
      auditId = auditResult && auditResult.id ? auditResult.id : null;
    } catch (_err) {
      auditId = null;
    }
  }

  return {
    ok: true,
    lineUserId,
    serverTime: nowIso,
    explanation,
    llmUsed,
    llmStatus,
    llmModel,
    schemaErrors: schemaErrors.length ? schemaErrors : null,
    auditId
  };
}

module.exports = {
  getOpsExplanation
};
