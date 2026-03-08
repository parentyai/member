'use strict';

const HIGH_RISK_INTENTS = new Set(['ssn', 'banking']);
const MEDIUM_RISK_INTENTS = new Set(['school', 'housing']);
const LOW_RISK_INTENTS = new Set(['general']);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeIntent(value) {
  const intent = normalizeText(value);
  if (!intent) return 'general';
  if (HIGH_RISK_INTENTS.has(intent)) return intent;
  if (MEDIUM_RISK_INTENTS.has(intent)) return intent;
  if (LOW_RISK_INTENTS.has(intent)) return intent;
  return 'general';
}

function normalizeReasonCodes(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out;
}

function resolveIntentRiskTier(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const domainIntent = normalizeIntent(
    payload.domainIntent
    || payload.normalizedConversationIntent
    || payload.intent
    || 'general'
  );
  const inputReasonCodes = normalizeReasonCodes(payload.reasonCodes);

  let intentRiskTier = 'low';
  if (HIGH_RISK_INTENTS.has(domainIntent)) intentRiskTier = 'high';
  else if (MEDIUM_RISK_INTENTS.has(domainIntent)) intentRiskTier = 'medium';

  const riskReasonCodes = normalizeReasonCodes([
    `intent_${domainIntent}`,
    `risk_${intentRiskTier}`
  ].concat(inputReasonCodes));

  return {
    domainIntent,
    intentRiskTier,
    riskReasonCodes
  };
}

module.exports = {
  resolveIntentRiskTier,
  normalizeIntent,
  normalizeReasonCodes,
  HIGH_RISK_INTENTS,
  MEDIUM_RISK_INTENTS
};
