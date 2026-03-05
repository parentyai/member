'use strict';

const CONVERSATION_MODES = Object.freeze(['casual', 'concierge']);
const OPPORTUNITY_TYPES = Object.freeze(['none', 'action', 'blocked', 'life']);

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeConversationMode(value) {
  const normalized = normalizeText(value).toLowerCase();
  return CONVERSATION_MODES.includes(normalized) ? normalized : 'casual';
}

function normalizeOpportunityType(value) {
  const normalized = normalizeText(value).toLowerCase();
  return OPPORTUNITY_TYPES.includes(normalized) ? normalized : 'none';
}

function normalizeReasonKeys(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 8);
}

function normalizeActionLines(value) {
  const rows = Array.isArray(value) ? value : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 3);
}

function normalizeAtomText(value) {
  const normalized = normalizeText(value);
  return normalized || null;
}

function normalizeSuggestedAtoms(value) {
  const payload = value && typeof value === 'object' ? value : {};
  return {
    nextActions: normalizeActionLines(payload.nextActions),
    pitfall: normalizeAtomText(payload.pitfall),
    question: normalizeAtomText(payload.question)
  };
}

function normalizeInterventionBudget(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  if (numeric >= 1) return 1;
  return 0;
}

function buildOpportunityDecision(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const opportunityType = normalizeOpportunityType(payload.opportunityType);
  const interventionBudget = normalizeInterventionBudget(payload.interventionBudget);
  const modeFromInput = normalizeConversationMode(payload.conversationMode);
  const conversationMode = interventionBudget > 0 && opportunityType !== 'none'
    ? (modeFromInput === 'concierge' ? 'concierge' : 'casual')
    : 'casual';
  return {
    conversationMode,
    opportunityType,
    opportunityReasonKeys: normalizeReasonKeys(payload.opportunityReasonKeys),
    interventionBudget,
    suggestedAtoms: normalizeSuggestedAtoms(payload.suggestedAtoms)
  };
}

module.exports = {
  CONVERSATION_MODES,
  OPPORTUNITY_TYPES,
  normalizeConversationMode,
  normalizeOpportunityType,
  normalizeReasonKeys,
  normalizeSuggestedAtoms,
  normalizeInterventionBudget,
  buildOpportunityDecision
};
