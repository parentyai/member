'use strict';

const crypto = require('crypto');

const faqArticlesRepo = require('../../repos/firestore/faqArticlesRepo');
const faqAnswerLogsRepo = require('../../repos/firestore/faqAnswerLogsRepo');
const systemFlagsRepo = require('../../repos/firestore/systemFlagsRepo');
const { FAQ_ANSWER_SCHEMA_ID } = require('../../llm/schemas');
const { isLlmFeatureEnabled } = require('../../llm/featureFlag');
const { getDisclaimer } = require('../../llm/disclaimers');
const { appendAuditLog } = require('../audit/appendAuditLog');
const { buildLlmInputView } = require('../llm/buildLlmInputView');
const { guardLlmOutput } = require('../llm/guardLlmOutput');

const DEFAULT_TIMEOUT_MS = 2500;
const PROMPT_VERSION = 'faq_answer_v2_kb_only';
const MIN_SCORE = 1.2;
const TOP1_TOP2_RATIO = 1.2;
const SYSTEM_PROMPT = [
  'You are a FAQ assistant.',
  'Answer only from kbCandidates.',
  'If evidence is insufficient, do not answer.',
  'Use FAQAnswer.v1 schema.',
  'Do not include direct URLs. citations must use sourceType=link_registry and sourceId.',
  'Advisory only.'
].join('\n');

const FAQ_FIELD_CATEGORIES = Object.freeze({
  question: 'Internal',
  locale: 'Internal',
  intent: 'Internal',
  kbCandidates: 'Public',
  'kbCandidates.articleId': 'Public',
  'kbCandidates.title': 'Public',
  'kbCandidates.body': 'Public',
  'kbCandidates.tags': 'Public',
  'kbCandidates.riskLevel': 'Public',
  'kbCandidates.linkRegistryIds': 'Public',
  'kbCandidates.status': 'Public',
  'kbCandidates.validUntil': 'Public',
  'kbCandidates.allowedIntents': 'Public',
  'kbCandidates.disclaimerVersion': 'Public',
  'kbCandidates.searchScore': 'Public'
});

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function hashJson(value) {
  try {
    return crypto.createHash('sha256').update(JSON.stringify(value || {}), 'utf8').digest('hex');
  } catch (_err) {
    return null;
  }
}

function toIso(value) {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value.toDate === 'function') {
    const asDate = value.toDate();
    if (asDate instanceof Date) return asDate.toISOString();
  }
  return new Date().toISOString();
}

function toIsoOrNull(value) {
  if (value === null || value === undefined) return null;
  return toIso(value);
}

function normalizeLocale(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return 'ja';
  return value.trim();
}

function normalizeIntent(value) {
  if (typeof value !== 'string' || value.trim().length === 0) return null;
  return value.trim();
}

function normalizeQuestion(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function buildBlocked(params) {
  const payload = params || {};
  return {
    ok: false,
    blocked: true,
    httpStatus: 422,
    blockedReason: payload.blockedReason || 'blocked',
    traceId: payload.traceId || null,
    llmUsed: false,
    llmStatus: payload.llmStatus || 'blocked',
    blockedReasonCategory: payload.blockedReasonCategory || 'UNKNOWN',
    schemaErrors: payload.schemaErrors || null,
    fallbackActions: Array.isArray(payload.fallbackActions) ? payload.fallbackActions : [],
    suggestedFaqs: Array.isArray(payload.suggestedFaqs) ? payload.suggestedFaqs : [],
    faqAnswer: null,
    disclaimerVersion: payload.disclaimerVersion || null,
    disclaimer: payload.disclaimer || null,
    serverTime: payload.serverTime || new Date().toISOString(),
    deprecated: false
  };
}

function toBlockedReasonCategory(blockedReason) {
  const reason = String(blockedReason || '').trim();
  if (!reason) return 'UNKNOWN';
  if (reason === 'kb_no_match') return 'NO_KB_MATCH';
  if (reason === 'low_confidence') return 'LOW_CONFIDENCE';
  if (reason === 'direct_url_forbidden') return 'DIRECT_URL_DETECTED';
  if (reason === 'warn_link_blocked') return 'WARN_LINK_BLOCKED';
  if (reason === 'restricted_field_detected' || reason === 'secret_field_detected') return 'SENSITIVE_QUERY';
  if (reason === 'consent_missing') return 'CONSENT_MISSING';
  return 'UNKNOWN';
}

function looksLikeDirectUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim());
}

