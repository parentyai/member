'use strict';

const crypto = require('crypto');

const { resolvePolicyForRequest, shouldAttachUrls } = require('../../../domain/llm/conciergePolicy');
const { selectUrls } = require('../../../domain/llm/urlRanker');
const { sanitizeRetrievalCandidates } = require('../retrieval/sanitizeRetrievalCandidates');
const { selectResponseStyle } = require('../../../domain/llm/styleRouter');
const { resolveConversationState } = require('../../../domain/llm/conversation/conversationState');
const { resolveConversationMove } = require('../../../domain/llm/conversation/conversationMoves');
const {
  extractAnalysisFromBaseReply,
  composeConversationDraft,
  composeConversationDraftFromSignals
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
const { buildContextualFeatures } = require('../../../domain/llm/bandit/contextualFeatures');
const { buildCounterfactualSnapshot } = require('../../../domain/llm/bandit/counterfactualSnapshot');
const { buildContextSignature } = require('../../../domain/llm/bandit/contextualSignature');
const { evaluateCounterfactualChoice } = require('../../../domain/llm/bandit/counterfactualEvaluator');
const { resolveIntentRiskTier } = require('../../../domain/llm/policy/resolveIntentRiskTier');
const { computeSourceReadiness } = require('../../../domain/llm/knowledge/computeSourceReadiness');
const { evaluateAnswerReadiness } = require('../../../domain/llm/quality/evaluateAnswerReadiness');
const { applyAnswerReadinessDecision } = require('../../../domain/llm/quality/applyAnswerReadinessDecision');

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

function normalizeContextualFeatures(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    featureVersion: normalizeText(payload.featureVersion) || 'bandit_ctx_v1',
    journeyPhase: normalizeText(payload.journeyPhase) || 'pre',
    tier: normalizeText(payload.tier) || 'free',
    mode: normalizeText(payload.mode) || 'A',
    topic: normalizeText(payload.topic) || 'general',
    riskBucket: normalizeText(payload.riskBucket) || 'low',
    evidenceNeed: normalizeText(payload.evidenceNeed) || 'none',
    styleId: normalizeText(payload.styleId) || null,
    ctaCount: Number.isFinite(Number(payload.ctaCount)) ? Math.max(0, Math.floor(Number(payload.ctaCount))) : 0,
    lengthBucket: normalizeText(payload.lengthBucket) || 'short',
    timingBucket: normalizeText(payload.timingBucket) || 'daytime',
    questionFlag: payload.questionFlag === true,
    intentConfidence: Number.isFinite(Number(payload.intentConfidence)) ? Number(payload.intentConfidence) : 0,
    contextConfidence: Number.isFinite(Number(payload.contextConfidence)) ? Number(payload.contextConfidence) : 0,
    intentConfidenceBucket: normalizeText(payload.intentConfidenceBucket) || 'low',
    contextConfidenceBucket: normalizeText(payload.contextConfidenceBucket) || 'low',
    taskLoadBucket: normalizeText(payload.taskLoadBucket) || 'none',
    topTaskCount: Number.isFinite(Number(payload.topTaskCount)) ? Math.max(0, Math.floor(Number(payload.topTaskCount))) : 0,
    blockedTaskPresent: payload.blockedTaskPresent === true,
    dueSoonTaskPresent: payload.dueSoonTaskPresent === true
  };
}

function normalizeCounterfactualTopArms(value) {
  return (Array.isArray(value) ? value : [])
    .slice(0, 5)
    .map((row, index) => ({
      rank: Number.isFinite(Number(row && row.rank)) ? Math.max(1, Math.floor(Number(row.rank))) : index + 1,
      armId: normalizeText(row && row.armId) || null,
      styleId: normalizeText(row && row.styleId) || null,
      ctaCount: Number.isFinite(Number(row && row.ctaCount)) ? Math.max(0, Math.floor(Number(row.ctaCount))) : 0,
      score: Number.isFinite(Number(row && row.score)) ? Number(row.score) : 0
    }))
    .filter((row) => row.armId);
}

