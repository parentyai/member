'use strict';

function parseFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return fallback;
}

function isTaskEngineEnabled() {
  return parseFlag('ENABLE_TASK_ENGINE_V1', false);
}

function isTaskNudgeEnabled() {
  return parseFlag('ENABLE_TASK_NUDGE_V1', false);
}

function isTaskEventsEnabled() {
  return parseFlag('ENABLE_TASK_EVENTS_V1', true);
}

function isJourneyTemplateEnabled() {
  return parseFlag('ENABLE_JOURNEY_TEMPLATE_V1', true);
}

module.exports = {
  isTaskEngineEnabled,
  isTaskNudgeEnabled,
  isTaskEventsEnabled,
  isJourneyTemplateEnabled
};