function buildFallbackActions(allowedSourceIds, requiredContactSourceIds) {
  const safeAllowed = Array.isArray(allowedSourceIds)
    ? allowedSourceIds.filter((id) => typeof id === 'string' && id.trim().length > 0 && !looksLikeDirectUrl(id))
    : [];
  const safeRequired = Array.isArray(requiredContactSourceIds)
    ? requiredContactSourceIds.filter((id) => typeof id === 'string' && id.trim().length > 0 && !looksLikeDirectUrl(id))
    : [];

  const officialFaqSourceId = safeAllowed[0] || null;
  const contactSourceId = safeRequired.find((id) => id !== officialFaqSourceId) || safeAllowed[1] || null;

  const actions = [];
  if (officialFaqSourceId) {
    actions.push({
      actionKey: 'open_official_faq',
      label: '公式FAQを見る',
      sourceId: officialFaqSourceId
    });
  }
  if (contactSourceId) {
    actions.push({
      actionKey: 'open_contact',
      label: '問い合わせる',
      sourceId: contactSourceId
    });
  }
  return actions;
}

function buildSuggestedFaqs(candidates) {
  return (Array.isArray(candidates) ? candidates : [])
    .slice(0, 3)
    .map((item) => ({
      articleId: item && item.id ? String(item.id) : '',
      title: item && item.title ? String(item.title) : ''
    }))
    .filter((item) => item.articleId.length > 0);
}

async function callAdapter(adapter, payload, timeoutMs) {
  if (!adapter || typeof adapter.answerFaq !== 'function') throw new Error('adapter_missing');
  const limit = typeof timeoutMs === 'number' ? timeoutMs : DEFAULT_TIMEOUT_MS;
  const exec = adapter.answerFaq(payload);
  const timeout = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('llm_timeout')), limit);
  });
  return Promise.race([exec, timeout]);
}

function normalizeAnswerCandidate(adapterResult) {
  if (adapterResult && typeof adapterResult === 'object' && adapterResult.answer && typeof adapterResult.answer === 'object') {
    return { answer: adapterResult.answer, model: adapterResult.model || null };
  }
  return { answer: adapterResult, model: adapterResult && adapterResult.model ? adapterResult.model : null };
}

function collectAllowedSourceIds(articles) {
  const out = new Set();
  for (const article of articles || []) {
    const ids = Array.isArray(article.linkRegistryIds) ? article.linkRegistryIds : [];
    for (const id of ids) {
      if (typeof id === 'string' && id.trim().length > 0) out.add(id.trim());
    }
  }
  return Array.from(out);
}

function collectRequiredContactSourceIds(articles) {
  const out = new Set();
  for (const article of articles || []) {
    if (!article || String(article.riskLevel || 'low').toLowerCase() !== 'high') continue;
    const ids = Array.isArray(article.linkRegistryIds) ? article.linkRegistryIds : [];
    for (const id of ids) {
      if (typeof id === 'string' && id.trim().length > 0) out.add(id.trim());
    }
  }
  return Array.from(out);
}

function extractCitationSourceIds(answer) {
  const citations = answer && Array.isArray(answer.citations) ? answer.citations : [];
  const out = new Set();
  for (const citation of citations) {
    if (!citation || citation.sourceType !== 'link_registry') continue;
    if (typeof citation.sourceId !== 'string') continue;
    const sourceId = citation.sourceId.trim();
    if (sourceId) out.add(sourceId);
  }
  return out;
}

function hasRequiredCitation(answer, requiredSourceIds) {
  if (!Array.isArray(requiredSourceIds) || requiredSourceIds.length === 0) return true;
  const cited = extractCitationSourceIds(answer);
  return requiredSourceIds.some((id) => cited.has(id));
}

function toNumberOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function resolveLlmPolicySnapshot(policy) {
  const normalized = systemFlagsRepo.normalizeLlmPolicy(policy);
  if (normalized === null) {
    return Object.assign({}, systemFlagsRepo.DEFAULT_LLM_POLICY);
  }
  return normalized;
}

function isConsentMissingByPolicy(policy) {
  return Boolean(policy && policy.lawfulBasis === 'consent' && policy.consentVerified !== true);
}

