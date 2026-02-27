# Member 構造成熟度 再評価レポート（84c2d34基準）

- 監査基準時点: 2026-02-27（branch: main, commit: 84c2d34）
- 基準コミット: `84c2d347b6df2612270250b0c5708429ae247625`
- 基準コマンド: `git status -sb`, `npm run catchup:drift-check`, `npm run audit-core:check`
- 判定: `catchup:drift-check` 全PASS / `audit-core:check` PASS
- drift: `live_count_match=true` / `count_drift(routes,usecases,repos,collections)=0,0,0,0`（`docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json`）

## 1. 機能一覧（構造化）

共通実測: `dependency_graph` の `route_to_usecase/usecase_to_repo/repo_to_collection` は live 再構築と差分 0（`artifact_only=0`,`live_only=0`）。

### 通知作成/承認/送信
- 機能名: 通知作成/承認/送信
- プロダクト上の役割: 通知の草稿作成・承認・配信実行を管理する中核フロー。
- 入口(route/webhook/admin/internal): src/routes/admin/notifications.js(admin), src/routes/admin/osNotifications.js(admin), src/routes/phase36NoticeSend.js(public), src/routes/phase67PlanSend.js(public), src/routes/phase68ExecuteSend.js(public), src/routes/phase121OpsNoticeSend.js(public)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), approveNotification(src/usecases/adminOs/approveNotification.js), createNotification(src/usecases/notifications/createNotification.js), executeNotificationSend(src/usecases/adminOs/executeNotificationSend.js), executeSegmentSend(src/usecases/phase68/executeSegmentSend.js), listNotifications(src/usecases/notifications/listNotifications.js), planNotificationSend(src/usecases/adminOs/planNotificationSend.js), planSegmentSend(src/usecases/phase67/planSegmentSend.js), previewNotification(src/usecases/adminOs/previewNotification.js), sendNotice(src/usecases/phase36/sendNotice.js), sendNotification(src/usecases/notifications/sendNotification.js), sendOpsNotice(src/usecases/phase121/sendOpsNotice.js), testSendNotification(src/usecases/notifications/testSendNotification.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/automationConfigRepo.js, src/repos/firestore/automationRunsRepo.js, src/repos/firestore/decisionLogsRepo.js, src/repos/firestore/decisionTimelineRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/noticesRepo.js, src/repos/firestore/notificationTemplatesRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/opsStatesRepo.js, src/repos/firestore/sendRetryQueueRepo.js, src/repos/firestore/systemFlagsRepo.js, src/repos/firestore/templatesVRepo.js, src/repos/firestore/usersRepo.js
- Firestore collections: audit_logs, automation_config, automation_runs, decision_logs, decision_timeline, link_registry, notices, notification_deliveries, notification_templates, notifications, ops_states, send_retry_queue, system_flags, templates_v, users
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): validateSingleCta, validateLinkRequired, validateWarnLinkBlock, getKillSwitch, evaluateNotificationPolicy, checkNotificationCap
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 678
- Phase由来(導入最古/拡張最新): 最古Phase0 / 最新Phase672（tests/phase* token一致 87件） / legacy feature=phase121OpsNoticeSend
- 状態: レガシー混在
- live_delta: artifact_only=0 / live_only=0

### Link Registry
- 機能名: Link Registry
- プロダクト上の役割: 遷移先URLの登録・健全性確認・クリック導線を管理する。
- 入口(route/webhook/admin/internal): src/routes/admin/linkRegistry.js(admin), src/routes/admin/osLinkRegistryLookup.js(admin), src/routes/trackClick.js(public), src/routes/trackClickGet.js(public)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), checkLinkHealth(src/usecases/linkRegistry/checkLinkHealth.js), createLink(src/usecases/linkRegistry/createLink.js), deleteLink(src/usecases/linkRegistry/deleteLink.js), listLinks(src/usecases/linkRegistry/listLinks.js), recordClickAndRedirect(src/usecases/track/recordClickAndRedirect.js), updateLink(src/usecases/linkRegistry/updateLink.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js
- Firestore collections: audit_logs, link_registry, notification_deliveries, notifications
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): validateWarnLinkBlock
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 327
- Phase由来(導入最古/拡張最新): 最古Phase0 / 最新Phase671（tests/phase* token一致 44件）
- 状態: 部分
- live_delta: artifact_only=0 / live_only=0

### Kill Switch
- 機能名: Kill Switch
- プロダクト上の役割: 送信系/内部ジョブ系の即時停止フラグを制御する。
- 入口(route/webhook/admin/internal): src/routes/admin/osKillSwitch.js(admin)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), getKillSwitch(src/usecases/killSwitch/setKillSwitch.js), setKillSwitch(src/usecases/killSwitch/setKillSwitch.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/systemFlagsRepo.js
- Firestore collections: audit_logs, system_flags
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): getKillSwitch, setKillSwitch, killSwitch
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 52
- Phase由来(導入最古/拡張最新): 最古Phase0 / 最新Phase669（tests/phase* token一致 22件）
- 状態: 完成
- live_delta: artifact_only=0 / live_only=0

