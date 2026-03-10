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

function isConciseReplyText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return false;
  const lines = normalized.split('\n').map((line) => line.trim()).filter(Boolean);
  if (!lines.length || lines.length > 3) return false;
  return normalized.length <= 180;
}

const DOMAIN_CLARIFY_VARIANTS = Object.freeze({
  school: [
    '学校手続きを進めるため、学年か希望エリアを1つ教えてください。',
    '学校の次の一手を絞るので、対象校の地域か学年を先に決めましょう。'
  ],
  ssn: [
    'SSN手続きを進めるため、在留ステータスを1つ教えてください。',
    'SSNの次の一手を確定したいので、最寄り窓口の地域を教えてください。'
  ],
  housing: [
    '住まい探しを進めるため、希望エリアか入居時期を1つ教えてください。',
    '住まい探しの次の一手に絞るので、予算帯かエリアを先に決めましょう。'
  ],
  banking: [
    '口座手続きを進めるため、使いたい銀行か用途を1つ教えてください。',
    '口座開設の次の一手を絞るので、口座種別か来店地域を先に決めましょう。'
  ],
  general: [
    '対象を絞って案内したいので、いま一番気になっている手続きと期限を1つずつ教えてください。',
    'まず優先手続きを1つに絞りたいので、対象手続きと期限を1つずつ教えてください。'
  ]
});