function buildAuditSummaryBase(params) {
  const payload = params || {};
  return {
    purpose: 'faq',
    llmEnabled: payload.llmEnabled,
    envLlmFeatureFlag: payload.envEnabled,
    dbLlmEnabled: payload.dbEnabled,
    schemaId: FAQ_ANSWER_SCHEMA_ID,
    disclaimerVersion: payload.disclaimerVersion,
    lawfulBasis: payload.llmPolicy.lawfulBasis,
    consentVerified: payload.llmPolicy.consentVerified,
    crossBorder: payload.llmPolicy.crossBorder,
    kbMatchedIds: payload.matchedArticleIds,
    top1Score: payload.confidence.top1Score,
    top2Score: payload.confidence.top2Score,
    top1Top2Ratio: payload.confidence.top1Top2Ratio,
    inputFieldCategoriesUsed: payload.inputFieldCategoriesUsed,
    fieldCategoriesUsed: payload.inputFieldCategoriesUsed
  };
}

function evaluateConfidence(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return {
      confident: false,
      blockedReason: 'kb_no_match',
      top1Score: null,
      top2Score: null,
      top1Top2Ratio: null
    };
  }
  const withScore = candidates
    .map((item) => toNumberOrNull(item && item.searchScore))
    .filter((value) => value !== null);
  if (!withScore.length) {
    return {
      confident: true,
      blockedReason: null,
      top1Score: null,
      top2Score: null,
      top1Top2Ratio: null
    };
  }
  const top1Score = withScore[0];
  const top2Score = withScore.length > 1 ? withScore[1] : null;
  const top1Top2Ratio = top2Score && top2Score > 0 ? top1Score / top2Score : null;
  if (top1Score < MIN_SCORE) {
    return {
      confident: false,
      blockedReason: 'low_confidence',
      top1Score,
      top2Score,
      top1Top2Ratio
    };
  }
  if (top2Score && top2Score > 0 && top1Top2Ratio !== null && top1Top2Ratio < TOP1_TOP2_RATIO) {
    return {
      confident: false,
      blockedReason: 'low_confidence',
      top1Score,
      top2Score,
      top1Top2Ratio
    };
  }
  return {
    confident: true,
    blockedReason: null,
    top1Score,
    top2Score,
    top1Top2Ratio
  };
}

async function appendAudit(data, deps) {
  const auditFn = deps && deps.appendAuditLog ? deps.appendAuditLog : appendAuditLog;
  if (!auditFn) return null;
  const result = await auditFn(data);
  return result && result.id ? result.id : null;
}

async function appendFaqAnswerLog(data, deps) {
  const repo = deps && deps.faqAnswerLogsRepo ? deps.faqAnswerLogsRepo : faqAnswerLogsRepo;
  if (!repo || typeof repo.appendFaqAnswerLog !== 'function') return null;
  const result = await repo.appendFaqAnswerLog(data);
  return result && result.id ? result.id : null;
}

async function appendDisclaimerRenderedAudit(params, deps) {
  const payload = params || {};
  return appendAudit({
    actor: payload.actor || 'unknown',
    action: 'llm_disclaimer_rendered',
    eventType: 'LLM_DISCLAIMER_RENDERED',
    entityType: 'llm_disclaimer',
    entityId: payload.purpose || 'faq',
    traceId: payload.traceId || null,
    requestId: payload.requestId || null,
    payloadSummary: {
      purpose: payload.purpose || 'faq',
      disclaimerVersion: payload.disclaimerVersion || null,
      disclaimerShown: payload.disclaimerShown !== false,
      llmStatus: payload.llmStatus || null,
      inputFieldCategoriesUsed: []
    }
  }, deps);
}

