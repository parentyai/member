'use strict';

const crypto = require('crypto');

const { resolvePolicyForRequest, shouldAttachUrls } = require('../../../domain/llm/conciergePolicy');
const { selectUrls } = require('../../../domain/llm/urlRanker');
const { sanitizeCandidates } = require('../../../domain/llm/injectionGuard');
const { selectResponseStyle } = require('../../../domain/llm/styleRouter');
const { resolveConversationState } = require('../../../domain/llm/conversation/conversationState');
const { resolveConversationMove } = require('../../../domain/llm/conversation/conversationMoves');
const {
  extractAnalysisFromBaseReply,
  composeConversationDraft
} = require('../../../domain/llm/conversation/conversationComposer');
const { humanizeConciergeResponse } = require('../../../domain/llm/styleHumanizer');
const { searchWebCandidates } = require('../../../infra/webSearch/provider');
const { scoreConversationConfidence } = require('../../../domain/llm/conversation/confidenceScorer');
const { resolveEvidenceNeed, resolveEvidenceOutcome } = require('../../../domain/llm/conversation/evidenceOutcome');
const { lintConciergeText } = require('../../../domain/llm/conversation/postRenderSafetyLint');
const {
  selectActionForConversation,
  buildSegmentKey
} = require('../../../domain/llm/conversation/actionSelector');

const CONTEXT_VERSION = 'concierge_ctx_v1';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 4500 ? `${text.slice(0, 4500)}...` : text;
}

function resolveFlagEnabled(name, fallback) {
  const raw = normalizeText(process.env[name]);
  if (!raw) return fallback;
  if (/^(0|false|off|no)$/i.test(raw)) return false;
  if (/^(1|true|on|yes)$/i.test(raw)) return true;
  return fallback;
}

function resolveRuntimeFlag(explicitValue, envName, fallback) {
  if (typeof explicitValue === 'boolean') return explicitValue;
  return resolveFlagEnabled(envName, fallback);
}

function resolveTimeOfDay(input) {
  const value = Number(input);
  if (Number.isFinite(value) && value >= 0 && value <= 23) return Math.floor(value);
  return new Date().getHours();
}

function normalizeTaskEntry(item) {
  const row = item && typeof item === 'object' ? item : {};
  const key = normalizeText(row.key || row.todoKey || row.title || row.id);
  if (!key) return null;
  return {
    key,
    status: normalizeText(row.status || row.graphStatus || row.progressState || 'open').toLowerCase() || 'open',
    due: normalizeText(row.due || row.dueAt || row.dueDate)
  };
}

function toMillis(value) {
  if (!value) return null;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value > 1000000000000 ? value : value * 1000;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    if (parsed instanceof Date && Number.isFinite(parsed.getTime())) return parsed.getTime();
  }
  return null;
}

function buildConciergeContextSnapshot(input) {
  const source = input && typeof input === 'object' ? input : null;
  if (!source) return null;

  const topTasksRaw = Array.isArray(source.topTasks)
    ? source.topTasks
    : (Array.isArray(source.topOpenTasks)
      ? source.topOpenTasks
      : (Array.isArray(source.openTasksTop5) ? source.openTasksTop5 : []));

  const topTasks = topTasksRaw
    .map((item) => normalizeTaskEntry(item))
    .filter(Boolean)
    .slice(0, 3);

  const blockedTask = topTasks.find((item) => item.status === 'locked') || null;
  const dueSoonTask = topTasks
    .filter((item) => Number.isFinite(toMillis(item.due)))
    .sort((a, b) => toMillis(a.due) - toMillis(b.due))[0] || null;

  return {
    phase: normalizeText(source.phase || source.journeyPhase).toLowerCase() || '',
    topTasks,
    blockedTask: blockedTask ? [blockedTask].slice(0, 1)[0] : null,
    dueSoonTask: dueSoonTask ? [dueSoonTask].slice(0, 1)[0] : null,
    updatedAt: normalizeText(source.updatedAt || source.sourceUpdatedAt || '')
  };
}

function buildFeatureHash(meta) {
  const text = JSON.stringify(meta || {});
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 16);
}

function formatSourceFooters(selectedUrls, maxUrls) {
  const rows = Array.isArray(selectedUrls) ? selectedUrls : [];
  const cap = Number.isFinite(Number(maxUrls)) ? Math.max(0, Math.floor(Number(maxUrls))) : 0;
  if (!rows.length || cap <= 0) return '';
  const sources = rows
    .slice(0, cap)
    .map((row) => {
      const domain = normalizeText(row && row.domain);
      const path = normalizeText(row && row.path) || '/';
      if (!domain) return '';
      return `(source: ${domain}${path})`;
    })
    .filter(Boolean);
  if (!sources.length) return '';
  return `根拠: ${sources.join(', ')}`;
}

