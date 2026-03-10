# FEATURE_FLAG_GOVERNANCE

- generatedAt: 2026-03-10T13:07:34.694Z
- gitCommit: 17c0117e43391e5524a727e544cc5e14e9d83fd6
- branch: codex/spec-v2-pr5-action-gateway-intercept
- flagCount: 86
- source: src/**/*.js
- check: `npm run feature-flags:check`

| Flag | Owner | Default | ReviewBy | BlastRadius | Purpose | Source |
| --- | --- | --- | --- | --- | --- | --- |
| ENABLE_ADMIN_BUILD_META | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_build_meta | src/index.js:64 |
| ENABLE_ADMIN_DEVELOPER_SURFACE_V1 | admin-ops | false | 2026-09-30 | ops_facing | Runtime gate for enable_admin_developer_surface_v1 | src/index.js:120 |
| ENABLE_ADMIN_HISTORY_SYNC | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_history_sync | src/index.js:80 |
| ENABLE_ADMIN_HOME_CLEAN_SURFACE_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_home_clean_surface_v1 | src/index.js:100 |
| ENABLE_ADMIN_LEGACY_STATUS_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_legacy_status_v1 | src/index.js:124 |
| ENABLE_ADMIN_LOCAL_PREFLIGHT_BLOCKING_V1 | admin-ops | false | 2026-09-30 | ops_facing | Runtime gate for enable_admin_local_preflight_blocking_v1 | src/index.js:88 |
| ENABLE_ADMIN_LOCAL_PREFLIGHT_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_local_preflight_v1 | src/index.js:84 |
| ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_nav_all_accessible_v1 | src/index.js:72 |
| ENABLE_ADMIN_NAV_ROLLOUT_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_nav_rollout_v1 | src/index.js:68 |
| ENABLE_ADMIN_NO_COLLAPSE_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_no_collapse_v1 | src/index.js:92 |
| ENABLE_ADMIN_OPS_ONLY_NAV_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_ops_only_nav_v1 | src/index.js:116 |
| ENABLE_ADMIN_ROLE_PERSIST | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_role_persist | src/index.js:76 |
| ENABLE_ADMIN_TOP_SUMMARY_V1 | admin-ops | false | 2026-09-30 | ops_facing | Runtime gate for enable_admin_top_summary_v1 | src/index.js:96 |
| ENABLE_ADMIN_TREND_UI | admin-ops | false | 2026-09-30 | ops_facing | Runtime gate for enable_admin_trend_ui | src/index.js:176<br>src/index.js:184 |
| ENABLE_ADMIN_UI_FOUNDATION_V1 | admin-ops | false | 2026-09-30 | ops_facing | Runtime gate for enable_admin_ui_foundation_v1 | src/index.js:47 |
| ENABLE_ADMIN_USERS_STRIPE_LAYOUT_V1 | admin-ops | true | 2026-09-30 | ops_facing | Runtime gate for enable_admin_users_stripe_layout_v1 | src/index.js:104 |
| ENABLE_BILLING_LIFECYCLE_AUTOMATION | billing | false | 2026-09-30 | cross_module | Runtime gate for enable_billing_lifecycle_automation | src/usecases/billing/handleBillingLifecycleAutomation.js:22 |
| ENABLE_CITY_PACK_AUDIT_RUNS_ORDERBY_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_audit_runs_orderby_v1 | src/repos/firestore/sourceAuditRunsRepo.js:18 |
| ENABLE_CITY_PACK_CONTENT_MANAGE_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_content_manage_v1 | src/index.js:108 |
| ENABLE_CITY_PACK_METRICS_BOUNDED_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_metrics_bounded_v1 | src/usecases/cityPack/computeCityPackMetrics.js:46 |
| ENABLE_CITY_PACK_METRICS_DAILY_PREFERRED_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_metrics_daily_preferred_v1 | src/usecases/cityPack/computeCityPackMetrics.js:50 |
| ENABLE_CITY_PACK_MODULE_SUBSCRIPTION_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_module_subscription_v1 | src/domain/tasks/featureFlags.js:118 |
| ENABLE_CITY_PACK_RECOMMENDED_TASKS_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_recommended_tasks_v1 | src/domain/tasks/featureFlags.js:150 |
| ENABLE_CITY_PACK_REVIEW_INBOX_BATCH_READ_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_review_inbox_batch_read_v1 | src/routes/admin/cityPackReviewInbox.js:81 |
| ENABLE_CITY_PACK_SOURCE_REFS_BUFFERED_LIMIT_V1 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_source_refs_buffered_limit_v1 | src/repos/firestore/sourceRefsRepo.js:39 |
| ENABLE_CITY_PACK_UI_V2 | city-pack | true | 2026-09-30 | user_facing | Runtime gate for enable_city_pack_ui_v2 | src/index.js:112 |
| ENABLE_COMPOSER_AB_OPTION_V1 | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_composer_ab_option_v1 | src/index.js:140 |
| ENABLE_COMPOSER_CATEGORY_WIZARD_V1 | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_composer_category_wizard_v1 | src/index.js:136 |
| ENABLE_CONTEXT_SNAPSHOT_V2 | context-platform | false | 2026-09-30 | cross_module | Runtime gate for enable_context_snapshot_v2 | src/routes/internal/userContextSnapshotRecompressJob.js:22 |
| ENABLE_CONVERSATION_ROUTER | assistant-paid | true | 2026-09-30 | cross_module | Runtime gate for enable_conversation_router | src/routes/webhookLine.js:383 |
| ENABLE_EMERGENCY | emergency-layer | false | 2026-09-30 | cross_module | Runtime gate for enable_emergency | src/usecases/emergency/runEmergencySync.js:280 |
| ENABLE_INTENT_ALIAS_V1 | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_intent_alias_v1 | src/repos/firestore/opsConfigRepo.js:80 |
| ENABLE_JOURNEY_ATTENTION_BUDGET_V1 | journey-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_journey_attention_budget_v1 | src/domain/tasks/featureFlags.js:122 |
| ENABLE_JOURNEY_BRANCH_QUEUE_V1 | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_branch_queue_v1 | src/usecases/journey/applyJourneyReactionBranch.js:9<br>src/usecases/journey/runJourneyBranchDispatchJob.js:17 |
| ENABLE_JOURNEY_DAG_CATALOG_V1 | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_dag_catalog_v1 | src/routes/admin/journeyGraphCatalogConfig.js:47<br>src/usecases/journey/syncJourneyDagCatalogToTodos.js:30 |
| ENABLE_JOURNEY_DAG_UI_V1 | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_dag_ui_v1 | src/routes/admin/journeyGraphCatalogConfig.js:48 |
| ENABLE_JOURNEY_KPI | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_kpi | src/routes/admin/osJourneyKpi.js:9<br>src/routes/internal/journeyKpiBuildJob.js:21 |
| ENABLE_JOURNEY_NOTIFICATION_NARROWING_V1 | journey-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_journey_notification_narrowing_v1 | src/domain/tasks/featureFlags.js:130 |
| ENABLE_JOURNEY_PARAM_CANARY_V1 | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_param_canary_v1 | src/usecases/journey/resolveEffectiveJourneyParams.js:36 |
| ENABLE_JOURNEY_PARAM_VERSIONING_V1 | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_param_versioning_v1 | src/usecases/journey/resolveEffectiveJourneyParams.js:110<br>src/usecases/journey/runJourneyTodoReminderJob.js:57 |
| ENABLE_JOURNEY_REGIONAL_PROCEDURES_V1 | journey-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_journey_regional_procedures_v1 | src/domain/tasks/featureFlags.js:138 |
| ENABLE_JOURNEY_REMINDER_JOB | journey-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_journey_reminder_job | src/routes/admin/journeyPolicyConfig.js:66<br>src/usecases/journey/runJourneyTodoReminderJob.js:43 |
| ENABLE_JOURNEY_RULE_ENGINE_V1 | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_rule_engine_v1 | src/routes/admin/journeyGraphCatalogConfig.js:49<br>src/usecases/journey/runJourneyTodoReminderJob.js:50 |
| ENABLE_JOURNEY_TEMPLATE_V1 | journey-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_journey_template_v1 | src/domain/tasks/featureFlags.js:78 |
| ENABLE_JOURNEY_UNIFIED_VIEW_V1 | journey-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_journey_unified_view_v1 | src/domain/tasks/featureFlags.js:82 |
| ENABLE_LEGACY_TODO_DERIVE_FROM_TEMPLATES_V1 | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_legacy_todo_derive_from_templates_v1 | src/domain/tasks/featureFlags.js:86 |
| ENABLE_LEGACY_TODO_EMIT_DISABLED_V1 | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_legacy_todo_emit_disabled_v1 | src/domain/tasks/featureFlags.js:90 |
| ENABLE_LINE_CTA_BUTTONS_V1 | notification-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_line_cta_buttons_v1 | src/usecases/adminOs/previewNotification.js:65<br>src/usecases/notifications/sendNotification.js:144 |
| ENABLE_LINK_REGISTRY_IMPACT_MAP_V1 | link-registry | true | 2026-09-30 | cross_module | Runtime gate for enable_link_registry_impact_map_v1 | src/domain/tasks/featureFlags.js:166 |
| ENABLE_LINK_REGISTRY_INTENT_V2 | link-registry | true | 2026-09-30 | cross_module | Runtime gate for enable_link_registry_intent_v2 | src/domain/tasks/featureFlags.js:110 |
| ENABLE_NEXT_TASK_ENGINE_V1 | platform-core | true | 2026-09-30 | cross_module | Runtime gate for enable_next_task_engine_v1 | src/domain/tasks/featureFlags.js:146 |
| ENABLE_NOTIFICATION_CTA_MULTI_V1 | notification-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_notification_cta_multi_v1 | src/routes/admin/osNotifications.js:88<br>src/usecases/adminOs/previewNotification.js:40 |
| ENABLE_OPS_REALTIME_DASHBOARD_V1 | ops-platform | true | 2026-09-30 | ops_facing | Runtime gate for enable_ops_realtime_dashboard_v1 | src/index.js:128 |
| ENABLE_OPS_SYSTEM_SNAPSHOT_V1 | ops-platform | true | 2026-09-30 | ops_facing | Runtime gate for enable_ops_system_snapshot_v1 | src/index.js:132<br>src/routes/admin/opsFeatureCatalogStatus.js:22 |
| ENABLE_PAID_FAQ_QUALITY_V2 | assistant-paid | true | 2026-09-30 | user_facing | Runtime gate for enable_paid_faq_quality_v2 | src/routes/admin/journeyPolicyConfig.js:68<br>src/routes/webhookLine.js:363 |
| ENABLE_PAID_OPPORTUNITY_ENGINE_V1 | assistant-paid | false | 2026-09-30 | user_facing | Runtime gate for enable_paid_opportunity_engine_v1 | src/routes/webhookLine.js:379 |
| ENABLE_PAID_ORCHESTRATOR_V2 | assistant-paid | false | 2026-09-30 | user_facing | Runtime gate for enable_paid_orchestrator_v2 | src/routes/webhookLine.js:387 |
| ENABLE_PRO_PREDICTIVE_ACTIONS_V1 | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_pro_predictive_actions_v1 | src/routes/webhookLine.js:375 |
| ENABLE_REACTION_RESPONSE_TEXT_STORE_V1 | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_reaction_response_text_store_v1 | src/usecases/phase37/sanitizeReactionResponseText.js:13 |
| ENABLE_RETRY_QUEUE_GIVEUP_V1 | platform-core | true | 2026-09-30 | cross_module | Runtime gate for enable_retry_queue_giveup_v1 | src/routes/phase73RetryQueue.js:43 |
| ENABLE_RICH_MENU_DYNAMIC | platform-core | true | 2026-09-30 | cross_module | Runtime gate for enable_rich_menu_dynamic | src/routes/admin/journeyPolicyConfig.js:67<br>src/usecases/journey/applyPersonalizedRichMenu.js:23 |
| ENABLE_RICH_MENU_TASK_OS_ENTRY_V1 | platform-core | true | 2026-09-30 | cross_module | Runtime gate for enable_rich_menu_task_os_entry_v1 | src/domain/tasks/featureFlags.js:154 |
| ENABLE_SNAPSHOT_ONLY_CONTEXT_V1 | context-platform | false | 2026-09-30 | cross_module | Runtime gate for enable_snapshot_only_context_v1 | src/routes/webhookLine.js:367 |
| ENABLE_STRIPE_WEBHOOK | billing | false | 2026-09-30 | cross_module | Runtime gate for enable_stripe_webhook | src/routes/webhookStripe.js:13 |
| ENABLE_TASK_CATEGORY_SYSTEM_V1 | task-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_task_category_system_v1 | src/domain/tasks/featureFlags.js:142 |
| ENABLE_TASK_CONTENT_ADMIN_EDITOR_V1 | task-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_task_content_admin_editor_v1 | src/domain/tasks/featureFlags.js:98 |
| ENABLE_TASK_DETAIL_LINE_V1 | task-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_task_detail_line_v1 | src/domain/tasks/featureFlags.js:94 |
| ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1 | task-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_task_detail_section_safety_valve_v1 | src/domain/tasks/featureFlags.js:102 |
| ENABLE_TASK_ENGINE_V1 | task-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_task_engine_v1 | src/domain/tasks/featureFlags.js:66 |
| ENABLE_TASK_EVENTS_V1 | task-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_task_events_v1 | src/domain/tasks/featureFlags.js:74 |
| ENABLE_TASK_GRAPH_V1 | task-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_task_graph_v1 | src/routes/webhookLine.js:371 |
| ENABLE_TASK_MICRO_LEARNING_V1 | task-platform | true | 2026-09-30 | user_facing | Runtime gate for enable_task_micro_learning_v1 | src/domain/tasks/featureFlags.js:114 |
| ENABLE_TASK_NUDGE_V1 | task-platform | false | 2026-09-30 | user_facing | Runtime gate for enable_task_nudge_v1 | src/domain/tasks/featureFlags.js:70 |
| ENABLE_USER_CONTEXT_SNAPSHOT | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_user_context_snapshot | src/routes/internal/userContextSnapshotJob.js:22 |
| ENABLE_UXOS_EVENTS_V1 | ux-os | false | 2026-09-30 | user_facing | Runtime gate for enable_uxos_events_v1 | src/domain/tasks/featureFlags.js:178 |
| ENABLE_UXOS_FATIGUE_WARN_V1 | ux-os | false | 2026-09-30 | user_facing | Runtime gate for enable_uxos_fatigue_warn_v1 | src/domain/tasks/featureFlags.js:186<br>src/index.js:148 |
| ENABLE_UXOS_NBA_V1 | ux-os | false | 2026-09-30 | user_facing | Runtime gate for enable_uxos_nba_v1 | src/domain/tasks/featureFlags.js:182 |
| ENABLE_UXOS_POLICY_READONLY_V1 | ux-os | false | 2026-09-30 | user_facing | Runtime gate for enable_uxos_policy_readonly_v1 | src/domain/tasks/featureFlags.js:190<br>src/index.js:144 |
| ENABLE_V1_ACTION_GATEWAY | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_v1_action_gateway | src/routes/webhookLine.js:415 |
| ENABLE_V1_CHANNEL_EDGE | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_v1_channel_edge | src/routes/webhookLine.js:396 |
| ENABLE_V1_FAST_SLOW_ACK | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_v1_fast_slow_ack | src/routes/webhookLine.js:3156 |
| ENABLE_V1_FAST_SLOW_DISPATCH | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_v1_fast_slow_dispatch | src/routes/webhookLine.js:400 |
| ENABLE_V1_LIFF_SYNTHETIC_EVENTS | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_v1_liff_synthetic_events | src/index.js:152 |
| ENABLE_V1_LINE_RENDERER | platform-core | false | 2026-09-30 | cross_module | Runtime gate for enable_v1_line_renderer | src/infra/lineClient.js:149<br>src/infra/lineClient.js:167 |
| ENABLE_VENDOR_RELEVANCE_SHADOW_V1 | vendor-ranking | true | 2026-09-30 | cross_module | Runtime gate for enable_vendor_relevance_shadow_v1 | src/domain/tasks/featureFlags.js:194 |
| ENABLE_VENDOR_RELEVANCE_SORT_V1 | vendor-ranking | false | 2026-09-30 | cross_module | Runtime gate for enable_vendor_relevance_sort_v1 | src/domain/tasks/featureFlags.js:198 |

