'use strict';

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
  return out.slice(0, Number.isFinite(Number(limit)) ? Math.max(0, Math.floor(Number(limit))) : 8);
}

function mapSourceRefIds(validation) {
  const rows = validation && Array.isArray(validation.sourceRefs) ? validation.sourceRefs : [];
  return uniqueStrings(rows.map((item) => item && (item.sourceRefId || item.id || item.refId)), 8);
}

function resolveCityPackQualityContext(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const validation = payload.cityPackValidation && typeof payload.cityPackValidation === 'object'
    ? payload.cityPackValidation
    : null;
  const blockingInvalidSourceRefs = validation && Array.isArray(validation.blockingInvalidSourceRefs)
    ? validation.blockingInvalidSourceRefs.slice(0, 8)
    : [];
  const optionalInvalidSourceRefs = validation && Array.isArray(validation.optionalInvalidSourceRefs)
    ? validation.optionalInvalidSourceRefs.slice(0, 8)
    : [];
  const packId = normalizeText(payload.cityPackPackId) || null;
  const sourceReadinessDecision = normalizeText(payload.cityPackSourceReadinessDecision).toLowerCase() || null;
  const sourceReadinessReasons = uniqueStrings(payload.cityPackSourceReadinessReasons, 8)
    .map((item) => item.toLowerCase().replace(/\s+/g, '_'));
  const requestedCityKey = normalizeText(payload.requestedCityKey).toLowerCase() || null;
  const matchedCityKey = normalizeText(payload.matchedCityKey).toLowerCase() || null;
  const citySpecificitySatisfied = payload.citySpecificitySatisfied === true;
  const citySpecificityReason = normalizeText(payload.citySpecificityReason).toLowerCase() || null;
  const scopeDisclosureRequired = payload.scopeDisclosureRequired === true;
  const context = payload.cityPackContext === true || Boolean(packId) || Boolean(validation) || Boolean(requestedCityKey);
  const grounded = payload.cityPackGrounded === true
    || (citySpecificitySatisfied === true && validation ? validation.blocked !== true : false);
  const requiredSourcesSatisfied = typeof payload.cityPackRequiredSourcesSatisfied === 'boolean'
    ? payload.cityPackRequiredSourcesSatisfied
    : (validation ? blockingInvalidSourceRefs.length === 0 : null);

  let groundingReason = normalizeText(payload.cityPackGroundingReason).toLowerCase() || null;
  if (!groundingReason) {
    if (requiredSourcesSatisfied === false) groundingReason = 'required_sources_blocked';
    else if (citySpecificitySatisfied !== true && citySpecificityReason) groundingReason = citySpecificityReason;
    else if (optionalInvalidSourceRefs.length > 0) groundingReason = 'optional_sources_stale';
    else if (grounded === true) groundingReason = 'validated_sources_available';
    else if (context) groundingReason = 'city_pack_context_without_grounding';
  }

  const sourceSnapshot = payload.cityPackSourceSnapshot && typeof payload.cityPackSourceSnapshot === 'object'
    ? Object.assign({}, payload.cityPackSourceSnapshot)
    : {
        packId,
        sourceRefIds: mapSourceRefIds(validation),
        blockingInvalidSourceRefs,
        optionalInvalidSourceRefs,
        sourceReadinessDecision,
        blocked: validation ? validation.blocked === true : null
      };

  const reasonCodes = [];
  if (context) reasonCodes.push('city_pack_context_active');
  if (requestedCityKey && citySpecificitySatisfied !== true) reasonCodes.push('city_specificity_missing');
  if (requiredSourcesSatisfied === false) reasonCodes.push('city_pack_required_source_blocked');
  if (optionalInvalidSourceRefs.length > 0) reasonCodes.push('city_pack_optional_source_stale');
  if (scopeDisclosureRequired) reasonCodes.push('city_scope_disclosure_required');
  if (groundingReason && !reasonCodes.includes(groundingReason)) reasonCodes.push(groundingReason);
  sourceReadinessReasons.forEach((item) => {
    if (!reasonCodes.includes(item)) reasonCodes.push(item);
  });

  return {
    context,
    grounded,
    groundingReason,
    freshnessScore: clamp01(payload.cityPackFreshnessScore),
    authorityScore: clamp01(payload.cityPackAuthorityScore),
    requiredSourcesSatisfied,
    requestedCityKey,
    matchedCityKey,
    citySpecificitySatisfied,
    citySpecificityReason,
    scopeDisclosureRequired,
    sourceSnapshot,
    packId,
    validation,
    reasonCodes: reasonCodes.slice(0, 12)
  };
}

module.exports = {
  resolveCityPackQualityContext
};
