'use strict';

const TOPICS = Object.freeze({
  GENERAL: 'general',
  REGULATION: 'regulation',
  MEDICAL: 'medical',
  VISA: 'visa',
  TAX: 'tax',
  SCHOOL: 'school',
  PRICING: 'pricing',
  ACTIVITY: 'activity',
  OTHER: 'other'
});

const MODES = Object.freeze({
  A: 'A',
  B: 'B',
  C: 'C'
});

const USER_TIERS = Object.freeze({
  FREE: 'free',
  PAID: 'paid',
  ADMIN: 'admin'
});

const MODE_BY_TOPIC = Object.freeze({
  [TOPICS.REGULATION]: MODES.B,
  [TOPICS.MEDICAL]: MODES.B,
  [TOPICS.VISA]: MODES.B,
  [TOPICS.TAX]: MODES.B,
  [TOPICS.SCHOOL]: MODES.B,
  [TOPICS.PRICING]: MODES.B,
  [TOPICS.ACTIVITY]: MODES.C
});

const KEYWORDS = Object.freeze({
  [TOPICS.VISA]: [/\bvisa\b/i, /在留/, /ビザ/, /immigration/i, /入管/],
  [TOPICS.TAX]: [/\btax\b/i, /税/, /確定申告/, /源泉/],
  [TOPICS.MEDICAL]: [/medical/i, /病院/, /医療/, /保険証/, /ワクチン/, /health/],
  [TOPICS.SCHOOL]: [/school/i, /学校/, /学区/, /入学/, /tuition/i, /授業料/],
  [TOPICS.PRICING]: [/price/i, /pricing/i, /fee/i, /料金/, /費用/, /コスト/],
  [TOPICS.REGULATION]: [/規制/, /法律/, /法令/, /期限/, /締切/, /compliance/i, /regulation/i],
  [TOPICS.ACTIVITY]: [/weekend/i, /travel/i, /trip/i, /activity/i, /観光/, /週末/, /イベント/, /遊び/]
});

const DEFAULT_POLICY = Object.freeze({
  maxUrlsGlobal: 3,
  free: {
    maxUrlsByMode: { A: 0, B: 1, C: 1 },
    storedOnly: true,
    allowExternalSearch: false,
    allowedRanksByMode: { A: [], B: ['R0', 'R1'], C: ['R0', 'R1', 'R2'] }
  },
  paid: {
    maxUrlsByMode: { A: 0, B: 3, C: 3 },
    storedOnly: false,
    allowExternalSearch: true,
    allowedRanksByMode: { A: [], B: ['R0', 'R1'], C: ['R0', 'R1', 'R2'] }
  },
  admin: {
    maxUrlsByMode: { A: 0, B: 3, C: 3 },
    storedOnly: false,
    allowExternalSearch: true,
    allowedRanksByMode: { A: [], B: ['R0', 'R1'], C: ['R0', 'R1', 'R2'] }
  }
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function detectTopic(question) {
  const text = normalizeText(question);
  if (!text) return TOPICS.GENERAL;
  const orderedTopics = [
    TOPICS.VISA,
    TOPICS.TAX,
    TOPICS.MEDICAL,
    TOPICS.SCHOOL,
    TOPICS.PRICING,
    TOPICS.REGULATION,
    TOPICS.ACTIVITY
  ];
  for (const topic of orderedTopics) {
    const patterns = KEYWORDS[topic] || [];
    if (patterns.some((pattern) => pattern.test(text))) return topic;
  }
  return TOPICS.GENERAL;
}

function resolveUserTier(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const raw = typeof payload.userTier === 'string' ? payload.userTier.trim().toLowerCase() : '';
  if (raw === USER_TIERS.FREE || raw === USER_TIERS.PAID || raw === USER_TIERS.ADMIN) return raw;
  const plan = typeof payload.plan === 'string' ? payload.plan.trim().toLowerCase() : '';
  if (plan === 'pro' || plan === 'paid') return USER_TIERS.PAID;
  if (plan === 'admin') return USER_TIERS.ADMIN;
  return USER_TIERS.FREE;
}

function decideMode(topic) {
  return MODE_BY_TOPIC[topic] || MODES.A;
}

function resolveTierPolicy(userTier, policy) {
  const source = policy && typeof policy === 'object' ? policy : DEFAULT_POLICY;
  if (userTier === USER_TIERS.PAID) return source.paid;
  if (userTier === USER_TIERS.ADMIN) return source.admin || source.paid;
  return source.free;
}

function resolvePolicyForRequest(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const policy = payload.policy && typeof payload.policy === 'object' ? payload.policy : DEFAULT_POLICY;
  const userTier = resolveUserTier(payload);
  const topic = detectTopic(payload.question || payload.intent || '');
  const mode = decideMode(topic);
  const tierPolicy = resolveTierPolicy(userTier, policy);
  const modeCap = tierPolicy.maxUrlsByMode && Number.isFinite(Number(tierPolicy.maxUrlsByMode[mode]))
    ? Math.max(0, Math.floor(Number(tierPolicy.maxUrlsByMode[mode])))
    : 0;
  const maxUrlsGlobal = Number.isFinite(Number(policy.maxUrlsGlobal))
    ? Math.max(0, Math.floor(Number(policy.maxUrlsGlobal)))
    : DEFAULT_POLICY.maxUrlsGlobal;
  const maxUrls = Math.max(0, Math.min(maxUrlsGlobal, modeCap));
  const allowedRanks = Array.isArray(tierPolicy.allowedRanksByMode && tierPolicy.allowedRanksByMode[mode])
    ? tierPolicy.allowedRanksByMode[mode].slice()
    : [];
  return {
    userTier,
    topic,
    mode,
    maxUrls,
    maxUrlsGlobal,
    allowedRanks,
    storedOnly: tierPolicy.storedOnly === true,
    allowExternalSearch: tierPolicy.allowExternalSearch === true
  };
}

function shouldAttachUrls(mode, urlCount) {
  if (mode === MODES.A) return false;
  const count = Number.isFinite(Number(urlCount)) ? Number(urlCount) : 0;
  return count > 0;
}

module.exports = {
  TOPICS,
  MODES,
  USER_TIERS,
  DEFAULT_POLICY,
  detectTopic,
  decideMode,
  resolveUserTier,
  resolvePolicyForRequest,
  shouldAttachUrls
};
