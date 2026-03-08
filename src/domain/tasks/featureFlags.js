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

const TASK_FEATURE_FLAG_REGISTRY = Object.freeze({
  ENABLE_TASK_ENGINE_V1: { owner: 'task-platform', defaultValue: false, reviewBy: '2026-06-30', rationale: 'task engine rollout gate', type: 'boolean' },
  ENABLE_TASK_NUDGE_V1: { owner: 'task-platform', defaultValue: false, reviewBy: '2026-06-30', rationale: 'task nudge pipeline gate', type: 'boolean' },
  ENABLE_TASK_EVENTS_V1: { owner: 'task-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'task events emit contract gate', type: 'boolean' },
  ENABLE_JOURNEY_TEMPLATE_V1: { owner: 'journey-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'journey template resolution gate', type: 'boolean' },
  ENABLE_JOURNEY_UNIFIED_VIEW_V1: { owner: 'journey-platform', defaultValue: false, reviewBy: '2026-06-30', rationale: 'unified journey view rollout', type: 'boolean' },
  ENABLE_LEGACY_TODO_DERIVE_FROM_TEMPLATES_V1: { owner: 'journey-platform', defaultValue: false, reviewBy: '2026-06-30', rationale: 'legacy todo derive compatibility', type: 'boolean' },
  ENABLE_LEGACY_TODO_EMIT_DISABLED_V1: { owner: 'journey-platform', defaultValue: false, reviewBy: '2026-06-30', rationale: 'legacy todo emit guard', type: 'boolean' },
  ENABLE_TASK_DETAIL_LINE_V1: { owner: 'task-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'line task detail surface gate', type: 'boolean' },
  ENABLE_TASK_CONTENT_ADMIN_EDITOR_V1: { owner: 'task-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'admin editor gate', type: 'boolean' },
  ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1: { owner: 'task-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'detail section chunking safety valve', type: 'boolean' },
  TASK_DETAIL_SECTION_CHUNK_LIMIT: { owner: 'task-platform', defaultValue: 3, reviewBy: '2026-06-30', rationale: 'detail chunk limit guardrail', type: 'number' },
  ENABLE_LINK_REGISTRY_INTENT_V2: { owner: 'link-registry', defaultValue: true, reviewBy: '2026-06-30', rationale: 'link intent resolver v2 gate', type: 'boolean' },
  ENABLE_TASK_MICRO_LEARNING_V1: { owner: 'task-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'micro learning rendering gate', type: 'boolean' },
  ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1: { owner: 'city-pack', defaultValue: true, reviewBy: '2026-06-30', rationale: 'city pack module subscription filter gate', type: 'boolean' },
  ENABLE_JOURNEY_ATTENTION_BUDGET_V1: { owner: 'journey-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'journey attention budget gate', type: 'boolean' },
  JOURNEY_DAILY_ATTENTION_BUDGET_MAX: { owner: 'journey-platform', defaultValue: 3, reviewBy: '2026-06-30', rationale: 'daily attention budget upper bound', type: 'number' },
  ENABLE_JOURNEY_NOTIFICATION_NARROWING_V1: { owner: 'journey-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'notification narrowing gate', type: 'boolean' },
  JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX: { owner: 'journey-platform', defaultValue: 1, reviewBy: '2026-06-30', rationale: 'primary notification cap', type: 'number' },
  ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1: { owner: 'journey-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'regional procedures entry gate', type: 'boolean' },
  ENABLE_TASK_CATEGORY_SYSTEM_V1: { owner: 'task-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'task category routing gate', type: 'boolean' },
  ENABLE_NEXT_TASK_ENGINE_V1: { owner: 'task-platform', defaultValue: true, reviewBy: '2026-06-30', rationale: 'next task engine gate', type: 'boolean' },
  ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1: { owner: 'city-pack', defaultValue: true, reviewBy: '2026-06-30', rationale: 'city pack recommended tasks sync gate', type: 'boolean' },
  ENABLE_RICH_MENU_TASK_OS_ENTRY_V1: { owner: 'line-experience', defaultValue: true, reviewBy: '2026-06-30', rationale: 'rich menu task os entry gate', type: 'boolean' },
  TASK_DEPENDENCY_MAX: { owner: 'task-platform', defaultValue: 10, reviewBy: '2026-06-30', rationale: 'task dependency fan-out cap', type: 'number' },
  JOURNEY_NEXT_TASK_MAX: { owner: 'journey-platform', defaultValue: 3, reviewBy: '2026-06-30', rationale: 'journey next task top-N cap', type: 'number' },
  ENABLE_LINK_REGISTRY_IMPACT_MAP_V1: { owner: 'link-registry', defaultValue: true, reviewBy: '2026-06-30', rationale: 'link impact mapping gate', type: 'boolean' },
  TASK_NUDGE_LINK_POLICY: { owner: 'task-platform', defaultValue: 'strict', reviewBy: '2026-06-30', rationale: 'task nudge link policy mode', type: 'enum' },
  ENABLE_UXOS_EVENTS_V1: { owner: 'ux-os', defaultValue: false, reviewBy: '2026-06-30', rationale: 'ux os events append gate', type: 'boolean' },
  ENABLE_UXOS_NBA_V1: { owner: 'ux-os', defaultValue: false, reviewBy: '2026-06-30', rationale: 'ux os nba surface gate', type: 'boolean' },
  ENABLE_UXOS_FATIGUE_WARN_V1: { owner: 'ux-os', defaultValue: false, reviewBy: '2026-06-30', rationale: 'fatigue warning diagnostics gate', type: 'boolean' },
  ENABLE_UXOS_POLICY_READONLY_V1: { owner: 'ux-os', defaultValue: false, reviewBy: '2026-06-30', rationale: 'policy read-only pane gate', type: 'boolean' },
  ENABLE_VENDOR_RELEVANCE_SHADOW_V1: { owner: 'vendor-ranking', defaultValue: true, reviewBy: '2026-06-30', rationale: 'vendor relevance shadow diagnostics', type: 'boolean' },
  ENABLE_VENDOR_RELEVANCE_SORT_V1: { owner: 'vendor-ranking', defaultValue: false, reviewBy: '2026-06-30', rationale: 'vendor relevance sort rollout', type: 'boolean' }
});

function getTaskFeatureFlagRegistry() {
  return Object.keys(TASK_FEATURE_FLAG_REGISTRY)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => Object.assign({ name }, TASK_FEATURE_FLAG_REGISTRY[name]));
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

function isJourneyNotificationNarrowingEnabled() {
  return parseFlag('ENABLE_JOURNEY_NOTIFICATION_NARROWING_V1', true);
}

function getJourneyPrimaryNotificationDailyMax() {
  return parseNumber('JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX', 1, 1, 5);
}

function isJourneyRegionalProceduresEnabled() {
  return parseFlag('ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1', true);
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

function getTaskDependencyMax() {
  return parseNumber('TASK_DEPENDENCY_MAX', 10, 1, 20);
}

function getJourneyNextTaskMax() {
  return parseNumber('JOURNEY_NEXT_TASK_MAX', 3, 1, 10);
}

function isLinkRegistryImpactMapEnabled() {
  return parseFlag('ENABLE_LINK_REGISTRY_IMPACT_MAP_V1', true);
}

function getTaskNudgeLinkPolicy() {
  const raw = typeof process.env.TASK_NUDGE_LINK_POLICY === 'string'
    ? process.env.TASK_NUDGE_LINK_POLICY.trim().toLowerCase()
    : '';
  if (raw === 'lenient') return 'lenient';
  return 'strict';
}

function isUxOsEventsEnabled() {
  return parseFlag('ENABLE_UXOS_EVENTS_V1', false);
}

function isUxOsNbaEnabled() {
  return parseFlag('ENABLE_UXOS_NBA_V1', false);
}

function isUxOsFatigueWarnEnabled() {
  return parseFlag('ENABLE_UXOS_FATIGUE_WARN_V1', false);
}

function isUxOsPolicyReadonlyEnabled() {
  return parseFlag('ENABLE_UXOS_POLICY_READONLY_V1', false);
}

function isVendorRelevanceShadowEnabled() {
  return parseFlag('ENABLE_VENDOR_RELEVANCE_SHADOW_V1', true);
}

function isVendorRelevanceSortEnabled() {
  return parseFlag('ENABLE_VENDOR_RELEVANCE_SORT_V1', false);
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
  isJourneyNotificationNarrowingEnabled,
  getJourneyPrimaryNotificationDailyMax,
  isJourneyRegionalProceduresEnabled,
  isTaskCategorySystemEnabled,
  isNextTaskEngineEnabled,
  isCityPackRecommendedTasksEnabled,
  isRichMenuTaskOsEntryEnabled,
  getTaskDependencyMax,
  getJourneyNextTaskMax,
  isLinkRegistryImpactMapEnabled,
  getTaskNudgeLinkPolicy,
  isUxOsEventsEnabled,
  isUxOsNbaEnabled,
  isUxOsFatigueWarnEnabled,
  isUxOsPolicyReadonlyEnabled,
  isVendorRelevanceShadowEnabled,
  isVendorRelevanceSortEnabled,
  getTaskFeatureFlagRegistry
};