function buildClarifyCandidate(packet, strategy, options) {
  const domainIntent = normalizeText(packet.normalizedConversationIntent).toLowerCase();
  const followupIntent = normalizeText(packet.followupIntent).toLowerCase();
  const hasFollowupIntent = followupIntent === 'docs_required' || followupIntent === 'appointment_needed' || followupIntent === 'next_step';
  const variant = options && options.variant === 'alt' ? 'alt' : 'default';
  const candidateId = variant === 'alt' ? 'clarify_candidate_alt' : 'clarify_candidate';
  const responseHints = []
    .concat(Array.isArray(packet.recentAssistantCommitments) ? packet.recentAssistantCommitments : [])
    .concat(Array.isArray(packet.recentResponseHints) ? packet.recentResponseHints : [])
    .filter((item) => typeof item === 'string' && item.trim());
  const pickLeastRepeatedVariant = (variants) => {
    const rows = Array.isArray(variants) ? variants.filter(Boolean) : [];
    if (!rows.length) return '';
    const scored = rows.map((line, index) => ({
      index,
      line,
      similarity: responseHints.reduce((max, hint) => Math.max(max, similarityScore(line, hint)), 0)
    }));
    scored.sort((left, right) => left.similarity - right.similarity || left.index - right.index);
    if (variant === 'alt' && scored.length > 1) return scored[Math.min(1, scored.length - 1)].line;
    return scored[0].line;
  };
  if (packet.recoverySignal === true) {
    const recoveryDirectByIntent = {
      docs_required: {
        school: '了解です。学校手続きは住所証明と予防接種記録を先にそろえると止まりにくいです。',
        ssn: '了解です。SSNは本人確認書類と在留資格の書類を先にそろえるのが最優先です。',
        housing: '了解です。住まい探しは本人確認と収入確認の書類を先に固めると進みます。',
        banking: '了解です。口座手続きは本人確認と住所証明を先にそろえるのが近道です。',
        general: '了解です。必要書類は最優先手続きに必要なものから先に整理すると進みます。'
      },
      appointment_needed: {
        school: '了解です。学校手続きは対象校ごとに予約制が異なるため、対象校を1つ決めて先に確認しましょう。',
        ssn: '了解です。SSNは地域で予約要否が異なるため、最寄り窓口の予約可否を先に確認しましょう。',
        housing: '了解です。住まい探しは内見予約が必要な物件が多いので、候補を絞って確認しましょう。',
        banking: '了解です。口座手続きは支店で予約要否が異なるので、来店地域を決めて確認しましょう。',
        general: '了解です。予約要否は窓口ごとに異なるため、対象窓口を1つ決めて確認しましょう。'
      },
      next_step: {
        school: '了解です。学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。',
        ssn: '了解です。SSNの次は、必要書類を1つの一覧にまとめて窓口要件を確認するのが最短です。',
        housing: '了解です。住まい探しの次は、候補を3件まで絞って内見順を決めるのが最短です。',
        banking: '了解です。口座手続きの次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。',
        general: '了解です。次は、最優先手続きを1つ決めて期限を確認するのが最短です。'
      }
    };
    if (hasFollowupIntent) {
      const intentMap = recoveryDirectByIntent[followupIntent] || recoveryDirectByIntent.next_step;
      const directReply = intentMap[domainIntent] || intentMap.general;
      return {
        id: candidateId,
        kind: 'clarify_candidate',
        replyText: directReply,
        domainIntent,
        followupIntent,
        directAnswerCandidate: true,
        retrievalQuality: 'none',
        conciergeMeta: null,
        atoms: {
          situationLine: directReply,
          nextActions: [],
          pitfall: '',
          followupQuestion: ''
        }
      };
    }
    const recoveryByDomain = {
      school: '了解です。学校手続き前提で組み直します。必要書類か予約要否のどちらから確認しますか？',
      ssn: '了解です。SSN前提で整理し直します。必要書類か予約要否のどちらから確認しますか？',
      housing: '了解です。住まい探し前提で整理し直します。必要書類か次の一手のどちらから確認しますか？',
      banking: '了解です。口座手続き前提で整理し直します。必要書類か予約要否のどちらから確認しますか？',
      general: '了解です。前提を合わせ直します。対象手続きを1つ教えてください。'
    };
    const recoveryReply = recoveryByDomain[domainIntent] || recoveryByDomain.general;
    return {
      id: candidateId,
      kind: 'clarify_candidate',
      replyText: recoveryReply,
      domainIntent,
      followupIntent: hasFollowupIntent ? followupIntent : null,
      directAnswerCandidate: false,
      retrievalQuality: 'none',
      conciergeMeta: null,
      atoms: {
        situationLine: recoveryReply,
        nextActions: [],
        pitfall: '',
        followupQuestion: ''
      }
    };
  }
  if (hasFollowupIntent && domainIntent !== 'general') {
    const byIntent = {
      docs_required: {
        school: '学校手続きでは、対象学年と住所エリアが分かると必要書類を即絞れます。',
        ssn: 'SSN手続きでは、在留ステータスが分かると必要書類を即確定できます。',
        housing: '住まい探しでは、希望エリアが分かると必要書類の優先度を絞れます。',
        banking: '口座手続きでは、口座用途が分かると必要書類の案内を絞れます。',
        general: '必要書類を確定したいので、対象手続きと対象者を1つずつ教えてください。'
      },
      appointment_needed: {
        school: '学校手続きは予約制の窓口があるので、対象校の地域が分かると予約要否を確定できます。',
        ssn: 'SSN窓口は地域差があるので、最寄り地域が分かると予約要否を確定できます。',
        housing: '住まい探しは内見予約が必要な場合があるので、希望エリアが分かると確認できます。',
        banking: '口座手続きは支店ごとに異なるため、利用予定の地域が分かると予約要否を確定できます。',
        general: '予約要否を確定したいので、窓口名か地域を1つ教えてください。'
      },
      next_step: {
        school: '学校手続きの次は、対象校を1校に絞って書類不足を先に潰すのが最短です。',
        ssn: 'SSNの次は、必要書類を1つにまとめて窓口要件を確認するのが最短です。',
        housing: '住まい探しの次は、候補物件を3件まで絞って内見順を決めるのが最短です。',
        banking: '口座手続きの次は、口座種別を1つ決めて書類を先に確定するのが最短です。',
        general: '次の一手を絞るため、期限が近い手続きを1つだけ教えてください。'
      }
    };
    const intentMap = byIntent[followupIntent] || byIntent.next_step;
    const followupReply = intentMap[domainIntent] || intentMap.general;
    return {
      id: candidateId,
      kind: 'clarify_candidate',
      replyText: followupReply,
      domainIntent,
      followupIntent,
      directAnswerCandidate: true,
      retrievalQuality: 'none',
      atoms: {
        situationLine: '状況を把握しました。',
        nextActions: [],
        pitfall: '',
        followupQuestion: followupReply
      }
    };
  }
  const replyText = strategy === 'recommendation'
    ? (variant === 'alt'
      ? 'おすすめ先を絞るため、優先条件を1つだけ教えてください。'
      : 'おすすめ先を絞りたいので、希望エリアと優先条件を1つずつ教えてください。')
    : pickLeastRepeatedVariant(
      DOMAIN_CLARIFY_VARIANTS[domainIntent] || DOMAIN_CLARIFY_VARIANTS.general
    );
  return {
    id: candidateId,
    kind: 'clarify_candidate',
    replyText,
    domainIntent: domainIntent || 'general',
    followupIntent: hasFollowupIntent ? followupIntent : null,
    directAnswerCandidate: false,
    retrievalQuality: 'none',
    atoms: {
      situationLine: '対象を絞って案内します。',
      nextActions: [],
      pitfall: '',
      followupQuestion: replyText
    }
  };
}

