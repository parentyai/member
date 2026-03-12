'use strict';

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeReasonCodes(values) {
  const rows = Array.isArray(values) ? values : [];
  const out = [];
  rows.forEach((item) => {
    const normalized = normalizeText(item).toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    if (!out.includes(normalized)) out.push(normalized);
  });
  return out.slice(0, 12);
}

function normalizeSeverity(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (!normalized) return null;
  return normalized;
}

function resolveEmergencyQualityContext(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const nested = payload.emergencyContext && typeof payload.emergencyContext === 'object'
    ? payload.emergencyContext
    : null;
  const active = payload.emergencyContext === true
    || payload.emergencyContextActive === true
    || (nested && nested.active === true);
  const severity = normalizeSeverity(payload.emergencySeverity)
    || normalizeSeverity(nested && nested.severity)
    || null;
  const officialSourceSatisfied = typeof payload.emergencyOfficialSourceSatisfied === 'boolean'
    ? payload.emergencyOfficialSourceSatisfied
    : (nested && typeof nested.officialSourceSatisfied === 'boolean'
      ? nested.officialSourceSatisfied
      : null);
  const reasonCodes = normalizeReasonCodes([].concat(
    payload.emergencyReasonCodes || [],
    nested && Array.isArray(nested.reasonCodes) ? nested.reasonCodes : []
  ));
  if (active && !reasonCodes.includes('emergency_context_active')) reasonCodes.push('emergency_context_active');
  if (active && officialSourceSatisfied !== true && !reasonCodes.includes('emergency_official_source_missing')) {
    reasonCodes.push('emergency_official_source_missing');
  }
  return {
    active,
    severity,
    officialSourceSatisfied,
    reasonCodes: normalizeReasonCodes(reasonCodes)
  };
}

module.exports = {
  resolveEmergencyQualityContext
};
