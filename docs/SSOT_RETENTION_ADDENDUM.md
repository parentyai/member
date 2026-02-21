# SSOT_RETENTION_ADDENDUM

- 本書は `src/domain/retention/retentionPolicy.js` と `docs/REPO_AUDIT_INPUTS/data_lifecycle.json` の整合補足。
- 物理削除の実行は本フェーズ対象外。
- `retention=UNDEFINED_IN_CODE` は `retentionDays=null` を意味し、保持期間未確定を示す。

## Collection分類

| kind | count |
| --- | --- |
| aggregate | 7 |
| config | 31 |
| event | 3 |
| evidence | 3 |
| transient | 1 |

## Collection方針

| collection | kind | retention | deletable | recomputable |
| --- | --- | --- | --- | --- |
| `audit_logs` | evidence | UNDEFINED_IN_CODE | false | false |
| `automation_config` | config | UNDEFINED_IN_CODE | false | false |
| `automation_runs` | config | UNDEFINED_IN_CODE | false | false |
| `checklists` | config | UNDEFINED_IN_CODE | false | false |
| `city_pack_bulletins` | config | UNDEFINED_IN_CODE | false | false |
| `city_pack_feedback` | config | UNDEFINED_IN_CODE | false | false |
| `city_pack_metrics_daily` | aggregate | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `city_pack_requests` | config | UNDEFINED_IN_CODE | false | false |
| `city_pack_template_library` | config | UNDEFINED_IN_CODE | false | false |
| `city_pack_update_proposals` | config | UNDEFINED_IN_CODE | false | false |
| `city_packs` | config | UNDEFINED_IN_CODE | false | false |
| `decision_drifts` | config | UNDEFINED_IN_CODE | false | false |
| `decision_logs` | evidence | UNDEFINED_IN_CODE | false | false |
| `decision_timeline` | evidence | UNDEFINED_IN_CODE | false | false |
| `events` | event | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `faq_answer_logs` | event | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `faq_articles` | config | UNDEFINED_IN_CODE | false | false |
| `link_registry` | config | UNDEFINED_IN_CODE | false | false |
| `notices` | config | UNDEFINED_IN_CODE | false | false |
| `notification_deliveries` | event | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `notification_templates` | config | UNDEFINED_IN_CODE | false | false |
| `notification_test_run_items` | config | UNDEFINED_IN_CODE | false | false |
| `notification_test_runs` | config | UNDEFINED_IN_CODE | false | false |
| `notifications` | config | UNDEFINED_IN_CODE | false | false |
| `ops_assist_cache` | config | UNDEFINED_IN_CODE | false | false |
| `ops_read_model_snapshots` | aggregate | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `ops_segments` | config | UNDEFINED_IN_CODE | false | false |
| `ops_state` | config | UNDEFINED_IN_CODE | false | false |
| `ops_states` | config | UNDEFINED_IN_CODE | false | false |
| `phase18_cta_stats` | aggregate | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `phase2_reports_checklist_pending` | aggregate | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `phase2_reports_daily_events` | aggregate | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `phase2_reports_weekly_events` | aggregate | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `phase2_runs` | aggregate | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `phase22_kpi_snapshots` | config | UNDEFINED_IN_CODE | false | false |
| `redac_membership_links` | config | UNDEFINED_IN_CODE | false | false |
| `send_retry_queue` | config | UNDEFINED_IN_CODE | false | false |
| `source_audit_runs` | transient | UNDEFINED_IN_CODE | CONDITIONAL | true |
| `source_evidence` | config | UNDEFINED_IN_CODE | false | false |
| `source_refs` | config | UNDEFINED_IN_CODE | false | false |
| `system_flags` | config | UNDEFINED_IN_CODE | false | false |
| `templates_v` | config | UNDEFINED_IN_CODE | false | false |
| `user_checklists` | config | UNDEFINED_IN_CODE | false | false |
| `user_consents` | config | UNDEFINED_IN_CODE | false | false |
| `users` | config | UNDEFINED_IN_CODE | false | false |
