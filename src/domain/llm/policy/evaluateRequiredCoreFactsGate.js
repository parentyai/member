'use strict';

const { REQUIRED_CORE_FACTS } = require('./parentYamlRoutingContract');

const DOMAIN_CRITICAL_FACTS = Object.freeze({
  ssn: ['primary_visa_class', 'destination_state', 'assignment_start_date'],
  banking: ['primary_visa_class', 'destination_state', 'destination_city'],
  school: ['destination_state', 'destination_city', 'school_needed_flag', 'dependents_present'],
  housing: ['destination_state', 'destination_city', 'housing_stage'],
  general: ['assignment_type', 'destination_state', 'destination_city']
});

const DOMAIN_CLARIFY_TEXT = Object.freeze({
  ssn: 'SSNを正確に案内するため、在留ステータスか最寄り窓口の地域を教えてください。',
  banking: '口座手続きを正確に案内するため、利用予定の銀行か来店地域を教えてください。',
  school: '学校手続きを正確に案内するため、対象学年か希望エリアを教えてください。',
  housing: '住まい探しを具体化するため、希望エリアか入居時期を教えてください。',
  general: 'まず対象手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。'
});

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDomainIntent(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'ssn' || normalized === 'school' || normalized === 'housing' || normalized === 'banking') {
    return normalized;
  }
  return 'general';
}

function normalizeLower(value) {
  return normalizeText(value).toLowerCase();
}

function getByPath(source, path) {
  const keys = Array.isArray(path) ? path : String(path || '').split('.');
  let cursor = source;
  for (const key of keys) {
    if (!cursor || typeof cursor !== 'object') return undefined;
    cursor = cursor[key];
  }
  return cursor;
}

function toBoolean(value) {
  if (value === true || value === false) return value;
  const normalized = normalizeLower(value);
  if (normalized === 'true' || normalized === 'yes' || normalized === '1') return true;
  if (normalized === 'false' || normalized === 'no' || normalized === '0') return false;
  return null;
}

function toIsoDate(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const text = normalizeText(value);
  if (!text) return null;
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return null;
  return new Date(parsed).toISOString().slice(0, 10);
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value === 'boolean') return true;
  if (value instanceof Date) return Number.isFinite(value.getTime());
  return true;
}

function pickFirstValue(snapshot, paths) {
  const candidates = Array.isArray(paths) ? paths : [];
  for (const path of candidates) {
    const value = getByPath(snapshot, path);
    if (hasValue(value)) return value;
  }
  return null;
}

function resolveFactValues(snapshot) {
  const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
  const family = source.family && typeof source.family === 'object' ? source.family : {};
  const dependentsFromFamily = Array.isArray(family.kidsAges) && family.kidsAges.length > 0
    ? true
    : (family.spouse === true ? true : null);

  const values = {
    assignment_type: normalizeText(pickFirstValue(source, [
      'assignment_type',
      'assignmentType',
      'assignment.type',
      'assignment.assignmentType',
      'assignment.assignment_type'
    ])) || null,
    planned_entry_date: toIsoDate(pickFirstValue(source, [
      'planned_entry_date',
      'plannedEntryDate',
      'dates.planned_entry_date',
      'timeline.plannedEntryDate',
      'entry.plannedDate'
    ])),
    assignment_start_date: toIsoDate(pickFirstValue(source, [
      'assignment_start_date',
      'assignmentStartDate',
      'dates.assignment_start_date',
      'timeline.assignmentStartDate'
    ])),
    destination_state: normalizeText(pickFirstValue(source, [
      'destination_state',
      'destinationState',
      'destination.state',
      'location.state'
    ])).toUpperCase() || null,
    destination_city: normalizeText(pickFirstValue(source, [
      'destination_city',
      'destinationCity',
      'destination.city',
      'location.city'
    ])) || null,
    primary_visa_class: normalizeText(pickFirstValue(source, [
      'primary_visa_class',
      'primaryVisaClass',
      'visa.primaryClass',
      'visaClass'
    ])).toUpperCase() || null,
    dependents_present: (() => {
      const explicit = toBoolean(pickFirstValue(source, [
        'dependents_present',
        'dependentsPresent',
        'family.dependentsPresent',
        'family.hasDependents'
      ]));
      if (explicit !== null) return explicit;
      if (dependentsFromFamily !== null) return dependentsFromFamily;
      return null;
    })(),
    housing_stage: normalizeText(pickFirstValue(source, [
      'housing_stage',
      'housingStage',
      'housing.stage'
    ])).toLowerCase() || null,
    school_needed_flag: (() => {
      const explicit = toBoolean(pickFirstValue(source, [
        'school_needed_flag',
        'schoolNeededFlag',
        'family.schoolNeededFlag',
        'needsSchool'
      ]));
      return explicit !== null ? explicit : null;
    })(),
    spouse_work_intent: normalizeText(pickFirstValue(source, [
      'spouse_work_intent',
      'spouseWorkIntent',
      'family.spouseWorkIntent'
    ])).toLowerCase() || null
  };

  return values;
}

