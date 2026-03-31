'use strict';

const { buildConversationPacket } = require('./buildConversationPacket');
const { buildStrategyPlan } = require('./strategyPlanner');
const {
  resolveRetrievalDecision,
  judgeNeedRetrieval,
  judgeRetrievalQuality,
  judgeEvidenceSufficiency
} = require('./retrievalController');
const { judgeCandidates } = require('./judgeCandidates');
const {
  resolveCandidatePriority,
  isDirectAnswerEligibleCandidate,
  resolveFallbackPriorityReason
} = require('./candidatePriority');
const { verifyCandidate } = require('./verifyCandidate');
const { finalizeCandidate } = require('./finalizeCandidate');
const { resolveLlmLegalPolicySnapshot } = require('../policy/resolveLlmLegalPolicySnapshot');
const { resolveIntentRiskTier } = require('../policy/resolveIntentRiskTier');
const { evaluateParentYamlRoutingInvariant } = require('../policy/parentYamlRoutingContract');
const { evaluateRequiredCoreFactsGate } = require('../policy/evaluateRequiredCoreFactsGate');
const { computeSourceReadiness } = require('../knowledge/computeSourceReadiness');
const { buildRuntimeKnowledgeCandidates } = require('../knowledge/buildRuntimeKnowledgeCandidates');
const { runAnswerReadinessGateV2 } = require('../quality/runAnswerReadinessGateV2');
const { resolveJourneyActionSignals } = require('../quality/resolveJourneyActionSignals');
const { resolveRuntimeCityPackSignals } = require('../quality/resolveRuntimeCityPackSignals');
const { resolveRuntimeEmergencySignals } = require('../quality/resolveRuntimeEmergencySignals');
const { createResponseQualityContext } = require('../quality/responseQualityFoundation');
const { enforceActionGateway } = require('../../../v1/action_gateway/actionGateway');
const { resolveActionClass } = require('../../../v1/policy_graph/resolveActionClass');

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

function uniqueReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 12);
}

function resolveActionClassForOrchestrator(packet, strategyPlan, payload) {
  const explicit = normalizeText(payload.actionClassOverride);
  if (explicit) return resolveActionClass(explicit);
  const strategy = normalizeText(strategyPlan && strategyPlan.strategy).toLowerCase();
  const domainIntent = normalizeText(packet && packet.normalizedConversationIntent).toLowerCase();
  if (strategy === 'recommendation') return 'draft';
  if (strategy === 'domain_concierge' || strategy === 'concierge') {
    if (domainIntent === 'ssn' || domainIntent === 'banking') return 'lookup';
    return 'draft';
  }
  return 'lookup';
}

function resolveActionToolName(actionClass, payload) {
  const explicit = normalizeText(payload.actionToolName).toLowerCase();
  if (explicit) return explicit;
  if (actionClass === 'assist') return 'assist';
  if (actionClass === 'human_only') return 'human_only';
  if (actionClass === 'draft') return 'draft';
  return 'lookup';
}

function applyActionGatewayToReadiness(readiness, gatewayDecision, enabled) {
  const base = readiness && typeof readiness === 'object'
    ? readiness
    : {
      decision: 'allow',
      reasonCodes: [],
      safeResponseMode: 'answer',
      qualitySnapshot: {}
    };
  if (enabled !== true) return base;
  if (!gatewayDecision || gatewayDecision.allowed === true) return base;
  const reasonCodes = uniqueReasonCodes([].concat(base.reasonCodes || [], gatewayDecision.reason || []));
  if (gatewayDecision.decision === 'clarify') {
    return Object.assign({}, base, {
      decision: 'clarify',
      safeResponseMode: 'clarify',
      reasonCodes
    });
  }
  return Object.assign({}, base, {
    decision: 'refuse',
    safeResponseMode: 'refuse',
    reasonCodes
  });
}

function applyCoreFactsGateToReadiness(readiness, gate) {
  const base = readiness && typeof readiness === 'object'
    ? readiness
    : {
      decision: 'allow',
      reasonCodes: [],
      safeResponseMode: 'answer',
      qualitySnapshot: {}
    };
  const coreFactsGate = gate && typeof gate === 'object' ? gate : null;
  if (!coreFactsGate || coreFactsGate.decision !== 'clarify') return base;
  const reasonCodes = uniqueReasonCodes([]
    .concat(base.reasonCodes || [])
    .concat(coreFactsGate.reasonCodes || [])
    .concat('missing_required_core_facts'));
  return Object.assign({}, base, {
    decision: 'clarify',
    safeResponseMode: 'clarify',
    reasonCodes
  });
}

function shouldPreserveDirectAnswerFlow(packet, strategyPlan, selected) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const plan = strategyPlan && typeof strategyPlan === 'object' ? strategyPlan : {};
  const candidate = selected && typeof selected === 'object' ? selected : {};
  const domainIntent = normalizeText(payload.normalizedConversationIntent).toLowerCase();
  const requestShape = normalizeText(payload.requestShape).toLowerCase();
  const answerability = normalizeText(payload.answerability || (payload.requestContract && payload.requestContract.answerability)).toLowerCase();
  const knowledgeScope = normalizeText(payload.knowledgeScope).toLowerCase() || 'none';
  const genericFallbackSlice = normalizeText(payload.genericFallbackSlice).toLowerCase();
  const strategy = normalizeText(plan.strategy).toLowerCase();
  const fallbackType = normalizeText(plan.fallbackType).toLowerCase();
  const selectedKind = normalizeText(candidate.kind).toLowerCase();
  const detailObligations = Array.isArray(payload.detailObligations)
    ? payload.detailObligations.map((item) => normalizeText(item).toLowerCase()).filter(Boolean)
    : [];
  const requestShapeDirectAnswer = ['compare', 'correction', 'rewrite', 'summarize', 'message_template', 'criteria', 'followup_continue'].includes(requestShape)
    && (selectedKind === 'domain_concierge_candidate' || selectedKind === 'continuation_candidate' || selectedKind === 'structured_answer_candidate');
  const generalDirectAnswer = domainIntent === 'general'
    && (strategy === 'domain_concierge' || strategy === 'concierge')
    && (
      normalizeText(payload.followupIntent).toLowerCase() === 'next_step'
      || fallbackType === 'general_followup_direct_answer'
      || fallbackType === 'service_plan_direct_answer'
    )
    && (selectedKind === 'continuation_candidate' || selectedKind === 'domain_concierge_candidate');
  const utilityTransformDirectAnswer = fallbackType === 'utility_transform_direct_answer'
    && strategy === 'domain_concierge'
    && (selectedKind === 'domain_concierge_candidate' || selectedKind === 'continuation_candidate');
  const mixedDomainDirectAnswer = fallbackType === 'mixed_domain_direct_answer'
    && strategy === 'domain_concierge'
    && (selectedKind === 'domain_concierge_candidate' || selectedKind === 'continuation_candidate');
  const broadKickoffDirectAnswer = domainIntent === 'general'
    && requestShape === 'answer'
    && knowledgeScope === 'general'
    && genericFallbackSlice === 'broad'
    && strategy === 'grounded_answer'
    && [
      'domain_concierge_candidate',
      'grounded_candidate',
      'structured_answer_candidate',
      'knowledge_backed_candidate',
      'saved_faq_candidate',
      'housing_knowledge_candidate'
    ].includes(selectedKind);
  const schoolLowFrictionDirectAnswer = domainIntent === 'school'
    && requestShape === 'answer'
    && answerability === 'answer_now'
    && detailObligations.includes('avoid_question_back')
    && selectedKind === 'domain_concierge_candidate';
  return requestShapeDirectAnswer === true
    || generalDirectAnswer === true
    || utilityTransformDirectAnswer === true
    || mixedDomainDirectAnswer === true
    || broadKickoffDirectAnswer === true
    || schoolLowFrictionDirectAnswer === true;
}

