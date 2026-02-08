'use strict';

const { getOpsConsoleView } = require('../phase42/getOpsConsoleView');
const { getOpsAssistContext } = require('../phase38/getOpsAssistContext');
const { getOpsAssistSuggestion } = require('../phase40/getOpsAssistSuggestion');
const opsAssistCacheRepo = require('../../repos/firestore/opsAssistCacheRepo');
const { computeInputHash } = require('../phase51/shouldRefreshOpsAssist');

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.getTime();
  }
  return null;
}

function isCacheValid(cache, nowMs) {
  if (!cache) return false;
  const ttlSec = typeof cache.ttlSec === 'number' ? cache.ttlSec : null;
  if (!ttlSec) return true;
  const createdAtMs = toMillis(cache.createdAt);
  if (!createdAtMs) return false;
  return nowMs - createdAtMs <= ttlSec * 1000;
}

function buildSuggestionFromCache(cache) {
  if (!cache) return null;
  if (cache.snapshot && typeof cache.snapshot === 'object') {
    return cache.snapshot;
  }
  const nextAction = typeof cache.suggestion === 'string' ? cache.suggestion : null;
  const reason = typeof cache.reason === 'string' ? cache.reason : '';
  if (!nextAction) return null;
  return {
    suggestionText: `${nextAction}: ${reason}`,
    confidence: 'LOW',
    basedOn: ['constraints'],
    riskFlags: [],
    disclaimer: 'This is advisory only',
    suggestion: {
      nextAction,
      reason
    },
    model: cache.model || 'ops-assist-rules'
  };
}

async function getOpsAssistForConsole(params, deps) {
  const payload = params || {};
  if (!payload.lineUserId) throw new Error('lineUserId required');

  const contextFn = deps && deps.getOpsAssistContext ? deps.getOpsAssistContext : getOpsAssistContext;
  const viewFn = deps && deps.getOpsConsoleView ? deps.getOpsConsoleView : getOpsConsoleView;
  const suggestionFn = deps && deps.getOpsAssistSuggestion ? deps.getOpsAssistSuggestion : getOpsAssistSuggestion;
  const cacheRepo = deps && deps.opsAssistCacheRepo ? deps.opsAssistCacheRepo : opsAssistCacheRepo;

  const lineUserId = payload.lineUserId;
  const notificationId = payload.notificationId || null;
  const nowMs = deps && typeof deps.nowMs === 'number' ? deps.nowMs : Date.now();
  const ttlSec = typeof payload.ttlSec === 'number' ? payload.ttlSec : 300;

  const context = await contextFn({ lineUserId, notificationId }, deps);
  const view = await viewFn({ lineUserId, notificationId, includeAssist: false, context }, deps);

  let cached = null;
  if (cacheRepo && typeof cacheRepo.getLatestOpsAssistCache === 'function') {
    cached = await cacheRepo.getLatestOpsAssistCache(lineUserId);
  }

  let llmSuggestion = null;
  if (isCacheValid(cached, nowMs)) {
    llmSuggestion = buildSuggestionFromCache(cached);
  }

  if (!llmSuggestion) {
    llmSuggestion = await suggestionFn({ lineUserId, notificationId, context, opsConsoleView: view }, deps);
    if (cacheRepo && typeof cacheRepo.appendOpsAssistCache === 'function') {
      try {
        const inputHash = computeInputHash(llmSuggestion && llmSuggestion.promptPayload ? llmSuggestion.promptPayload : null);
        const expiresAt = new Date(nowMs + ttlSec * 1000).toISOString();
        await cacheRepo.appendOpsAssistCache({
          lineUserId,
          suggestion: llmSuggestion && llmSuggestion.suggestion ? llmSuggestion.suggestion.nextAction : null,
          reason: llmSuggestion && llmSuggestion.suggestion ? llmSuggestion.suggestion.reason : null,
          model: llmSuggestion && llmSuggestion.model ? llmSuggestion.model : null,
          snapshot: llmSuggestion || null,
          sourceDecisionLogId: view && view.latestDecisionLog ? view.latestDecisionLog.id : null,
          ttlSec,
          inputHash,
          expiresAt
        });
      } catch (err) {
        // best-effort cache only
      }
    }
  }

  const suggestionSchema = llmSuggestion && llmSuggestion.suggestionSchema
    ? llmSuggestion.suggestionSchema
    : (llmSuggestion && llmSuggestion.suggestion ? llmSuggestion.suggestion : null);
  const lastSuggestionAuditId = llmSuggestion && llmSuggestion.suggestionAuditId
    ? llmSuggestion.suggestionAuditId
    : null;

  return Object.assign({}, view, {
    llmSuggestion: llmSuggestion || null,
    suggestion: suggestionSchema,
    lastSuggestionAuditId
  });
}

module.exports = {
  getOpsAssistForConsole
};
