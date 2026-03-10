'use strict';

const INTENT_TYPE_ENUM = Object.freeze([
  'NEXT_STEP',
  'HOW_TO',
  'DOCUMENTS_REQUIRED',
  'ELIGIBILITY_CHECK',
  'DEADLINE_CHECK',
  'STATUS_EXPLANATION',
  'STATE_RULE_DIFF',
  'TIMELINE_PLAN',
  'BLOCKER_HELP',
  'EXCEPTION_ESCALATION',
  'COST_ESTIMATE',
  'RETURN_PLAN',
  'GENERAL_OVERVIEW'
]);

const ANSWER_MODE_ENUM = Object.freeze([
  'ACTION_PLAN',
  'CHECKLIST',
  'EXPLANATION',
  'COMPARISON',
  'WARNING_ONLY',
  'ESCALATION_NOTICE',
  'TIMELINE',
  'REVERSE_LOOKUP'
]);

const LIFECYCLE_STAGE_ENUM = Object.freeze([
  'PRE_ASSIGNMENT',
  'PRE_DEPARTURE',
  'ENTRY_TRAVEL',
  'ARRIVAL_0_7',
  'ARRIVAL_0_30',
  'SETTLEMENT_30_90',
  'STEADY_STATE',
  'RENEWAL_CHANGE',
  'RETURN_REPAT'
]);

const DOMAIN_TO_CHAPTER = Object.freeze({
  immigration: 'I',
  entry: 'C',
  arrival: 'D',
  ssn: 'N',
  ssn_payroll: 'E',
  housing: 'L',
  family: 'F',
  school: 'K',
  health: 'H',
  tax: 'T',
  dmv_id: 'N',
  driving_vehicle: 'V',
  safety: 'P',
  reverse_lookup: 'Z',
  banking: 'M',
  general: 'A'
});

const REQUIRED_CORE_FACTS = Object.freeze([
  'assignment_type',
  'planned_entry_date',
  'assignment_start_date',
  'destination_state',
  'destination_city',
  'primary_visa_class',
  'dependents_present',
  'housing_stage',
  'school_needed_flag',
  'spouse_work_intent'
]);

const PHASE_TO_LIFECYCLE = Object.freeze({
  pre: 'PRE_DEPARTURE',
  arrival: 'ARRIVAL_0_30',
  settled: 'STEADY_STATE',
  extend: 'RENEWAL_CHANGE',
  return: 'RETURN_REPAT'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function pickEnumValue(candidate, allowed, fallback) {
  const normalized = normalizeText(candidate).toUpperCase();
  if (allowed.includes(normalized)) return normalized;
  return fallback;
}

function resolveParentIntentType(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const followupIntent = normalizeLower(payload.followupIntent);
  const routerMode = normalizeLower(payload.routerMode);
  const strategy = normalizeLower(payload.strategy);
  const domainIntent = normalizeLower(payload.domainIntent);
  const riskTier = normalizeLower(payload.intentRiskTier);

  if (followupIntent === 'docs_required') return 'DOCUMENTS_REQUIRED';
  if (followupIntent === 'appointment_needed') return 'DEADLINE_CHECK';
  if (followupIntent === 'next_step') return 'NEXT_STEP';
  if (strategy === 'clarify') return 'BLOCKER_HELP';
  if (routerMode === 'problem') return 'BLOCKER_HELP';
  if (routerMode === 'activity' || strategy === 'recommendation') return 'TIMELINE_PLAN';
  if (strategy === 'concierge' || strategy === 'domain_concierge') return 'HOW_TO';
  if (domainIntent === 'tax') return 'STATE_RULE_DIFF';
  if (riskTier === 'high') return 'ELIGIBILITY_CHECK';
  if (routerMode === 'question') return 'HOW_TO';
  return 'GENERAL_OVERVIEW';
}

function resolveParentAnswerMode(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const readinessDecision = normalizeLower(payload.readinessDecision);
  const strategy = normalizeLower(payload.strategy);
  const followupIntent = normalizeLower(payload.followupIntent);
  const routerMode = normalizeLower(payload.routerMode);

  if (readinessDecision === 'refuse') return 'ESCALATION_NOTICE';
  if (readinessDecision === 'clarify') return 'WARNING_ONLY';
  if (routerMode === 'activity' || strategy === 'recommendation') return 'TIMELINE';
  if (followupIntent === 'docs_required' || followupIntent === 'next_step') return 'ACTION_PLAN';
  if (strategy === 'grounded_answer') return 'EXPLANATION';
  if (strategy === 'concierge' || strategy === 'domain_concierge') return 'ACTION_PLAN';
  if (strategy === 'clarify') return 'WARNING_ONLY';
  return 'EXPLANATION';
}

function resolveParentLifecycleStage(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = normalizeText(payload.lifecycleStage).toUpperCase();
  if (LIFECYCLE_STAGE_ENUM.includes(explicit)) return explicit;
  const snapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : {};
  const phase = normalizeLower(snapshot.phase || snapshot.journeyPhase || snapshot.lifecycleStage || payload.phase);
  const mapped = PHASE_TO_LIFECYCLE[phase];
  return mapped || 'ARRIVAL_0_30';
}

function resolveParentChapter(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const explicit = normalizeText(payload.chapter).toUpperCase();
  if (/^[A-Z]$/.test(explicit)) return explicit;
  const domainIntent = normalizeLower(payload.domainIntent || payload.normalizedConversationIntent || 'general');
  return DOMAIN_TO_CHAPTER[domainIntent] || DOMAIN_TO_CHAPTER.general;
}

function evaluateParentYamlRoutingInvariant(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const intentType = pickEnumValue(
    payload.intentType || resolveParentIntentType(payload),
    INTENT_TYPE_ENUM,
    'GENERAL_OVERVIEW'
  );
  const answerMode = pickEnumValue(
    payload.answerMode || resolveParentAnswerMode(payload),
    ANSWER_MODE_ENUM,
    'EXPLANATION'
  );
  const lifecycleStage = pickEnumValue(
    payload.lifecycleStage || resolveParentLifecycleStage(payload),
    LIFECYCLE_STAGE_ENUM,
    'ARRIVAL_0_30'
  );
  const chapter = resolveParentChapter(payload);

  const invariantErrors = [];
  if (!INTENT_TYPE_ENUM.includes(intentType)) invariantErrors.push('intent_type_invalid');
  if (!ANSWER_MODE_ENUM.includes(answerMode)) invariantErrors.push('answer_mode_invalid');
  if (!LIFECYCLE_STAGE_ENUM.includes(lifecycleStage)) invariantErrors.push('lifecycle_stage_invalid');
  if (!/^[A-Z]$/.test(chapter)) invariantErrors.push('chapter_invalid');

  return {
    intentType,
    answerMode,
    lifecycleStage,
    chapter,
    invariantErrors,
    invariantStatus: invariantErrors.length === 0 ? 'ok' : 'invalid'
  };
}

module.exports = {
  INTENT_TYPE_ENUM,
  ANSWER_MODE_ENUM,
  LIFECYCLE_STAGE_ENUM,
  DOMAIN_TO_CHAPTER,
  REQUIRED_CORE_FACTS,
  resolveParentIntentType,
  resolveParentAnswerMode,
  resolveParentLifecycleStage,
  resolveParentChapter,
  evaluateParentYamlRoutingInvariant
};