### City Pack
- 機能名: City Pack
- プロダクト上の役割: City Pack本体・配信素材・監査ジョブを運用する。
- 入口(route/webhook/admin/internal): src/routes/admin/cityPacks.js(admin), src/routes/admin/cityPackBulletins.js(admin), src/routes/admin/cityPackTemplateLibrary.js(admin), src/routes/admin/cityPackUpdateProposals.js(admin), src/routes/internal/cityPackDraftGeneratorJob.js(internal), src/routes/internal/cityPackSourceAuditJob.js(internal)
- usecases: activateCityPack(src/usecases/cityPack/activateCityPack.js), appendAuditLog(src/usecases/audit/appendAuditLog.js), composeCityAndNationwidePacks(src/usecases/nationwidePack/composeCityAndNationwidePacks.js), runCityPackDraftJob(src/usecases/cityPack/runCityPackDraftJob.js), runCityPackSourceAuditJob(src/usecases/cityPack/runCityPackSourceAuditJob.js), sendNotification(src/usecases/notifications/sendNotification.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/cityPackBulletinsRepo.js, src/repos/firestore/cityPackRequestsRepo.js, src/repos/firestore/cityPacksRepo.js, src/repos/firestore/decisionTimelineRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/sourceAuditRunsRepo.js, src/repos/firestore/sourceEvidenceRepo.js, src/repos/firestore/sourceRefsRepo.js, src/repos/firestore/usersRepo.js
- Firestore collections: audit_logs, city_pack_bulletins, city_pack_requests, city_packs, decision_timeline, link_registry, notification_deliveries, notifications, source_audit_runs, source_evidence, source_refs, users
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): validateCityPackSources, validateCityPackSchoolLinks, requireInternalJobToken, getKillSwitch
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 389
- Phase由来(導入最古/拡張最新): 最古Phase0 / 最新Phase670（tests/phase* token一致 31件）
- 状態: 完成
- live_delta: artifact_only=0 / live_only=0

### City Pack Requests
- 機能名: City Pack Requests
- プロダクト上の役割: 地域リクエストからCity Packの下書き生成/有効化を行う。
- 入口(route/webhook/admin/internal): src/routes/admin/cityPackRequests.js(admin)
- usecases: activateCityPack(src/usecases/cityPack/activateCityPack.js), appendAuditLog(src/usecases/audit/appendAuditLog.js), runCityPackDraftJob(src/usecases/cityPack/runCityPackDraftJob.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/cityPackRequestsRepo.js, src/repos/firestore/cityPacksRepo.js, src/repos/firestore/sourceRefsRepo.js
- Firestore collections: audit_logs, city_pack_requests, city_packs, source_refs
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): validateCityPackSources, validateCityPackSchoolLinks, getKillSwitch
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 70
- Phase由来(導入最古/拡張最新): 最古Phase260 / 最新Phase666（tests/phase* token一致 7件）
- 状態: 完成
- live_delta: artifact_only=0 / live_only=0

### City Pack Review Inbox
- 機能名: City Pack Review Inbox
- プロダクト上の役割: City Pack審査キュー・差分レビュー・監査集約を担う。
- 入口(route/webhook/admin/internal): src/routes/admin/cityPackReviewInbox.js(admin)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), computeCityPackMetrics(src/usecases/cityPack/computeCityPackMetrics.js), normalizeLimit(src/usecases/cityPack/computeCityPackMetrics.js), normalizeWindowDays(src/usecases/cityPack/computeCityPackMetrics.js), reviewSourceRefDecision(src/usecases/cityPack/reviewSourceRefDecision.js), runCityPackSourceAuditJob(src/usecases/cityPack/runCityPackSourceAuditJob.js)
- repos: src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/cityPackBulletinsRepo.js, src/repos/firestore/cityPacksRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/emergencyBulletinsRepo.js, src/repos/firestore/emergencyDiffsRepo.js, src/repos/firestore/emergencyProvidersRepo.js, src/repos/firestore/emergencySnapshotsRepo.js, src/repos/firestore/emergencyUnmappedEventsRepo.js, src/repos/firestore/journeyGraphCatalogRepo.js, src/repos/firestore/journeyParamVersionsRepo.js, src/repos/firestore/journeyPolicyRepo.js, src/repos/firestore/journeyReminderRunsRepo.js, src/repos/firestore/journeyTodoItemsRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/sourceAuditRunsRepo.js, src/repos/firestore/sourceEvidenceRepo.js, src/repos/firestore/sourceRefsRepo.js, src/repos/firestore/userJourneySchedulesRepo.js, src/repos/firestore/usersRepo.js
- Firestore collections: audit_logs, checklists, city_pack_bulletins, city_packs, emergency_bulletins, emergency_diffs, emergency_providers, emergency_snapshots, emergency_unmapped_events, events, journey_param_versions, journey_reminder_runs, journey_todo_items, link_registry, notification_deliveries, notifications, opsConfig, source_audit_runs, source_evidence, source_refs, user_checklists, user_journey_schedules, users
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): getKillSwitch
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 187
- Phase由来(導入最古/拡張最新): 最古Phase250 / 最新Phase668（tests/phase* token一致 5件）
- 状態: 完成
- live_delta: artifact_only=0 / live_only=0

### City Pack Evidence
- 機能名: City Pack Evidence
- プロダクト上の役割: City Packの根拠情報参照と監査証跡を提供する。
- 入口(route/webhook/admin/internal): src/routes/admin/cityPackEvidence.js(admin)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js)
- repos: src/repos/firestore/auditLogsRepo.js
- Firestore collections: audit_logs
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): -
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 40
- Phase由来(導入最古/拡張最新): 未観測（tests/phase* token一致 0件）
- 状態: 部分
- live_delta: artifact_only=0 / live_only=0