function resolveMixedDomainCanonicalReply(replyText, packet, strategyPlan) {
  const original = normalizeText(replyText);
  if (!original) return original;
  const payload = packet && typeof packet === 'object' ? packet : {};
  const plan = strategyPlan && typeof strategyPlan === 'object' ? strategyPlan : {};
  const fallbackType = normalizeText(plan.fallbackType).toLowerCase();
  const messageText = normalizeText(payload.messageText);
  if (fallbackType !== 'mixed_domain_direct_answer' || !messageText) return original;
  const hasHousingSignal = /(引っ越し|引越し|住まい|住居|部屋|賃貸|housing|move|moving)/i.test(messageText);
  const hasSchoolSignal = /(学校|学区|入学|転校|school|district)/i.test(messageText);
  const hasOrderingCue = /(何から|順番|確認|不安|手続き)/i.test(messageText);
  if (!(hasHousingSignal && hasSchoolSignal && hasOrderingCue)) return original;
  if (/(学区|学校)/.test(original) && /(住むエリア|住居|住まい)/.test(original)) return original;
  return [
    '順番は、住むエリアと学区の関係を先に確認することです。',
    '次に、住所証明など共通で使う書類をまとめます。',
    'そのうえで、住居候補と学校候補を同じエリア軸で絞り込みましょう。'
  ].join('\n');
}

function enforceMixedDomainSelectedCandidate(selected, packet, strategyPlan) {
  const current = selected && typeof selected === 'object' ? selected : null;
  if (!current) return current;
  const canonicalReply = resolveMixedDomainCanonicalReply(current.replyText, packet, strategyPlan);
  if (!canonicalReply || canonicalReply === normalizeText(current.replyText)) return current;
  return Object.assign({}, current, {
    replyText: canonicalReply,
    preserveReplyText: true,
    atoms: Object.assign({}, current.atoms || {}, {
      situationLine: canonicalReply.split('\n')[0] || canonicalReply,
      nextActions: [],
      pitfall: '',
      followupQuestion: ''
    })
  });
}

function enforceMixedDomainFinalReply(replyText, packet, strategyPlan) {
  return resolveMixedDomainCanonicalReply(replyText, packet, strategyPlan);
}

function preserveDirectAnswerReadiness(readiness, packet, strategyPlan, selected) {
  const base = readiness && typeof readiness === 'object'
    ? readiness
    : {
      decision: 'allow',
      reasonCodes: [],
      safeResponseMode: 'answer',
      qualitySnapshot: {}
    };
  if (shouldPreserveDirectAnswerFlow(packet, strategyPlan, selected) !== true || base.decision !== 'clarify') return base;
  return Object.assign({}, base, {
    decision: 'allow',
    safeResponseMode: 'answer',
    reasonCodes: uniqueReasonCodes([].concat(base.reasonCodes || [], 'direct_answer_preserved'))
  });
}

function resolveReadinessClarifyText(selected, requiredCoreFacts) {
  const coreFactsClarify = normalizeText(requiredCoreFacts && requiredCoreFacts.clarifyText);
  if (coreFactsClarify) return coreFactsClarify;
  const selectedReply = normalizeText(selected && selected.replyText);
  if (selectedReply) return selectedReply;
  return 'まず対象手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。';
}

function createEmptyKnowledgeCandidateCountBySource() {
  return {
    faq: 0,
    savedFaq: 0,
    cityPack: 0,
    sourceRefs: 0,
    webSearch: 0
  };
}

function incrementKnowledgeCount(target, key, amount) {
  if (!target || !Object.prototype.hasOwnProperty.call(target, key)) return;
  const numeric = Number(amount);
  if (!Number.isFinite(numeric) || numeric <= 0) return;
  target[key] += Math.floor(numeric);
}

function extractAuditMeta(result) {
  if (result && result.auditMeta && typeof result.auditMeta === 'object') return result.auditMeta;
  if (result && result.conciergeMeta && typeof result.conciergeMeta === 'object') return result.conciergeMeta;
  if (result && result.raw && result.raw.auditMeta && typeof result.raw.auditMeta === 'object') return result.raw.auditMeta;
  return null;
}

function accumulateKnowledgeCandidateCounts(target, row) {
  const payload = row && typeof row === 'object' ? row : {};
  const auditMeta = extractAuditMeta(payload);
  const citations = Array.isArray(payload.citations)
    ? payload.citations
    : (payload.raw && Array.isArray(payload.raw.citations) ? payload.raw.citations : []);
  incrementKnowledgeCount(target, 'faq', citations.length);

  const sourceSnapshotRefs = auditMeta && Array.isArray(auditMeta.sourceSnapshotRefs)
    ? auditMeta.sourceSnapshotRefs
    : [];
  incrementKnowledgeCount(target, 'sourceRefs', sourceSnapshotRefs.length);

  const selectedUrls = auditMeta && Array.isArray(auditMeta.urls) ? auditMeta.urls : [];
  selectedUrls.forEach((item) => {
    const source = normalizeText(item && item.source).toLowerCase();
    if (source.includes('city_pack')) incrementKnowledgeCount(target, 'cityPack', 1);
    else if (source.includes('web')) incrementKnowledgeCount(target, 'webSearch', 1);
    else if (source.includes('stored') || source.includes('source_ref')) incrementKnowledgeCount(target, 'sourceRefs', 1);
  });

  const cityPackGrounded = payload.cityPackGrounded === true
    || (auditMeta && auditMeta.cityPackGrounded === true)
    || (auditMeta && auditMeta.cityPackContext === true)
    || (auditMeta && typeof auditMeta.cityPackPackId === 'string' && auditMeta.cityPackPackId.trim());
  if (cityPackGrounded) incrementKnowledgeCount(target, 'cityPack', 1);

  const savedFaqReused = payload.savedFaqReused === true
    || (auditMeta && auditMeta.savedFaqReused === true);
  if (savedFaqReused) incrementKnowledgeCount(target, 'savedFaq', 1);
}

