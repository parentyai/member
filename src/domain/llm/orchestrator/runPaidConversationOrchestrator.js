'use strict';

const { buildConversationPacket } = require('./buildConversationPacket');
const { buildStrategyPlan } = require('./strategyPlanner');
const {
  judgeNeedRetrieval,
  judgeRetrievalQuality,
  judgeEvidenceSufficiency
} = require('./retrievalController');
const { judgeCandidates } = require('./judgeCandidates');
const { verifyCandidate } = require('./verifyCandidate');
const { finalizeCandidate } = require('./finalizeCandidate');
const { resolveLlmLegalPolicySnapshot } = require('../policy/resolveLlmLegalPolicySnapshot');
const { resolveIntentRiskTier } = require('../policy/resolveIntentRiskTier');
const { computeSourceReadiness } = require('../knowledge/computeSourceReadiness');
const { evaluateAnswerReadiness } = require('../quality/evaluateAnswerReadiness');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeForSimilarity(value) {
  return normalizeText(value).toLowerCase().replace(/\s+/g, ' ');
}

function similarityScore(left, right) {
  const a = normalizeForSimilarity(left);
  const b = normalizeForSimilarity(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const aTokens = new Set(a.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  const bTokens = new Set(b.split(/[^\p{L}\p{N}]+/u).filter(Boolean));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  aTokens.forEach((token) => {
    if (bTokens.has(token)) overlap += 1;
  });
  const denominator = Math.max(aTokens.size, bTokens.size);
  return denominator > 0 ? overlap / denominator : 0;
}

function buildClarifyCandidate(packet, strategy) {
  const domainIntent = normalizeText(packet.normalizedConversationIntent).toLowerCase();
  const replyText = strategy === 'recommendation'
    ? 'おすすめ先を絞りたいので、希望エリアと優先条件を1つずつ教えてください。'
    : (domainIntent && domainIntent !== 'general'
      ? '状況は把握しました。まず優先したい手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。'
      : '対象を絞って案内したいので、いま一番気になっている手続きと期限を1つずつ教えてください。');
  return {
    id: 'clarify_candidate',
    kind: 'clarify_candidate',
    replyText,
    domainIntent: domainIntent || 'general',
    retrievalQuality: 'none',
    atoms: {
      situationLine: '対象を絞って案内します。',
      nextActions: [],
      pitfall: '',
      followupQuestion: replyText
    }
  };
}

function buildCasualCandidate(casualReply, packet) {
  const replyText = casualReply && casualReply.replyText ? casualReply.replyText : 'こんにちは。';
  return {
    id: 'conversation_candidate',
    kind: 'casual_candidate',
    replyText,
    domainIntent: packet.normalizedConversationIntent || 'general',
    retrievalQuality: 'none',
    atoms: {
      situationLine: replyText,
      nextActions: [],
      pitfall: '',
      followupQuestion: ''
    }
  };
}

function buildGroundedCandidate(result, retrievalQuality, packet) {
  if (!result || result.ok !== true) return null;
  return {
    id: 'grounded_candidate',
    kind: 'grounded_candidate',
    replyText: result.replyText || '',
    domainIntent: packet.normalizedConversationIntent || 'general',
    retrievalQuality,
    assistantQuality: result.assistantQuality || null,
    model: result.model || null,
    tokensIn: Number.isFinite(Number(result.tokensIn)) ? Number(result.tokensIn) : 0,
    tokensOut: Number.isFinite(Number(result.tokensOut)) ? Number(result.tokensOut) : 0,
    raw: result,
    atoms: result.output && typeof result.output === 'object'
      ? {
          situationLine: result.output.situation || '',
          nextActions: Array.isArray(result.output.nextActions) ? result.output.nextActions : [],
          pitfall: Array.isArray(result.output.risks) ? (result.output.risks[0] || '') : '',
          followupQuestion: Array.isArray(result.output.gaps) ? (result.output.gaps[0] || '') : ''
        }
      : {}
  };
}

function buildComposedCandidate(result, packet) {
  if (!result || result.ok !== true) return null;
  return {
    id: 'composed_concierge_candidate',
    kind: 'composed_concierge_candidate',
    replyText: result.replyText || '',
    domainIntent: packet.normalizedConversationIntent || 'general',
    retrievalQuality: result.auditMeta && result.auditMeta.evidenceOutcome === 'SUPPORTED' ? 'good' : 'mixed',
    conciergeMeta: result.auditMeta || null,
    atoms: {}
  };
}

function buildDomainCandidate(result, packet) {
  if (!result || result.ok !== true) return null;
  return {
    id: 'domain_concierge_candidate',
    kind: 'domain_concierge_candidate',
    replyText: result.replyText || '',
    domainIntent: result.domainIntent || packet.normalizedConversationIntent || 'general',
    retrievalQuality: 'none',
    conciergeMeta: result.auditMeta || null,
    opportunityDecision: {
      conversationMode: result.conversationMode || 'concierge',
      opportunityType: result.opportunityType || 'action',
      opportunityReasonKeys: Array.isArray(result.opportunityReasonKeys) ? result.opportunityReasonKeys : [],
      interventionBudget: Number.isFinite(Number(result.interventionBudget)) ? Number(result.interventionBudget) : 1
    },
    followupIntent: typeof result.followupIntent === 'string' ? result.followupIntent : null,
    conciseModeApplied: result.conciseModeApplied === true,
    atoms: result.atoms && typeof result.atoms === 'object' ? result.atoms : {}
  };
}

async function buildCandidateSet(packet, strategyPlan, deps) {
  const candidates = [];
  const strategy = strategyPlan.strategy;
  let groundedResult = null;
  let retrievalQuality = 'none';

  if (strategy === 'casual') {
    const casualReply = await deps.generatePaidCasualReply({
      messageText: packet.messageText,
      contextHint: packet.contextResumeDomain || packet.normalizedConversationIntent,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
    candidates.push(buildCasualCandidate(casualReply, packet));
    if (packet.intentDecision && packet.intentDecision.reason !== 'greeting_detected') {
      candidates.push(buildClarifyCandidate(packet, strategy));
    }
    return { candidates, groundedResult, retrievalQuality };
  }

  if (strategy === 'domain_concierge' || strategy === 'concierge') {
    const domainResult = await deps.generateDomainConciergeCandidate({
      domainIntent: packet.normalizedConversationIntent || 'general',
      messageText: packet.messageText,
      contextSnapshot: packet.contextSnapshot,
      opportunityDecision: packet.opportunityDecision,
      followupIntent: packet.followupIntent,
      recentFollowupIntents: packet.recentFollowupIntents,
      blockedReason: null
    });
    const domainCandidate = buildDomainCandidate(domainResult, packet);
    if (domainCandidate) candidates.push(domainCandidate);
    candidates.push(buildClarifyCandidate(packet, strategy));
    return { candidates, groundedResult, retrievalQuality };
  }

  if (strategyPlan.retrieveNeeded === true) {
    groundedResult = await deps.generateGroundedReply({
      question: packet.messageText,
      intent: packet.paidIntent,
      contextSnapshot: packet.contextSnapshot,
      maxNextActionsCap: packet.maxNextActionsCap
    });
    retrievalQuality = judgeRetrievalQuality(groundedResult);
    const groundedCandidate = buildGroundedCandidate(groundedResult, retrievalQuality, packet);
    if (groundedCandidate) candidates.push(groundedCandidate);

    if (groundedCandidate && packet.llmFlags.llmConciergeEnabled && typeof deps.composeConciergeCandidate === 'function') {
      const composed = await deps.composeConciergeCandidate({
        groundedResult,
        packet
      });
      const composedCandidate = buildComposedCandidate(composed, packet);
      if (composedCandidate) candidates.push(composedCandidate);
    }
  }

  if (strategy === 'clarify') {
    const casualReply = await deps.generatePaidCasualReply({
      messageText: packet.messageText,
      contextHint: packet.contextResumeDomain || packet.normalizedConversationIntent,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
    candidates.push(buildCasualCandidate(casualReply, packet));
  }

  if (strategy === 'clarify' || strategy === 'grounded_answer' || strategy === 'recommendation') {
    candidates.push(buildClarifyCandidate(packet, strategy));
  }

  if (!candidates.length) {
    const fallbackDomain = await deps.generateDomainConciergeCandidate({
      domainIntent: 'general',
      messageText: packet.messageText,
      contextSnapshot: packet.contextSnapshot,
      opportunityDecision: packet.opportunityDecision,
      followupIntent: packet.followupIntent,
      recentFollowupIntents: packet.recentFollowupIntents,
      blockedReason: groundedResult && groundedResult.blockedReason ? groundedResult.blockedReason : null
    });
    const fallbackCandidate = buildDomainCandidate(fallbackDomain, packet);
    if (fallbackCandidate) candidates.push(fallbackCandidate);
  }

  return { candidates, groundedResult, retrievalQuality };
}

function resolveLoopSafeCandidate(packet, selected, candidates) {
  const current = selected && typeof selected === 'object' ? selected : null;
  if (!current) {
    return {
      selected: current,
      loopBreakApplied: false
    };
  }
  const intentReason = packet && packet.intentDecision && typeof packet.intentDecision.reason === 'string'
    ? packet.intentDecision.reason
    : '';
  if (intentReason === 'greeting_detected' || intentReason === 'smalltalk_detected') {
    return {
      selected: current,
      loopBreakApplied: false
    };
  }
  const clarifyCandidate = Array.isArray(candidates)
    ? candidates.find((item) => item && item.kind === 'clarify_candidate')
    : null;
  if (!clarifyCandidate) {
    return {
      selected: current,
      loopBreakApplied: false,
      repetitionPrevented: false
    };
  }

  const normalizedReply = normalizeForSimilarity(current.replyText);
  const fallbackPhrase = '優先したい手続きがあれば1つだけ教えてください。';
  const responseHints = []
    .concat(Array.isArray(packet.recentAssistantCommitments) ? packet.recentAssistantCommitments : [])
    .concat(Array.isArray(packet.recentResponseHints) ? packet.recentResponseHints : [])
    .filter((item) => typeof item === 'string' && item.trim());
  const recentTwoResponseHints = responseHints.slice(0, 2);
  const maxHintSimilarity = responseHints.reduce((max, item) => {
    const score = similarityScore(normalizedReply, item);
    return Math.max(max, score);
  }, 0);
  const maxRecentTwoSimilarity = recentTwoResponseHints.reduce((max, item) => {
    const score = similarityScore(normalizedReply, item);
    return Math.max(max, score);
  }, 0);
  const defaultPhraseSimilarity = similarityScore(normalizedReply, fallbackPhrase);
  const isCasualCandidate = current.kind === 'casual_candidate';
  const shouldBreak = (
    isCasualCandidate
      && (
        packet.lowInformationMessage === true
        || packet.contextResume === true
        || defaultPhraseSimilarity >= 0.85
        || maxHintSimilarity >= 0.85
      )
  ) || maxRecentTwoSimilarity >= 0.9;

  if (!shouldBreak) {
    return {
      selected: current,
      loopBreakApplied: false,
      repetitionPrevented: false
    };
  }

  const fallbackCandidate = current.kind === 'domain_concierge_candidate' && Array.isArray(candidates)
    ? candidates.find((item) => item && item.kind === 'domain_concierge_candidate' && item.id !== current.id)
    : null;
  const switchedCandidate = clarifyCandidate || fallbackCandidate || current;
  return {
    selected: switchedCandidate,
    loopBreakApplied: switchedCandidate !== current,
    repetitionPrevented: true
  };
}

async function runPaidConversationOrchestrator(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const deps = payload.deps && typeof payload.deps === 'object' ? payload.deps : {};
  const recentActionRows = Array.isArray(payload.recentActionRows) ? payload.recentActionRows : [];
  const legalSnapshot = resolveLlmLegalPolicySnapshot({
    policy: payload.legalSnapshot && typeof payload.legalSnapshot === 'object' ? payload.legalSnapshot : null
  });
  const packet = buildConversationPacket(Object.assign({}, payload, {
    recentActionRows,
    legalSnapshot
  }));
  const strategyPlan = buildStrategyPlan(packet);
  strategyPlan.retrieveNeeded = judgeNeedRetrieval(packet, strategyPlan);
  const riskSnapshot = resolveIntentRiskTier({
    domainIntent: packet.normalizedConversationIntent
  });

  const candidateSet = await buildCandidateSet(packet, strategyPlan, deps);
  const groundedResult = candidateSet.groundedResult && typeof candidateSet.groundedResult === 'object'
    ? candidateSet.groundedResult
    : null;
  const sourceReadiness = computeSourceReadiness({
    intentRiskTier: riskSnapshot.intentRiskTier,
    candidates: groundedResult && Array.isArray(groundedResult.citations)
      ? groundedResult.citations.map((sourceId) => ({ sourceId }))
      : [],
    retrievalQuality: candidateSet.retrievalQuality,
    retrieveNeeded: strategyPlan.retrieveNeeded === true,
    evidenceCoverage: groundedResult && groundedResult.assistantQuality
      ? groundedResult.assistantQuality.evidenceCoverage
      : 0
  });
  const readinessSourceAuthorityScore = strategyPlan.retrieveNeeded === true
    ? sourceReadiness.sourceAuthorityScore
    : 1;
  const readinessSourceFreshnessScore = strategyPlan.retrieveNeeded === true
    ? sourceReadiness.sourceFreshnessScore
    : 1;
  const readinessSourceDecision = strategyPlan.retrieveNeeded === true
    ? sourceReadiness.sourceReadinessDecision
    : 'allow';
  const readinessSourceReasons = strategyPlan.retrieveNeeded === true
    ? sourceReadiness.reasonCodes
    : ['no_retrieval_strategy'];
  const readinessOfficialOnlySatisfied = strategyPlan.retrieveNeeded === true
    ? sourceReadiness.officialOnlySatisfied === true
    : true;
  const evidenceSufficiency = judgeEvidenceSufficiency({
    strategy: strategyPlan.strategy,
    retrieveNeeded: strategyPlan.retrieveNeeded,
    retrievalQuality: candidateSet.retrievalQuality,
    blockedReason: candidateSet.groundedResult && candidateSet.groundedResult.blockedReason
  });
  const effectiveEvidenceSufficiency = sourceReadiness.sourceReadinessDecision === 'refuse'
    ? 'refuse'
    : (sourceReadiness.sourceReadinessDecision === 'clarify' ? 'clarify' : evidenceSufficiency);
  const judged = judgeCandidates({
    packet,
    strategy: strategyPlan.strategy,
    candidates: candidateSet.candidates
  });
  const loopResolved = resolveLoopSafeCandidate(packet, judged.selected, candidateSet.candidates);
  const verified = verifyCandidate({
    packet,
    selected: loopResolved.selected,
    evidenceSufficiency: effectiveEvidenceSufficiency
  });
  const evidenceCoverage = groundedResult && groundedResult.assistantQuality
    ? Number(groundedResult.assistantQuality.evidenceCoverage) || 0
    : 0;
  const unsupportedClaimCount = (Array.isArray(verified.contradictionFlags) ? verified.contradictionFlags : [])
    .filter((item) => typeof item === 'string' && item.toLowerCase().includes('unsupported'))
    .length;
  const readinessEvidenceCoverage = strategyPlan.retrieveNeeded === true ? evidenceCoverage : 1;
  const readinessResult = evaluateAnswerReadiness({
    lawfulBasis: legalSnapshot.lawfulBasis,
    consentVerified: legalSnapshot.consentVerified,
    crossBorder: legalSnapshot.crossBorder,
    legalDecision: legalSnapshot.legalDecision,
    intentRiskTier: riskSnapshot.intentRiskTier,
    sourceAuthorityScore: readinessSourceAuthorityScore,
    sourceFreshnessScore: readinessSourceFreshnessScore,
    sourceReadinessDecision: readinessSourceDecision,
    officialOnlySatisfied: readinessOfficialOnlySatisfied,
    unsupportedClaimCount,
    contradictionDetected: Array.isArray(verified.contradictionFlags) && verified.contradictionFlags.length > 0,
    evidenceCoverage: readinessEvidenceCoverage,
    fallbackType: groundedResult && groundedResult.ok !== true && groundedResult.blockedReason
      ? groundedResult.blockedReason
      : null
  });
  const finalized = finalizeCandidate({
    selected: verified.selected,
    verificationOutcome: verified.verificationOutcome,
    contradictionFlags: verified.contradictionFlags,
    readinessDecision: readinessResult.decision,
    readinessSafeResponseMode: readinessResult.safeResponseMode,
    fallbackText: '状況を整理しながら進めます。優先する手続きを1つ決めましょう。'
  });

  const selected = verified.selected && typeof verified.selected === 'object' ? verified.selected : {};
  const assistantQuality = groundedResult && groundedResult.assistantQuality
    ? groundedResult.assistantQuality
    : {
        intentResolved: packet.paidIntent,
        kbTopScore: 0,
        evidenceCoverage: 0,
        blockedStage: null,
        fallbackReason: null
      };
  const blockedReason = groundedResult && groundedResult.ok !== true && groundedResult.blockedReason
    ? groundedResult.blockedReason
    : null;

  return {
    ok: true,
    handled: true,
    packet,
    strategyPlan,
    replyText: finalized.replyText,
    blockedReason,
    assistantQuality,
    conversationMode: strategyPlan.conversationMode,
    routerReason: packet.routerReason,
    opportunityDecision: packet.opportunityDecision,
    domainIntent: packet.normalizedConversationIntent || 'general',
    conciergeMeta: selected.conciergeMeta || null,
    model: groundedResult ? groundedResult.model || null : null,
    tokensIn: groundedResult ? groundedResult.tokensIn || 0 : 0,
    tokensOut: groundedResult ? groundedResult.tokensOut || 0 : 0,
    telemetry: {
      strategy: strategyPlan.strategy,
      retrieveNeeded: strategyPlan.retrieveNeeded === true,
      retrievalQuality: candidateSet.retrievalQuality,
      orchestratorPathUsed: true,
      contextResumeDomain: packet.contextResumeDomain || null,
      loopBreakApplied: loopResolved.loopBreakApplied === true,
      followupIntent: packet.followupIntent || null,
      conciseModeApplied: selected && selected.conciseModeApplied === true,
      repetitionPrevented: loopResolved.repetitionPrevented === true,
      sourceAuthorityScore: readinessSourceAuthorityScore,
      sourceFreshnessScore: readinessSourceFreshnessScore,
      sourceReadinessDecision: readinessSourceDecision,
      sourceReadinessReasons: readinessSourceReasons,
      officialOnlySatisfied: readinessOfficialOnlySatisfied,
      readinessDecision: readinessResult.decision,
      readinessReasonCodes: readinessResult.reasonCodes,
      readinessSafeResponseMode: readinessResult.safeResponseMode,
      unsupportedClaimCount,
      contradictionDetected: Array.isArray(verified.contradictionFlags) && verified.contradictionFlags.length > 0,
      answerReadinessLogOnly: false,
      judgeWinner: judged.judgeWinner,
      judgeScores: judged.judgeScores,
      verificationOutcome: finalized.finalMeta.verificationOutcome,
      contradictionFlags: finalized.finalMeta.contradictionFlags,
      candidateCount: Array.isArray(candidateSet.candidates) ? candidateSet.candidates.length : 0,
      committedNextActions: finalized.finalMeta.committedNextActions,
      committedFollowupQuestion: finalized.finalMeta.committedFollowupQuestion
    },
    finalMeta: finalized.finalMeta,
    legalSnapshot
  };
}

module.exports = {
  runPaidConversationOrchestrator
};