### Emergency
- 機能名: Emergency
- プロダクト上の役割: 緊急情報の取得・正規化・承認・通知配信を運用する。
- 入口(route/webhook/admin/internal): src/routes/admin/emergencyLayer.js(admin), src/routes/internal/emergencyJobs.js(internal)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), approveEmergencyBulletin(src/usecases/emergency/approveEmergencyBulletin.js), fetchProviderSnapshot(src/usecases/emergency/fetchProviderSnapshot.js), getEmergencyBulletin(src/usecases/emergency/adminEmergencyLayer.js), getEmergencyEvidence(src/usecases/emergency/adminEmergencyLayer.js), listEmergencyBulletins(src/usecases/emergency/adminEmergencyLayer.js), listEmergencyProviders(src/usecases/emergency/adminEmergencyLayer.js), normalizeAndDiffProvider(src/usecases/emergency/normalizeAndDiffProvider.js), rejectEmergencyBulletin(src/usecases/emergency/adminEmergencyLayer.js), runEmergencySync(src/usecases/emergency/runEmergencySync.js), summarizeDraftWithLLM(src/usecases/emergency/summarizeDraftWithLLM.js), updateEmergencyProvider(src/usecases/emergency/adminEmergencyLayer.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/emergencyBulletinsRepo.js, src/repos/firestore/emergencyDiffsRepo.js, src/repos/firestore/emergencyEventsRepo.js, src/repos/firestore/emergencyProvidersRepo.js, src/repos/firestore/emergencySnapshotsRepo.js, src/repos/firestore/emergencyUnmappedEventsRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/systemFlagsRepo.js
- Firestore collections: audit_logs, emergency_bulletins, emergency_diffs, emergency_events_normalized, emergency_providers, emergency_snapshots, emergency_unmapped_events, link_registry, system_flags
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): requireInternalJobToken, getKillSwitch, validatePreconditions, validateSingleCta, validateWarnLinkBlock
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: あり
- テスト本数: 111
- Phase由来(導入最古/拡張最新): 最古Phase657 / 最新Phase669（tests/phase* token一致 2件）
- 状態: 完成
- live_delta: artifact_only=0 / live_only=0

### FAQ/KB
- 機能名: FAQ/KB
- プロダクト上の役割: FAQ/KB管理とLLM FAQ応答を提供する。
- 入口(route/webhook/admin/internal): src/routes/admin/kbArticles.js(admin), src/routes/admin/llmFaq.js(admin), src/routes/phaseLLM4FaqAnswer.js(public)
- usecases: answerFaqFromKb(src/usecases/faq/answerFaqFromKb.js), appendAuditLog(src/usecases/audit/appendAuditLog.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/faqAnswerLogsRepo.js, src/repos/firestore/faqArticlesRepo.js, src/repos/firestore/systemFlagsRepo.js
- Firestore collections: audit_logs, faq_answer_logs, faq_articles, system_flags
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): validateKbArticle
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: あり
- テスト本数: 120
- Phase由来(導入最古/拡張最新): 最古Phase219 / 最新Phase249（tests/phase* token一致 12件） / legacy feature=phaseLLM4FaqAnswer
- 状態: レガシー混在
- live_delta: artifact_only=0 / live_only=0

### User管理
- 機能名: User管理
- プロダクト上の役割: ユーザー要約・状態集計・タイムライン表示を提供する。
- 入口(route/webhook/admin/internal): src/routes/admin/osUsersSummaryAnalyze.js(admin), src/routes/admin/osUsersSummaryExport.js(admin), src/routes/admin/userTimeline.js(admin), src/routes/phase5Ops.js(public), src/routes/phase5State.js(public), src/routes/phase6MemberSummary.js(public)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), buildTemplateKey(src/usecases/adminOs/planNotificationSend.js), getMemberSummary(src/usecases/phase6/getMemberSummary.js), getNotificationsSummaryFiltered(src/usecases/phase5/getNotificationsSummaryFiltered.js), getStaleMemberNumberUsers(src/usecases/phase5/getStaleMemberNumberUsers.js), getUserStateSummary(src/usecases/phase5/getUserStateSummary.js), getUsersSummaryFiltered(src/usecases/phase5/getUsersSummaryFiltered.js)
- repos: src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/opsSnapshotsRepo.js, src/repos/firestore/opsStatesRepo.js, src/repos/firestore/systemFlagsRepo.js, src/repos/firestore/usersRepo.js
- Firestore collections: audit_logs, checklists, events, notification_deliveries, notifications, ops_read_model_snapshots, ops_states, system_flags, user_checklists, users
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): -
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 515
- Phase由来(導入最古/拡張最新): 最古Phase1 / 最新Phase672（tests/phase* token一致 139件）
- 状態: 部分
- live_delta: artifact_only=0 / live_only=0

### Deliveries/Click Tracking
- 機能名: Deliveries/Click Tracking
- プロダクト上の役割: 配信結果参照とクリック追跡を提供する。
- 入口(route/webhook/admin/internal): src/routes/admin/notificationDeliveries.js(admin), src/routes/trackClick.js(public), src/routes/trackClickGet.js(public)
- usecases: getNotificationDeliveries(src/usecases/deliveries/getNotificationDeliveries.js), recordClickAndRedirect(src/usecases/track/recordClickAndRedirect.js)
- repos: src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/usersRepo.js
- Firestore collections: link_registry, notification_deliveries, notifications, users
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): validateWarnLinkBlock
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 298
- Phase由来(導入最古/拡張最新): 最古Phase0 / 最新Phase671（tests/phase* token一致 5件）
- 状態: 部分
- live_delta: artifact_only=0 / live_only=0

