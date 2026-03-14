'use strict';

const faqArticlesRepo = require('../../../repos/firestore/faqArticlesRepo');
const sourceRefsRepo = require('../../../repos/firestore/sourceRefsRepo');
const { searchFaqFromKb } = require('../../../usecases/faq/searchFaqFromKb');
const { buildKnowledgeReadinessCandidates } = require('../../../usecases/faq/buildKnowledgeReadinessCandidates');
const { refineSavedFaqReuseSignals } = require('../../../usecases/faq/refineSavedFaqReuseSignals');
const { computeSourceReadiness } = require('./computeSourceReadiness');
const { resolveCityIntentGrounding } = require('./resolveCityIntentGrounding');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeIntentToken(value) {
  return normalizeText(value).toUpperCase();
}

function uniqueStrings(values, limit) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 8);
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
    const date = value.toDate();
    if (date instanceof Date && Number.isFinite(date.getTime())) return date.getTime();
  }
  return null;
}

function matchesAllowedIntent(allowedIntents, intent) {
  const normalizedIntent = normalizeIntentToken(intent);
  const rows = Array.isArray(allowedIntents) ? allowedIntents : [];
  if (!rows.length) return true;
  const normalized = rows.map((item) => normalizeIntentToken(item)).filter(Boolean);
  if (!normalized.length) return true;
  if (!normalizedIntent) return normalized.includes('GENERAL') || normalized.includes('FAQ');
  return normalized.includes(normalizedIntent) || normalized.includes('GENERAL') || normalized.includes('FAQ');
}

function isValidUntilUsable(validUntil, nowMs) {
  if (!validUntil) return true;
  const parsed = toMillis(validUntil);
  if (!Number.isFinite(parsed)) return false;
  return parsed >= nowMs;
}

function extractSummary(text) {
  const normalized = normalizeText(text);
  if (!normalized) return '';
  const firstLine = normalized.split(/\n+/).map((item) => item.trim()).find(Boolean) || '';
  const sentence = firstLine.split(/(?<=[。.!?！？])/u).map((item) => item.trim()).find(Boolean) || firstLine;
  return sentence.slice(0, 180);
}

function resolveActionForSlice(slice) {
  const normalizedSlice = normalizeText(slice).toLowerCase();
  if (normalizedSlice === 'housing') return '・希望条件を2つまで固定する';
  if (normalizedSlice === 'city') return '・地域条件と初期費用を先に確認する';
  if (normalizedSlice === 'followup') return '・前の話題で未確定の条件を1つだけ埋める';
  return '・対象条件と期限を1つずつ整理する';
}

function resolveFollowupForSlice(slice) {
  const normalizedSlice = normalizeText(slice).toLowerCase();
  if (normalizedSlice === 'housing') return '入居時期か希望エリアは決まっていますか？';
  if (normalizedSlice === 'city') return '赴任先の都市か住むエリアは決まっていますか？';
  if (normalizedSlice === 'followup') return 'いま一番止まっている条件はどこですか？';
  return 'いま優先したい条件は何ですか？';
}

function buildReplyText(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const summary = normalizeText(payload.summary) || normalizeText(payload.title) || '関連情報をもとに整理します。';
  const action = resolveActionForSlice(payload.slice);
  const question = resolveFollowupForSlice(payload.slice);
  return [summary, action, question].filter(Boolean).join('\n');
}

function buildKnowledgeQuery(packet) {
  const payload = packet && typeof packet === 'object' ? packet : {};
  const parts = [normalizeText(payload.messageText)];
  if (payload.priorContextUsed === true) {
    parts.push(normalizeText(payload.contextResumeDomain));
    const commitment = Array.isArray(payload.recentAssistantCommitments) ? payload.recentAssistantCommitments[0] : '';
    const responseHint = Array.isArray(payload.recentResponseHints) ? payload.recentResponseHints[0] : '';
    parts.push(normalizeText(commitment));
    parts.push(normalizeText(responseHint));
  }
  if (payload.followupIntent) parts.push(normalizeText(payload.followupIntent).replace(/_/g, ' '));
  return parts.filter(Boolean).join(' ');
}

async function resolveFaqArticle(question, locale, deps) {
  const search = typeof deps.searchFaqFromKb === 'function' ? deps.searchFaqFromKb : searchFaqFromKb;
  const getArticle = typeof deps.getFaqArticle === 'function' ? deps.getFaqArticle : faqArticlesRepo.getArticle;
  const result = await search({
    question,
    locale,
    limit: 3,
    intent: 'FAQ'
  }).catch(() => ({ ok: true, candidates: [] }));
  const top = Array.isArray(result && result.candidates) ? result.candidates[0] : null;
  if (!top || !top.articleId) {
    return { article: null, searchResult: result, rejectReason: 'no_faq_match' };
  }
  const article = await getArticle(top.articleId).catch(() => null);
  if (!article || typeof article !== 'object') {
    return { article: null, searchResult: result, rejectReason: 'faq_article_missing' };
  }
  return {
    article: Object.assign({ id: top.articleId }, article),
    searchResult: result,
    rejectReason: null
  };
}

