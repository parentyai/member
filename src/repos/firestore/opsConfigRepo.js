'use strict';

const { getDb, serverTimestamp } = require('../../infra/firestore');

const COLLECTION = 'opsConfig';
const DOC_ID = 'llmPolicy';
const KNOWN_INTENTS = Object.freeze([
  'faq_search',
  'situation_analysis',
  'gap_check',
  'timeline_build',
  'next_action_generation',
  'risk_alert'
]);
const INTENT_ALIASES = Object.freeze({
  next_action: 'next_action_generation'
});

const DEFAULT_LLM_POLICY = Object.freeze({
  enabled: false,
  model: 'gpt-4o-mini',
  temperature: 0.2,
  top_p: 1,
  max_output_tokens: 600,
  per_user_daily_limit: 20,
  per_user_token_budget: 12000,
  global_qps_limit: 5,
  cache_ttl_sec: 120,
  allowed_intents_free: ['faq_search'],
  allowed_intents_pro: ['situation_analysis', 'gap_check', 'timeline_build', 'next_action_generation', 'risk_alert', 'faq_search'],
  safety_mode: 'strict',
  forbidden_domains: [],
  disclaimer_templates: Object.freeze({
    generic: '提案情報です。最終判断は運用担当が行ってください。',
    faq: 'この回答は公式FAQ（KB）に基づく要約です。個別事情により異なる場合があります。',
    ops_explain: '提案です。自動実行は行いません。最終判断は運用担当が行ってください。',
    next_actions: '提案候補です。実行手順の確定は決定論レイヤで行ってください。',
    paid_assistant: '提案です。契約・法務・税務の最終判断は専門家確認のうえで行ってください。'
  }),
  output_constraints: Object.freeze({
    max_next_actions: 3,
    max_gaps: 5,
    max_risks: 3,
    require_evidence: true,
    forbid_direct_url: true
  })
});