### Analytics/Read Model
- 機能名: Analytics/Read Model
- プロダクト上の役割: 配信Read ModelとKPI可視化を提供する。
- 入口(route/webhook/admin/internal): src/routes/admin/readModel.js(admin), src/routes/admin/monitorInsights.js(admin), src/routes/admin/osDashboardKpi.js(admin), src/routes/admin/osJourneyKpi.js(admin)
- usecases: aggregateJourneyKpis(src/usecases/journey/aggregateJourneyKpis.js), appendAuditLog(src/usecases/audit/appendAuditLog.js), getNotificationReadModel(src/usecases/admin/getNotificationReadModel.js)
- repos: src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/journeyKpiDailyRepo.js, src/repos/firestore/journeyTodoStatsRepo.js, src/repos/firestore/llmUsageLogsRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/userSubscriptionsRepo.js
- Firestore collections: audit_logs, checklists, events, journey_kpi_daily, journey_todo_stats, llm_usage_logs, notification_deliveries, notifications, user_checklists, user_subscriptions, users
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): getKillSwitch
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: あり
- テスト本数: 254
- Phase由来(導入最古/拡張最新): 最古Phase4 / 最新Phase672（tests/phase* token一致 36件）
- 状態: 完成
- live_delta: artifact_only=0 / live_only=0

### Ops Console
- 機能名: Ops Console
- プロダクト上の役割: 運用ダッシュボード/意思決定ビュー/準備度確認を提供する。
- 入口(route/webhook/admin/internal): src/routes/admin/opsOverview.js(admin), src/routes/admin/osView.js(admin), src/routes/phase25OpsConsole.js(public), src/routes/phase26OpsConsoleList.js(public), src/routes/phase42OpsConsoleView.js(public), src/routes/phase38OpsDashboard.js(public), src/routes/admin/productReadiness.js(admin), src/routes/admin/readPathFallbackSummary.js(admin), src/routes/admin/opsSnapshotHealth.js(admin)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), getNotificationOperationalSummary(src/usecases/admin/getNotificationOperationalSummary.js), getOpsAssistForConsole(src/usecases/phase46/getOpsAssistForConsole.js), getOpsConsole(src/usecases/phase25/getOpsConsole.js), getOpsConsoleView(src/usecases/phase42/getOpsConsoleView.js), getOpsDashboard(src/usecases/phase38/getOpsDashboard.js), getUserOperationalSummary(src/usecases/admin/getUserOperationalSummary.js), listOpsConsole(src/usecases/phase26/listOpsConsole.js)
- repos: src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/decisionDriftsRepo.js, src/repos/firestore/decisionLogsRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/journeyTodoStatsRepo.js, src/repos/firestore/llmUsageStatsRepo.js, src/repos/firestore/noticesRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/opsAssistCacheRepo.js, src/repos/firestore/opsSnapshotsRepo.js, src/repos/firestore/userJourneyProfilesRepo.js, src/repos/firestore/userJourneySchedulesRepo.js, src/repos/firestore/userSubscriptionsRepo.js, src/repos/firestore/usersRepo.js
- Firestore collections: audit_logs, checklists, decision_drifts, decision_logs, events, journey_todo_stats, llm_usage_stats, notices, notification_deliveries, notifications, ops_assist_cache, ops_read_model_snapshots, user_checklists, user_journey_profiles, user_journey_schedules, user_subscriptions, users
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): getKillSwitch
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: あり
- テスト本数: 574
- Phase由来(導入最古/拡張最新): 最古Phase4 / 最新Phase672（tests/phase* token一致 88件）
- 状態: 部分
- live_delta: artifact_only=0 / live_only=0

### LLM Guard
- 機能名: LLM Guard
- プロダクト上の役割: LLM設定・同意・運用説明・利用量監査を提供する。
- 入口(route/webhook/admin/internal): src/routes/admin/llmConfig.js(admin), src/routes/admin/llmPolicyConfig.js(admin), src/routes/admin/llmConsent.js(admin), src/routes/admin/llmOps.js(admin), src/routes/phaseLLM2OpsExplain.js(public), src/routes/phaseLLM3OpsNextActions.js(public), src/routes/admin/osLlmUsageSummary.js(admin), src/routes/admin/osLlmUsageExport.js(admin)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js), getNextActionCandidates(src/usecases/phaseLLM3/getNextActionCandidates.js), getOpsExplanation(src/usecases/phaseLLM2/getOpsExplanation.js)
- repos: src/repos/firestore/auditLogsRepo.js, src/repos/firestore/systemFlagsRepo.js
- Firestore collections: audit_logs, system_flags
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): evaluateLlmAvailability, evaluateLLMBudget
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: あり
- テスト本数: 292
- Phase由来(導入最古/拡張最新): 最古Phase227 / 最新Phase657（tests/phase* token一致 12件）
- 状態: 部分
- live_delta: artifact_only=0 / live_only=0

### Retention/Policy
- 機能名: Retention/Policy
- プロダクト上の役割: Retention dry-run/apply実行と監査参照を提供する。
- 入口(route/webhook/admin/internal): src/routes/internal/retentionDryRunJob.js(internal), src/routes/internal/retentionApplyJob.js(internal), src/routes/admin/retentionRuns.js(admin)
- usecases: appendAuditLog(src/usecases/audit/appendAuditLog.js)
- repos: src/repos/firestore/auditLogsRepo.js
- Firestore collections: audit_logs
- guard依存(validators/killSwitch/protectionMatrix/indexFallback): requireInternalJobToken, getRetentionPolicy
- traceId連携: あり（feature_map.trace_linked）
- audit_logs連携: あり（feature_map.audit_linked）
- LLM依存有無: なし
- テスト本数: 126
- Phase由来(導入最古/拡張最新): 最古Phase307 / 最新Phase657（tests/phase* token一致 6件）
- 状態: 完成
- live_delta: artifact_only=0 / live_only=0