async function resolveCityPackSourceRefs(candidate, deps) {
  const getSourceRef = typeof deps.getSourceRef === 'function' ? deps.getSourceRef : sourceRefsRepo.getSourceRef;
  const refs = uniqueStrings(candidate && candidate.sourceRefs, 8);
  if (!refs.length) return [];
  const rows = await Promise.all(refs.map(async (sourceRefId) => {
    const sourceRef = await getSourceRef(sourceRefId).catch(() => null);
    if (!sourceRef || typeof sourceRef !== 'object') return null;
    return Object.assign({ id: sourceRefId }, sourceRef);
  }));
  return rows.filter(Boolean);
}

function buildSourceReadinessFromArticle(article, intentRiskTier) {
  const readinessCandidates = buildKnowledgeReadinessCandidates([article]);
  return computeSourceReadiness({
    intentRiskTier,
    candidates: readinessCandidates,
    retrievalQuality: readinessCandidates.length > 0 ? 'good' : 'bad',
    retrieveNeeded: true,
    evidenceCoverage: readinessCandidates.length > 0 ? 0.84 : 0
  });
}

function buildSourceReadinessFromCityPack(sourceRefs, intentRiskTier) {
  const candidates = (Array.isArray(sourceRefs) ? sourceRefs : []).map((item) => ({
    sourceType: item && item.sourceType ? item.sourceType : 'other',
    authorityLevel: item && item.authorityLevel ? item.authorityLevel : 'other',
    authorityTier: item && item.authorityTier ? item.authorityTier : null,
    bindingLevel: item && item.bindingLevel ? item.bindingLevel : null,
    validUntil: item && item.validUntil ? item.validUntil : null,
    status: item && item.status ? item.status : 'active',
    requiredLevel: item && item.requiredLevel ? item.requiredLevel : 'required',
    sourceSnapshotRefCount: 1,
    linkRegistryCount: 0
  }));
  return computeSourceReadiness({
    intentRiskTier,
    candidates,
    retrievalQuality: candidates.length > 0 ? 'good' : 'bad',
    retrieveNeeded: true,
    evidenceCoverage: candidates.length > 0 ? 0.82 : 0
  });
}

function buildSavedFaqSignals(article, intentRiskTier, sourceReadiness, nowMs, requestedIntent) {
  if (!article) {
    return {
      savedFaqReused: false,
      savedFaqReusePass: false,
      savedFaqReuseReasonCodes: ['no_saved_faq_candidate'],
      sourceSnapshotRefs: []
    };
  }
  const sourceSnapshotRefs = uniqueStrings([]
    .concat(Array.isArray(article.sourceSnapshotRefs) ? article.sourceSnapshotRefs : [])
    .concat(Array.isArray(article.linkRegistryIds) ? article.linkRegistryIds : []), 8);
  const reasonCodes = [];
  if (!matchesAllowedIntent(article.allowedIntents, requestedIntent)) {
    reasonCodes.push('saved_faq_intent_mismatch');
  }
  if (!isValidUntilUsable(article.validUntil, nowMs)) {
    reasonCodes.push('saved_faq_stale');
  }
  if (intentRiskTier === 'high' && sourceSnapshotRefs.length === 0) {
    reasonCodes.push('saved_faq_missing_official_source_refs');
  }
  return refineSavedFaqReuseSignals({
    savedFaqSignals: {
      savedFaqReused: true,
      savedFaqReusePass: reasonCodes.length === 0,
      savedFaqReuseReasonCodes: reasonCodes.length ? reasonCodes : ['saved_faq_reuse_ready'],
      sourceSnapshotRefs
    },
    sourceReadiness,
    intentRiskTier
  });
}