function buildKnowledgeCandidateCountBySource(candidateSet) {
  const counts = createEmptyKnowledgeCandidateCountBySource();
  const payload = candidateSet && typeof candidateSet === 'object' ? candidateSet : {};
  if (payload.groundedResult && typeof payload.groundedResult === 'object') {
    accumulateKnowledgeCandidateCounts(counts, payload.groundedResult);
  }
  (Array.isArray(payload.candidates) ? payload.candidates : []).forEach((candidate) => {
    accumulateKnowledgeCandidateCounts(counts, candidate);
  });
  return counts;
}

function hasKnowledgeUsage(row) {
  const payload = row && typeof row === 'object' ? row : {};
  const auditMeta = extractAuditMeta(payload);
  const citations = Array.isArray(payload.citations)
    ? payload.citations
    : (payload.raw && Array.isArray(payload.raw.citations) ? payload.raw.citations : []);
  const sourceSnapshotRefs = auditMeta && Array.isArray(auditMeta.sourceSnapshotRefs)
    ? auditMeta.sourceSnapshotRefs
    : [];
  const selectedUrls = auditMeta && Array.isArray(auditMeta.urls) ? auditMeta.urls : [];
  return citations.length > 0 || sourceSnapshotRefs.length > 0 || selectedUrls.length > 0;
}

function buildKnowledgeUsageMeta(selected) {
  const payload = selected && typeof selected === 'object' ? selected : {};
  const auditMeta = extractAuditMeta(payload);
  return {
    knowledgeCandidateUsed: hasKnowledgeUsage(payload),
    cityPackUsedInAnswer: payload.cityPackGrounded === true
      || (auditMeta && (auditMeta.cityPackGrounded === true || auditMeta.cityPackContext === true)),
    savedFaqUsedInAnswer: payload.savedFaqReused === true
      || (auditMeta && auditMeta.savedFaqReused === true)
  };
}

