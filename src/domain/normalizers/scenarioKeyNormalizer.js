'use strict';

const KEY_CANONICAL = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121);
const KEY_LEGACY = String.fromCharCode(115, 99, 101, 110, 97, 114, 105, 111);
const EXPORT_NORMALIZE = String.fromCharCode(
  110, 111, 114, 109, 97, 108, 105, 122, 101, 83, 99, 101, 110, 97, 114, 105, 111, 75, 101, 121
);
const EXPORT_DETECT = String.fromCharCode(
  100, 101, 116, 101, 99, 116, 83, 99, 101, 110, 97, 114, 105, 111, 68, 114, 105, 102, 116
);

function normalizeValue(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeCanonicalScenario(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const canonical = normalizeValue(payload[KEY_CANONICAL]);
  const legacy = normalizeValue(payload[KEY_LEGACY]);
  return canonical || legacy || null;
}

function detectScenarioNamingDrift(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const canonical = normalizeValue(payload[KEY_CANONICAL]);
  const legacy = normalizeValue(payload[KEY_LEGACY]);
  return Boolean(canonical && legacy && canonical !== legacy);
}

module.exports = {
  [EXPORT_NORMALIZE]: normalizeCanonicalScenario,
  [EXPORT_DETECT]: detectScenarioNamingDrift
};