function buildKnowledgeCandidate(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const packet = payload.packet && typeof payload.packet === 'object' ? payload.packet : {};
  const kind = normalizeText(payload.kind) || 'knowledge_backed_candidate';
  const title = normalizeText(payload.title) || 'knowledge';
  const summary = normalizeText(payload.summary) || title;
  const sourceSnapshotRefs = uniqueStrings(payload.sourceSnapshotRefs, 8);
  const citations = uniqueStrings(payload.citations, 8);
  const sourceReadiness = payload.sourceReadiness && typeof payload.sourceReadiness === 'object'
    ? payload.sourceReadiness
    : {};
  const savedFaqSignals = payload.savedFaqSignals && typeof payload.savedFaqSignals === 'object'
    ? payload.savedFaqSignals
    : null;
  const cityPack = payload.cityPack && typeof payload.cityPack === 'object' ? payload.cityPack : null;
  const knowledgeGroundingKind = normalizeText(payload.knowledgeGroundingKind) || 'faq';
  const evidenceCoverage = Number.isFinite(Number(payload.evidenceCoverage))
    ? Number(payload.evidenceCoverage)
    : (kind === 'city_pack_backed_candidate' ? 0.82 : 0.84);
  return {
    id: kind,
    kind,
    replyText: buildReplyText({
      title,
      summary,
      slice: packet.genericFallbackSlice
    }),
    domainIntent: packet.normalizedConversationIntent || 'general',
    retrievalQuality: sourceReadiness.sourceReadinessDecision === 'allow' ? 'good' : 'mixed',
    directAnswerCandidate: packet.priorContextUsed === true,
    knowledgeGroundingKind,
    sourceReadinessDecision: sourceReadiness.sourceReadinessDecision || null,
    sourceAuthorityScore: sourceReadiness.sourceAuthorityScore,
    sourceFreshnessScore: sourceReadiness.sourceFreshnessScore,
    officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
    evidenceCoverage,
    citations,
    savedFaqReused: savedFaqSignals ? savedFaqSignals.savedFaqReused === true : false,
    savedFaqReusePass: savedFaqSignals ? savedFaqSignals.savedFaqReusePass === true : false,
    cityPackGrounded: cityPack ? true : false,
    raw: {
      citations,
      auditMeta: {
        evidenceOutcome: 'SUPPORTED',
        sourceSnapshotRefs,
        sourceAuthorityScore: sourceReadiness.sourceAuthorityScore,
        sourceFreshnessScore: sourceReadiness.sourceFreshnessScore,
        sourceReadinessDecision: sourceReadiness.sourceReadinessDecision || null,
        sourceReadinessReasons: Array.isArray(sourceReadiness.reasonCodes) ? sourceReadiness.reasonCodes : [],
        officialOnlySatisfied: sourceReadiness.officialOnlySatisfied === true,
        evidenceCoverage,
        cityPackContext: cityPack ? true : false,
        cityPackGrounded: cityPack ? true : false,
        cityPackGroundingReason: cityPack ? 'runtime_city_pack_candidate' : null,
        cityPackPackId: cityPack ? cityPack.sourceId : null,
        cityPackSourceSnapshot: cityPack ? { sourceRefIds: sourceSnapshotRefs } : null,
        savedFaqReused: savedFaqSignals ? savedFaqSignals.savedFaqReused === true : false,
        savedFaqReusePass: savedFaqSignals ? savedFaqSignals.savedFaqReusePass === true : false,
        savedFaqReuseReasonCodes: savedFaqSignals && Array.isArray(savedFaqSignals.savedFaqReuseReasonCodes)
          ? savedFaqSignals.savedFaqReuseReasonCodes
          : [],
        savedFaqValid: savedFaqSignals ? !savedFaqSignals.savedFaqReuseReasonCodes.includes('saved_faq_stale') : false,
        savedFaqAllowedIntent: savedFaqSignals ? !savedFaqSignals.savedFaqReuseReasonCodes.includes('saved_faq_intent_mismatch') : false,
        savedFaqAuthorityScore: sourceReadiness.sourceAuthorityScore
      }
    },
    atoms: {
      situationLine: summary,
      nextActions: [resolveActionForSlice(packet.genericFallbackSlice).replace(/^・\s*/, '')],
      pitfall: '',
      followupQuestion: resolveFollowupForSlice(packet.genericFallbackSlice)
    }
  };
}