function normalizeCounterfactualEval(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    version: normalizeText(payload.version) || 'v1',
    eligible: payload.eligible === true,
    selectedArmId: normalizeText(payload.selectedArmId) || null,
    selectedRank: Number.isFinite(Number(payload.selectedRank))
      ? Math.max(1, Math.floor(Number(payload.selectedRank)))
      : null,
    bestArmId: normalizeText(payload.bestArmId) || null,
    bestScore: Number.isFinite(Number(payload.bestScore)) ? Number(payload.bestScore) : 0,
    selectedScore: Number.isFinite(Number(payload.selectedScore)) ? Number(payload.selectedScore) : 0,
    scoreGap: Number.isFinite(Number(payload.scoreGap)) ? Math.max(0, Number(payload.scoreGap)) : 0,
    minGap: Number.isFinite(Number(payload.minGap)) ? Math.max(0, Number(payload.minGap)) : 0.12,
    opportunityDetected: payload.opportunityDetected === true
  };
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
      : { findings: [], modified: false },
    contextSignature: normalizeText(payload.contextSignature) || null,
    contextualBanditEnabled: payload.contextualBanditEnabled === true,
    contextualFeatures: normalizeContextualFeatures(payload.contextualFeatures),
    counterfactualSelectedArmId: normalizeText(payload.counterfactualSelectedArmId) || null,
    counterfactualSelectedRank: Number.isFinite(Number(payload.counterfactualSelectedRank))
      ? Math.max(1, Math.floor(Number(payload.counterfactualSelectedRank)))
      : null,
    counterfactualTopArms: normalizeCounterfactualTopArms(payload.counterfactualTopArms),
    counterfactualEval: normalizeCounterfactualEval(payload.counterfactualEval),
    sourceAuthorityScore: Number.isFinite(Number(payload.sourceAuthorityScore)) ? Number(payload.sourceAuthorityScore) : null,
    sourceFreshnessScore: Number.isFinite(Number(payload.sourceFreshnessScore)) ? Number(payload.sourceFreshnessScore) : null,
    sourceReadinessDecision: normalizeText(payload.sourceReadinessDecision) || null,
    sourceReadinessReasons: Array.isArray(payload.sourceReadinessReasons)
      ? payload.sourceReadinessReasons.filter(Boolean).slice(0, 8)
      : [],
    officialOnlySatisfied: payload.officialOnlySatisfied === true,
    readinessDecision: normalizeText(payload.readinessDecision) || null,
    readinessReasonCodes: Array.isArray(payload.readinessReasonCodes)
      ? payload.readinessReasonCodes.filter(Boolean).slice(0, 12)
      : [],
    readinessSafeResponseMode: normalizeText(payload.readinessSafeResponseMode) || null,
    unsupportedClaimCount: Number.isFinite(Number(payload.unsupportedClaimCount))
      ? Math.max(0, Math.floor(Number(payload.unsupportedClaimCount)))
      : 0,
    contradictionDetected: payload.contradictionDetected === true,
    answerReadinessLogOnly: payload.answerReadinessLogOnly !== false
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

  const sanitizedRetrieval = sanitizeRetrievalCandidates([storedCandidates, webCandidates]);
  const sanitized = {
    candidates: Array.isArray(sanitizedRetrieval.candidates) ? sanitizedRetrieval.candidates : [],
    blockedReasons: Array.isArray(sanitizedRetrieval.blockedReasons) ? sanitizedRetrieval.blockedReasons : [],
    injectionFindings: sanitizedRetrieval.injectionFindings === true
  };
  if (sanitized.blockedReasons.length) blockedReasons.push(...sanitized.blockedReasons);
  const ranked = selectUrls(sanitized.candidates, {
    maxUrls: policy.maxUrls,
    allowedRanks: policy.allowedRanks
  }, {
    denylist: payload.denylist
  });

  const evidenceNeed = resolveEvidenceNeed(policy.mode);
  const riskSnapshot = resolveIntentRiskTier({
    domainIntent: payload.domainIntent || policy.topic || 'general',
    reasonCodes: payload.riskReasonCodes
  });
  const sourceReadiness = computeSourceReadiness({
    intentRiskTier: payload.intentRiskTier || riskSnapshot.intentRiskTier,
    candidates: ranked.selected,
    retrievalQuality: ranked.selected.length > 0 ? 'good' : 'none',
    retrieveNeeded: evidenceNeed !== 'none',
    evidenceCoverage: ranked.selected.length > 0 ? 1 : 0
  });
  const evidenceDecision = resolveEvidenceOutcome({
    mode: policy.mode,
    evidenceNeed,
    urlCount: ranked.selected.length,
    blockedReasons,
    injectionFindings: sanitized.injectionFindings
  });
  if (sourceReadiness.sourceReadinessDecision === 'clarify' && evidenceDecision.evidenceOutcome === 'SUPPORTED') {
    evidenceDecision.evidenceOutcome = 'INSUFFICIENT';
  }
  if (sourceReadiness.sourceReadinessDecision === 'refuse') {
    evidenceDecision.evidenceOutcome = 'BLOCKED';
    blockedReasons.push('source_readiness_refuse');
  }
  const readinessResult = evaluateAnswerReadiness({
    lawfulBasis: payload && payload.legalSnapshot && typeof payload.legalSnapshot.lawfulBasis === 'string'
      ? payload.legalSnapshot.lawfulBasis
      : 'unspecified',
    consentVerified: payload && payload.legalSnapshot && payload.legalSnapshot.consentVerified === true,
    crossBorder: payload && payload.legalSnapshot && payload.legalSnapshot.crossBorder === true,
    legalDecision: payload && payload.legalSnapshot && typeof payload.legalSnapshot.legalDecision === 'string'
      ? payload.legalSnapshot.legalDecision
      : null,
    intentRiskTier: payload.intentRiskTier || riskSnapshot.intentRiskTier,
    sourceAuthorityScore: sourceReadiness.sourceAuthorityScore,
    sourceFreshnessScore: sourceReadiness.sourceFreshnessScore,
    sourceReadinessDecision: sourceReadiness.sourceReadinessDecision,
    officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
    unsupportedClaimCount: 0,
    contradictionDetected: false,
    evidenceCoverage: evidenceDecision.evidenceOutcome === 'SUPPORTED'
      ? 1
      : (evidenceDecision.evidenceOutcome === 'INSUFFICIENT' ? 0.35 : 0),
    fallbackType: blockedReasons.length > 0 ? blockedReasons[0] : null
  });

  const baseReplyText = normalizeText(payload.baseReplyText);
  const opportunityHints = payload.opportunityHints && typeof payload.opportunityHints === 'object'
    ? payload.opportunityHints
    : null;
  const opportunityActions = opportunityHints && Array.isArray(opportunityHints.nextActions)
    ? opportunityHints.nextActions.map((item) => normalizeText(item)).filter(Boolean).slice(0, 3)
    : [];
  const opportunityPitfall = opportunityHints ? normalizeText(opportunityHints.pitfall) : '';
  const opportunityQuestion = opportunityHints ? normalizeText(opportunityHints.question) : '';
  const hasOpportunityHints = opportunityActions.length > 0 || opportunityPitfall.length > 0 || opportunityQuestion.length > 0;
  const analysis = hasOpportunityHints
    ? {
      summary: normalizeText(opportunityHints.summary) || normalizeText(baseReplyText) || 'いま必要な対応を先に整理します。',
      missing: [],
      risks: opportunityPitfall ? [opportunityPitfall] : [],
      nextActions: opportunityActions,
      refs: []
    }
    : extractAnalysisFromBaseReply({ baseReplyText });
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
  const contextualFeaturesForBandit = buildContextualFeatures({
    mode: policy.mode,
    topic: policy.topic,
    userTier: policy.userTier,
    journeyPhase: payload.journeyPhase || (contextSnapshot && contextSnapshot.phase) || '',
    riskBucket: confidence.riskBucket,
    evidenceNeed,
    contextSnapshot,
    chosenAction: null,
    intentConfidence: confidence.intentConfidence,
    contextConfidence: confidence.contextConfidence
  });
  const contextSignature = buildContextSignature(contextualFeaturesForBandit);

  let stateByArm = banditInput.stateByArm && typeof banditInput.stateByArm === 'object'
    ? banditInput.stateByArm
    : {};
  let contextualStateByArm = banditInput.contextualStateByArm && typeof banditInput.contextualStateByArm === 'object'
    ? banditInput.contextualStateByArm
    : {};
  if (
    banditEnabled
    && (
      !stateByArm
      || Object.keys(stateByArm).length === 0
      || !contextualStateByArm
      || Object.keys(contextualStateByArm).length === 0
    )
    && typeof banditInput.stateFetcher === 'function'
  ) {
    try {
      const fetched = await banditInput.stateFetcher({
        segmentKey: segmentKeyHint,
        contextSignature
      });
      if (fetched && typeof fetched === 'object') {
        if (fetched.stateByArm && typeof fetched.stateByArm === 'object') {
          stateByArm = fetched.stateByArm;
        } else if (Object.keys(stateByArm).length === 0) {
          stateByArm = fetched;
        }
        if (fetched.contextualStateByArm && typeof fetched.contextualStateByArm === 'object') {
          contextualStateByArm = fetched.contextualStateByArm;
        }
      }
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
      contextualStateByArm,
      randomFn: banditInput.randomFn
    }
  });

  const chosenAction = actionSelection && actionSelection.selected && typeof actionSelection.selected === 'object'
    ? actionSelection.selected
    : null;
  const contextualFeatures = buildContextualFeatures({
    mode: policy.mode,
    topic: policy.topic,
    userTier: policy.userTier,
    journeyPhase: payload.journeyPhase || (contextSnapshot && contextSnapshot.phase) || '',
    riskBucket: confidence.riskBucket,
    evidenceNeed,
    contextSnapshot,
    chosenAction,
    intentConfidence: confidence.intentConfidence,
    contextConfidence: confidence.contextConfidence
  });
  const counterfactual = buildCounterfactualSnapshot({
    candidates: actionSelection.candidates,
    selectedArmId: chosenAction && chosenAction.armId ? chosenAction.armId : null,
    maxArms: 3
  });
  const counterfactualEval = evaluateCounterfactualChoice({
    selectedArmId: counterfactual.selectedArmId,
    selectedRank: counterfactual.selectedRank,
    topArms: counterfactual.topArms,
    selectedScore: chosenAction && Number.isFinite(Number(chosenAction.score))
      ? Number(chosenAction.score)
      : 0
  });

  const styleDecisionForRender = Object.assign({}, styleDecision, {
    styleId: chosenAction && chosenAction.styleId ? chosenAction.styleId : styleDecision.styleId,
    maxActions: chosenAction && Number.isFinite(Number(chosenAction.ctaCount))
      ? Number(chosenAction.ctaCount)
      : styleDecision.maxActions,
    askClarifying: (chosenAction && chosenAction.questionFlag === true) || styleDecision.askClarifying === true || confidence.forceClarify
  });

  const draftPacket = hasOpportunityHints
    ? composeConversationDraftFromSignals({
      summary: analysis.summary,
      nextActions: opportunityActions,
      pitfall: opportunityPitfall,
      question: opportunityQuestion,
      state: conversationState,
      move,
      baseReplyText
    })
    : composeConversationDraft({
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

  const lintedReplyText = trimForLineMessage(lintResult.text || mergedReply);
  const readinessApplied = applyAnswerReadinessDecision({
    decision: readinessResult.decision,
    replyText: lintedReplyText,
    clarifyText: 'まず対象手続きと期限を1つずつ教えてください。そこから次の一手を具体化します。',
    refuseText: 'この内容は安全に断定できないため、公式窓口で最終確認してください。必要なら確認ポイントを整理します。'
  });
  const replyText = trimForLineMessage(readinessApplied.replyText || lintedReplyText);
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
    contextSignature,
    contextualBanditEnabled: actionSelection.contextualBanditUsed === true,
    postRenderLint: lintResult,
    contextualFeatures,
    counterfactualSelectedArmId: counterfactual.selectedArmId,
    counterfactualSelectedRank: counterfactual.selectedRank,
    counterfactualTopArms: counterfactual.topArms,
    counterfactualEval,
    banditEnabled,
    sourceAuthorityScore: sourceReadiness.sourceAuthorityScore,
    sourceFreshnessScore: sourceReadiness.sourceFreshnessScore,
    sourceReadinessDecision: sourceReadiness.sourceReadinessDecision,
    sourceReadinessReasons: sourceReadiness.reasonCodes,
    officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
    readinessDecision: readinessResult.decision,
    readinessReasonCodes: readinessResult.reasonCodes,
    readinessSafeResponseMode: readinessResult.safeResponseMode,
    unsupportedClaimCount: readinessResult.qualitySnapshot.unsupportedClaimCount,
    contradictionDetected: readinessResult.qualitySnapshot.contradictionDetected === true,
    answerReadinessLogOnly: false
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
