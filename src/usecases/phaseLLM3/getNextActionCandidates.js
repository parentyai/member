'use strict';

const crypto = require('crypto');

const { getOpsConsole } = require('../phase25/getOpsConsole');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { DEFAULT_ALLOW_LISTS } = require('../../llm/allowList');
const { NEXT_ACTION_CANDIDATES_SCHEMA_ID, ABSTRACT_ACTIONS } = require('../../llm/schemas');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { buildLlmInputView } = require('../llm/buildLlmInputView');
const { guardLlmOutput } = require('../llm/guardLlmOutput');

const DEFAULT_TIMEOUT_MS = 2500;
const PROMPT_VERSION = 'next_action_candidates_v2';
const SYSTEM_PROMPT = [
  'You are an ops assistant.',
  'Return abstract next action candidates only.',
  'Use NextActionCandidates.v1 schema.',
  'Do not emit runbook commands.',
  'Advisory only.'
].join('\n');

const NEXT_ACTION_FIELD_CATEGORIES = Object.freeze({
  readiness: 'Internal',
  opsState: 'Internal',
  latestDecisionLog: 'Internal',
  constraints: 'Internal'
});

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
  if (!adapter || typeof adapter.suggestNextActionCandidates !== 'function') throw new Error('adapter_missing');
  const exec = adapter.suggestNextActionCandidates(payload);
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm_timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

async function getNextActionCandidates(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');

  const consoleFn = deps && deps.getOpsConsole ? deps.getOpsConsole : getOpsConsole;
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  const getLlmEnabled = deps && deps.getLlmEnabled ? deps.getLlmEnabled : systemFlagsRepo.getLlmEnabled;
  const env = deps && deps.env ? deps.env : process.env;
  const envEnabled = isLlmFeatureEnabled(env);
  const dbEnabled = await getLlmEnabled();
  const llmEnabled = Boolean(envEnabled && dbEnabled);
  const nowIso = new Date().toISOString();

  const consoleResult = payload.consoleResult
    ? payload.consoleResult
    : await consoleFn({ lineUserId, auditView: false }, deps);

  const input = buildInputFromConsole(consoleResult || {});
  const view = buildLlmInputView({
    input,
    allowList: DEFAULT_ALLOW_LISTS.nextActionCandidates,
    fieldCategories: NEXT_ACTION_FIELD_CATEGORIES,
    allowRestricted: false
  });

  let llmStatus = 'disabled';
  let llmUsed = false;
  let llmModel = null;
  let schemaErrors = [];
  let nextActionCandidates = buildFallbackCandidates(input, nowIso);

  if (!view.ok) {
    llmStatus = view.blockedReason;
  } else if (!llmEnabled) {
    llmStatus = 'disabled';
  } else {
    try {
      const adapterResult = await callAdapter(
        deps && deps.llmAdapter,
        {
          schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
          promptVersion: PROMPT_VERSION,
          system: SYSTEM_PROMPT,
          input: view.data
        },
        deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS
      );
      const candidate = adapterResult && isPlainObject(adapterResult.nextActionCandidates)
        ? adapterResult.nextActionCandidates
        : adapterResult;
      const guard = await guardLlmOutput({
        purpose: 'next_actions',
        schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
        output: candidate
      }, deps);
      if (guard.ok) {
        nextActionCandidates = candidate;
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
        actor: payload.actor || 'unknown',
        action: llmUsed ? 'llm_next_actions_generated' : 'llm_next_actions_blocked',
        eventType: 'LLM_NEXT_ACTION_CANDIDATES',
        entityType: 'llm_next_actions',
        entityId: lineUserId,
        lineUserId,
        traceId: payload.traceId || null,
        schemaId: NEXT_ACTION_CANDIDATES_SCHEMA_ID,
        llmStatus,
        llmUsed,
        llmModel,
        payloadSummary: {
          purpose: 'next_actions',
          llmEnabled,
          envLlmFeatureFlag: envEnabled,
          dbLlmEnabled: dbEnabled,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || [],
          blockedReason: llmUsed ? null : llmStatus,
          inputHash: hashJson(view.ok ? view.data : input),
          outputHash: hashJson(nextActionCandidates)
        }
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
