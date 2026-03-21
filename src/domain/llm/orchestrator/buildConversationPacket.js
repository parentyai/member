'use strict';

const { detectIntent } = require('../router/detectIntent');
const { normalizeConversationIntent } = require('../router/normalizeConversationIntent');
const { resolveFollowupIntent } = require('./followupIntentResolver');
const { buildRequestContract } = require('./buildRequestContract');
const { resolveGenericFallbackSlice } = require('../conversation/replyTemplateTelemetry');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function toTimestamp(value) {
  if (!value) return 0;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value > 1000000000000 ? value : value * 1000;
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.getTime() : 0;
  }
  if (value && typeof value.toDate === 'function') {
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return 0;
}

function normalizeStringList(value, limit) {
  const rows = Array.isArray(value) ? value : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 8;
  const out = [];
  rows.forEach((item) => {
    if (out.length >= max) return;
    const normalized = normalizeText(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function isEchoCandidateLine(value) {
  const text = normalizeText(value);
  return text.length >= 16;
}

function appendHintValue(target, value, limit) {
  const out = Array.isArray(target) ? target : [];
  const max = Number.isFinite(Number(limit)) ? Math.max(1, Math.floor(Number(limit))) : 8;
  normalizeStringList([value], max).forEach((item) => {
    if (out.length >= max || out.includes(item)) return;
    out.push(item);
  });
  normalizeText(value)
    .split('\n')
    .map((line) => normalizeText(line))
    .filter((line) => isEchoCandidateLine(line))
    .forEach((line) => {
      if (out.length >= max || out.includes(line)) return;
      out.push(line);
    });
}

function resolveDomainIntentFromTaskKey(value) {
  const key = normalizeText(value).toLowerCase();
  if (!key) return null;
  if (key.includes('school')) return 'school';
  if (key.includes('ssn') || key.includes('social_security')) return 'ssn';
  if (key.includes('housing') || key.includes('lease') || key.includes('apartment')) return 'housing';
  if (key.includes('bank') || key.includes('wire') || key.includes('checking') || key.includes('debit')) return 'banking';
  return null;
}

function inferDomainFromContextSnapshot(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const keys = [];
  const pushTaskKey = (task) => {
    if (!task || typeof task !== 'object') return;
    keys.push(task.key || task.todoKey || task.id || task.title || '');
  };
  if (Array.isArray(source.topTasks)) source.topTasks.forEach(pushTaskKey);
  if (Array.isArray(source.topOpenTasks)) source.topOpenTasks.forEach(pushTaskKey);
  pushTaskKey(source.blockedTask);
  pushTaskKey(source.dueSoonTask);
  for (const taskKey of keys) {
    const domain = resolveDomainIntentFromTaskKey(taskKey);
    if (domain) return domain;
  }
  return null;
}

function summarizeRecentActionRows(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const ordered = list
    .slice()
    .sort((left, right) => toTimestamp(right && right.createdAt) - toTimestamp(left && left.createdAt));
  const assistantCommitments = [];
  const recentUserGoals = [];
  const recentDomains = [];
  const recentResponseHints = [];
  const recentFollowupIntents = [];
  const recentReplyRows = [];
  let latestAssistantReplyText = '';
  let latestAssistantDomainIntent = '';
  let latestAssistantFollowupIntent = '';

  ordered.forEach((row) => {
    if (!row || typeof row !== 'object') return;
    normalizeStringList(row.committedNextActions, 3).forEach((item) => {
      if (!assistantCommitments.includes(item)) assistantCommitments.push(item);
    });
    const followupQuestion = normalizeText(row.committedFollowupQuestion);
    if (followupQuestion && !assistantCommitments.includes(followupQuestion)) {
      assistantCommitments.push(followupQuestion);
    }
    const recentGoal = normalizeText(row.recentUserGoal);
    if (recentGoal && !recentUserGoals.includes(recentGoal)) recentUserGoals.push(recentGoal);
    const domainIntent = normalizeText(row.domainIntent).toLowerCase();
    if (domainIntent && domainIntent !== 'general' && !recentDomains.includes(domainIntent)) {
      recentDomains.push(domainIntent);
    }
    const responseHint = normalizeText(row.replyText || row.committedFollowupQuestion || '');
    appendHintValue(recentResponseHints, responseHint, 12);
    const followupIntent = normalizeText(row.followupIntent).toLowerCase();
    if (followupIntent && !recentFollowupIntents.includes(followupIntent)) {
      recentFollowupIntents.push(followupIntent);
    }
    const replyText = normalizeText(row.replyText);
    const committedFollowupQuestion = normalizeText(row.committedFollowupQuestion);
    if (replyText || committedFollowupQuestion) {
      recentReplyRows.push({
        replyText,
        committedFollowupQuestion,
        domainIntent,
        followupIntent,
        requestShape: normalizeText(row.requestShape).toLowerCase(),
        outputForm: normalizeText(row.outputForm).toLowerCase()
      });
    }
    if (!latestAssistantReplyText && replyText) latestAssistantReplyText = replyText;
    if (!latestAssistantDomainIntent && domainIntent) latestAssistantDomainIntent = domainIntent;
    if (!latestAssistantFollowupIntent && followupIntent) latestAssistantFollowupIntent = followupIntent;
  });

  return {
    assistantCommitments: assistantCommitments.slice(0, 6),
    recentUserGoals: recentUserGoals.slice(0, 6),
    recentDomains: recentDomains.slice(0, 4),
    recentResponseHints: recentResponseHints.slice(0, 6),
    recentFollowupIntents: recentFollowupIntents.slice(0, 6),
    recentReplyRows: recentReplyRows.slice(0, 6),
    latestAssistantReplyText: latestAssistantReplyText || null,
    latestAssistantDomainIntent: latestAssistantDomainIntent || null,
    latestAssistantFollowupIntent: latestAssistantFollowupIntent || null
  };
}

function isLowInformationMessage(text) {
  const normalized = normalizeText(text);
  if (!normalized) return true;
  if (normalized.length <= 8 && /^(ヒザ|ひざ|ビザ|びざ)/i.test(normalized)) return true;
  if (/^(ヒザ|ひざ|ビザ|びざ|それで|それは|それって|そうなんだ|なるほど|うん|はい|了解|ok|後は何[?？]?|次は[?？]?|つぎは[?？]?|必要書類|書類|予約|予約するの|予約要る|予約いる|どうする|何から)$/i.test(normalized)) return true;
  if (normalized.length <= 3 && /^(はい|うん|了解|ok|おけ|おっけー|thanks|ありがとう|ありがと)$/i.test(normalized)) return true;
  return false;
}

function isContextResumeCue(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const longFollowupCue = /^(それで|それなら|それって|じゃあ|では|その場合|となると|なら).*(タイミング|いつ|何から|何を|どう進め|どれくらい|期限|予定)/i;
  if (normalized.length > 18 && !longFollowupCue.test(normalized)) return false;
  if (/^(それで|それなら|それって|じゃあ|では|その場合|となると|なら|で、|で\?|で？|後は何[?？]?|あとは何[?？]?|次は[?？]?|つぎは[?？]?|予約するの[?？]?|必要書類は[?？]?|それだと)$/i.test(normalized)) {
    return true;
  }
  if (longFollowupCue.test(normalized)) return true;
  return /^(それで|それなら|じゃあ|では|なら).*[?？]$/.test(normalized);
}

function detectRecoverySignal(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  if (/(地域によって違う|地域差がある)/i.test(normalized)) return false;
  return /(それは違う|それも違う|違う、|ちがう、|違います|いや|そうじゃない|それじゃない|誤解|訂正|修正|じゃなくて|考え直して|今度は逆)/i.test(normalized);
}

function resolveRecoveryFollowupIntent(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const docsPattern = /(書類|必要書類|持ち物|証明書|提出物|何が必要|何を用意)/i;
  const appointmentPattern = /(予約|アポ|面談|窓口|来店)/i;
  const nextStepPattern = /(後は何|あとは何|次は|つぎは|何から|どう進め|それで)/i;

  if (docsPattern.test(normalized) && /(じゃなくて|ではなく|じゃない|違う)/.test(normalized)) return 'docs_required';
  if (appointmentPattern.test(normalized) && /(じゃなくて|ではなく|じゃない|違う)/.test(normalized)) return 'appointment_needed';
  if (docsPattern.test(normalized)) return 'docs_required';
  if (appointmentPattern.test(normalized)) return 'appointment_needed';
  if (nextStepPattern.test(normalized)) return 'next_step';
  return null;
}

function countUnresolvedTasks(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  let count = 0;
  if (Array.isArray(source.topTasks)) count += source.topTasks.length;
  if (Array.isArray(source.topOpenTasks)) count += source.topOpenTasks.length;
  if (source.blockedTask && typeof source.blockedTask === 'object') count += 1;
  if (source.dueSoonTask && typeof source.dueSoonTask === 'object') count += 1;
  return Math.max(0, Math.min(20, count));
}

function computeContextCarryScore(params) {
  const payload = params && typeof params === 'object' ? params : {};
  let score = 0;
  if (payload.contextResume === true) score += 0.5;
  if (payload.lowInformationMessage === true) score += 0.15;
  if (payload.contextResumeCue === true) score += 0.1;
  if (payload.recoverySignal === true) score += 0.1;
  if (typeof payload.contextResumeDomain === 'string' && payload.contextResumeDomain.trim()) score += 0.2;
  if (typeof payload.followupIntent === 'string' && payload.followupIntent.trim()) score += 0.1;
  if (typeof payload.recoveryFollowupIntent === 'string' && payload.recoveryFollowupIntent.trim()) score += 0.05;
  if (payload.followupCarryFromHistory === true) score += 0.1;
  if (Number.isFinite(Number(payload.unresolvedTaskCount)) && Number(payload.unresolvedTaskCount) > 0) score += 0.05;
  if (Number.isFinite(Number(payload.recentAssistantCommitmentCount)) && Number(payload.recentAssistantCommitmentCount) > 0) {
    score += 0.05;
  }
  if (Number.isFinite(Number(payload.recentFollowupIntentCount)) && Number(payload.recentFollowupIntentCount) > 0) {
    score += 0.05;
  }
  if (score > 1) return 1;
  return Math.round(score * 10000) / 10000;
}

function buildConversationPacket(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const messageText = normalizeText(payload.messageText);
  const intentDecision = detectIntent({ messageText });
  const detectedConversationIntent = normalizeConversationIntent(messageText);
  const recentHistory = summarizeRecentActionRows(payload.recentActionRows);
  const lowInformationMessage = isLowInformationMessage(messageText);
  const contextResumeCue = isContextResumeCue(messageText);
  const recoverySignal = detectRecoverySignal(messageText);
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object' ? payload.contextSnapshot : null;
  const contextSnapshotDomain = inferDomainFromContextSnapshot(contextSnapshot);
  const snapshotResumeDomain = (
    lowInformationMessage === true
    || detectedConversationIntent === contextSnapshotDomain
  ) ? contextSnapshotDomain : null;
  const recentDomain = recentHistory.recentDomains[0] || snapshotResumeDomain || null;
  const preliminaryRequestContract = buildRequestContract({
    messageText,
    fallbackDomain: recentDomain,
    recentResponseHints: recentHistory.recentResponseHints,
    recentReplyRows: recentHistory.recentReplyRows,
    latestAssistantReplyText: recentHistory.latestAssistantReplyText,
    latestAssistantDomainIntent: recentHistory.latestAssistantDomainIntent,
    latestAssistantFollowupIntent: recentHistory.latestAssistantFollowupIntent,
    lowInformationMessage,
    contextResumeCue,
    recoverySignal,
    intentReason: intentDecision.reason,
    intentMode: intentDecision.mode,
    highRiskIntent: detectedConversationIntent === 'ssn' || detectedConversationIntent === 'banking'
  });
  const sourceDomainIntent = normalizeText(preliminaryRequestContract.sourceDomainIntent).toLowerCase();
  const resumeAnchorDomain = sourceDomainIntent && sourceDomainIntent !== 'general'
    ? sourceDomainIntent
    : recentDomain;
  const suppressStaleDomainResume = preliminaryRequestContract.sourceMatchedFromHistory === true
    && sourceDomainIntent === 'general';
  const shouldAllowContextResume = intentDecision.mode !== 'greeting'
    && (
      intentDecision.reason !== 'smalltalk_detected'
      || contextResumeCue
      || recoverySignal
    );
  const contextResume = (
    lowInformationMessage
    || contextResumeCue
    || recoverySignal
    || preliminaryRequestContract.echoOfPriorAssistant === true
    || preliminaryRequestContract.requestShape === 'followup_continue'
  )
    && Boolean(resumeAnchorDomain)
    && suppressStaleDomainResume !== true
    && shouldAllowContextResume
    && (
      preliminaryRequestContract.currentTurnHasExplicitDomain !== true
      || preliminaryRequestContract.requestShape === 'rewrite'
      || preliminaryRequestContract.requestShape === 'message_template'
      || preliminaryRequestContract.requestShape === 'summarize'
      || preliminaryRequestContract.echoOfPriorAssistant === true
    );
  const requestContract = buildRequestContract({
    messageText,
    fallbackDomain: normalizeText(preliminaryRequestContract.sourceDomainIntent).toLowerCase() || (contextResume ? resumeAnchorDomain : null),
    recentResponseHints: recentHistory.recentResponseHints,
    recentReplyRows: recentHistory.recentReplyRows,
    latestAssistantReplyText: recentHistory.latestAssistantReplyText,
    latestAssistantDomainIntent: recentHistory.latestAssistantDomainIntent,
    latestAssistantFollowupIntent: recentHistory.latestAssistantFollowupIntent,
    lowInformationMessage,
    contextResumeCue,
    recoverySignal,
    intentReason: intentDecision.reason,
    intentMode: intentDecision.mode,
    highRiskIntent: (
      preliminaryRequestContract.primaryDomainIntent === 'ssn'
      || preliminaryRequestContract.primaryDomainIntent === 'banking'
    )
  });
  const normalizedConversationIntent = requestContract.primaryDomainIntent || 'general';
  const followupIntentDecision = resolveFollowupIntent({
    messageText,
    domainIntent: normalizedConversationIntent,
    contextResumeDomain: contextResume ? resumeAnchorDomain : null,
    recentFollowupIntents: recentHistory.recentFollowupIntents
  });
  const providedRouterReason = normalizeText(payload.routerReason);
  const routerReason = contextResume
    ? 'contextual_domain_resume'
    : (providedRouterReason || normalizeText(intentDecision.reason) || 'default_casual');
  const llmFlags = payload.llmFlags && typeof payload.llmFlags === 'object' ? payload.llmFlags : {};
  const unresolvedTaskCount = countUnresolvedTasks(contextSnapshot);
  const detectedFollowupIntent = followupIntentDecision && typeof followupIntentDecision.followupIntent === 'string'
    ? followupIntentDecision.followupIntent
    : null;
  const followupIntentReason = followupIntentDecision && typeof followupIntentDecision.reason === 'string'
    ? followupIntentDecision.reason
    : 'none';
  const suppressGenericKickoffFollowupIntent = followupIntentReason === 'general_next_step_keyword'
    && normalizedConversationIntent === 'general'
    && contextResume !== true
    && requestContract.requestShape === 'answer';
  const recoveryFollowupIntent = recoverySignal ? resolveRecoveryFollowupIntent(messageText) : null;
  const followupIntent = (suppressGenericKickoffFollowupIntent ? null : detectedFollowupIntent)
    || recoveryFollowupIntent
    || normalizeText(requestContract.sourceFollowupIntent).toLowerCase()
    || ((contextResume && normalizedConversationIntent !== 'general') ? 'next_step' : null);
  const followupCarryFromHistory = followupIntentReason === 'history_followup_carry';
  const priorContextUsed = contextResume === true || followupCarryFromHistory === true;
  const followupResolvedFromHistory = followupCarryFromHistory === true;
  const continuationReason = followupCarryFromHistory
    ? 'history_followup_carry'
    : (contextResume
      ? 'contextual_domain_resume'
      : (recoverySignal ? 'recovery_signal' : null));
  const contextCarryScore = computeContextCarryScore({
    contextResume,
    lowInformationMessage,
    contextResumeCue,
    recoverySignal,
    contextResumeDomain: contextResume ? recentDomain : null,
    followupIntent,
    followupCarryFromHistory,
    recoveryFollowupIntent,
    unresolvedTaskCount,
    recentAssistantCommitmentCount: recentHistory.assistantCommitments.length,
    recentFollowupIntentCount: recentHistory.recentFollowupIntents.length
  });
  const genericFallbackSlice = resolveGenericFallbackSlice({
    messageText,
    domainIntent: normalizedConversationIntent,
    followupIntent,
    routerReason,
    priorContextUsed,
    followupResolvedFromHistory,
    continuationReason
  });

  return {
    lineUserId: normalizeText(payload.lineUserId),
    traceId: normalizeText(payload.traceId) || null,
    requestId: normalizeText(payload.requestId) || null,
    messageText,
    planInfo: payload.planInfo && typeof payload.planInfo === 'object' ? payload.planInfo : { plan: 'free', status: 'unknown' },
    explicitPaidIntent: normalizeText(payload.explicitPaidIntent) || null,
    paidIntent: normalizeText(payload.paidIntent) || 'faq_search',
    detectedConversationIntent,
    primaryDomainIntent: requestContract.primaryDomainIntent,
    domainSignals: requestContract.domainSignals,
    normalizedConversationIntent,
    intentDecision,
    routerMode: normalizeText(payload.routerMode || intentDecision.mode) || 'casual',
    routerReason,
    contextSnapshot,
    contextResume,
    contextResumeCue,
    recoverySignal,
    contextResumeDomain: contextResume ? resumeAnchorDomain : null,
    followupIntent,
    followupIntentReason,
    followupCarryFromHistory,
    followupResolvedFromHistory,
    recoveryFollowupIntent,
    requestShape: requestContract.requestShape,
    depthIntent: requestContract.depthIntent || 'answer',
    transformSource: requestContract.transformSource || 'none',
    outputForm: requestContract.outputForm,
    knowledgeScope: requestContract.knowledgeScope || 'general',
    locationHint: requestContract.locationHint && typeof requestContract.locationHint === 'object'
      ? Object.assign({}, requestContract.locationHint)
      : { kind: 'none', matchedText: null, regionKey: null, state: null, city: null, cityKey: null, source: 'none' },
    detailObligations: requestContract.detailObligations,
    answerability: requestContract.answerability,
    echoOfPriorAssistant: requestContract.echoOfPriorAssistant === true,
    requestContract,
    lowInformationMessage,
    unresolvedTaskCount,
    priorContextUsed,
    continuationReason,
    genericFallbackSlice,
    contextCarryScore,
    llmFlags: {
      llmConciergeEnabled: llmFlags.llmConciergeEnabled === true,
      llmWebSearchEnabled: llmFlags.llmWebSearchEnabled !== false,
      llmStyleEngineEnabled: llmFlags.llmStyleEngineEnabled !== false,
      llmBanditEnabled: llmFlags.llmBanditEnabled === true,
      qualityEnabled: llmFlags.qualityEnabled !== false,
      snapshotStrictMode: llmFlags.snapshotStrictMode === true,
      actionGatewayEnabled: llmFlags.actionGatewayEnabled === true
    },
    maxNextActionsCap: Number.isFinite(Number(payload.maxNextActionsCap)) ? Number(payload.maxNextActionsCap) : null,
    recentEngagement: payload.recentEngagement && typeof payload.recentEngagement === 'object'
      ? payload.recentEngagement
      : { recentTurns: 0, recentInterventions: 0, recentClicks: false, recentTaskDone: false },
    recentAssistantCommitments: recentHistory.assistantCommitments,
    recentUserGoals: recentHistory.recentUserGoals,
    recentDomains: recentHistory.recentDomains,
    recentResponseHints: recentHistory.recentResponseHints,
    recentFollowupIntents: recentHistory.recentFollowupIntents,
    sourceReplyText: requestContract.sourceReplyText || null,
    sourceDomainIntent: requestContract.sourceDomainIntent || null,
    sourceFollowupIntent: requestContract.sourceFollowupIntent || null,
    opportunityDecision: payload.opportunityDecision && typeof payload.opportunityDecision === 'object'
      ? payload.opportunityDecision
      : null
  };
}

module.exports = {
  buildConversationPacket,
  summarizeRecentActionRows
};