function evaluateRequiredCoreFactsGate(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const contextSnapshot = payload.contextSnapshot && typeof payload.contextSnapshot === 'object'
    ? payload.contextSnapshot
    : null;
  const domainIntent = normalizeDomainIntent(payload.domainIntent);
  const intentRiskTier = normalizeLower(payload.intentRiskTier);
  const strategy = normalizeLower(payload.strategy);
  const actionClass = normalizeLower(payload.actionClass);
  const followupIntent = normalizeLower(payload.followupIntent);
  const explicitEnforce = payload.enforce === true;
  const explicitLogOnly = payload.logOnly === true;
  const snapshotPresent = Boolean(contextSnapshot && Object.keys(contextSnapshot).length > 0);

  const factValues = resolveFactValues(contextSnapshot || {});
  const missingFacts = REQUIRED_CORE_FACTS.filter((factKey) => !hasValue(factValues[factKey]));
  const criticalFactSet = DOMAIN_CRITICAL_FACTS[domainIntent] || DOMAIN_CRITICAL_FACTS.general;
  const criticalMissingFacts = criticalFactSet.filter((factKey) => missingFacts.includes(factKey));
  const presentFacts = REQUIRED_CORE_FACTS.filter((factKey) => !missingFacts.includes(factKey));
  const completeness = REQUIRED_CORE_FACTS.length > 0
    ? Math.round((presentFacts.length / REQUIRED_CORE_FACTS.length) * 10000) / 10000
    : 1;

  const intentNeedsHardFacts = intentRiskTier === 'high'
    || actionClass === 'assist'
    || strategy === 'grounded_answer'
    || followupIntent === 'appointment_needed';
  const shouldEvaluate = snapshotPresent === true;
  const shouldEnforce = explicitEnforce === true || (intentNeedsHardFacts && explicitLogOnly !== true);

  let decision = 'allow';
  const reasonCodes = [];
  let logOnly = false;
  let clarifyText = '';

  if (!shouldEvaluate) {
    logOnly = true;
    reasonCodes.push('core_facts_snapshot_missing');
  } else if (missingFacts.length === 0) {
    reasonCodes.push('core_facts_complete');
  } else {
    reasonCodes.push('core_facts_incomplete');
    if (shouldEnforce && criticalMissingFacts.length >= 2) {
      decision = 'clarify';
      reasonCodes.push('missing_required_core_facts');
      clarifyText = DOMAIN_CLARIFY_TEXT[domainIntent] || DOMAIN_CLARIFY_TEXT.general;
    } else if (shouldEnforce && missingFacts.length >= 7) {
      decision = 'clarify';
      reasonCodes.push('missing_required_core_facts');
      clarifyText = DOMAIN_CLARIFY_TEXT[domainIntent] || DOMAIN_CLARIFY_TEXT.general;
    } else {
      logOnly = true;
      reasonCodes.push('core_facts_log_only');
    }
  }

  return {
    decision,
    logOnly,
    enforce: shouldEnforce,
    requiredCoreFacts: REQUIRED_CORE_FACTS.slice(),
    factValues,
    presentFacts,
    missingFacts,
    criticalMissingFacts,
    completeness,
    missingCount: missingFacts.length,
    criticalMissingCount: criticalMissingFacts.length,
    clarifyText,
    reasonCodes: reasonCodes.slice(0, 12)
  };
}

module.exports = {
  evaluateRequiredCoreFactsGate,
  resolveFactValues
};