function appendClarifyCandidates(target, packet, strategy) {
  const rows = Array.isArray(target) ? target : [];
  const primary = buildClarifyCandidate(packet, strategy, { variant: 'default' });
  rows.push(primary);
  const alternate = buildClarifyCandidate(packet, strategy, { variant: 'alt' });
  if (alternate && normalizeForSimilarity(alternate.replyText) !== normalizeForSimilarity(primary.replyText)) {
    rows.push(alternate);
  }
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
    directAnswerCandidate: typeof result.followupIntent === 'string' && result.followupIntent.trim().length > 0,
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
      followupIntent: packet.followupIntent,
      recentResponseHints: packet.recentResponseHints,
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
      contextResumeDomain: packet.contextResumeDomain || null,
      opportunityDecision: packet.opportunityDecision,
      followupIntent: packet.followupIntent,
      recentFollowupIntents: packet.recentFollowupIntents,
      recentResponseHints: packet.recentResponseHints,
      recoverySignal: packet.recoverySignal === true,
      blockedReason: null
    });
    const domainCandidate = buildDomainCandidate(domainResult, packet);
    if (domainCandidate) candidates.push(domainCandidate);
    appendClarifyCandidates(candidates, packet, strategy);
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
      followupIntent: packet.followupIntent,
      recentResponseHints: packet.recentResponseHints,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
    candidates.push(buildCasualCandidate(casualReply, packet));
  }

  if (strategy === 'clarify' || strategy === 'grounded_answer' || strategy === 'recommendation') {
    appendClarifyCandidates(candidates, packet, strategy);
  }

  if (!candidates.length) {
    const fallbackDomain = await deps.generateDomainConciergeCandidate({
      domainIntent: 'general',
      messageText: packet.messageText,
      contextSnapshot: packet.contextSnapshot,
      contextResumeDomain: packet.contextResumeDomain || null,
      opportunityDecision: packet.opportunityDecision,
      followupIntent: packet.followupIntent,
      recentFollowupIntents: packet.recentFollowupIntents,
      recentResponseHints: packet.recentResponseHints,
      recoverySignal: packet.recoverySignal === true,
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
      loopBreakApplied: false,
      repeatRiskScore: 0
    };
  }
  const intentReason = packet && packet.intentDecision && typeof packet.intentDecision.reason === 'string'
    ? packet.intentDecision.reason
    : '';
  if (intentReason === 'greeting_detected' || intentReason === 'smalltalk_detected') {
    return {
      selected: current,
      loopBreakApplied: false,
      repeatRiskScore: 0
    };
  }
  const clarifyCandidate = Array.isArray(candidates)
    ? candidates.find((item) => item && item.kind === 'clarify_candidate')
    : null;
  if (!clarifyCandidate) {
    return {
      selected: current,
      loopBreakApplied: false,
      repetitionPrevented: false,
      repeatRiskScore: 0
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
  const repeatRiskScore = Math.max(defaultPhraseSimilarity, maxHintSimilarity, maxRecentTwoSimilarity);
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
      repetitionPrevented: false,
      repeatRiskScore
    };
  }

  const fallbackCandidate = current.kind === 'domain_concierge_candidate' && Array.isArray(candidates)
    ? candidates.find((item) => item && item.kind === 'domain_concierge_candidate' && item.id !== current.id)
    : null;
  const switchedCandidate = clarifyCandidate || fallbackCandidate || current;
  return {
    selected: switchedCandidate,
    loopBreakApplied: switchedCandidate !== current,
    repetitionPrevented: true,
    repeatRiskScore
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
  let selectedCandidate = judged.selected;
  if (strategyPlan.directAnswerFirst === true) {
    const directAnswerCandidate = Array.isArray(candidateSet.candidates)
      ? candidateSet.candidates.find((item) => item && item.kind === 'domain_concierge_candidate')
      : null;
    if (directAnswerCandidate) selectedCandidate = directAnswerCandidate;
  }
  const loopResolved = resolveLoopSafeCandidate(packet, selectedCandidate, candidateSet.candidates);
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

  const selectedKind = String(finalized.finalMeta && finalized.finalMeta.candidateKind ? finalized.finalMeta.candidateKind : '').toLowerCase();
  const followupIntent = typeof packet.followupIntent === 'string' ? packet.followupIntent : null;
  const selectedIsFollowupDomainAnswer = Boolean(
    followupIntent
    && selectedKind === 'domain_concierge_candidate'
  );
  const directAnswerApplied = selected.directAnswerCandidate === true
    || selectedIsFollowupDomainAnswer
    || (
      strategyPlan.directAnswerFirst === true
      && selectedKind !== 'clarify_candidate'
    );
  const clarifySuppressed = strategyPlan.clarifySuppressed === true
    || (Boolean(followupIntent) && selectedKind !== 'clarify_candidate');
  const conciseModeApplied = selected && selected.conciseModeApplied === true
    ? true
    : isConciseReplyText(finalized.replyText);
  const misunderstandingRecovered = packet.recoverySignal === true
    && (
      directAnswerApplied
      || clarifySuppressed
      || loopResolved.repetitionPrevented === true
      || packet.followupCarryFromHistory === true
    );

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
      directAnswerApplied,
      clarifySuppressed,
      recoverySignal: packet.recoverySignal === true,
      recoveryFollowupIntent: packet.recoveryFollowupIntent || null,
      followupIntentReason: packet.followupIntentReason || null,
      followupCarryFromHistory: packet.followupCarryFromHistory === true,
      retrieveNeeded: strategyPlan.retrieveNeeded === true,
      retrievalQuality: candidateSet.retrievalQuality,
      orchestratorPathUsed: true,
      contextResumeDomain: packet.contextResumeDomain || null,
      contextCarryScore: Number.isFinite(Number(packet.contextCarryScore)) ? Number(packet.contextCarryScore) : 0,
      loopBreakApplied: loopResolved.loopBreakApplied === true,
      repeatRiskScore: Number.isFinite(Number(loopResolved.repeatRiskScore)) ? Number(loopResolved.repeatRiskScore) : 0,
      followupIntent: followupIntent || null,
      conciseModeApplied,
      repetitionPrevented: loopResolved.repetitionPrevented === true,
      sourceAuthorityScore: readinessSourceAuthorityScore,
      sourceFreshnessScore: readinessSourceFreshnessScore,
      sourceReadinessDecision: readinessSourceDecision,
      sourceReadinessReasons: readinessSourceReasons,
      misunderstandingRecovered,
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
