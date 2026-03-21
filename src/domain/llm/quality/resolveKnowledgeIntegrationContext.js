'use strict';

const { resolveCityPackQualityContext } = require('./resolveCityPackQualityContext');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function clamp01(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0) return 0;
  if (num > 1) return 1;
  return num;
}

function uniqueStrings(values, limit) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item);
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 12);
}

function normalizeReasonCodes(values) {
  return uniqueStrings(values, 12).map((item) => item.toLowerCase().replace(/\s+/g, '_'));
}

function resolveSavedFaqBoolean(params, key, fallback) {
  if (typeof params[key] === 'boolean') return params[key];
  return fallback;
}

function resolveKnowledgeIntegrationContext(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const savedFaqSignals = payload.savedFaqSignals && typeof payload.savedFaqSignals === 'object'
    ? payload.savedFaqSignals
    : null;
  const cityPackValidation = payload.cityPackValidation && typeof payload.cityPackValidation === 'object'
    ? payload.cityPackValidation
    : null;

  const savedFaqReuseReasonCodes = normalizeReasonCodes([].concat(
    payload.savedFaqReuseReasonCodes || [],
    savedFaqSignals && Array.isArray(savedFaqSignals.savedFaqReuseReasonCodes)
      ? savedFaqSignals.savedFaqReuseReasonCodes
      : []
  ));
  const sourceSnapshotRefs = uniqueStrings([].concat(
    payload.sourceSnapshotRefs || [],
    savedFaqSignals && Array.isArray(savedFaqSignals.sourceSnapshotRefs) ? savedFaqSignals.sourceSnapshotRefs : []
  ), 8);
  const savedFaqReused = resolveSavedFaqBoolean(payload, 'savedFaqReused', savedFaqSignals && savedFaqSignals.savedFaqReused === true);
  const savedFaqReusePass = resolveSavedFaqBoolean(payload, 'savedFaqReusePass', savedFaqSignals && savedFaqSignals.savedFaqReusePass === true);
  const savedFaqValid = resolveSavedFaqBoolean(
    payload,
    'savedFaqValid',
    savedFaqReused ? !savedFaqReuseReasonCodes.includes('saved_faq_stale') : true
  );
  const savedFaqAllowedIntent = resolveSavedFaqBoolean(
    payload,
    'savedFaqAllowedIntent',
    savedFaqReused ? !savedFaqReuseReasonCodes.includes('saved_faq_intent_mismatch') : true
  );
  const savedFaqAuthorityScore = clamp01(payload.savedFaqAuthorityScore);

  const cityPack = resolveCityPackQualityContext(payload);
  const requiredInvalidRefs = cityPackValidation && Array.isArray(cityPackValidation.blockingInvalidSourceRefs)
    ? cityPackValidation.blockingInvalidSourceRefs
    : [];
  const optionalInvalidRefs = cityPackValidation && Array.isArray(cityPackValidation.optionalInvalidSourceRefs)
    ? cityPackValidation.optionalInvalidSourceRefs
    : [];
  const crossSystemConflictDetected = payload.crossSystemConflictDetected === true;

  const reasonCodes = normalizeReasonCodes([].concat(payload.integrationReasonCodes || []));
  if (requiredInvalidRefs.length > 0 && !reasonCodes.includes('city_pack_required_source_blocked')) {
    reasonCodes.push('city_pack_required_source_blocked');
  }
  if (optionalInvalidRefs.length > 0 && !reasonCodes.includes('city_pack_optional_source_stale')) {
    reasonCodes.push('city_pack_optional_source_stale');
  }
  if (cityPack.requestedCityKey && cityPack.citySpecificitySatisfied !== true && !reasonCodes.includes('city_specificity_missing')) {
    reasonCodes.push('city_specificity_missing');
  }
  if (cityPack.scopeDisclosureRequired === true && !reasonCodes.includes('city_scope_disclosure_required')) {
    reasonCodes.push('city_scope_disclosure_required');
  }
  if (savedFaqReused && savedFaqReusePass !== true) {
    savedFaqReuseReasonCodes.forEach((code) => {
      if (!reasonCodes.includes(code)) reasonCodes.push(code);
    });
  }
  if (crossSystemConflictDetected && !reasonCodes.includes('cross_system_conflict_detected')) {
    reasonCodes.push('cross_system_conflict_detected');
  }

  return {
    cityPackContext: cityPack.context,
    cityPackGrounded: cityPack.grounded,
    cityPackGroundingReason: cityPack.groundingReason,
    cityPackFreshnessScore: cityPack.freshnessScore,
    cityPackAuthorityScore: cityPack.authorityScore,
    cityPackRequiredSourcesSatisfied: cityPack.requiredSourcesSatisfied,
    cityPackSourceSnapshot: cityPack.sourceSnapshot,
    cityPackPackId: cityPack.packId,
    requestedCityKey: cityPack.requestedCityKey,
    matchedCityKey: cityPack.matchedCityKey,
    citySpecificitySatisfied: cityPack.citySpecificitySatisfied === true,
    citySpecificityReason: cityPack.citySpecificityReason || null,
    scopeDisclosureRequired: cityPack.scopeDisclosureRequired === true,
    cityPackValidation: cityPack.validation,
    savedFaqReused,
    savedFaqReusePass,
    savedFaqValid,
    savedFaqAllowedIntent,
    savedFaqAuthorityScore,
    sourceSnapshotRefs,
    crossSystemConflictDetected,
    reasonCodes: normalizeReasonCodes(reasonCodes.concat(cityPack.reasonCodes || []))
  };
}

module.exports = {
  resolveKnowledgeIntegrationContext
};
