'use strict';

function futureIso(days) {
  return new Date(Date.now() + (Number(days || 30) * 24 * 60 * 60 * 1000)).toISOString();
}

function pastIso(days) {
  return new Date(Date.now() - (Number(days || 30) * 24 * 60 * 60 * 1000)).toISOString();
}

const baseFlags = {
  llmConciergeEnabled: true,
  llmWebSearchEnabled: true,
  llmStyleEngineEnabled: true,
  llmBanditEnabled: false,
  qualityEnabled: true,
  snapshotStrictMode: false
};

function buildPlanInfo() {
  return { plan: 'pro', status: 'active' };
}

function makeBlockedGroundedReply(blockedReason) {
  return async () => ({
    ok: false,
    blockedReason: blockedReason || 'grounding_missing',
    assistantQuality: {
      intentResolved: 'situation_analysis',
      kbTopScore: 0,
      evidenceCoverage: 0,
      blockedStage: 'retrieval',
      fallbackReason: blockedReason || 'grounding_missing'
    }
  });
}

function makeDomainCandidate(domainIntent) {
  return {
    ok: true,
    replyText: '状況を整理しながら進めます。まずは優先する条件を1つに絞りましょう。',
    domainIntent: domainIntent || 'general',
    conversationMode: 'concierge',
    opportunityType: 'action',
    opportunityReasonKeys: [domainIntent ? `${domainIntent}_intent` : 'general_intent'],
    interventionBudget: 1,
    conciseModeApplied: true,
    auditMeta: null
  };
}

function makeFaqArticle(overrides) {
  return Object.assign({
    id: 'faq-1',
    title: '住まいの初期準備',
    body: '住まい探しでは、候補条件と初期費用を先に整理すると進めやすいです。',
    sourceSnapshotRefs: ['src-official-1'],
    linkRegistryIds: ['link-official-1'],
    allowedIntents: ['GENERAL', 'HOUSING'],
    validUntil: futureIso(60),
    authorityLevel: 'state',
    authorityTier: 'T2_PUBLIC_DATA',
    bindingLevel: 'REFERENCE',
    riskLevel: 'low',
    status: 'active'
  }, overrides || {});
}

function makeOfficialSourceRef(overrides) {
  return Object.assign({
    id: 'src-official-1',
    sourceType: 'official',
    authorityLevel: 'state',
    authorityTier: 'T1_OFFICIAL_OPERATION',
    bindingLevel: 'POLICY',
    validUntil: futureIso(60),
    status: 'active',
    requiredLevel: 'required'
  }, overrides || {});
}

function makeSearchFaqDeps(article, options) {
  const config = options && typeof options === 'object' ? options : {};
  return {
    searchFaqFromKb: async () => ({
      ok: true,
      candidates: config.noMatch === true ? [] : [{ articleId: article.id || 'faq-1' }]
    }),
    getFaqArticle: async () => config.noArticle === true ? null : article
  };
}

module.exports = {
  baseFlags,
  buildPlanInfo,
  futureIso,
  pastIso,
  makeBlockedGroundedReply,
  makeDomainCandidate,
  makeFaqArticle,
  makeOfficialSourceRef,
  makeSearchFaqDeps
};