function buildGuardDecisions(decisions) {
  return (Array.isArray(decisions) ? decisions : []).map((row) => ({
    rank: row.rank,
    domain: row.domain,
    path: row.path,
    allowed: row.allowed === true,
    reason: row.reason,
    source: row.source
  }));
}

function describeBlockedReason(reason) {
  const normalized = normalizeText(reason);
  if (!normalized) return '安全条件に一致しない根拠を検出しました。';
  if (normalized === 'external_instruction_detected') return '外部テキストに命令文が含まれていたため除外しました。';
  if (normalized === 'provider_unconfigured' || normalized === 'provider_error' || normalized === 'provider_exception') {
    return '外部根拠の確認に失敗したため、URLは表示しません。';
  }
  if (normalized === 'rank_not_allowed') return '許可ランク外の情報源だったため、URLは表示しません。';
  return '安全条件に一致しない根拠を検出しました。';
}

function buildAuditMeta(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const selected = Array.isArray(payload.selected) ? payload.selected : [];
  const decisions = Array.isArray(payload.decisions) ? payload.decisions : [];
  const blockedReasons = Array.from(new Set((Array.isArray(payload.blockedReasons) ? payload.blockedReasons : []).filter(Boolean)));
  const citationRanks = Array.from(new Set(selected.map((row) => row.rank).filter(Boolean)));

  const chosen = payload.chosenAction && typeof payload.chosenAction === 'object' ? payload.chosenAction : {};

  return {
    topic: payload.topic || 'general',
    mode: payload.mode || 'A',
    userTier: payload.userTier || 'free',
    citationRanks,
    urlCount: selected.length,
    urls: selected.map((row) => ({
      rank: row.rank,
      domain: row.domain,
      path: row.path,
      allowed: true,
      reason: row.reason,
      source: row.source
    })),
    guardDecisions: buildGuardDecisions(decisions),
    blockedReasons,
    injectionFindings: payload.injectionFindings === true,
    conversationState: payload.conversationState || null,
    conversationMove: payload.conversationMove || null,
    styleId: payload.styleId || null,
    conversationPattern: payload.conversationPattern || null,
    responseLength: Number.isFinite(Number(payload.responseLength)) ? Number(payload.responseLength) : 0,
    intentConfidence: Number.isFinite(Number(payload.intentConfidence)) ? Number(payload.intentConfidence) : 0,
    contextConfidence: Number.isFinite(Number(payload.contextConfidence)) ? Number(payload.contextConfidence) : 0,
    evidenceNeed: payload.evidenceNeed || 'none',
    evidenceOutcome: payload.evidenceOutcome || 'SUPPORTED',
    chosenAction: {
      armId: chosen.armId || null,
      styleId: chosen.styleId || null,
      ctaCount: Number.isFinite(Number(chosen.ctaCount)) ? Number(chosen.ctaCount) : 0,
      lengthBucket: chosen.lengthBucket || null,
      timingBucket: chosen.timingBucket || null,
      questionFlag: chosen.questionFlag === true,
      selectionSource: payload.selectionSource || 'score',
      score: Number.isFinite(Number(chosen.score)) ? Number(chosen.score) : 0,
      scoreBreakdown: chosen.scoreBreakdown && typeof chosen.scoreBreakdown === 'object' ? chosen.scoreBreakdown : {}
    },
    segmentKey: payload.segmentKey || null,
    contextVersion: payload.contextVersion || CONTEXT_VERSION,
    featureHash: payload.featureHash || null,
    postRenderLint: payload.postRenderLint && typeof payload.postRenderLint === 'object'
      ? {
          findings: Array.isArray(payload.postRenderLint.findings) ? payload.postRenderLint.findings : [],
          modified: payload.postRenderLint.modified === true
        }
      : { findings: [], modified: false }
  };
}