async function answerFaqFromKb(params, deps) {
  const payload = params || {};
  const question = normalizeQuestion(payload.question);
  if (!question) throw new Error('question required');

  const now = deps && deps.now instanceof Date ? deps.now : new Date();
  const serverTime = toIso(now);
  const traceId = typeof payload.traceId === 'string' && payload.traceId.trim().length > 0 ? payload.traceId.trim() : null;
  const requestId = typeof payload.requestId === 'string' && payload.requestId.trim().length > 0 ? payload.requestId.trim() : null;
  const actor = typeof payload.actor === 'string' && payload.actor.trim().length > 0 ? payload.actor.trim() : 'unknown';
  const disclaimer = getDisclaimer('faq');

  const locale = normalizeLocale(payload.locale);
  const intent = normalizeIntent(payload.intent);

  const env = deps && deps.env ? deps.env : process.env;
  const envEnabled = isLlmFeatureEnabled(env);
  const getLlmEnabled = deps && deps.getLlmEnabled ? deps.getLlmEnabled : systemFlagsRepo.getLlmEnabled;
  const getLlmPolicy = deps && Object.prototype.hasOwnProperty.call(deps, 'getLlmPolicy')
    ? deps.getLlmPolicy
    : (deps ? async () => Object.assign({}, systemFlagsRepo.DEFAULT_LLM_POLICY) : systemFlagsRepo.getLlmPolicy);
  const dbEnabled = await getLlmEnabled();
  const llmPolicy = resolveLlmPolicySnapshot(await getLlmPolicy());
  const llmEnabled = Boolean(envEnabled && dbEnabled);

  const kbRepo = deps && deps.faqArticlesRepo ? deps.faqArticlesRepo : faqArticlesRepo;
  const candidates = await kbRepo.searchActiveArticles({
    query: question,
    locale,
    intent,
    limit: 5
  });

  const matchedArticleIds = candidates.map((item) => item.id);
  const allowedSourceIds = collectAllowedSourceIds(candidates);
  const requiredContactSourceIds = collectRequiredContactSourceIds(candidates);
  const fallbackActions = buildFallbackActions(allowedSourceIds, requiredContactSourceIds);
  const suggestedFaqs = buildSuggestedFaqs(candidates);
  const confidence = evaluateConfidence(candidates);

  const llmInput = {
    question,
    locale,
    intent,
    kbCandidates: candidates.map((item) => ({
      articleId: item.id,
      title: item.title || '',
      body: item.body || '',
      tags: Array.isArray(item.tags) ? item.tags : [],
      riskLevel: item.riskLevel || 'low',
      linkRegistryIds: Array.isArray(item.linkRegistryIds) ? item.linkRegistryIds : [],
      status: item.status || null,
      validUntil: toIsoOrNull(item.validUntil),
      allowedIntents: Array.isArray(item.allowedIntents) ? item.allowedIntents : [],
      disclaimerVersion: item.disclaimerVersion || null,
      searchScore: toNumberOrNull(item.searchScore)
    }))
  };

  const view = buildLlmInputView({
    input: llmInput,
    allowList: [
      'question',
      'locale',
      'intent',
      'kbCandidates',
      'kbCandidates.articleId',
      'kbCandidates.title',
      'kbCandidates.body',
      'kbCandidates.tags',
      'kbCandidates.riskLevel',
      'kbCandidates.linkRegistryIds',
      'kbCandidates.status',
      'kbCandidates.validUntil',
      'kbCandidates.allowedIntents',
      'kbCandidates.disclaimerVersion',
      'kbCandidates.searchScore'
    ],
    fieldCategories: FAQ_FIELD_CATEGORIES,
    allowRestricted: false
  });

  let blocked = null;
  if (!view.ok) {
    blocked = buildBlocked({
      blockedReason: view.blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(view.blockedReason),
      fallbackActions,
      suggestedFaqs,
      traceId,
      llmStatus: view.blockedReason,
      serverTime
    });
  } else if (!llmEnabled) {
    blocked = buildBlocked({
      blockedReason: 'llm_disabled',
      blockedReasonCategory: toBlockedReasonCategory('llm_disabled'),
      fallbackActions,
      suggestedFaqs,
      traceId,
      llmStatus: 'llm_disabled',
      serverTime
    });
  } else if (isConsentMissingByPolicy(llmPolicy)) {
    blocked = buildBlocked({
      blockedReason: 'consent_missing',
      blockedReasonCategory: toBlockedReasonCategory('consent_missing'),
      fallbackActions,
      suggestedFaqs,
      traceId,
      llmStatus: 'consent_missing',
      serverTime
    });
  } else if (!confidence.confident) {
    blocked = buildBlocked({
      blockedReason: confidence.blockedReason || 'low_confidence',
      blockedReasonCategory: toBlockedReasonCategory(confidence.blockedReason || 'low_confidence'),
      fallbackActions,
      suggestedFaqs,
      traceId,
      llmStatus: confidence.blockedReason || 'low_confidence',
      serverTime
    });
  } else if (candidates.some((item) => String(item.riskLevel || '').toLowerCase() === 'high') && requiredContactSourceIds.length === 0) {
    blocked = buildBlocked({
      blockedReason: 'contact_source_required',
      blockedReasonCategory: toBlockedReasonCategory('contact_source_required'),
      fallbackActions,
      suggestedFaqs,
      traceId,
      llmStatus: 'contact_source_required',
      serverTime
    });
  }

  if (blocked) {
    blocked.disclaimerVersion = disclaimer.version;
    blocked.disclaimer = disclaimer.text;
    const auditId = await appendAudit({
      actor,
      action: 'llm_faq_answer_blocked',
      eventType: 'LLM_FAQ_ANSWER_BLOCKED',
      entityType: 'llm_faq',
      entityId: 'faq',
      traceId,
      requestId,
      payloadSummary: Object.assign(
        buildAuditSummaryBase({
          llmEnabled,
          envEnabled,
          dbEnabled,
          llmPolicy,
          disclaimerVersion: disclaimer.version,
          matchedArticleIds,
          confidence,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
        }),
        {
          blockedReasonCategory: toBlockedReasonCategory(blocked.blockedReason),
          blockedReason: blocked.blockedReason,
          inputHash: hashJson(view.data || llmInput)
        }
      )
    }, deps).catch(() => null);

    await appendFaqAnswerLog({
      traceId,
      questionHash: hashText(question),
      locale,
      matchedArticleIds,
      blockedReason: blocked.blockedReason
    }, deps).catch(() => null);
    await appendDisclaimerRenderedAudit(
      {
        actor,
        traceId,
        requestId,
        purpose: 'faq',
        disclaimerVersion: disclaimer.version,
        llmStatus: blocked.llmStatus,
        disclaimerShown: true
      },
      deps
    ).catch(() => null);

    return Object.assign(blocked, { auditId });
  }

  let answer;
  let llmModel = null;
  let llmStatus = 'ok';
  let guardResult = null;
  try {
    const adapterResult = await callAdapter(
      deps && deps.llmAdapter,
      {
        schemaId: FAQ_ANSWER_SCHEMA_ID,
        promptVersion: PROMPT_VERSION,
        system: SYSTEM_PROMPT,
        input: view.data
      },
      deps && typeof deps.llmTimeoutMs === 'number' ? deps.llmTimeoutMs : DEFAULT_TIMEOUT_MS
    );
    const normalized = normalizeAnswerCandidate(adapterResult);
    answer = normalized.answer;
    llmModel = normalized.model;
  } catch (err) {
    llmStatus = err && err.message ? String(err.message) : 'llm_error';
  }

  if (answer) {
    guardResult = await guardLlmOutput({
      purpose: 'faq',
      schemaId: FAQ_ANSWER_SCHEMA_ID,
      output: answer,
      requireCitations: true,
      allowedSourceIds,
      checkWarnLinks: true
    }, deps);
    if (!guardResult.ok) {
      llmStatus = guardResult.blockedReason || 'blocked';
    }
  }

  if (!answer || !guardResult || !guardResult.ok) {
    const blockedReason = llmStatus || 'blocked';
    const blockedResult = buildBlocked({
      blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(blockedReason),
      fallbackActions,
      suggestedFaqs,
      traceId,
      llmStatus: blockedReason,
      schemaErrors: guardResult && guardResult.schemaErrors ? guardResult.schemaErrors : null,
      serverTime,
      disclaimerVersion: disclaimer.version,
      disclaimer: disclaimer.text
    });
    const auditId = await appendAudit({
      actor,
      action: 'llm_faq_answer_blocked',
      eventType: 'LLM_FAQ_ANSWER_BLOCKED',
      entityType: 'llm_faq',
      entityId: 'faq',
      traceId,
      requestId,
      payloadSummary: Object.assign(
        buildAuditSummaryBase({
          llmEnabled,
          envEnabled,
          dbEnabled,
          llmPolicy,
          disclaimerVersion: disclaimer.version,
          matchedArticleIds,
          confidence,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
        }),
        {
          blockedReasonCategory: toBlockedReasonCategory(blockedReason),
          blockedReason,
          inputHash: hashJson(view.data),
          outputHash: answer ? hashJson(answer) : null
        }
      )
    }, deps).catch(() => null);

    await appendFaqAnswerLog({
      traceId,
      questionHash: hashText(question),
      locale,
      matchedArticleIds,
      blockedReason
    }, deps).catch(() => null);
    await appendDisclaimerRenderedAudit(
      {
        actor,
        traceId,
        requestId,
        purpose: 'faq',
        disclaimerVersion: disclaimer.version,
        llmStatus: blockedReason,
        disclaimerShown: true
      },
      deps
    ).catch(() => null);

    return Object.assign(blockedResult, { auditId });
  }

  if (!hasRequiredCitation(answer, requiredContactSourceIds)) {
    const blockedReason = 'contact_source_required';
    const blockedResult = buildBlocked({
      blockedReason,
      blockedReasonCategory: toBlockedReasonCategory(blockedReason),
      fallbackActions,
      suggestedFaqs,
      traceId,
      llmStatus: blockedReason,
      schemaErrors: null,
      serverTime,
      disclaimerVersion: disclaimer.version,
      disclaimer: disclaimer.text
    });
    const auditId = await appendAudit({
      actor,
      action: 'llm_faq_answer_blocked',
      eventType: 'LLM_FAQ_ANSWER_BLOCKED',
      entityType: 'llm_faq',
      entityId: 'faq',
      traceId,
      requestId,
      payloadSummary: Object.assign(
        buildAuditSummaryBase({
          llmEnabled,
          envEnabled,
          dbEnabled,
          llmPolicy,
          disclaimerVersion: disclaimer.version,
          matchedArticleIds,
          confidence,
          inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
        }),
        {
          blockedReasonCategory: toBlockedReasonCategory(blockedReason),
          blockedReason,
          inputHash: hashJson(view.data),
          outputHash: hashJson(answer)
        }
      )
    }, deps).catch(() => null);
    await appendFaqAnswerLog({
      traceId,
      questionHash: hashText(question),
      locale,
      matchedArticleIds,
      blockedReason
    }, deps).catch(() => null);
    await appendDisclaimerRenderedAudit(
      {
        actor,
        traceId,
        requestId,
        purpose: 'faq',
        disclaimerVersion: disclaimer.version,
        llmStatus: blockedReason,
        disclaimerShown: true
      },
      deps
    ).catch(() => null);
    return Object.assign(blockedResult, { auditId });
  }

  const auditId = await appendAudit({
    actor,
    action: 'llm_faq_answer_generated',
    eventType: 'LLM_FAQ_ANSWER_GENERATED',
    entityType: 'llm_faq',
    entityId: 'faq',
    traceId,
    requestId,
    payloadSummary: Object.assign(
      buildAuditSummaryBase({
        llmEnabled,
        envEnabled,
        dbEnabled,
        llmPolicy,
        disclaimerVersion: disclaimer.version,
        matchedArticleIds,
        confidence,
        inputFieldCategoriesUsed: view.inputFieldCategoriesUsed || []
      }),
      {
        blockedReasonCategory: null,
        blockedReason: null,
        inputHash: hashJson(view.data),
        outputHash: hashJson(answer)
      }
    )
  }, deps).catch(() => null);

  await appendFaqAnswerLog({
    traceId,
    questionHash: hashText(question),
    locale,
    matchedArticleIds,
    blockedReason: null
  }, deps).catch(() => null);
  await appendDisclaimerRenderedAudit(
    {
      actor,
      traceId,
      requestId,
      purpose: 'faq',
      disclaimerVersion: disclaimer.version,
      llmStatus: 'ok',
      disclaimerShown: true
    },
    deps
  ).catch(() => null);

  return {
    ok: true,
    blocked: false,
    httpStatus: 200,
    traceId,
    question,
    serverTime,
    faqAnswer: answer,
    llmUsed: true,
    llmStatus: 'ok',
    llmModel,
    schemaErrors: null,
    blockedReason: null,
    blockedReasonCategory: null,
    fallbackActions: [],
    suggestedFaqs,
    disclaimerVersion: disclaimer.version,
    disclaimer: disclaimer.text,
    inputFieldCategoriesUsed: view.inputFieldCategoriesUsed,
    auditId
  };
}

module.exports = {
  answerFaqFromKb
};
