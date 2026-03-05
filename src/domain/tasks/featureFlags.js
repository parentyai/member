'use strict';

function parseFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return fallback;
}

function parseIntEnv(name, fallback, min, max) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const value = Math.floor(parsed);
  if (Number.isFinite(min) && value < min) return fallback;
  if (Number.isFinite(max) && value > max) return fallback;
  return value;
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

function isTaskDetailLineEnabled() {
  return parseFlag('ENABLE_TASK_DETAIL_LINE_V1', true);
}

function isTaskCategorySystemEnabled() {
  return parseFlag('ENABLE_TASK_CATEGORY_SYSTEM_V1', true);
}

function isNextTaskEngineEnabled() {
  return parseFlag('ENABLE_NEXT_TASK_ENGINE_V1', true);
}

function isCityPackRecommendedTasksEnabled() {
  return parseFlag('ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1', true);
}

function isRichMenuTaskOsEntryEnabled() {
  return parseFlag('ENABLE_RICH_MENU_TASK_OS_ENTRY_V1', true);
}

function isTaskDetailSectionSafetyValveEnabled() {
  return parseFlag('ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1', true);
}

function isLinkRegistryIntentV2Enabled() {
  return parseFlag('ENABLE_LINK_REGISTRY_INTENT_V2', true);
}

function getTaskDependencyMax() {
  return parseIntEnv('TASK_DEPENDENCY_MAX', 10, 1, 20);
}

function getJourneyNextTaskMax() {
  return parseIntEnv('JOURNEY_NEXT_TASK_MAX', 3, 1, 10);
}

function getTaskDetailSectionChunkLimit() {
  return parseIntEnv('TASK_DETAIL_SECTION_CHUNK_LIMIT', 3, 1, 10);
}

module.exports = {
  isTaskEngineEnabled,
  isTaskNudgeEnabled,
  isTaskEventsEnabled,
  isJourneyTemplateEnabled,
  isJourneyUnifiedViewEnabled,
  isLegacyTodoDeriveFromTemplatesEnabled,
  isLegacyTodoEmitDisabled,
  getTaskNudgeLinkPolicy,
  isTaskDetailLineEnabled,
  isTaskCategorySystemEnabled,
  isNextTaskEngineEnabled,
  isCityPackRecommendedTasksEnabled,
  isRichMenuTaskOsEntryEnabled,
  isTaskDetailSectionSafetyValveEnabled,
  isLinkRegistryIntentV2Enabled,
  getTaskDependencyMax,
  getJourneyNextTaskMax,
  getTaskDetailSectionChunkLimit
};