async function buildRuntimeKnowledgeCandidates(params, deps) {
  const payload = params && typeof params === 'object' ? params : {};
  const packet = payload.packet && typeof payload.packet === 'object' ? payload.packet : {};
  const locale = normalizeText(payload.locale) || 'ja';
  const nowMs = Number.isFinite(Number(payload.nowMs)) ? Number(payload.nowMs) : Date.now();
  const intentRiskTier = normalizeText(payload.intentRiskTier).toLowerCase() || 'low';
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const knowledgeQuery = buildKnowledgeQuery(packet);
  const candidates = [];
  const telemetry = {
    knowledgeCandidateRejectedReason: null,
    cityPackCandidateAvailable: false,
    cityPackRejectedReason: null,
    savedFaqCandidateAvailable: false,
    savedFaqRejectedReason: null,
    sourceReadinessDecisionSource: 'runtime_knowledge_candidates',
    knowledgeGroundingKind: null
  };

  if (intentRiskTier === 'high') {
    telemetry.knowledgeCandidateRejectedReason = 'knowledge_runtime_disabled_high_risk';
    return { candidates, telemetry };
  }

  const faqResult = await resolveFaqArticle(knowledgeQuery, locale, resolvedDeps);
  if (!faqResult.article) {
    telemetry.knowledgeCandidateRejectedReason = faqResult.rejectReason || 'no_faq_match';
  } else {
    const faqReadiness = buildSourceReadinessFromArticle(faqResult.article, intentRiskTier);
    if (faqReadiness.sourceReadinessDecision !== 'allow') {
      telemetry.knowledgeCandidateRejectedReason = `faq_${faqReadiness.sourceReadinessDecision}`;
    } else {
      const summary = extractSummary(faqResult.article.body || faqResult.article.title);
      const faqCandidateKind = normalizeText(packet.genericFallbackSlice).toLowerCase() === 'housing'
        ? 'housing_knowledge_candidate'
        : 'knowledge_backed_candidate';
      candidates.push(buildKnowledgeCandidate({
        packet,
        kind: faqCandidateKind,
        title: faqResult.article.title || 'FAQ',
        summary,
        citations: [faqResult.article.id],
        sourceSnapshotRefs: []
          .concat(Array.isArray(faqResult.article.sourceSnapshotRefs) ? faqResult.article.sourceSnapshotRefs : [])
          .concat(Array.isArray(faqResult.article.linkRegistryIds) ? faqResult.article.linkRegistryIds : []),
        sourceReadiness: faqReadiness,
        knowledgeGroundingKind: 'faq'
      }));
      telemetry.knowledgeGroundingKind = telemetry.knowledgeGroundingKind || 'faq';
    }

    const savedFaqSignals = buildSavedFaqSignals(
      faqResult.article,
      intentRiskTier,
      faqReadiness,
      nowMs,
      packet.normalizedConversationIntent || packet.paidIntent || 'FAQ'
    );
    telemetry.savedFaqCandidateAvailable = savedFaqSignals.savedFaqReused === true;
    if (savedFaqSignals.savedFaqReusePass === true) {
      candidates.push(buildKnowledgeCandidate({
        packet,
        kind: 'saved_faq_candidate',
        title: faqResult.article.title || 'saved_faq',
        summary: extractSummary(faqResult.article.body || faqResult.article.title),
        citations: [faqResult.article.id],
        sourceSnapshotRefs: savedFaqSignals.sourceSnapshotRefs,
        sourceReadiness: faqReadiness,
        savedFaqSignals,
        knowledgeGroundingKind: 'saved_faq'
      }));
      telemetry.knowledgeGroundingKind = telemetry.knowledgeGroundingKind || 'saved_faq';
    } else if (telemetry.savedFaqRejectedReason === null) {
      telemetry.savedFaqRejectedReason = Array.isArray(savedFaqSignals.savedFaqReuseReasonCodes)
        ? savedFaqSignals.savedFaqReuseReasonCodes[0] || 'saved_faq_rejected'
        : 'saved_faq_rejected';
    }
  }

  const cityPackResult = await resolveCityIntentGrounding({
    lineUserId: packet.lineUserId,
    locale,
    messageText: packet.messageText,
    genericFallbackSlice: packet.genericFallbackSlice
  }, resolvedDeps);
  const topCityPack = Array.isArray(cityPackResult && cityPackResult.candidates) ? cityPackResult.candidates[0] : null;
  if (topCityPack) {
    telemetry.cityPackCandidateAvailable = true;
    const sourceRefs = await resolveCityPackSourceRefs(topCityPack, resolvedDeps);
    const cityPackReadiness = buildSourceReadinessFromCityPack(sourceRefs, intentRiskTier);
    if (cityPackReadiness.sourceReadinessDecision === 'allow') {
      candidates.push(buildKnowledgeCandidate({
        packet,
        kind: 'city_pack_backed_candidate',
        title: topCityPack.title || 'city_pack',
        summary: `${topCityPack.title || '地域パック'} の情報を優先して整理します。`,
        sourceSnapshotRefs: sourceRefs.map((item) => item.id),
        sourceReadiness: cityPackReadiness,
        cityPack: topCityPack,
        knowledgeGroundingKind: 'city_pack'
      }));
      telemetry.knowledgeGroundingKind = 'city_pack';
    } else if (telemetry.cityPackRejectedReason === null) {
      telemetry.cityPackRejectedReason = `city_pack_${cityPackReadiness.sourceReadinessDecision}`;
    }
  } else {
    telemetry.cityPackRejectedReason = 'no_city_pack_match';
  }

  return {
    candidates,
    telemetry
  };
}

module.exports = {
  buildRuntimeKnowledgeCandidates
};