function normalizeBoolean(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function normalizeString(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized;
}

function normalizeNumber(value, fallback, min, max) {
  if (value === null || value === undefined || value === '') return fallback;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

function resolveIntentAliasEnabled() {
  const raw = process.env.ENABLE_INTENT_ALIAS_V1;
  if (typeof raw !== 'string') return true;
  const normalized = raw.trim().toLowerCase();
  return !(normalized === '0' || normalized === 'false' || normalized === 'off');
}

function normalizeIntentToken(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase() : '';
  if (!normalized) return '';
  if (resolveIntentAliasEnabled() && Object.prototype.hasOwnProperty.call(INTENT_ALIASES, normalized)) {
    return INTENT_ALIASES[normalized];
  }
  return normalized;
}

function normalizeIntentList(value, fallback) {
  if (value === null || value === undefined) return fallback.slice();
  if (!Array.isArray(value)) return null;
  const out = [];
  value.forEach((item) => {
    const normalized = normalizeIntentToken(item);
    if (!normalized) return;
    if (!KNOWN_INTENTS.includes(normalized)) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeLowercaseStringList(value, fallback) {
  if (value === null || value === undefined) return fallback.slice();
  if (!Array.isArray(value)) return null;
  const out = [];
  value.forEach((item) => {
    if (typeof item !== 'string') return;
    const normalized = item.trim().toLowerCase();
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function normalizeSafetyMode(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (['strict', 'balanced', 'relaxed'].includes(normalized)) return normalized;
  return null;
}

function normalizeDisclaimerTemplates(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : DEFAULT_LLM_POLICY.disclaimer_templates;
  if (value === null || value === undefined) return Object.assign({}, base);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out = {};
  const keys = Array.from(new Set(Object.keys(base).concat(Object.keys(value))));
  keys.forEach((key) => {
    const field = typeof key === 'string' ? key.trim().toLowerCase() : '';
    if (!field) return;
    if (!/^[a-z0-9_]{1,64}$/.test(field)) return;
    const candidate = Object.prototype.hasOwnProperty.call(value, key) ? value[key] : base[key];
    if (typeof candidate !== 'string') return;
    const text = candidate.trim();
    if (!text) return;
    out[field] = text.slice(0, 800);
  });
  const fallbackKeys = Object.keys(base);
  const missingRequired = fallbackKeys.some((key) => !out[key]);
  if (missingRequired) return null;
  return out;
}

function normalizeOutputConstraints(value, fallback) {
  const base = fallback && typeof fallback === 'object' ? fallback : DEFAULT_LLM_POLICY.output_constraints;
  if (value === null || value === undefined) return Object.assign({}, base);
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const maxNextActions = normalizeNumber(value.max_next_actions, base.max_next_actions, 0, 3);
  const maxGaps = normalizeNumber(value.max_gaps, base.max_gaps, 0, 10);
  const maxRisks = normalizeNumber(value.max_risks, base.max_risks, 0, 10);
  const requireEvidence = normalizeBoolean(value.require_evidence, base.require_evidence);
  const forbidDirectUrl = normalizeBoolean(value.forbid_direct_url, base.forbid_direct_url);
  if ([maxNextActions, maxGaps, maxRisks, requireEvidence, forbidDirectUrl].includes(null)) return null;

  return {
    max_next_actions: Math.floor(maxNextActions),
    max_gaps: Math.floor(maxGaps),
    max_risks: Math.floor(maxRisks),
    require_evidence: requireEvidence,
    forbid_direct_url: forbidDirectUrl
  };
}

function normalizeLlmPolicy(input) {
  if (input === null || input === undefined) {
    return Object.assign({}, DEFAULT_LLM_POLICY);
  }
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const enabled = normalizeBoolean(input.enabled, DEFAULT_LLM_POLICY.enabled);
  const model = normalizeString(input.model, DEFAULT_LLM_POLICY.model);
  const temperature = normalizeNumber(input.temperature, DEFAULT_LLM_POLICY.temperature, 0, 2);
  const topP = normalizeNumber(input.top_p, DEFAULT_LLM_POLICY.top_p, 0, 1);
  const maxOutputTokens = normalizeNumber(input.max_output_tokens, DEFAULT_LLM_POLICY.max_output_tokens, 32, 4096);
  const perUserDailyLimit = normalizeNumber(input.per_user_daily_limit, DEFAULT_LLM_POLICY.per_user_daily_limit, 0, 2000);
  const perUserTokenBudgetInput = Object.prototype.hasOwnProperty.call(input, 'per_user_token_budget')
    ? input.per_user_token_budget
    : input.per_user_daily_token_budget;
  const perUserTokenBudget = normalizeNumber(perUserTokenBudgetInput, DEFAULT_LLM_POLICY.per_user_token_budget, 0, 500000);
  const globalQpsLimit = normalizeNumber(input.global_qps_limit, DEFAULT_LLM_POLICY.global_qps_limit, 0, 1000);
  const cacheTtlSec = normalizeNumber(input.cache_ttl_sec, DEFAULT_LLM_POLICY.cache_ttl_sec, 0, 86400);
  const allowedFree = normalizeIntentList(input.allowed_intents_free, DEFAULT_LLM_POLICY.allowed_intents_free);
  const allowedPro = normalizeIntentList(input.allowed_intents_pro, DEFAULT_LLM_POLICY.allowed_intents_pro);
  const safetyMode = normalizeSafetyMode(input.safety_mode, DEFAULT_LLM_POLICY.safety_mode);
  const forbiddenDomains = normalizeLowercaseStringList(input.forbidden_domains, DEFAULT_LLM_POLICY.forbidden_domains);
  const disclaimerTemplates = normalizeDisclaimerTemplates(
    input.disclaimer_templates,
    DEFAULT_LLM_POLICY.disclaimer_templates
  );
  const outputConstraints = normalizeOutputConstraints(
    input.output_constraints,
    DEFAULT_LLM_POLICY.output_constraints
  );

  if ([
    enabled,
    model,
    temperature,
    topP,
    maxOutputTokens,
    perUserDailyLimit,
    perUserTokenBudget,
    globalQpsLimit,
    cacheTtlSec,
    allowedFree,
    allowedPro,
    safetyMode,
    forbiddenDomains,
    disclaimerTemplates,
    outputConstraints
  ].includes(null)) {
    return null;
  }

  return {
    enabled,
    model,
    temperature,
    top_p: topP,
    max_output_tokens: Math.floor(maxOutputTokens),
    per_user_daily_limit: Math.floor(perUserDailyLimit),
    per_user_token_budget: Math.floor(perUserTokenBudget),
    global_qps_limit: Math.floor(globalQpsLimit),
    cache_ttl_sec: Math.floor(cacheTtlSec),
    allowed_intents_free: allowedFree,
    allowed_intents_pro: allowedPro,
    safety_mode: safetyMode,
    forbidden_domains: forbiddenDomains,
    disclaimer_templates: disclaimerTemplates,
    output_constraints: outputConstraints
  };
}

async function getLlmPolicy() {
  const db = getDb();
  const snap = await db.collection(COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) return Object.assign({}, DEFAULT_LLM_POLICY);
  const data = snap.data() || {};
  const normalized = normalizeLlmPolicy(data);
  if (!normalized) return Object.assign({}, DEFAULT_LLM_POLICY);
  return Object.assign({}, normalized, {
    updatedAt: data.updatedAt || null,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : null
  });
}

async function setLlmPolicy(policy, actor) {
  const normalized = normalizeLlmPolicy(policy);
  if (!normalized) throw new Error('invalid llmPolicy');
  const updatedBy = typeof actor === 'string' && actor.trim() ? actor.trim() : 'unknown';
  const db = getDb();
  await db.collection(COLLECTION).doc(DOC_ID).set(Object.assign({}, normalized, {
    updatedAt: serverTimestamp(),
    updatedBy
  }), { merge: true });
  return getLlmPolicy();
}

module.exports = {
  COLLECTION,
  DOC_ID,
  KNOWN_INTENTS,
  INTENT_ALIASES,
  normalizeIntentToken,
  DEFAULT_LLM_POLICY,
  normalizeLlmPolicy,
  getLlmPolicy,
  setLlmPolicy
};
