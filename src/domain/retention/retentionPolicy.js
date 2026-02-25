'use strict';

// Generated from docs/REPO_AUDIT_INPUTS/data_lifecycle.json baseline (add-only).

const RETENTION_POLICY = Object.freeze({
  'audit_logs': Object.freeze({ kind: 'evidence', retentionDays: 365, deletable: 'NO', recomputable: false }),
  'automation_config': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'automation_runs': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'billing_lifecycle_automation_logs': Object.freeze({ kind: 'evidence', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'checklists': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'city_pack_bulletins': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'city_pack_feedback': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'city_pack_metrics_daily': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'city_pack_requests': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'city_pack_template_library': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'city_pack_update_proposals': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'city_packs': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'decision_drifts': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'decision_logs': Object.freeze({ kind: 'evidence', retentionDays: 365, deletable: 'NO', recomputable: false }),
  'decision_timeline': Object.freeze({ kind: 'evidence', retentionDays: 365, deletable: 'NO', recomputable: false }),
  'events': Object.freeze({ kind: 'event', retentionDays: 180, deletable: 'CONDITIONAL', recomputable: true }),
  'faq_answer_logs': Object.freeze({ kind: 'event', retentionDays: 180, deletable: 'CONDITIONAL', recomputable: true }),
  'faq_articles': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'journey_kpi_daily': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'journey_graph_change_logs': Object.freeze({ kind: 'evidence', retentionDays: 365, deletable: 'NO', recomputable: false }),
  'link_registry': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'llm_quality_logs': Object.freeze({ kind: 'event', retentionDays: 180, deletable: 'CONDITIONAL', recomputable: true }),
  'llm_usage_logs': Object.freeze({ kind: 'event', retentionDays: 180, deletable: 'CONDITIONAL', recomputable: true }),
  'llm_usage_stats': Object.freeze({ kind: 'aggregate', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'notices': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'notification_deliveries': Object.freeze({ kind: 'event', retentionDays: 180, deletable: 'CONDITIONAL', recomputable: true }),
  'notification_templates': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'notification_test_run_items': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'notification_test_runs': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'notifications': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'opsConfig': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'ops_assist_cache': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'ops_segments': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'ops_read_model_snapshots': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'ops_state': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'ops_states': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'phase18_cta_stats': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'phase22_kpi_snapshots': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'phase2_reports_checklist_pending': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'phase2_reports_daily_events': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'phase2_reports_weekly_events': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'phase2_runs': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'redac_membership_links': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'rich_menu_bindings': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'send_retry_queue': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'source_audit_runs': Object.freeze({ kind: 'transient', retentionDays: 30, deletable: 'CONDITIONAL', recomputable: true }),
  'source_evidence': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'source_refs': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'stripe_webhook_dead_letters': Object.freeze({ kind: 'transient', retentionDays: 30, deletable: 'CONDITIONAL', recomputable: true }),
  'stripe_webhook_events': Object.freeze({ kind: 'evidence', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'system_flags': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'templates_v': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'user_checklists': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'user_consents': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'user_context_snapshots': Object.freeze({ kind: 'aggregate', retentionDays: 90, deletable: 'CONDITIONAL', recomputable: true }),
  'user_subscriptions': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
  'users': Object.freeze({ kind: 'config', retentionDays: 'INDEFINITE', deletable: 'NO', recomputable: false }),
});

function normalizeCollectionName(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function getRetentionPolicy(collection) {
  const key = normalizeCollectionName(collection);
  if (!key) return null;
  const policy = RETENTION_POLICY[key];
  if (!policy) {
    return { collection: key, kind: 'unknown', retentionDays: null, deletable: 'UNDEFINED', recomputable: false, defined: false };
  }
  return Object.assign({ collection: key, defined: true }, policy);
}

function listRetentionPolicies() {
  return Object.keys(RETENTION_POLICY).sort().map((collection) => Object.assign({ collection, defined: true }, RETENTION_POLICY[collection]));
}

module.exports = {
  getRetentionPolicy,
  listRetentionPolicies
};
