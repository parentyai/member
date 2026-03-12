'use strict';

const HIGH_RISK_INTENTS = new Set(['ssn', 'banking', 'emergency']);
const MEDIUM_RISK_INTENTS = new Set([
  'school',
  'housing',
  'city_pack',
  'local_guidance',
  'journey',
  'task_blocker',
  'saved_faq'
]);
const LOW_RISK_INTENTS = new Set(['general']);
const INTENT_ALIASES = Object.freeze({
  city: 'city_pack',
  citypack: 'city_pack',
  local: 'local_guidance',
  guidance: 'local_guidance',
  local_guidance: 'local_guidance',
  'local-guidance': 'local_guidance',
  journey_state: 'journey',
  task: 'task_blocker',
  blocker: 'task_blocker',
  faq: 'saved_faq',
  savedfaq: 'saved_faq',
  emergency_layer: 'emergency'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizeIntent(value) {
  const intent = normalizeText(value);
  if (!intent) return 'general';
  const aliased = INTENT_ALIASES[intent] || intent;
  if (HIGH_RISK_INTENTS.has(aliased)) return aliased;
  if (MEDIUM_RISK_INTENTS.has(aliased)) return aliased;
  if (LOW_RISK_INTENTS.has(aliased)) return aliased;
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
  const explicitIntent = normalizeIntent(
    payload.domainIntent
    || payload.normalizedConversationIntent
    || payload.intent
    || 'general'
  );
  const emergencyContextActive = payload.emergencyContext === true
    || payload.emergencyContextActive === true;
  const taskBlockerDetected = payload.taskBlockerContext === true
    || payload.taskBlockerDetected === true;
  const journeyContextActive = payload.journeyContext === true
    || payload.journeyContextActive === true;
  const cityPackContextActive = payload.cityPackContext === true
    || payload.cityPackContextActive === true;
  const savedFaqContextActive = payload.savedFaqContext === true
    || payload.savedFaqReused === true;
  const domainIntent = emergencyContextActive
    ? 'emergency'
    : explicitIntent;
  const inputReasonCodes = normalizeReasonCodes(payload.reasonCodes);

  let intentRiskTier = 'low';
  if (HIGH_RISK_INTENTS.has(domainIntent)) intentRiskTier = 'high';
  else if (MEDIUM_RISK_INTENTS.has(domainIntent)) intentRiskTier = 'medium';

  const riskReasonCodes = normalizeReasonCodes([
    `intent_${domainIntent}`,
    `risk_${intentRiskTier}`,
    emergencyContextActive ? 'emergency_context_active' : null,
    taskBlockerDetected ? 'task_blocker_detected' : null,
    journeyContextActive ? 'journey_context_active' : null,
    cityPackContextActive ? 'city_pack_context_active' : null,
    savedFaqContextActive ? 'saved_faq_context_active' : null
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
