'use strict';

const { getOpsAssistContext } = require('../phase38/getOpsAssistContext');
const { buildOpsAssistPrompt } = require('../phase45/buildOpsAssistPrompt');
const { buildOpsAssistInput, computeOpsAssistInputHash } = require('../phase102/buildOpsAssistInput');
const { guardOpsAssistSuggestion } = require('../phase103/guardOpsAssistSuggestion');
const { appendLlmSuggestionAudit } = require('../phase104/appendLlmSuggestionAudit');
const decisionTimelineRepo = require('../../repos/firestore/decisionTimelineRepo');
const opsAssistCacheRepo = require('../../repos/firestore/opsAssistCacheRepo');
const { computeInputHash, shouldRefreshOpsAssist } = require('../phase51/shouldRefreshOpsAssist');
const { emitObs } = require('../../ops/obs');

function resolveDefaultNextAction(allowedNextActions, readinessStatus) {
  const allowed = Array.isArray(allowedNextActions) ? allowedNextActions : [];
  if (readinessStatus !== 'READY') {
    if (allowed.includes('STOP_AND_ESCALATE')) return 'STOP_AND_ESCALATE';
    return allowed[0] || 'NO_ACTION';
  }
  if (allowed.includes('NO_ACTION')) return 'NO_ACTION';
  return allowed[0] || 'NO_ACTION';
}

function buildSuggestion(context, opsAssistInput) {
  const readiness = opsAssistInput && opsAssistInput.readiness
    ? opsAssistInput.readiness.status
    : null;
  const timeline = Array.isArray(context && context.decisionTimeline) ? context.decisionTimeline : [];
  const basedOn = [];
  if (opsAssistInput && opsAssistInput.opsState) basedOn.push('opsState');
  if (timeline.length) basedOn.push('decisionTimeline');
  basedOn.push('constraints');

  const riskFlags = [];
  if (readiness !== 'READY') riskFlags.push('readiness_not_ready');
  if (!timeline.length) riskFlags.push('no_timeline');

  const allowedNextActions = opsAssistInput && opsAssistInput.constraints
    ? opsAssistInput.constraints.allowedNextActions
    : [];
  const nextAction = resolveDefaultNextAction(allowedNextActions, readiness);
  const reason = readiness !== 'READY'
    ? 'readiness not ready; defaulting to STOP_AND_ESCALATE'
    : 'default safe action within allowedNextActions';
  const suggestionText = `${nextAction}: ${reason}`;
  const confidence = readiness === 'READY' ? 'MEDIUM' : 'LOW';

  return {
    suggestionText,
    confidence,
    basedOn,
    riskFlags,
    disclaimer: 'This is advisory only',
    suggestion: {
      nextAction,
      reason,
      recommendedNextAction: nextAction,
      confidence,
      rationaleBullets: [reason]
    },
    model: 'ops-assist-rules'
  };
}