## 2. レイヤー構造図（静的構造）

```text
[Interface Layer]
  webhook: src/routes/webhookLine.js
  admin: src/routes/admin/*.js (例: osNotifications.js, cityPackRequests.js, emergencyLayer.js)
  public: src/routes/trackClick.js, src/routes/phase36NoticeSend.js
  internal: src/routes/internal/*.js (例: emergencyJobs.js, retentionDryRunJob.js)
        |
        v
[Application Layer]
  usecases/* (例: notifications/sendNotification.js, cityPack/activateCityPack.js, emergency/runEmergencySync.js)
        |
        v
[Repository Layer]
  repos/firestore/* (例: notificationsRepo.js, cityPacksRepo.js, emergencyBulletinsRepo.js)
        |
        v
[Data Layer]
  Firestore collections (notifications, city_packs, emergency_bulletins, audit_logs, ... )

[Guard Layer] --(横断)--> Interface/Application/Repository
  validators, killSwitch(systemFlagsRepo), protection_matrix, indexFallbackPolicy

[Observability Layer] --(横断)--> Interface/Application/Repository
  audit_logs, events, decision_timeline, notification_deliveries
```

依存方向: `Interface -> Application -> Repository -> Data`、`Guard/Observability` は横断依存。

## 3. 機能 × 依存マトリクス

| 機能 | repo依存 | collection依存 | guard依存 | index依存 | fallback依存 | LLM依存 |
|---|---|---|---|---|---|---|
| 通知作成/承認/送信 | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/automationConfigRepo.js, src/repos/firestore/automationRunsRepo.js, src/repos/firestore/decisionLogsRepo.js, src/repos/firestore/decisionTimelineRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/noticesRepo.js, src/repos/firestore/notificationTemplatesRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/opsStatesRepo.js, src/repos/firestore/sendRetryQueueRepo.js, src/repos/firestore/systemFlagsRepo.js, src/repos/firestore/templatesVRepo.js, src/repos/firestore/usersRepo.js | audit_logs, automation_config, automation_runs, decision_logs, decision_timeline, link_registry, notices, notification_deliveries, notification_templates, notifications, ops_states, send_retry_queue, system_flags, templates_v, users | validateSingleCta, validateLinkRequired, validateWarnLinkBlock, getKillSwitch, evaluateNotificationPolicy, checkNotificationCap | - | - | - |
| Link Registry | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js | audit_logs, link_registry, notification_deliveries, notifications | validateWarnLinkBlock | - | - | - |
| Kill Switch | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/systemFlagsRepo.js | audit_logs, system_flags | getKillSwitch, setKillSwitch, killSwitch | - | - | - |
| City Pack | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/cityPackBulletinsRepo.js, src/repos/firestore/cityPackRequestsRepo.js, src/repos/firestore/cityPacksRepo.js, src/repos/firestore/decisionTimelineRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/sourceAuditRunsRepo.js, src/repos/firestore/sourceEvidenceRepo.js, src/repos/firestore/sourceRefsRepo.js, src/repos/firestore/usersRepo.js | audit_logs, city_pack_bulletins, city_pack_requests, city_packs, decision_timeline, link_registry, notification_deliveries, notifications, source_audit_runs, source_evidence, source_refs, users | validateCityPackSources, validateCityPackSchoolLinks, requireInternalJobToken, getKillSwitch | city_packs_language_status_updatedAt_desc | - | - |
| City Pack Requests | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/cityPackRequestsRepo.js, src/repos/firestore/cityPacksRepo.js, src/repos/firestore/sourceRefsRepo.js | audit_logs, city_pack_requests, city_packs, source_refs | validateCityPackSources, validateCityPackSchoolLinks, getKillSwitch | - | - | - |
| City Pack Review Inbox | src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/cityPackBulletinsRepo.js, src/repos/firestore/cityPacksRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/emergencyBulletinsRepo.js, src/repos/firestore/emergencyDiffsRepo.js, src/repos/firestore/emergencyProvidersRepo.js, src/repos/firestore/emergencySnapshotsRepo.js, src/repos/firestore/emergencyUnmappedEventsRepo.js, src/repos/firestore/journeyGraphCatalogRepo.js, src/repos/firestore/journeyParamVersionsRepo.js, src/repos/firestore/journeyPolicyRepo.js, src/repos/firestore/journeyReminderRunsRepo.js, src/repos/firestore/journeyTodoItemsRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/sourceAuditRunsRepo.js, src/repos/firestore/sourceEvidenceRepo.js, src/repos/firestore/sourceRefsRepo.js, src/repos/firestore/userJourneySchedulesRepo.js, src/repos/firestore/usersRepo.js | audit_logs, checklists, city_pack_bulletins, city_packs, emergency_bulletins, emergency_diffs, emergency_providers, emergency_snapshots, emergency_unmapped_events, events, journey_param_versions, journey_reminder_runs, journey_todo_items, link_registry, notification_deliveries, notifications, opsConfig, source_audit_runs, source_evidence, source_refs, user_checklists, user_journey_schedules, users | getKillSwitch | - | - | - |
| City Pack Evidence | src/repos/firestore/auditLogsRepo.js | audit_logs | - | - | - | - |
| Emergency | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/emergencyBulletinsRepo.js, src/repos/firestore/emergencyDiffsRepo.js, src/repos/firestore/emergencyEventsRepo.js, src/repos/firestore/emergencyProvidersRepo.js, src/repos/firestore/emergencySnapshotsRepo.js, src/repos/firestore/emergencyUnmappedEventsRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/systemFlagsRepo.js | audit_logs, emergency_bulletins, emergency_diffs, emergency_events_normalized, emergency_providers, emergency_snapshots, emergency_unmapped_events, link_registry, system_flags | requireInternalJobToken, getKillSwitch, validatePreconditions, validateSingleCta, validateWarnLinkBlock | - | - | あり |
| FAQ/KB | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/faqAnswerLogsRepo.js, src/repos/firestore/faqArticlesRepo.js, src/repos/firestore/systemFlagsRepo.js | audit_logs, faq_answer_logs, faq_articles, system_flags | validateKbArticle | - | - | あり |
| User管理 | src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/opsSnapshotsRepo.js, src/repos/firestore/opsStatesRepo.js, src/repos/firestore/systemFlagsRepo.js, src/repos/firestore/usersRepo.js | audit_logs, checklists, events, notification_deliveries, notifications, ops_read_model_snapshots, ops_states, system_flags, user_checklists, users | - | - | - | - |
| Deliveries/Click Tracking | src/repos/firestore/deliveriesRepo.js, src/repos/firestore/linkRegistryRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/usersRepo.js | link_registry, notification_deliveries, notifications, users | validateWarnLinkBlock | - | - | - |
| Analytics/Read Model | src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/journeyKpiDailyRepo.js, src/repos/firestore/journeyTodoStatsRepo.js, src/repos/firestore/llmUsageLogsRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/userSubscriptionsRepo.js | audit_logs, checklists, events, journey_kpi_daily, journey_todo_stats, llm_usage_logs, notification_deliveries, notifications, user_checklists, user_subscriptions, users | getKillSwitch | - | - | あり |
| Ops Console | src/repos/firestore/analyticsReadRepo.js, src/repos/firestore/auditLogsRepo.js, src/repos/firestore/decisionDriftsRepo.js, src/repos/firestore/decisionLogsRepo.js, src/repos/firestore/deliveriesRepo.js, src/repos/firestore/journeyTodoStatsRepo.js, src/repos/firestore/llmUsageStatsRepo.js, src/repos/firestore/noticesRepo.js, src/repos/firestore/notificationsRepo.js, src/repos/firestore/opsAssistCacheRepo.js, src/repos/firestore/opsSnapshotsRepo.js, src/repos/firestore/userJourneyProfilesRepo.js, src/repos/firestore/userJourneySchedulesRepo.js, src/repos/firestore/userSubscriptionsRepo.js, src/repos/firestore/usersRepo.js | audit_logs, checklists, decision_drifts, decision_logs, events, journey_todo_stats, llm_usage_stats, notices, notification_deliveries, notifications, ops_assist_cache, ops_read_model_snapshots, user_checklists, user_journey_profiles, user_journey_schedules, user_subscriptions, users | getKillSwitch | audit_logs_action_createdAt_desc | - | あり |
| LLM Guard | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/systemFlagsRepo.js | audit_logs, system_flags | evaluateLlmAvailability, evaluateLLMBudget | - | - | あり |
| Retention/Policy | src/repos/firestore/auditLogsRepo.js | audit_logs | requireInternalJobToken, getRetentionPolicy | audit_logs_action_createdAt_desc | - | - |