function createEmptyKnowledgeTelemetry() {
  return {
    knowledgeCandidateRejectedReason: null,
    knowledgeRejectedReasons: [],
    cityPackCandidateAvailable: false,
    cityPackRejectedReason: null,
    savedFaqCandidateAvailable: false,
    savedFaqRejectedReason: null,
    sourceReadinessDecisionSource: null,
    knowledgeGroundingKind: null
  };
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
  const auditMeta = extractAuditMeta(result);
  const cityPackGrounded = Boolean(
    auditMeta
    && (
      auditMeta.cityPackGrounded === true
      || auditMeta.cityPackContext === true
      || (typeof auditMeta.cityPackPackId === 'string' && auditMeta.cityPackPackId.trim())
    )
  );
  const genericFallbackSlice = normalizeText(packet && packet.genericFallbackSlice).toLowerCase();
  const candidateKind = genericFallbackSlice === 'city'
    ? (cityPackGrounded ? 'city_pack_backed_candidate' : 'city_grounded_candidate')
    : 'grounded_candidate';
  return {
    id: candidateKind,
    kind: candidateKind,
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

function buildStructuredCandidate(result, retrievalQuality, packet) {
  if (!result || result.ok !== true) return null;
  const output = result.output && typeof result.output === 'object' ? result.output : {};
  const lines = [];
  const situation = normalizeText(output.situation);
  if (situation) lines.push(situation);
  const nextActions = Array.isArray(output.nextActions)
    ? output.nextActions.map((item) => normalizeText(item)).filter(Boolean).slice(0, 2)
    : [];
  if (nextActions.length > 0) {
    lines.push(`まずは ${nextActions.join('、')} を進めると詰まりにくいです。`);
  }
  const gap = Array.isArray(output.gaps)
    ? normalizeText(output.gaps[0])
    : '';
  if (gap) lines.push(gap);
  const replyText = lines.length > 0 ? lines.join('\n') : normalizeText(result.replyText);
  if (!replyText) return null;
  return {
    id: 'structured_answer_candidate',
    kind: 'structured_answer_candidate',
    replyText,
    domainIntent: packet.normalizedConversationIntent || 'general',
    retrievalQuality,
    assistantQuality: result.assistantQuality || null,
    model: result.model || null,
    tokensIn: Number.isFinite(Number(result.tokensIn)) ? Number(result.tokensIn) : 0,
    tokensOut: Number.isFinite(Number(result.tokensOut)) ? Number(result.tokensOut) : 0,
    raw: result,
    atoms: {
      situationLine: situation || replyText,
      nextActions,
      pitfall: Array.isArray(output.risks) ? (normalizeText(output.risks[0]) || '') : '',
      followupQuestion: gap || ''
    }
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
    raw: result,
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
    directAnswerCandidate: (
      (typeof result.followupIntent === 'string' && result.followupIntent.trim().length > 0)
      || result.preserveReplyText === true
    ),
    conciseModeApplied: result.conciseModeApplied === true,
    preserveReplyText: result.preserveReplyText === true,
    raw: result,
    atoms: result.atoms && typeof result.atoms === 'object' ? result.atoms : {}
  };
}

function buildContinuationCandidate(result, packet) {
  const domainCandidate = buildDomainCandidate(result, packet);
  if (!domainCandidate) return null;
  return Object.assign({}, domainCandidate, {
    id: 'continuation_candidate',
    kind: 'continuation_candidate',
    directAnswerCandidate: true
  });
}

function shouldBuildContinuationCandidate(packet, strategyPlan) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const plan = strategyPlan && typeof strategyPlan === 'object' ? strategyPlan : {};
  const continuationContext = payload.priorContextUsed === true
    || payload.followupResolvedFromHistory === true
    || payload.contextResume === true;
  return (
    continuationContext
    || (Boolean(payload.followupIntent) && continuationContext)
    || normalizeText(plan.fallbackType).toLowerCase() === 'followup_grounding_probe'
    || normalizeText(plan.fallbackType).toLowerCase() === 'general_followup_direct_answer'
    || normalizeText(plan.fallbackType).toLowerCase() === 'utility_transform_direct_answer'
    || normalizeText(plan.fallbackType).toLowerCase() === 'service_plan_direct_answer'
  );
}

async function buildCandidateSet(packet, strategyPlan, deps, options) {
  const candidates = [];
  const strategy = strategyPlan.strategy;
  let groundedResult = null;
  let retrievalQuality = 'none';
  let domainResult = null;
  let knowledgeTelemetry = createEmptyKnowledgeTelemetry();
  const config = options && typeof options === 'object' ? options : {};
  const candidateSet = Array.isArray(strategyPlan.candidateSet) ? strategyPlan.candidateSet : [];
  const wantsDomainFallback = candidateSet.includes('domain_concierge_candidate');
  const wantsClarify = candidateSet.includes('clarify_candidate');
  const continuationPreferred = shouldBuildContinuationCandidate(packet, strategyPlan);

  const pushUniqueCandidate = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return;
    if (candidates.some((item) => item && item.kind === candidate.kind)) return;
    candidates.push(candidate);
  };

  const ensureDomainResult = async () => {
    if (domainResult) return domainResult;
    if (typeof deps.generateDomainConciergeCandidate !== 'function') return null;
    domainResult = await deps.generateDomainConciergeCandidate({
      domainIntent: packet.normalizedConversationIntent || 'general',
      messageText: packet.messageText,
      contextSnapshot: packet.contextSnapshot,
      contextResumeDomain: packet.contextResumeDomain || null,
      opportunityDecision: packet.opportunityDecision,
      followupIntent: packet.followupIntent,
      recentFollowupIntents: packet.recentFollowupIntents,
      recentResponseHints: packet.recentResponseHints,
      requestContract: packet.requestContract,
      recoverySignal: packet.recoverySignal === true,
      blockedReason: groundedResult && groundedResult.blockedReason ? groundedResult.blockedReason : null
    });
    return domainResult;
  };

  if (strategy === 'casual') {
    const casualReply = await deps.generatePaidCasualReply({
      messageText: packet.messageText,
      contextHint: packet.contextResumeDomain || packet.normalizedConversationIntent,
      followupIntent: packet.followupIntent,
      recentResponseHints: packet.recentResponseHints,
      requestContract: packet.requestContract,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
    candidates.push(buildCasualCandidate(casualReply, packet));
    if (packet.intentDecision && packet.intentDecision.reason !== 'greeting_detected') {
      candidates.push(buildClarifyCandidate(packet, strategy));
    }
    return { candidates, groundedResult, retrievalQuality, knowledgeTelemetry };
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
    const structuredCandidate = buildStructuredCandidate(groundedResult, retrievalQuality, packet);
    pushUniqueCandidate(groundedCandidate);
    pushUniqueCandidate(structuredCandidate);

    if (groundedCandidate && packet.llmFlags.llmConciergeEnabled && typeof deps.composeConciergeCandidate === 'function') {
      const composed = await deps.composeConciergeCandidate({
        groundedResult,
        packet
      });
      const composedCandidate = buildComposedCandidate(composed, packet);
      pushUniqueCandidate(composedCandidate);
    }
  }

  const runtimeKnowledge = await buildRuntimeKnowledgeCandidates({
    packet,
    locale: config.locale || 'ja',
    intentRiskTier: config.intentRiskTier || 'low'
  }, deps);
  knowledgeTelemetry = runtimeKnowledge && runtimeKnowledge.telemetry
    ? Object.assign(createEmptyKnowledgeTelemetry(), runtimeKnowledge.telemetry)
    : createEmptyKnowledgeTelemetry();
  (Array.isArray(runtimeKnowledge && runtimeKnowledge.candidates) ? runtimeKnowledge.candidates : [])
    .forEach((candidate) => pushUniqueCandidate(candidate));

  if (strategy === 'domain_concierge' || strategy === 'concierge' || wantsDomainFallback || continuationPreferred) {
    const currentDomainResult = await ensureDomainResult();
    const continuationCandidate = continuationPreferred
      ? buildContinuationCandidate(currentDomainResult, packet)
      : null;
    const domainCandidate = buildDomainCandidate(currentDomainResult, packet);
    pushUniqueCandidate(continuationCandidate);
    if (strategy === 'domain_concierge' || strategy === 'concierge' || wantsDomainFallback) {
      pushUniqueCandidate(domainCandidate);
    }
  }

  if (strategy === 'domain_concierge' || strategy === 'concierge') {
    if (wantsClarify || candidates.length === 0) appendClarifyCandidates(candidates, packet, strategy);
    return { candidates, groundedResult, retrievalQuality, knowledgeTelemetry };
  }

  if (strategy === 'clarify') {
    const casualReply = await deps.generatePaidCasualReply({
      messageText: packet.messageText,
      contextHint: packet.contextResumeDomain || packet.normalizedConversationIntent,
      followupIntent: packet.followupIntent,
      recentResponseHints: packet.recentResponseHints,
      requestContract: packet.requestContract,
      suggestedAtoms: { nextActions: [], pitfall: null, question: null }
    });
    pushUniqueCandidate(buildCasualCandidate(casualReply, packet));
  }

  if (strategy === 'clarify' || strategy === 'grounded_answer' || strategy === 'recommendation' || wantsClarify) {
    appendClarifyCandidates(candidates, packet, strategy);
  }

  if (!candidates.length) {
    const fallbackDomain = await deps.generateDomainConciergeCandidate({
      domainIntent: packet.normalizedConversationIntent || 'general',
      messageText: packet.messageText,
      contextSnapshot: packet.contextSnapshot,
      contextResumeDomain: packet.contextResumeDomain || null,
      opportunityDecision: packet.opportunityDecision,
      followupIntent: packet.followupIntent,
      recentFollowupIntents: packet.recentFollowupIntents,
      recentResponseHints: packet.recentResponseHints,
      requestContract: packet.requestContract,
      recoverySignal: packet.recoverySignal === true,
      blockedReason: groundedResult && groundedResult.blockedReason ? groundedResult.blockedReason : null
    });
    const fallbackCandidate = buildDomainCandidate(fallbackDomain, packet);
    pushUniqueCandidate(fallbackCandidate);
  }

  return { candidates, groundedResult, retrievalQuality, knowledgeTelemetry };
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

function buildCandidateVerificationQueue(primaryCandidate, rankedCandidates) {
  const queue = [];
  const pushUnique = (candidate) => {
    if (!candidate || typeof candidate !== 'object') return;
    const key = `${normalizeText(candidate.id)}:${normalizeText(candidate.kind)}:${normalizeText(candidate.replyText)}`;
    if (queue.some((item) => `${normalizeText(item.id)}:${normalizeText(item.kind)}:${normalizeText(item.replyText)}` === key)) {
      return;
    }
    queue.push(candidate);
  };
  pushUnique(primaryCandidate);
  (Array.isArray(rankedCandidates) ? rankedCandidates : []).forEach((candidate) => pushUnique(candidate));
  return queue;
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
  const retrievalDecision = resolveRetrievalDecision(packet, strategyPlan);
  strategyPlan.retrieveNeeded = retrievalDecision.retrieveNeeded === true;
  const riskSnapshot = resolveIntentRiskTier({
    domainIntent: packet.normalizedConversationIntent
  });
  const parentRouting = evaluateParentYamlRoutingInvariant({
    domainIntent: packet.normalizedConversationIntent,
    followupIntent: packet.followupIntent,
    routerMode: packet.routerMode,
    strategy: strategyPlan.strategy,
    contextSnapshot: packet.contextSnapshot,
    intentRiskTier: riskSnapshot.intentRiskTier
  });
  const actionClass = resolveActionClassForOrchestrator(packet, strategyPlan, payload);

  const candidateSet = await buildCandidateSet(packet, strategyPlan, deps, {
    intentRiskTier: riskSnapshot.intentRiskTier,
    locale: 'ja'
  });
  const groundedResult = candidateSet.groundedResult && typeof candidateSet.groundedResult === 'object'
    ? candidateSet.groundedResult
    : null;
  const baseSourceReadiness = computeSourceReadiness({
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
  const evidenceSufficiency = judgeEvidenceSufficiency({
    strategy: strategyPlan.strategy,
    retrieveNeeded: strategyPlan.retrieveNeeded,
    retrievalQuality: candidateSet.retrievalQuality,
    blockedReason: candidateSet.groundedResult && candidateSet.groundedResult.blockedReason
  });
  const judged = judgeCandidates({
    packet,
    strategy: strategyPlan.strategy,
    candidates: candidateSet.candidates
  });
  const groundedCandidateAvailable = candidateSet.candidates.some((item) => {
    const kind = normalizeText(item && item.kind).toLowerCase();
    return kind === 'grounded_candidate' || kind === 'city_grounded_candidate' || kind === 'city_pack_backed_candidate';
  });
  const structuredCandidateAvailable = candidateSet.candidates.some((item) => normalizeText(item && item.kind).toLowerCase() === 'structured_answer_candidate');
  const continuationCandidateAvailable = candidateSet.candidates.some((item) => normalizeText(item && item.kind).toLowerCase() === 'continuation_candidate');
  let selectedCandidate = judged.selected;
  let selectedByDirectAnswerFirst = false;
  if (strategyPlan.directAnswerFirst === true) {
    const directAnswerCandidates = Array.isArray(candidateSet.candidates)
      ? candidateSet.candidates
        .filter((item) => isDirectAnswerEligibleCandidate(packet, item))
        .sort((left, right) => resolveCandidatePriority(packet, right) - resolveCandidatePriority(packet, left))
      : [];
    const preferredDirectCandidate = directAnswerCandidates[0] || null;
    const selectedPriority = resolveCandidatePriority(packet, selectedCandidate);
    const preferredPriority = resolveCandidatePriority(packet, preferredDirectCandidate);
    const selectedIsDirect = isDirectAnswerEligibleCandidate(packet, selectedCandidate);
    if (preferredDirectCandidate && (!selectedIsDirect || preferredPriority >= selectedPriority)) {
      selectedCandidate = preferredDirectCandidate;
      selectedByDirectAnswerFirst = true;
    }
  }
  const loopResolved = resolveLoopSafeCandidate(packet, selectedCandidate, candidateSet.candidates);
  const selectedForReadiness = loopResolved.selected && typeof loopResolved.selected === 'object'
    ? loopResolved.selected
    : null;
  const selectedHasKnowledgeReadiness = Boolean(
    selectedForReadiness
    && typeof selectedForReadiness.sourceReadinessDecision === 'string'
    && normalizeText(selectedForReadiness.knowledgeGroundingKind)
  );
  const selectedKnowledgeGroundingKind = selectedHasKnowledgeReadiness
    ? normalizeText(selectedForReadiness.knowledgeGroundingKind).toLowerCase()
    : (normalizeText(candidateSet.knowledgeTelemetry && candidateSet.knowledgeTelemetry.knowledgeGroundingKind).toLowerCase() || null);
  const readinessSourceAuthorityScore = selectedHasKnowledgeReadiness
    ? Number(selectedForReadiness.sourceAuthorityScore || 0)
    : (strategyPlan.retrieveNeeded === true ? baseSourceReadiness.sourceAuthorityScore : 1);
  const readinessSourceFreshnessScore = selectedHasKnowledgeReadiness
    ? Number(selectedForReadiness.sourceFreshnessScore || 0)
    : (strategyPlan.retrieveNeeded === true ? baseSourceReadiness.sourceFreshnessScore : 1);
  const readinessSourceDecision = selectedHasKnowledgeReadiness
    ? selectedForReadiness.sourceReadinessDecision
    : (strategyPlan.retrieveNeeded === true ? baseSourceReadiness.sourceReadinessDecision : 'allow');
  const readinessSourceReasons = selectedHasKnowledgeReadiness
    ? uniqueReasonCodes([]
      .concat(selectedForReadiness.raw && selectedForReadiness.raw.auditMeta && Array.isArray(selectedForReadiness.raw.auditMeta.sourceReadinessReasons)
        ? selectedForReadiness.raw.auditMeta.sourceReadinessReasons
        : []))
    : (strategyPlan.retrieveNeeded === true ? baseSourceReadiness.reasonCodes : ['no_retrieval_strategy']);
  const readinessOfficialOnlySatisfied = selectedHasKnowledgeReadiness
    ? selectedForReadiness.officialOnlySatisfied === true
    : (strategyPlan.retrieveNeeded === true ? baseSourceReadiness.officialOnlySatisfied === true : true);
  const sourceReadinessDecisionSource = selectedHasKnowledgeReadiness
    ? 'selected_knowledge_candidate'
    : (strategyPlan.retrieveNeeded === true ? 'grounded_retrieval_citations' : 'strategy_no_retrieval_default');
  const knowledgeCanAnswer = selectedHasKnowledgeReadiness
    && readinessSourceDecision === 'allow'
    && (riskSnapshot.intentRiskTier !== 'high' || readinessOfficialOnlySatisfied === true);
  let effectiveEvidenceSufficiency = readinessSourceDecision === 'refuse'
    ? 'refuse'
    : (readinessSourceDecision === 'clarify' ? 'clarify' : evidenceSufficiency);
  if (knowledgeCanAnswer && (effectiveEvidenceSufficiency === 'clarify' || effectiveEvidenceSufficiency === 'answer_with_hedge')) {
    effectiveEvidenceSufficiency = selectedForReadiness.retrievalQuality === 'good' ? 'answer' : 'answer_with_hedge';
  }
  if (
    shouldPreserveDirectAnswerFlow(packet, strategyPlan, loopResolved.selected)
    && effectiveEvidenceSufficiency === 'clarify'
  ) {
    effectiveEvidenceSufficiency = 'answer';
  }
  const verificationQueue = buildCandidateVerificationQueue(loopResolved.selected, judged.rankedCandidates);
  let verified = null;
  for (const candidate of verificationQueue) {
    const attempt = verifyCandidate({
      packet,
      selected: candidate,
      evidenceSufficiency: effectiveEvidenceSufficiency,
      knowledgeTelemetry: candidateSet.knowledgeTelemetry || null
    });
    if (!attempt || typeof attempt !== 'object') continue;
    verified = attempt;
    if (!Array.isArray(attempt.blockingViolationCodes) || attempt.blockingViolationCodes.length === 0) break;
  }
  if (!verified) {
    verified = verifyCandidate({
      packet,
      selected: null,
      evidenceSufficiency: effectiveEvidenceSufficiency,
      knowledgeTelemetry: candidateSet.knowledgeTelemetry || null
    });
  }
  const evidenceCoverage = selectedHasKnowledgeReadiness && Number.isFinite(Number(selectedForReadiness.evidenceCoverage))
    ? Number(selectedForReadiness.evidenceCoverage)
    : (groundedResult && groundedResult.assistantQuality
      ? Number(groundedResult.assistantQuality.evidenceCoverage) || 0
      : 0);
  const unsupportedClaimCount = (Array.isArray(verified.contradictionFlags) ? verified.contradictionFlags : [])
    .filter((item) => typeof item === 'string' && item.toLowerCase().includes('unsupported'))
    .length;
  const readinessEvidenceCoverage = strategyPlan.retrieveNeeded === true || selectedHasKnowledgeReadiness === true
    ? evidenceCoverage
    : 1;
  const requiredCoreFacts = evaluateRequiredCoreFactsGate({
    contextSnapshot: packet.contextSnapshot,
    domainIntent: packet.normalizedConversationIntent,
    intentRiskTier: riskSnapshot.intentRiskTier,
    strategy: strategyPlan.strategy,
    actionClass,
    followupIntent: packet.followupIntent
  });
  const journeySignals = resolveJourneyActionSignals({
    contextSnapshot: packet.contextSnapshot,
    journeyPhase: packet.contextSnapshot && (packet.contextSnapshot.phase || packet.contextSnapshot.journeyPhase)
      ? String(packet.contextSnapshot.phase || packet.contextSnapshot.journeyPhase)
      : null,
    nextActions: verified.selected && verified.selected.atoms && Array.isArray(verified.selected.atoms.nextActions)
      ? verified.selected.atoms.nextActions
      : []
  });
  const [cityPackSignals, emergencySignals] = await Promise.all([
    resolveRuntimeCityPackSignals({
      lineUserId: packet.lineUserId,
      locale: 'ja',
      domainIntent: packet.normalizedConversationIntent,
      intentRiskTier: riskSnapshot.intentRiskTier
    }),
    resolveRuntimeEmergencySignals({
      lineUserId: packet.lineUserId,
      contextSnapshot: packet.contextSnapshot
    })
  ]);
  const responseQualityContext = createResponseQualityContext({
    entryType: 'orchestrator',
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
    requiredCoreFactsComplete: requiredCoreFacts.missingCount === 0,
    missingRequiredCoreFactsCount: requiredCoreFacts.missingCount,
    requiredCoreFactsMissing: requiredCoreFacts.missingFacts,
    requiredCoreFactsDecision: requiredCoreFacts.decision,
    requiredCoreFactsLogOnly: requiredCoreFacts.logOnly === true,
    fallbackType: groundedResult && groundedResult.ok !== true && groundedResult.blockedReason
      ? groundedResult.blockedReason
      : null,
    emergencyContext: emergencySignals.emergencyContext === true,
    emergencySeverity: emergencySignals.emergencySeverity || null,
    emergencyOfficialSourceSatisfied: emergencySignals.emergencyOfficialSourceSatisfied === true,
    emergencyOverrideApplied: emergencySignals.emergencyOverrideApplied === true,
    emergencyEventId: emergencySignals.emergencyEventId || null,
    emergencyRegionKey: emergencySignals.emergencyRegionKey || null,
    emergencySourceSnapshot: emergencySignals.emergencySourceSnapshot || null,
    journeyContext: journeySignals.journeyContext === true,
    journeyPhase: journeySignals.journeyPhase || null,
    contextSnapshot: packet.contextSnapshot || null,
    taskBlockerDetected: journeySignals.taskBlockerDetected === true,
    blockedTask: journeySignals.blockedTask || null,
    taskGraphState: journeySignals.taskGraphState || null,
    nextActionCandidates: journeySignals.nextActionCandidates,
    nextActions: journeySignals.nextActions,
    journeyAlignedAction: journeySignals.journeyAlignedAction !== false,
    cityPackContext: cityPackSignals.cityPackContext === true,
    cityPackGrounded: cityPackSignals.cityPackGrounded === true,
    cityPackGroundingReason: cityPackSignals.cityPackGroundingReason || null,
    cityPackFreshnessScore: cityPackSignals.cityPackFreshnessScore,
    cityPackAuthorityScore: cityPackSignals.cityPackAuthorityScore,
    cityPackRequiredSourcesSatisfied: cityPackSignals.cityPackRequiredSourcesSatisfied,
    cityPackSourceSnapshot: cityPackSignals.cityPackSourceSnapshot || null,
    cityPackPackId: cityPackSignals.cityPackPackId || null,
    requestedCityKey: cityPackSignals.requestedCityKey
      || (candidateSet.knowledgeTelemetry ? candidateSet.knowledgeTelemetry.requestedCityKey || null : null),
    matchedCityKey: cityPackSignals.matchedCityKey
      || (candidateSet.knowledgeTelemetry ? candidateSet.knowledgeTelemetry.matchedCityKey || null : null),
    citySpecificitySatisfied: cityPackSignals.citySpecificitySatisfied === true
      || (candidateSet.knowledgeTelemetry ? candidateSet.knowledgeTelemetry.citySpecificitySatisfied === true : false),
    citySpecificityReason: cityPackSignals.citySpecificityReason
      || (candidateSet.knowledgeTelemetry ? candidateSet.knowledgeTelemetry.citySpecificityReason || null : null),
    scopeDisclosureRequired: cityPackSignals.scopeDisclosureRequired === true,
    cityPackValidation: cityPackSignals.cityPackValidation,
    knowledgeScope: packet.knowledgeScope || 'general',
    requestShape: packet.requestContract && packet.requestContract.requestShape,
    outputForm: packet.requestContract && packet.requestContract.outputForm,
    transformSource: packet.requestContract && packet.requestContract.transformSource,
    savedFaqContext: false,
    crossSystemConflictDetected: false
  });
  const readinessGate = runAnswerReadinessGateV2({
    entryType: 'orchestrator',
    responseQualityContext
  });
  const readinessResult = readinessGate.readiness;
  const actionGatewayEnabled = payload.llmFlags && payload.llmFlags.actionGatewayEnabled === true;
  const actionToolName = resolveActionToolName(actionClass, payload);
  const actionGatewayDecision = enforceActionGateway({
    actionClass,
    toolName: actionToolName,
    confirmationToken: payload.confirmationToken
  });
  const withCoreFactsGate = applyCoreFactsGateToReadiness(readinessResult, requiredCoreFacts);
  const effectiveReadiness = applyActionGatewayToReadiness(withCoreFactsGate, actionGatewayDecision, actionGatewayEnabled);
  const preservedReadiness = preserveDirectAnswerReadiness(
    effectiveReadiness,
    packet,
    strategyPlan,
    verified.selected
  );
  const readinessClarifyText = preservedReadiness.decision === 'clarify'
    ? resolveReadinessClarifyText(verified.selected, requiredCoreFacts)
    : '';
  const finalizationCandidate = enforceMixedDomainSelectedCandidate(
    verified.selected,
    packet,
    strategyPlan
  );
  const finalized = finalizeCandidate({
    selected: finalizationCandidate,
    verificationOutcome: verified.verificationOutcome,
    contradictionFlags: verified.contradictionFlags,
    violationCodes: verified.violationCodes,
    requestContract: packet.requestContract,
    recentAssistantCommitments: packet.recentAssistantCommitments,
    repetitionPrevented: loopResolved.repetitionPrevented === true,
    readinessDecision: preservedReadiness.decision,
    readinessReasonCodes: preservedReadiness.reasonCodes,
    readinessSafeResponseMode: preservedReadiness.safeResponseMode,
    readinessClarifyText,
    fallbackText: '状況を整理しながら進めます。優先する手続きを1つ決めましょう。',
    responseQualityContext,
    readinessGate
  });
  const finalReplyText = enforceMixedDomainFinalReply(finalized.replyText, packet, strategyPlan);
  const retrievalBlockedByStrategy = retrievalDecision.retrievalBlockedByStrategy === true;
  const retrievalBlockReason = strategyPlan.retrieveNeeded === true
    ? null
    : (retrievalDecision.retrievalBlockReason || null);
  const knowledgeCandidateCountBySource = buildKnowledgeCandidateCountBySource(candidateSet);
  const fallbackPriorityReason = resolveFallbackPriorityReason(packet, loopResolved.selected, candidateSet.candidates);

  const selected = finalizationCandidate && typeof finalizationCandidate === 'object' ? finalizationCandidate : {};
  const knowledgeUsageMeta = buildKnowledgeUsageMeta(selected);
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
    : isConciseReplyText(finalReplyText);
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
    replyText: finalReplyText,
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
      strategyReason: strategyPlan.strategyReason || null,
      strategyAlternativeSet: Array.isArray(strategyPlan.strategyAlternativeSet)
        ? strategyPlan.strategyAlternativeSet.slice(0, 8)
        : [],
      strategyPriorityVersion: strategyPlan.strategyPriorityVersion || 'v2',
      fallbackPriorityReason,
      directAnswerApplied,
      requestShape: packet.requestShape || null,
      depthIntent: packet.depthIntent || null,
      transformSource: packet.transformSource || null,
      outputForm: packet.outputForm || null,
      knowledgeScope: packet.knowledgeScope || null,
      locationHintKind: packet.locationHint && typeof packet.locationHint.kind === 'string' ? packet.locationHint.kind : null,
      locationHintCityKey: packet.locationHint && typeof packet.locationHint.cityKey === 'string' ? packet.locationHint.cityKey : null,
      locationHintState: packet.locationHint && typeof packet.locationHint.state === 'string' ? packet.locationHint.state : null,
      locationHintRegionKey: packet.locationHint && typeof packet.locationHint.regionKey === 'string' ? packet.locationHint.regionKey : null,
      detailObligations: Array.isArray(packet.detailObligations) ? packet.detailObligations.slice(0, 8) : [],
      answerability: packet.answerability || null,
      echoOfPriorAssistant: packet.echoOfPriorAssistant === true,
      selectedCandidateKind: finalized.finalMeta && finalized.finalMeta.candidateKind
        ? finalized.finalMeta.candidateKind
        : null,
      selectedByDirectAnswerFirst,
      clarifySuppressed,
      recoverySignal: packet.recoverySignal === true,
      recoveryFollowupIntent: packet.recoveryFollowupIntent || null,
      followupIntentReason: packet.followupIntentReason || null,
      followupCarryFromHistory: packet.followupCarryFromHistory === true,
      followupResolvedFromHistory: packet.followupResolvedFromHistory === true,
      retrieveNeeded: strategyPlan.retrieveNeeded === true,
      retrievalBlockedByStrategy,
      retrievalBlockReason,
      retrievalPermitReason: retrievalDecision.retrievalPermitReason || null,
      retrievalReenabledBySlice: retrievalDecision.retrievalReenabledBySlice || null,
      retrievalQuality: candidateSet.retrievalQuality,
      groundedCandidateAvailable,
      structuredCandidateAvailable,
      continuationCandidateAvailable,
      orchestratorPathUsed: true,
      contextResumeDomain: packet.contextResumeDomain || null,
      priorContextUsed: packet.priorContextUsed === true,
      continuationReason: packet.continuationReason || null,
      genericFallbackSlice: packet.genericFallbackSlice || 'other',
      contextCarryScore: Number.isFinite(Number(packet.contextCarryScore)) ? Number(packet.contextCarryScore) : 0,
      loopBreakApplied: loopResolved.loopBreakApplied === true,
      repeatRiskScore: Number.isFinite(Number(loopResolved.repeatRiskScore)) ? Number(loopResolved.repeatRiskScore) : 0,
      followupIntent: followupIntent || null,
      conciseModeApplied,
      repetitionPrevented: loopResolved.repetitionPrevented === true,
      fallbackTemplateKind: finalized.finalMeta ? finalized.finalMeta.fallbackTemplateKind || null : null,
      finalizerTemplateKind: finalized.finalMeta ? finalized.finalMeta.finalizerTemplateKind || null : null,
      replyTemplateFingerprint: finalized.finalMeta ? finalized.finalMeta.replyTemplateFingerprint || null : null,
      knowledgeCandidateCountBySource,
      knowledgeCandidateUsed: knowledgeUsageMeta.knowledgeCandidateUsed === true,
      knowledgeCandidateRejectedReason: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.knowledgeCandidateRejectedReason || null
        : null,
      knowledgeRejectedReasons: candidateSet.knowledgeTelemetry
        ? (Array.isArray(candidateSet.knowledgeTelemetry.knowledgeRejectedReasons)
          ? candidateSet.knowledgeTelemetry.knowledgeRejectedReasons.slice(0, 8)
          : [])
        : [],
      cityPackCandidateAvailable: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.cityPackCandidateAvailable === true
        : false,
      requestedCityKey: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.requestedCityKey || null
        : (packet.locationHint && packet.locationHint.cityKey ? packet.locationHint.cityKey : null),
      matchedCityKey: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.matchedCityKey || null
        : null,
      citySpecificitySatisfied: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.citySpecificitySatisfied === true
        : false,
      citySpecificityReason: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.citySpecificityReason || null
        : null,
      cityPackRejectedReason: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.cityPackRejectedReason || null
        : null,
      cityPackUsedInAnswer: knowledgeUsageMeta.cityPackUsedInAnswer === true,
      savedFaqCandidateAvailable: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.savedFaqCandidateAvailable === true
        : false,
      savedFaqRejectedReason: candidateSet.knowledgeTelemetry
        ? candidateSet.knowledgeTelemetry.savedFaqRejectedReason || null
        : null,
      savedFaqUsedInAnswer: knowledgeUsageMeta.savedFaqUsedInAnswer === true,
      sourceReadinessDecisionSource,
      knowledgeGroundingKind: selectedKnowledgeGroundingKind,
      sourceAuthorityScore: readinessSourceAuthorityScore,
      sourceFreshnessScore: readinessSourceFreshnessScore,
      sourceReadinessDecision: readinessSourceDecision,
      sourceReadinessReasons: readinessSourceReasons,
      misunderstandingRecovered,
      officialOnlySatisfied: readinessOfficialOnlySatisfied,
      readinessDecision: preservedReadiness.decision,
      readinessReasonCodes: preservedReadiness.reasonCodes,
      readinessSafeResponseMode: preservedReadiness.safeResponseMode,
      answerReadinessVersion: readinessGate.answerReadinessVersion,
      answerReadinessLogOnlyV2: readinessGate.answerReadinessLogOnlyV2 === true,
      answerReadinessEnforcedV2: readinessGate.answerReadinessEnforcedV2 === true,
      answerReadinessV2Mode: readinessGate.mode ? readinessGate.mode.mode : null,
      answerReadinessV2Stage: readinessGate.mode ? readinessGate.mode.stage : null,
      answerReadinessV2EnforcementReason: readinessGate.mode ? readinessGate.mode.enforcementReason : null,
      readinessDecisionV2: readinessGate.readinessV2.decision,
      readinessReasonCodesV2: readinessGate.readinessV2.reasonCodes,
      readinessSafeResponseModeV2: readinessGate.readinessV2.safeResponseMode,
      unsupportedClaimCount,
      contradictionDetected: Array.isArray(verified.contradictionFlags) && verified.contradictionFlags.length > 0,
      answerReadinessLogOnly: false,
      emergencyContextActive: readinessGate.telemetry.emergencyContextActive === true,
      emergencyOverrideApplied: readinessGate.telemetry.emergencyOverrideApplied === true,
      emergencyEventId: readinessGate.telemetry.emergencyEventId || null,
      emergencyRegionKey: readinessGate.telemetry.emergencyRegionKey || null,
      emergencySourceSnapshot: readinessGate.telemetry.emergencySourceSnapshot || null,
      emergencyOfficialSourceSatisfied: readinessGate.telemetry.emergencyOfficialSourceSatisfied === true,
      journeyPhase: readinessGate.telemetry.journeyPhase || null,
      taskBlockerDetected: readinessGate.telemetry.taskBlockerDetected === true,
      blockedTask: readinessGate.telemetry.blockedTask || null,
      taskGraphState: readinessGate.telemetry.taskGraphState || null,
      nextActionCandidates: Array.isArray(readinessGate.telemetry.nextActionCandidates)
        ? readinessGate.telemetry.nextActionCandidates
        : [],
      nextActions: Array.isArray(readinessGate.telemetry.nextActions)
        ? readinessGate.telemetry.nextActions
        : [],
      journeyAlignedAction: typeof readinessGate.telemetry.journeyAlignedAction === 'boolean'
        ? readinessGate.telemetry.journeyAlignedAction
        : true,
      cityPackGrounded: readinessGate.telemetry.cityPackGrounded === true,
      cityPackGroundingReason: readinessGate.telemetry.cityPackGroundingReason || null,
      cityPackFreshnessScore: readinessGate.telemetry.cityPackFreshnessScore,
      cityPackAuthorityScore: readinessGate.telemetry.cityPackAuthorityScore,
      cityPackRequiredSourcesSatisfied: typeof readinessGate.telemetry.cityPackRequiredSourcesSatisfied === 'boolean'
        ? readinessGate.telemetry.cityPackRequiredSourcesSatisfied
        : null,
      scopeDisclosureRequired: readinessGate.telemetry.scopeDisclosureRequired === true,
      cityPackSourceSnapshot: readinessGate.telemetry.cityPackSourceSnapshot || null,
      cityPackPackId: readinessGate.telemetry.cityPackPackId || null,
      cityPackValidation: readinessGate.telemetry.cityPackValidation || null,
      savedFaqReused: readinessGate.telemetry.savedFaqReused === true,
      savedFaqReusePass: readinessGate.telemetry.savedFaqReusePass === true,
      savedFaqValid: readinessGate.telemetry.savedFaqValid === true,
      savedFaqAllowedIntent: readinessGate.telemetry.savedFaqAllowedIntent === true,
      savedFaqAuthorityScore: readinessGate.telemetry.savedFaqAuthorityScore,
      crossSystemConflictDetected: readinessGate.telemetry.crossSystemConflictDetected === true,
      actionClass,
      actionGatewayEnabled,
      actionGatewayEnforced: actionGatewayEnabled,
      actionGatewayAllowed: actionGatewayEnabled ? actionGatewayDecision.allowed === true : true,
      actionGatewayDecision: actionGatewayEnabled ? actionGatewayDecision.decision : 'bypass',
      actionGatewayReason: actionGatewayEnabled ? actionGatewayDecision.reason : 'action_gateway_disabled',
      parentIntentType: parentRouting.intentType,
      parentAnswerMode: parentRouting.answerMode,
      parentLifecycleStage: parentRouting.lifecycleStage,
      parentChapter: parentRouting.chapter,
      parentRoutingInvariantStatus: parentRouting.invariantStatus,
      parentRoutingInvariantErrors: parentRouting.invariantErrors,
      requiredCoreFactsComplete: requiredCoreFacts.missingCount === 0,
      missingRequiredCoreFacts: requiredCoreFacts.missingFacts,
      missingRequiredCoreFactsCount: requiredCoreFacts.missingCount,
      requiredCoreFactsCriticalMissingCount: requiredCoreFacts.criticalMissingCount,
      requiredCoreFactsGateDecision: requiredCoreFacts.decision,
      requiredCoreFactsGateLogOnly: requiredCoreFacts.logOnly === true,
      judgeWinner: judged.judgeWinner,
      judgeScores: judged.judgeScores,
      verificationOutcome: finalized.finalMeta.verificationOutcome,
      contradictionFlags: finalized.finalMeta.contradictionFlags,
      violationCodes: Array.isArray(finalized.finalMeta.violationCodes) ? finalized.finalMeta.violationCodes : [],
      candidateCount: Array.isArray(candidateSet.candidates) ? candidateSet.candidates.length : 0,
      committedNextActions: finalized.finalMeta.committedNextActions,
      committedFollowupQuestion: finalized.finalMeta.committedFollowupQuestion
    },
    finalMeta: finalized.finalMeta,
    legalSnapshot,
    actionClass,
    actionGateway: {
      enabled: actionGatewayEnabled,
      decision: actionGatewayEnabled ? actionGatewayDecision.decision : 'bypass',
      reason: actionGatewayEnabled ? actionGatewayDecision.reason : 'action_gateway_disabled',
      allowed: actionGatewayEnabled ? actionGatewayDecision.allowed === true : true
    }
  };
}

module.exports = {
  runPaidConversationOrchestrator
};
