'use strict';

function normalizeValue(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeScenarioKey(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const scenarioKey = normalizeValue(payload.scenarioKey);
  const scenario = normalizeValue(payload.scenario);
  return scenarioKey || scenario || null;
}

function detectScenarioDrift(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const scenarioKey = normalizeValue(payload.scenarioKey);
  const scenario = normalizeValue(payload.scenario);
  return Boolean(scenarioKey && scenario && scenarioKey !== scenario);
}

module.exports = {
  normalizeScenarioKey,
  detectScenarioDrift
};