注記: `load_risk.fallback_points=0`、`missing_index_surface.surface_count=0` のため fallback 依存は全カテゴリで未検出。

## 4. フェーズ時系列マップ

```text
Phase0  : 通知/クリック/Link Registry 基礎経路 (通知作成/承認/送信, Link Registry, Deliveries)
Phase1-6: User管理・Ops基礎 (phase5Ops, phase5State, phase6MemberSummary)
Phase22 : Ops意思決定系(read/decision)拡張
Phase36 : notice send route 導入 (phase36NoticeSend)
Phase67-68: 通知送信計画/実行分離 (phase67PlanSend -> phase68ExecuteSend)
Phase121: 旧通知送信経路 (phase121OpsNoticeSend) ※legacy
Phase219-249: FAQ/KB, LLM FAQ 周辺導入
Phase250-270: City Pack Requests / Review Inbox 系導入
Phase307-657: Retention dry-run/apply/runs 導入・強化
Phase657-669: Emergency Layer / internal jobs 導入・強化
Phase670-672: City Pack/Ops系の直近拡張
```

- 分裂/統合/レガシー化
- `feature_map.completion=legacy`: `phase105OpsAssistAdopt`, `phase121OpsNoticeSend`, `phase1Events`, `phase1Notifications`, `phaseLLM4FaqAnswer`
- `design_ai_meta.merge_candidates=0`, `legacy_repos=0`（repo alias重複は解消済み）
- カテゴリ別最古/最新は Section1 の Phase由来を参照。

## 5. 未使用/レガシー一覧