async function composeConciergeReply(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const policy = resolvePolicyForRequest({
    question: payload.question,
    userTier: payload.userTier,
    plan: payload.plan,
    policy: payload.policy
  });

  const contextSnapshot = buildConciergeContextSnapshot(payload.contextSnapshot);
  const styleEngineEnabled = resolveRuntimeFlag(payload.styleEngineEnabled, 'STYLE_ENGINE_ENABLED', true);
  const webSearchEnabled = resolveRuntimeFlag(payload.webSearchEnabled, 'WEB_SEARCH_ENABLED', true);

  const storedCandidates = Array.isArray(payload.storedCandidates) ? payload.storedCandidates : [];
  let webCandidates = [];
  const blockedReasons = [];

  if (policy.allowExternalSearch && policy.storedOnly !== true && policy.mode !== 'A' && webSearchEnabled) {
    const webResult = await searchWebCandidates({
      query: payload.question,
      locale: payload.locale || 'ja',
      limit: 5,
      env: payload.env,
      fetchFn: payload.fetchFn
    });
    if (webResult.ok) {
      webCandidates = webResult.candidates;
      if (Array.isArray(webResult.blockedReasons) && webResult.blockedReasons.length) {
        blockedReasons.push(...webResult.blockedReasons);
      }
    } else if (webResult.reason) {
      blockedReasons.push(webResult.reason);
    }
  }

  const sanitized = sanitizeCandidates([].concat(storedCandidates, webCandidates));
  if (sanitized.blockedReasons.length) blockedReasons.push(...sanitized.blockedReasons);
  const ranked = selectUrls(sanitized.candidates, {
    maxUrls: policy.maxUrls,
    allowedRanks: policy.allowedRanks
  }, {
    denylist: payload.denylist
  });

  const evidenceNeed = resolveEvidenceNeed(policy.mode);
  const evidenceDecision = resolveEvidenceOutcome({
    mode: policy.mode,
    evidenceNeed,
    urlCount: ranked.selected.length,
    blockedReasons,
    injectionFindings: sanitized.injectionFindings
  });

  const baseReplyText = normalizeText(payload.baseReplyText);
  const analysis = extractAnalysisFromBaseReply({ baseReplyText });
  const confidence = scoreConversationConfidence({
    question: payload.question,
    topic: policy.topic,
    mode: policy.mode,
    blockedReasons,
    contextSnapshot,
    thresholds: payload.confidenceThresholds
  });

  const stateResult = resolveConversationState({
    analysis,
    blockedReasons,
    question: payload.question
  });
  const conversationState = confidence.forceClarify ? 'CLARIFY' : stateResult.to;
  const move = resolveConversationMove({
    state: conversationState,
    analysis,
    question: payload.question
  });

  const styleDecision = selectResponseStyle({
    topic: policy.topic,
    userTier: policy.userTier,
    question: payload.question,
    journeyPhase: payload.journeyPhase || (contextSnapshot && contextSnapshot.phase) || '',
    messageLength: normalizeText(payload.question).length,
    timeOfDay: resolveTimeOfDay(payload.timeOfDay),
    urgency: payload.urgency || ''
  });

  const banditInput = payload.bandit && typeof payload.bandit === 'object' ? payload.bandit : {};
  const banditEnabled = banditInput.enabled === true;
  const segmentKeyHint = buildSegmentKey({
    journeyPhase: payload.journeyPhase || (contextSnapshot && contextSnapshot.phase) || '',
    userTier: policy.userTier,
    riskBucket: confidence.riskBucket
  });

  let stateByArm = banditInput.stateByArm && typeof banditInput.stateByArm === 'object'
    ? banditInput.stateByArm
    : {};
  if (banditEnabled && (!stateByArm || Object.keys(stateByArm).length === 0) && typeof banditInput.stateFetcher === 'function') {
    try {
      const fetched = await banditInput.stateFetcher({ segmentKey: segmentKeyHint });
      if (fetched && typeof fetched === 'object') stateByArm = fetched;
    } catch (_err) {
      blockedReasons.push('bandit_state_unavailable');
    }
  }

  const actionSelection = selectActionForConversation({
    styleDecision,
    confidence,
    forceClarify: confidence.forceClarify,
    mode: policy.mode,
    topic: policy.topic,
    userTier: policy.userTier,
    messageLength: normalizeText(payload.question).length,
    timeOfDay: resolveTimeOfDay(payload.timeOfDay),
    journeyPhase: payload.journeyPhase || (contextSnapshot && contextSnapshot.phase) || '',
    riskBucket: confidence.riskBucket,
    evidenceNeed,
    bandit: {
      enabled: banditEnabled,
      epsilon: banditInput.epsilon,
      stateByArm,
      randomFn: banditInput.randomFn
    }
  });

  const chosenAction = actionSelection && actionSelection.selected && typeof actionSelection.selected === 'object'
    ? actionSelection.selected
    : null;

  const styleDecisionForRender = Object.assign({}, styleDecision, {
    styleId: chosenAction && chosenAction.styleId ? chosenAction.styleId : styleDecision.styleId,
    maxActions: chosenAction && Number.isFinite(Number(chosenAction.ctaCount))
      ? Number(chosenAction.ctaCount)
      : styleDecision.maxActions,
    askClarifying: (chosenAction && chosenAction.questionFlag === true) || styleDecision.askClarifying === true || confidence.forceClarify
  });

  const draftPacket = composeConversationDraft({
    analysis,
    state: conversationState,
    move,
    baseReplyText
  });

  const humanized = styleEngineEnabled
    ? humanizeConciergeResponse({
        draftPacket,
        styleDecision: styleDecisionForRender,
        state: conversationState,
        move
      })
    : {
        text: draftPacket.draft || baseReplyText,
        styleId: styleDecisionForRender.styleId || null,
        conversationPattern: styleDecision.conversationPattern || null,
        responseLength: normalizeText(draftPacket.draft || baseReplyText).length
      };

  let selectedForRender = ranked.selected.slice();
  let sourceSection = shouldAttachUrls(policy.mode, selectedForRender.length)
    ? formatSourceFooters(selectedForRender, policy.maxUrls)
    : '';

  if (evidenceDecision.evidenceOutcome === 'INSUFFICIENT') {
    selectedForRender = [];
    sourceSection = '';
  }
  if (evidenceDecision.evidenceOutcome === 'BLOCKED') {
    selectedForRender = [];
    sourceSection = '';
  }

  let mergedReply = sourceSection
    ? `${normalizeText(humanized.text || draftPacket.draft || baseReplyText)}\n\n${sourceSection}`
    : normalizeText(humanized.text || draftPacket.draft || baseReplyText);

  if (evidenceDecision.evidenceOutcome === 'INSUFFICIENT' && policy.mode === 'B') {
    mergedReply = `${mergedReply}\n\n補足: 安全条件を満たす根拠URLを確認できないため、公式窓口で最終確認してください。`;
  }
  if (evidenceDecision.evidenceOutcome === 'BLOCKED') {
    mergedReply = `${mergedReply}\n\n補足: ${describeBlockedReason(blockedReasons[0])}`;
  }

  const lintResult = lintConciergeText({
    text: mergedReply,
    topic: policy.topic,
    mode: policy.mode,
    maxUrls: policy.maxUrls
  });

  const replyText = trimForLineMessage(lintResult.text || mergedReply);
  const featureHash = buildFeatureHash({
    contextVersion: CONTEXT_VERSION,
    phase: contextSnapshot && contextSnapshot.phase,
    topTasks: contextSnapshot && Array.isArray(contextSnapshot.topTasks)
      ? contextSnapshot.topTasks.map((item) => item.key)
      : [],
    mode: policy.mode,
    topic: policy.topic,
    tier: policy.userTier,
    segmentKey: actionSelection.segmentKey
  });

  const auditMeta = buildAuditMeta({
    topic: policy.topic,
    mode: policy.mode,
    userTier: policy.userTier,
    selected: selectedForRender,
    decisions: ranked.decisions,
    blockedReasons,
    injectionFindings: sanitized.injectionFindings,
    conversationState,
    conversationMove: move,
    styleId: humanized.styleId,
    conversationPattern: humanized.conversationPattern,
    responseLength: normalizeText(replyText).length,
    intentConfidence: confidence.intentConfidence,
    contextConfidence: confidence.contextConfidence,
    evidenceNeed,
    evidenceOutcome: evidenceDecision.evidenceOutcome,
    chosenAction,
    selectionSource: actionSelection.selectionSource,
    segmentKey: actionSelection.segmentKey,
    contextVersion: CONTEXT_VERSION,
    featureHash,
    postRenderLint: lintResult,
    banditEnabled
  });

  return {
    ok: true,
    replyText,
    mode: policy.mode,
    topic: policy.topic,
    userTier: policy.userTier,
    selectedUrls: selectedForRender,
    decisions: ranked.decisions,
    blockedReasons: Array.from(new Set(blockedReasons)),
    injectionFindings: sanitized.injectionFindings,
    auditMeta
  };
}

module.exports = {
  composeConciergeReply,
  buildConciergeContextSnapshot,
  buildFeatureHash
};
