# SSOT_RETENTION_ADDENDUM

- 本書は `src/domain/retention/retentionPolicy.js` と `docs/REPO_AUDIT_INPUTS/data_lifecycle.json` の整合補足。
- 物理削除の実行は本フェーズ対象外。
- `retention=INDEFINITE` は削除期限を定義しない明示値を示す。
- `retention=UNDEFINED_IN_CODE` は未定義であり、運用上の解消対象を示す。

## Collection分類

| kind | count |
| --- | --- |
| aggregate | 10 |
| config | 37 |
| event | 5 |
| evidence | 7 |
| transient | 3 |

## Collection方針

| collection | kind | retention | deletable | recomputable |
| --- | --- | --- | --- | --- |
| `audit_logs` | evidence | 365d | false | false |
| `automation_config` | config | INDEFINITE | false | false |
| `automation_runs` | config | INDEFINITE | false | false |
| `billing_lifecycle_automation_logs` | evidence | INDEFINITE | false | false |
| `checklists` | config | INDEFINITE | false | false |
| `city_pack_bulletins` | config | INDEFINITE | false | false |
| `city_pack_feedback` | config | INDEFINITE | false | false |
| `city_pack_metrics_daily` | aggregate | 90d | CONDITIONAL | true |
| `city_pack_requests` | config | INDEFINITE | false | false |
| `city_pack_template_library` | config | INDEFINITE | false | false |
| `city_pack_update_proposals` | config | INDEFINITE | false | false |
| `city_packs` | config | INDEFINITE | false | false |
| `decision_drifts` | config | INDEFINITE | false | false |
| `decision_logs` | evidence | 365d | false | false |
| `decision_timeline` | evidence | 365d | false | false |
| `events` | event | 180d | CONDITIONAL | true |
| `faq_answer_logs` | event | 180d | CONDITIONAL | true |
| `faq_articles` | config | INDEFINITE | false | false |
| `journey_graph_change_logs` | evidence | 365d | false | false |
| `journey_kpi_daily` | aggregate | 90d | CONDITIONAL | true |
| `link_registry` | config | INDEFINITE | false | false |
| `llm_quality_logs` | event | 180d | CONDITIONAL | true |
| `llm_usage_logs` | event | 180d | CONDITIONAL | true |
| `llm_usage_stats` | aggregate | INDEFINITE | false | false |
| `notices` | config | INDEFINITE | false | false |
| `notification_deliveries` | event | 180d | CONDITIONAL | true |
| `notification_templates` | config | INDEFINITE | false | false |
| `notification_test_run_items` | config | INDEFINITE | false | false |
| `notification_test_runs` | config | INDEFINITE | false | false |
| `notifications` | config | INDEFINITE | false | false |
| `ops_assist_cache` | config | INDEFINITE | false | false |
| `ops_read_model_snapshots` | aggregate | 90d | CONDITIONAL | true |
| `ops_segments` | config | INDEFINITE | false | false |
| `ops_state` | config | INDEFINITE | false | false |
| `ops_states` | config | INDEFINITE | false | false |
| `opsConfig` | config | INDEFINITE | false | false |
| `phase18_cta_stats` | aggregate | 90d | CONDITIONAL | true |
| `phase2_reports_checklist_pending` | aggregate | 90d | CONDITIONAL | true |
| `phase2_reports_daily_events` | aggregate | 90d | CONDITIONAL | true |
| `phase2_reports_weekly_events` | aggregate | 90d | CONDITIONAL | true |
| `phase2_runs` | aggregate | 90d | CONDITIONAL | true |
| `phase22_kpi_snapshots` | config | INDEFINITE | false | false |
| `redac_membership_links` | config | INDEFINITE | false | false |
| `rich_menu_assignment_rules` | config | INDEFINITE | false | false |
| `rich_menu_bindings` | config | INDEFINITE | false | false |
| `rich_menu_phase_profiles` | config | INDEFINITE | false | false |
| `rich_menu_rate_buckets` | transient | 30d | CONDITIONAL | true |
| `rich_menu_rollout_runs` | evidence | 365d | false | false |
| `rich_menu_templates` | config | INDEFINITE | false | false |
| `send_retry_queue` | config | INDEFINITE | false | false |
| `source_audit_runs` | transient | 30d | CONDITIONAL | true |
| `source_evidence` | config | INDEFINITE | false | false |
| `source_refs` | config | INDEFINITE | false | false |
| `stripe_webhook_dead_letters` | transient | 30d | CONDITIONAL | true |
| `stripe_webhook_events` | evidence | INDEFINITE | false | false |
| `system_flags` | config | INDEFINITE | false | false |
| `templates_v` | config | INDEFINITE | false | false |
| `user_checklists` | config | INDEFINITE | false | false |
| `user_consents` | config | INDEFINITE | false | false |
| `user_context_snapshots` | aggregate | 90d | CONDITIONAL | true |
| `user_subscriptions` | config | INDEFINITE | false | false |
| `users` | config | INDEFINITE | false | false |