| 分類 | 対象 | 根拠 | 判定 |
|---|---|---|---|
| 監査対象 | src/repos/firestore/indexFallbackPolicy.js | src/index.js 起点 static require graph 未到達 | 到達不能(非marker) |
| 監査対象 | src/shared/phaseDocPathResolver.js | src/index.js 起点 static require graph 未到達 | 到達不能(非marker) |
| 監査対象 | src/routes/admin/productReadiness.js の `scenario` | docs/REPO_AUDIT_INPUTS/structure_risk.json naming_drift_scenario_count=1 | naming drift |
| 監査対象 | scenarioKey系 38ファイル | docs/REPO_AUDIT_INPUTS/structure_risk.json naming_drift_scenarioKey_count=38 | naming drift cluster |
| 監査対象 | protection_matrix auth none 7 endpoints | docs/REPO_AUDIT_INPUTS/protection_matrix.json | guard境界確認対象 |
| 削除候補 | - | docs/REPO_AUDIT_INPUTS/design_ai_meta.json merge_candidates=0 | 該当なし |
| 凍結 | - | docs/REPO_AUDIT_INPUTS/structure_risk.json legacy_repos_count=0 | 該当なし |
| collection drift | ops_state/ops_states | data_model_map は `ops_states` のみ収載 | drift未検出(現行正規化済み) |
| retention未定義 | - | docs/REPO_AUDIT_INPUTS/retention_risk.json undefined_retention_count=0 | 未定義ゼロ |
| fallback過多 | - | docs/REPO_AUDIT_INPUTS/load_risk.json fallback_hotspots=0/full_scan_hotspots=0 | hotspot未検出 |

## 6. 実行パス可視化（ASCII）

### 6.1 通知送信フロー

```text
admin route
  src/routes/admin/osNotifications.js (handleOsNotifications)
    -> usecase src/usecases/adminOs/executeNotificationSend.js (executeNotificationSend)
      -> usecase src/usecases/notifications/sendNotification.js (sendNotification)
        -> repo src/repos/firestore/notificationsRepo.js (notifications)
        -> repo src/repos/firestore/deliveriesRepo.js (notification_deliveries)
        -> repo src/repos/firestore/decisionTimelineRepo.js (decision_timeline)
      -> guard validateSingleCta / validateLinkRequired / validateWarnLinkBlock / getKillSwitch
      -> observability appendAuditLog(audit_logs) + deliveries(notification_deliveries) + decision_timeline
```

### 6.2 City Pack承認フロー

```text
admin route
  src/routes/admin/cityPackRequests.js (handleAction approve/activate)
    -> usecase src/usecases/cityPack/activateCityPack.js (activateCityPack)
      -> usecase src/usecases/cityPack/validateCityPackSources.js (validateCityPackSources)
      -> repo src/repos/firestore/cityPacksRepo.js (city_packs)
      -> repo src/repos/firestore/sourceRefsRepo.js (source_refs)
    -> guard validateCityPackSources / validateCityPackSchoolLinks / getKillSwitch
    -> observability appendAuditLog(audit_logs)
```

### 6.3 緊急通知フロー

```text
internal job route
  src/routes/internal/emergencyJobs.js (/internal/jobs/emergency-sync)
    -> usecase src/usecases/emergency/runEmergencySync.js (runEmergencySync)
      -> fetch src/usecases/emergency/fetchProviderSnapshot.js
      -> normalize&diff src/usecases/emergency/normalizeAndDiffProvider.js
      -> draft summarize src/usecases/emergency/summarizeDraftWithLLM.js
  admin approve route
    src/routes/admin/emergencyLayer.js (/api/admin/emergency/bulletins/:id/approve)
      -> usecase src/usecases/emergency/approveEmergencyBulletin.js (approveEmergencyBulletin)
        -> usecase src/usecases/notifications/createNotification.js
        -> usecase src/usecases/notifications/sendNotification.js
      -> guard requireInternalJobToken / getKillSwitch / validatePreconditions
      -> observability audit_logs + decision_timeline + notification_deliveries
```

## 7. 成熟度評価（A-E）

| 機能 | 評価 | 理由（証跡） |
|---|---|---|
| 通知作成/承認/送信 | D | legacy feature が同居し、運用判断時に新旧混在リスクが残る。（src/routes/admin/notifications.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| Link Registry | C | 動作は安定しているがクリック/公開経路でguardまたは監査が薄い。（src/routes/admin/linkRegistry.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| Kill Switch | A | 監査・trace・guard・テストが揃い、drift指標も小さい。（src/routes/admin/osKillSwitch.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| City Pack | A | 監査・trace・guard・テストが揃い、drift指標も小さい。（src/routes/admin/cityPacks.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| City Pack Requests | A | 監査・trace・guard・テストが揃い、drift指標も小さい。（src/routes/admin/cityPackRequests.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| City Pack Review Inbox | A | 監査・trace・guard・テストが揃い、drift指標も小さい。（src/routes/admin/cityPackReviewInbox.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| City Pack Evidence | B | 機能は完成だが一部経路でguard/監査密度が均一でない。（src/routes/admin/cityPackEvidence.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| Emergency | A | 監査・trace・guard・テストが揃い、drift指標も小さい。（src/routes/admin/emergencyLayer.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| FAQ/KB | D | legacy feature が同居し、運用判断時に新旧混在リスクが残る。（src/routes/admin/kbArticles.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| User管理 | B | 機能は完成だが一部経路でguard/監査密度が均一でない。（src/routes/admin/osUsersSummaryAnalyze.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| Deliveries/Click Tracking | C | 動作は安定しているがクリック/公開経路でguardまたは監査が薄い。（src/routes/admin/notificationDeliveries.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| Analytics/Read Model | B | 機能は完成だが一部経路でguard/監査密度が均一でない。（src/routes/admin/readModel.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| Ops Console | B | 機能は完成だが一部経路でguard/監査密度が均一でない。（src/routes/admin/opsOverview.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| LLM Guard | B | 機能は完成だが一部経路でguard/監査密度が均一でない。（src/routes/admin/llmConfig.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |
| Retention/Policy | B | 機能は完成だが一部経路でguard/監査密度が均一でない。（src/routes/internal/retentionDryRunJob.js, docs/REPO_AUDIT_INPUTS/feature_map.json） |

