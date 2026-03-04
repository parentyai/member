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

function isJourneyUnifiedViewEnabled() {
  return parseFlag('ENABLE_JOURNEY_UNIFIED_VIEW_V1', false);
}

function isLegacyTodoDeriveFromTemplatesEnabled() {
  return parseFlag('ENABLE_LEGACY_TODO_DERIVE_FROM_TEMPLATES_V1', false);
}

function isLegacyTodoEmitDisabled() {
  return parseFlag('ENABLE_LEGACY_TODO_EMIT_DISABLED_V1', false);
}

function getTaskNudgeLinkPolicy() {
  const raw = typeof process.env.TASK_NUDGE_LINK_POLICY === 'string'
    ? process.env.TASK_NUDGE_LINK_POLICY.trim().toLowerCase()
    : '';
  if (raw === 'lenient') return 'lenient';
  return 'strict';
}

module.exports = {
  isTaskEngineEnabled,
  isTaskNudgeEnabled,
  isTaskEventsEnabled,
  isJourneyTemplateEnabled,
  isJourneyUnifiedViewEnabled,
  isLegacyTodoDeriveFromTemplatesEnabled,
  isLegacyTodoEmitDisabled,
  getTaskNudgeLinkPolicy
};