async function getOpsAssistSuggestion(params, deps) {
  const payload = params || {};
  const lineUserId = payload.lineUserId;
  if (!lineUserId) throw new Error('lineUserId required');

  const contextFn = deps && deps.getOpsAssistContext ? deps.getOpsAssistContext : getOpsAssistContext;
  const timelineRepo = deps && Object.prototype.hasOwnProperty.call(deps, 'decisionTimelineRepo')
    ? deps.decisionTimelineRepo
    : (deps ? null : decisionTimelineRepo);
  const cacheRepo = deps && Object.prototype.hasOwnProperty.call(deps, 'opsAssistCacheRepo')
    ? deps.opsAssistCacheRepo
    : (deps ? null : opsAssistCacheRepo);
  const buildFn = deps && deps.buildSuggestion ? deps.buildSuggestion : buildSuggestion;
  const guardFn = deps && deps.guardOpsAssistSuggestion ? deps.guardOpsAssistSuggestion : guardOpsAssistSuggestion;
  const auditFn = deps && deps.appendLlmSuggestionAudit ? deps.appendLlmSuggestionAudit : appendLlmSuggestionAudit;
  const llmEnabled = payload.llmEnabled === true
    || (deps && deps.llmEnabled === true)
    || process.env.OPS_ASSIST_LLM_ENABLED === 'true';
  const nowMs = deps && typeof deps.nowMs === 'number' ? deps.nowMs : Date.now();

  const context = payload.context
    ? payload.context
    : await contextFn({ lineUserId, notificationId: payload.notificationId }, deps);

  const opsConsoleView = payload.opsConsoleView
    ? payload.opsConsoleView
    : (context && context.opsConsoleSnapshot ? context.opsConsoleSnapshot : {});
  const opsAssistInput = payload.opsAssistInput
    ? payload.opsAssistInput
    : buildOpsAssistInput({ opsConsoleView });
  const promptPayload = buildOpsAssistPrompt({ opsAssistInput });
  const inputHash = computeInputHash(promptPayload);
  const opsAssistInputHash = computeOpsAssistInputHash(opsAssistInput);
  const force = payload.force === true || payload.force === 1 || payload.force === '1';

  let cache = null;
  if (cacheRepo && typeof cacheRepo.getLatestOpsAssistCache === 'function') {
    cache = await cacheRepo.getLatestOpsAssistCache(lineUserId);
  }
  const refreshDecision = shouldRefreshOpsAssist({ cache, inputHash, force, nowMs });

  let suggestion = null;
  let cacheHit = false;
  if (!refreshDecision.refresh && cache && cache.snapshot) {
    suggestion = cache.snapshot;
    cacheHit = true;
  }
  if (!suggestion) {
    suggestion = buildFn(context, opsAssistInput);
    cacheHit = false;
    const guard = guardFn({ opsAssistInput, suggestedAction: suggestion.suggestion ? suggestion.suggestion.nextAction : null });
    let recommendedNextAction = suggestion.suggestion ? suggestion.suggestion.nextAction : null;
    if (guard && guard.forcedAction) {
      recommendedNextAction = guard.forcedAction;
    }
    const safetyStatus = guard && guard.status === 'BLOCK' ? 'BLOCK' : 'OK';
    const safetyReasons = guard && Array.isArray(guard.reasons) ? guard.reasons : [];
    const rationaleBullets = [];
    if (suggestion.suggestion && typeof suggestion.suggestion.reason === 'string') {
      rationaleBullets.push(suggestion.suggestion.reason);
    }
    if (guard && guard.forcedAction) {
      rationaleBullets.push('forced STOP_AND_ESCALATE by safety guard');
    }
    const finalReason = rationaleBullets.filter(Boolean).join(' | ') || 'default safe action';
    const confidence = readinessFromInput(opsAssistInput) === 'READY' && safetyStatus === 'OK' ? 'MEDIUM' : 'LOW';
    suggestion = Object.assign({}, suggestion, {
      suggestionText: `${recommendedNextAction || 'NO_ACTION'}: ${finalReason}`,
      confidence,
      suggestion: Object.assign({}, suggestion.suggestion || {}, {
        nextAction: recommendedNextAction || 'NO_ACTION',
        reason: finalReason,
        recommendedNextAction: recommendedNextAction || 'NO_ACTION',
        confidence,
        rationaleBullets: rationaleBullets.length ? rationaleBullets : [finalReason]
      }),
      safety: {
        status: safetyStatus,
        reasons: safetyReasons
      },
      evidence: buildEvidence(opsAssistInput, opsConsoleView, nowMs)
    });
    if (!llmEnabled) {
      suggestion.riskFlags = Array.isArray(suggestion.riskFlags)
        ? suggestion.riskFlags.concat(['llm_disabled_default'])
        : ['llm_disabled_default'];
    }

    if (cacheRepo && typeof cacheRepo.appendOpsAssistCache === 'function') {
      const ttlSec = typeof payload.ttlSec === 'number' ? payload.ttlSec : 300;
      const expiresAt = new Date(nowMs + ttlSec * 1000).toISOString();
      try {
        await cacheRepo.appendOpsAssistCache({
          lineUserId,
          suggestion: suggestion && suggestion.suggestion ? suggestion.suggestion.nextAction : null,
          reason: suggestion && suggestion.suggestion ? suggestion.suggestion.reason : null,
          model: suggestion && suggestion.model ? suggestion.model : null,
          snapshot: suggestion || null,
          sourceDecisionLogId: opsConsoleView && opsConsoleView.latestDecisionLog
            ? opsConsoleView.latestDecisionLog.id
            : null,
          ttlSec,
          inputHash,
          expiresAt
        });
      } catch (err) {
        // best-effort cache only
      }
    }
  }

  if (timelineRepo && typeof timelineRepo.appendTimelineEntry === 'function') {
    await timelineRepo.appendTimelineEntry({
      lineUserId,
      source: 'llm_assist',
      action: 'SUGGEST',
      refId: null,
      notificationId: payload.notificationId || null,
      snapshot: Object.assign({}, suggestion, { promptPayload })
    });
  }

  if (!suggestion.evidence) {
    suggestion.evidence = buildEvidence(opsAssistInput, opsConsoleView, nowMs);
  }
  if (!suggestion.safety) {
    suggestion.safety = { status: 'OK', reasons: [] };
  }

  if (auditFn) {
    try {
      await auditFn({
        lineUserId,
        inputHash: opsAssistInputHash,
        suggestion: suggestion.suggestion || null,
        safety: suggestion.safety || null,
        evidenceSnapshot: suggestion.evidence ? suggestion.evidence.snapshot : null
      }, deps);
    } catch (err) {
      // best-effort audit only
    }
  }

  const response = Object.assign({}, suggestion, { promptPayload });

  try {
    emitObs({
      action: 'ops_assist_suggest',
      result: cacheHit ? 'cache_hit' : 'ok',
      lineUserId,
      meta: {
        model: response.model || null,
        cacheHit,
        refreshReason: refreshDecision.reason,
        inputHash,
        opsAssistInputHash
      }
    });
  } catch (err) {
    // best-effort only
  }

  return response;
}

function readinessFromInput(input) {
  if (!input || !input.readiness) return null;
  return typeof input.readiness.status === 'string' ? input.readiness.status : null;
}

function buildEvidence(opsAssistInput, opsConsoleView, nowMs) {
  const inputsUsed = [];
  if (opsAssistInput && opsAssistInput.readiness) inputsUsed.push('readiness');
  if (opsAssistInput && opsAssistInput.opsState) inputsUsed.push('opsState');
  if (opsAssistInput && opsAssistInput.latestDecisionLog) inputsUsed.push('latestDecisionLog');
  if (opsAssistInput && opsAssistInput.userStateSummary) inputsUsed.push('userStateSummary');
  if (opsAssistInput && opsAssistInput.memberSummary) inputsUsed.push('memberSummary');
  if (opsAssistInput && opsAssistInput.constraints) inputsUsed.push('constraints');
  return {
    inputsUsed,
    snapshot: {
      mainSha: process.env.MAIN_SHA || process.env.GIT_SHA || null,
      serverTime: new Date(nowMs).toISOString()
    },
    sourceIds: {
      latestDecisionLogId: opsConsoleView && opsConsoleView.latestDecisionLog
        ? opsConsoleView.latestDecisionLog.id
        : null
    }
  };
}

module.exports = {
  getOpsAssistSuggestion
};