## 8. リスクランキング Top10

| 優先度 | リスク内容 | 根拠ファイル | 影響機能 |
|---|---|---|---|
| 1 | scenario/scenarioKey 命名ドリフト残存（1+38件） | docs/REPO_AUDIT_INPUTS/structure_risk.json | Ops Console, User管理, Analytics/Read Model, 通知作成/承認/送信 |
| 2 | src/index.js 起点の未到達 JS が2件残存 | scripts/check_structural_cleanup.js, src/repos/firestore/indexFallbackPolicy.js, src/shared/phaseDocPathResolver.js | Guard Layer, Docs連携 |
| 3 | legacy feature 5件が feature_map に残存 | docs/REPO_AUDIT_INPUTS/feature_map.json | 通知作成/承認/送信, FAQ/KB |
| 4 | protection_matrix 上で trace_required=false が 32 endpoint | docs/REPO_AUDIT_INPUTS/protection_matrix.json | 公開/一部admin経路 |
| 5 | protection_matrix 上で audit_required=false が 30 endpoint | docs/REPO_AUDIT_INPUTS/protection_matrix.json | 公開/一部admin経路 |
| 6 | auth_required=none endpoint が 7 件 | docs/REPO_AUDIT_INPUTS/protection_matrix.json | public/webhook経路 |
| 7 | confirm token 信頼度 low が 248 件（契約強度のばらつき） | docs/REPO_AUDIT_INPUTS/protection_matrix.json | admin操作系全般 |
| 8 | criticalContracts が 13件で、全routeに対する index契約明示は限定的 | docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json | Ops Console, Retention/Policy, City Pack |
| 9 | City Pack Evidence が audit_logs 単独依存でデータソース集中 | src/routes/admin/cityPackEvidence.js, docs/REPO_AUDIT_INPUTS/feature_map.json | City Pack Evidence |
| 10 | City Pack Evidence の phase由来が未観測（token一致0件） | tests/phase*/\*.test.js, docs/REPO_AUDIT_INPUTS/feature_map.json | City Pack Evidence |

## 9. 改善ロードマップ（プロダクト視点）

### 即時対応
1. scenario/scenarioKey 正規化ルールの適用範囲を固定し、`structure_risk` の 1+38 件を削減。
- 価値: クエリ/集計契約の一貫性向上。
- 緊急性: 高（運用指標の取り違えを防ぐ）。
- 非採用案との差: 現状維持では命名ドリフトが継続。
- 停止手段: 変換適用フラグをOFF。
- 巻き戻し: 変更PRを `git revert`。

2. 未到達2ファイルの扱いを明示（削除 or 凍結marker追加）。
- 価値: 到達性監査のノイズ削減。
- 緊急性: 中。
- 非採用案との差: 監査対象が恒常残存。
- 停止手段: cleanup check の fail 条件を維持。
- 巻き戻し: marker追加/削除PRを個別 revert。

3. trace/audit 未要求 endpoint の最小見直し。
- 価値: 事故時の追跡可能性を改善。
- 緊急性: 中。
- 非採用案との差: noTrace/noAudit 件数が固定化。
- 停止手段: 監査ログ出力をfeature flagで制御。
- 巻き戻し: 対象route単位でrevert。

### 中期改善
1. legacy feature（phase121OpsNoticeSend, phaseLLM4FaqAnswer 等）の段階撤去計画。
- 価値: 新旧混在リスクの除去。
- 緊急性: 中。
- 非採用案との差: D評価カテゴリが残る。
- 停止手段: route公開を killSwitch で遮断。
- 巻き戻し: route復帰コミットをrevert。

2. criticalContracts の対象拡張（ops/notification/read paths）。
- 価値: index不足の事前防止。
- 緊急性: 中。
- 非採用案との差: 13契約のまま監査範囲が限定。
- 停止手段: contracts-only gate で段階導入。
- 巻き戻し: 追加契約行をrevert。

### 長期再設計
1. Protection Matrix を「必須trace/audit/confirm」強度付き契約へ再編。
- 価値: guard漏れの継続監視を強化。
- 緊急性: 中。
- 非採用案との差: 低信頼度(`confirm_token_confidence=low`)が残存。
- 停止手段: 検証モードでfail-open運用開始。
- 巻き戻し: 契約チェックのみrevert。

2. 15カテゴリ単位の成熟度自動再評価ジョブを docs-artifacts に統合。
- 価値: 手動監査の工数削減、再現性向上。
- 緊急性: 低〜中。
- 非採用案との差: レポート更新が人依存。
- 停止手段: CIジョブをoptional化。
- 巻き戻し: ジョブ追加PRをrevert。

---
### 参照元
- docs/REPO_AUDIT_INPUTS/feature_map.json
- docs/REPO_AUDIT_INPUTS/dependency_graph.json
- docs/REPO_AUDIT_INPUTS/data_model_map.json
- docs/REPO_AUDIT_INPUTS/state_transitions.json
- docs/REPO_AUDIT_INPUTS/design_ai_meta.json
- docs/REPO_AUDIT_INPUTS/load_risk.json
- docs/REPO_AUDIT_INPUTS/protection_matrix.json
- docs/REPO_AUDIT_INPUTS/firestore_required_indexes.json
- docs/REPO_AUDIT_INPUTS/retention_risk.json
- docs/REPO_AUDIT_INPUTS/structure_risk.json
- docs/PHASE_PATH_MAP.json
