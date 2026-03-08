# FIRESTORE_RUNTIME_MAP

- generatedAt: 2026-03-08T02:47:49.524Z
- source.generatedAt: 2026-03-08T02:42:23.550Z
- runtime.firestore: OBSERVED_RUNTIME

`gcloud auth login --update-adc` and `gcloud auth application-default login` are required for Firestore runtime sampling.

| Collection | FieldCount | SampleDoc | Evidence |
| --- | --- | --- | --- |
| audit_logs | 8 | 0041Fy0EkdqASghk5k46 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| automation_config | 7 | 0FT60TbDar4khOerRMWa | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| automation_runs | 14 | 1xkB4IyUoGU5mVy30xl3 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| checklists | 8 | seed_chk_seed_users200_mix_20260304130143_001 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| city_pack_requests | 20 | cpr_c6c311a2-646b-454f-821c-0137ebf836be | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| city_packs | 21 | cp_4a5520f8-d76d-442d-afe6-1dabef4b0673 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| decision_logs | 10 | 19QzyrD754lQib14XOM9 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| decision_timeline | 10 | 02N7ItbyR89mCUBtYGZx | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| emergency_diffs | 14 | edf_00dc7e60aa4cf874a480aba5 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| emergency_events_normalized | 18 | eme_001897279a520104f0e8a917 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| emergency_providers | 13 | airnow_aqi | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| emergency_rules | 17 | stg_preview_test_rule | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| emergency_snapshots | 13 | nws_alerts__stg_dryrun_1772668054111__nws_alerts | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| emergency_unmapped_events | 9 | emu_008e6589371b121be6a5ee9e | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| events | 4 | 1GGJZSi8FMyGaD6tG9sc | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| faq_answer_logs | 6 | 00T0sWMjIs8ys9LVcSSi | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| faq_articles | 18 | 9EPiW2ItqfKbIAk4Cvkf | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| journey_kpi_daily | 21 | 2026-02-25 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| journey_param_change_logs | 11 | journey_param_1772067533494_c6b7e653b94e | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| journey_param_versions | 14 | jpv_1772067533370_8c5bad77436d | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| journey_reminder_runs | 12 | jrr_1771961990117_f0f832f8230b | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| journey_todo_items | 14 | U730STG000000000000000000000001__t730_case_a | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| journey_todo_stats | 13 | U_TEST_RIDAC_A_20260210092935 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| link_registry | 1 | TMdxdoNYN1Tcxz2vyOkp | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| llm_action_logs | 42 | 0BrQnyQT0kSjaMsyGpci | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| llm_policy_change_logs | 9 | llm_policy_1772559024239_c28c6a9892c1 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| llm_quality_logs | 10 | 0Q8ApDAgEc4BdPp3yxWy | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| llm_usage_logs | 14 | 2MFiqShlwgYfsG52sSf0 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| llm_usage_stats | 13 | U3037952f2f6531a3d8b24fd13ca3c680 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| notification_deliveries | 4 | I6mgmgKsEuVAaiO4IjXL | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| notification_templates | 7 | 3z37d1AaRgHeHp1BUD2B | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| notifications | 7 | 2ZMslooV6DWjzd0b5k1h | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| ops_read_model_snapshots | 8 | dashboard_kpi__1 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| opsConfig | 11 | journeyPolicy | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| phase18_cta_stats | 7 | 01URraLE2w4Fvwkd3kFm | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| rich_menu_rollout_runs | 11 | richmenu_apply_1772392074733_f9589a6d | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| ridac_membership_links | 5 | 571918a9d2f35adc96c63994b29d9d6261dc612ef3d4858856d10c5db839c943 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| seed_runs | 11 | seed_users200_mix_20260304130143 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| send_retry_queue | 11 | 0s2DIuSHQb87okG5fCQm | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| source_audit_runs | 14 | cp_run_1771907204462 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| source_refs | 19 | seed_sr_seed_users200_mix_20260304130143_boston | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| step_rules | 18 | mig_v1_A_arrival_registration | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| stripe_webhook_dead_letters | 6 | CIa43abT6VT6qRDt12la | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| stripe_webhook_events | 8 | evt_codex_e2e_1771954619 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| system_flags | 7 | phase0 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| task_contents | 13 | t730_case_a | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| tasks | 10 | U730STG000000000000000000000001__t730_case_a | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| user_journey_profiles | 6 | U_TEST_RIDAC_A_20260210092935 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| user_journey_schedules | 9 | U_TEST_RIDAC_A_20260210092935 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| user_subscriptions | 8 | U3037952f2f6531a3d8b24fd13ca3c680 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
| users | 17 | U3037952f2f6531a3d8b24fd13ca3c680 | runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
