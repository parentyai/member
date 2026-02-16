'use strict';

const crypto = require('crypto');

const { getOpsConsole } = require('../phase25/getOpsConsole');
const { DEFAULT_ALLOW_LISTS, sanitizeInput } = require('../../llm/allowList');
const { validateSchema } = require('../../llm/validateSchema');
const { NEXT_ACTION_CANDIDATES_SCHEMA_ID, ABSTRACT_ACTIONS } = require('../../llm/schemas');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { appendAuditLog } = require('../audit/appendAuditLog');

const DEFAULT_TIMEOUT_MS = 2500;
const PROMPT_VERSION = 'next_action_candidates_v1';
const SYSTEM_PROMPT = [
  'You are an ops assistant.',
  'Return abstract next action candidates only.',
  'Use NextActionCandidates.v1 schema.',
  'Advisory only.'
].join('\n');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function buildInputFromConsole(consoleResult) {
  const payload = consoleResult || {};
  const readiness = payload.readiness || {};
  const opsState = payload.opsState || {};
  const latestDecisionLog = payload.latestDecisionLog || {};
  return {
    readiness: {
      status: typeof readiness.status === 'string' ? readiness.status : null,
      blocking: Array.isArray(readiness.blocking) ? readiness.blocking : []
    },
    opsState: {
      nextAction: typeof opsState.nextAction === 'string' ? opsState.nextAction : null,
      failure_class: typeof opsState.failure_class === 'string' ? opsState.failure_class : null,
      reasonCode: typeof opsState.reasonCode === 'string' ? opsState.reasonCode : null,
      stage: typeof opsState.stage === 'string' ? opsState.stage : null
    },
    latestDecisionLog: {
      nextAction: typeof latestDecisionLog.nextAction === 'string' ? latestDecisionLog.nextAction : null,
      createdAt: latestDecisionLog.createdAt || null
    },
    constraints: {
      allowedNextActions: Array.isArray(payload.allowedNextActions) ? payload.allowedNextActions : [],
      readiness: typeof readiness.status === 'string' ? readiness.status : null
    }
  };
}

function buildCandidate(action, reason, confidence, safety) {
  const safe = safety || { status: 'OK', reasons: [] };
  return {
    action,
    reason,
    confidence,
    safety: {
      status: safe.status === 'BLOCK' ? 'BLOCK' : 'OK',
      reasons: Array.isArray(safe.reasons) ? safe.reasons : []
    }
  };
}

function buildFallbackCandidates(input, nowIso) {
  const readinessStatus = input && input.readiness ? input.readiness.status : null;
  const candidates = [];
  if (readinessStatus !== 'READY') {
    candidates.push(buildCandidate('ESCALATE', 'readiness is not READY', 0.7));
    candidates.push(buildCandidate('REVIEW', 'review blocking reasons and ops state', 0.4));
    candidates.push(buildCandidate('NO_ACTION', 'no automatic action', 0.2));
  } else {
    candidates.push(buildCandidate('MONITOR', 'ready state; monitor outcomes', 0.6));
    candidates.push(buildCandidate('REVIEW', 'confirm ops state consistency', 0.4));
    candidates.push(buildCandidate('NO_ACTION', 'no immediate action required', 0.3));
  }
  return {
    schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
    generatedAt: nowIso,
    advisoryOnly: true,
    candidates: candidates.slice(0, 3)
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
  if (!adapter || typeof adapter.suggestNextActionCandidates !== 'function') return null;
  const exec = adapter.suggestNextActionCandidates(payload);
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

async function getNextActionCandidates(params, deps) {
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
  const sanitized = sanitizeInput({ input, allowList: DEFAULT_ALLOW_LISTS.nextActionCandidates });

  let llmStatus = 'disabled';
  let llmUsed = false;
  let llmModel = null;
  let schemaErrors = [];
  let nextActionCandidates = buildFallbackCandidates(input, nowIso);

  if (!sanitized.ok) {
    llmStatus = 'allow_list_violation';
  } else if (!llmEnabled) {
    llmStatus = 'disabled';
  } else if (!deps || !deps.llmAdapter || typeof deps.llmAdapter.suggestNextActionCandidates !== 'function') {
    llmStatus = 'adapter_missing';
  } else {
    try {
      const adapterResult = await callAdapter(
        deps.llmAdapter,
        {
          schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
          promptVersion: PROMPT_VERSION,
          system: SYSTEM_PROMPT,
          input: sanitized.data
        },
        deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS
      );
      const candidate = adapterResult;
      const validation = validateSchema(NEXT_ACTION_CANDIDATES_SCHEMA_ID, candidate);
      if (validation.ok) {
        nextActionCandidates = candidate;
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

  if (!nextActionCandidates || !Array.isArray(nextActionCandidates.candidates)) {
    nextActionCandidates = buildFallbackCandidates(input, nowIso);
  } else {
    nextActionCandidates.candidates = nextActionCandidates.candidates
      .filter((item) => item && ABSTRACT_ACTIONS.includes(item.action))
      .slice(0, 3);
  }

  let auditId = null;
  if (auditFn) {
    try {
      const auditResult = await auditFn({
        action: 'LLM_NEXT_ACTION_CANDIDATES',
        eventType: 'LLM_NEXT_ACTION_CANDIDATES',
        type: 'OPS_NEXT_ACTION_CANDIDATES',
        lineUserId,
        traceId: payload.traceId || null,
        schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
        llmStatus,
        llmUsed,
        llmModel,
        inputHash: hashJson(sanitized.ok ? sanitized.data : input),
        outputHash: hashJson(nextActionCandidates)
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
    nextActionCandidates,
    llmUsed,
    llmStatus,
    llmModel,
    schemaErrors: schemaErrors.length ? schemaErrors : null,
    auditId
  };
}

module.exports = {
  getNextActionCandidates
};
