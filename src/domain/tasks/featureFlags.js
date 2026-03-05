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

function isTaskContentLinkMigrationEnabled() {
  return parseFlag('ENABLE_TASK_CONTENT_LINK_MIGRATION_V1', true);
}

function isTaskContentLinkMigrationApplyEnabled() {
  return parseFlag('ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1', false);
}

function isTaskUxAuditKpiEnabled() {
  return parseFlag('ENABLE_TASK_UX_AUDIT_KPI_V1', true);
}

function isLinkRegistryImpactMapEnabled() {
  return parseFlag('ENABLE_LINK_REGISTRY_IMPACT_MAP_V1', true);
}

function isTaskDetailContinuationMetricsEnabled() {
  return parseFlag('ENABLE_TASK_DETAIL_CONTINUATION_METRICS_V1', true);
}

function isTaskDetailGuideCommandsEnabled() {
  return parseFlag('ENABLE_TASK_DETAIL_GUIDE_COMMANDS_V1', true);
}

function getTaskUxAuditOverlapWarnThresholdPct() {
  return parseNumber('TASK_UX_AUDIT_OVERLAP_WARN_THRESHOLD_PCT', 95, 0, 100);
}

function getTaskUxAuditTaskKeyWarnThresholdPct() {
  return parseNumber('TASK_UX_AUDIT_TASKKEY_WARN_THRESHOLD_PCT', 80, 0, 100);
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
  isTaskContentLinkMigrationEnabled,
  isTaskContentLinkMigrationApplyEnabled,
  isTaskUxAuditKpiEnabled,
  isLinkRegistryImpactMapEnabled,
  isTaskDetailContinuationMetricsEnabled,
  isTaskDetailGuideCommandsEnabled,
  getTaskUxAuditOverlapWarnThresholdPct,
  getTaskUxAuditTaskKeyWarnThresholdPct,
  getTaskNudgeLinkPolicy
};
