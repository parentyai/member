'use strict';

function parseFlag(name, fallback) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const normalized = raw.trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'on') return true;
  if (normalized === '0' || normalized === 'false' || normalized === 'off') return false;
  return fallback;
}

function parseNumber(name, fallback, min, max) {
  const raw = process.env[name];
  if (typeof raw !== 'string') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const normalized = Math.floor(parsed);
  if (Number.isFinite(min) && normalized < min) return fallback;
  if (Number.isFinite(max) && normalized > max) return fallback;
  return normalized;
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

function isTaskDetailLineEnabled() {
  return parseFlag('ENABLE_TASK_DETAIL_LINE_V1', true);
}

function isTaskContentAdminEditorEnabled() {
  return parseFlag('ENABLE_TASK_CONTENT_ADMIN_EDITOR_V1', true);
}

function isTaskDetailSectionSafetyValveEnabled() {
  return parseFlag('ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1', true);
}

function getTaskDetailSectionChunkLimit() {
  return parseNumber('TASK_DETAIL_SECTION_CHUNK_LIMIT', 3, 1, 8);
}

function isLinkRegistryIntentV2Enabled() {
  return parseFlag('ENABLE_LINK_REGISTRY_INTENT_V2', true);
}

function isTaskMicroLearningEnabled() {
  return parseFlag('ENABLE_TASK_MICRO_LEARNING_V1', true);
}

function isCityPackModuleSubscriptionEnabled() {
  return parseFlag('ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1', true);
}

function isJourneyAttentionBudgetEnabled() {
  return parseFlag('ENABLE_JOURNEY_ATTENTION_BUDGET_V1', true);
}

function getJourneyDailyAttentionBudgetMax() {
  return parseNumber('JOURNEY_DAILY_ATTENTION_BUDGET_MAX', 3, 1, 10);
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
  isTaskDetailLineEnabled,
  isTaskContentAdminEditorEnabled,
  isTaskDetailSectionSafetyValveEnabled,
  getTaskDetailSectionChunkLimit,
  isLinkRegistryIntentV2Enabled,
  isTaskMicroLearningEnabled,
  isCityPackModuleSubscriptionEnabled,
  isJourneyAttentionBudgetEnabled,
  getJourneyDailyAttentionBudgetMax,
  getTaskNudgeLinkPolicy
};
