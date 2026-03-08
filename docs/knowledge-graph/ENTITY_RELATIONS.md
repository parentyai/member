# ENTITY_RELATIONS

- generatedAt: 2026-03-08T04:34:11.724Z
- gitCommit: 690e9ec95691e2bb60ab84db1dc2c33a9fcfff4f
- branch: codex/member-integrated-remediation-v1
- sourceDigest: ff4e927a1bcdeab1716540ca6dc05844deac4ac0788ef6be90eccf827bf53653
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| From | To | Relation | Evidence |
| --- | --- | --- | --- |
| Entity:CityPacks | Entity:SourceRefs | references_vendor_sources | src/usecases/cityPack/runCityPackSourceAuditJob.js:71<br>src/repos/firestore/sourceRefsRepo.js:1 |
| Entity:LlmInputBoundary | Entity:LlmResponse | llm_inference | src/usecases/llm/buildLlmInputView.js:1<br>src/infra/llmClient.js:46 |
| Entity:LlmResponse | Entity:FaqAnswerLogs | persist_answer_trace | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>src/repos/firestore/faqAnswerLogsRepo.js:1 |
| Pipeline:Notification | Entity:AuditLogs | writes | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1 |
| Pipeline:Notification | Entity:DecisionTimeline | writes | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1 |
| Pipeline:Notification | Entity:NotificationDeliveries | writes | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1 |
| Pipeline:Notification | Entity:Notifications | writes | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1 |
| Pipeline:Notification | Entity:SendRetryQueue | writes | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1 |
| Repo:analyticsReadRepo | Entity:Checklists | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1 |
| Repo:analyticsReadRepo | Entity:Events | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1 |
| Repo:analyticsReadRepo | Entity:NotificationDeliveries | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1 |
| Repo:analyticsReadRepo | Entity:Notifications | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1 |
| Repo:analyticsReadRepo | Entity:UserChecklists | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1 |
| Repo:analyticsReadRepo | Entity:Users | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1 |
| Repo:auditLogsRepo | Entity:AuditLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:20<br>src/repos/firestore/auditLogsRepo.js:1 |
| Repo:automationConfigRepo | Entity:AutomationConfig | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:145<br>src/repos/firestore/automationConfigRepo.js:1 |
| Repo:automationRunsRepo | Entity:AutomationRuns | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:183<br>src/repos/firestore/automationRunsRepo.js:1 |
| Repo:cityPackBulletinsRepo | Entity:CityPackBulletins | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:574<br>src/repos/firestore/cityPackBulletinsRepo.js:1 |
| Repo:cityPackFeedbackRepo | Entity:CityPackFeedback | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:126<br>src/repos/firestore/cityPackFeedbackRepo.js:1 |
| Repo:cityPackMetricsDailyRepo | Entity:CityPackMetricsDaily | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:84<br>src/repos/firestore/cityPackMetricsDailyRepo.js:1 |
| Repo:cityPackRequestsRepo | Entity:CityPackRequests | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:131<br>src/repos/firestore/cityPackRequestsRepo.js:1 |
| Repo:cityPacksRepo | Entity:CityPacks | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:4<br>src/repos/firestore/cityPacksRepo.js:1 |
| Repo:decisionDriftsRepo | Entity:DecisionDrifts | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:171<br>src/repos/firestore/decisionDriftsRepo.js:1 |
| Repo:decisionLogsRepo | Entity:DecisionLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:23<br>src/repos/firestore/decisionLogsRepo.js:1 |
| Repo:decisionTimelineRepo | Entity:DecisionTimeline | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:104<br>src/repos/firestore/decisionTimelineRepo.js:1 |
| Repo:deliveriesRepo | Entity:NotificationDeliveries | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:89<br>src/repos/firestore/deliveriesRepo.js:1 |
| Repo:emergencyBulletinsRepo | Entity:EmergencyBulletins | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:50<br>src/repos/firestore/emergencyBulletinsRepo.js:1 |
| Repo:emergencyDiffsRepo | Entity:EmergencyDiffs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:222<br>src/repos/firestore/emergencyDiffsRepo.js:1 |
| Repo:emergencyEventsRepo | Entity:EmergencyEventsNormalized | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:412<br>src/repos/firestore/emergencyEventsRepo.js:1 |
| Repo:emergencyProvidersRepo | Entity:EmergencyProviders | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:193<br>src/repos/firestore/emergencyProvidersRepo.js:1 |
| Repo:emergencyRulesRepo | Entity:EmergencyRules | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:491<br>src/repos/firestore/emergencyRulesRepo.js:1 |
| Repo:emergencySnapshotsRepo | Entity:EmergencySnapshots | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:194<br>src/repos/firestore/emergencySnapshotsRepo.js:1 |
| Repo:emergencyUnmappedEventsRepo | Entity:EmergencyUnmappedEvents | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:225<br>src/repos/firestore/emergencyUnmappedEventsRepo.js:1 |
| Repo:eventsRepo | Entity:Events | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:96<br>src/repos/firestore/eventsRepo.js:1 |
| Repo:faqAnswerLogsRepo | Entity:FaqAnswerLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:15<br>src/repos/firestore/faqAnswerLogsRepo.js:1 |
| Repo:faqArticlesRepo | Entity:FaqArticles | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:16<br>src/repos/firestore/faqArticlesRepo.js:1 |
| Repo:journeyBranchQueueRepo | Entity:JourneyBranchQueue | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:591<br>src/repos/firestore/journeyBranchQueueRepo.js:1 |
| Repo:journeyGraphCatalogRepo | Entity:OpsConfig | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:30<br>src/repos/firestore/journeyGraphCatalogRepo.js:1 |
| Repo:journeyKpiDailyRepo | Entity:JourneyKpiDaily | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:9<br>src/repos/firestore/journeyKpiDailyRepo.js:1 |
| Repo:journeyParamChangeLogsRepo | Entity:JourneyParamChangeLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:31<br>src/repos/firestore/journeyParamChangeLogsRepo.js:1 |
| Repo:journeyParamRuntimeRepo | Entity:OpsConfig | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:32<br>src/repos/firestore/journeyParamRuntimeRepo.js:1 |
| Repo:journeyParamVersionsRepo | Entity:JourneyParamVersions | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:33<br>src/repos/firestore/journeyParamVersionsRepo.js:1 |
| Repo:journeyPolicyRepo | Entity:OpsConfig | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:34<br>src/repos/firestore/journeyPolicyRepo.js:1 |
| Repo:journeyReminderRunsRepo | Entity:JourneyReminderRuns | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:435<br>src/repos/firestore/journeyReminderRunsRepo.js:1 |
| Repo:journeyTemplatesRepo | Entity:JourneyTemplates | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:45<br>src/repos/firestore/journeyTemplatesRepo.js:1 |
| Repo:journeyTodoItemsRepo | Entity:JourneyTodoItems | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:70<br>src/repos/firestore/journeyTodoItemsRepo.js:1 |
| Repo:journeyTodoStatsRepo | Entity:JourneyTodoStats | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:10<br>src/repos/firestore/journeyTodoStatsRepo.js:1 |
| Repo:linkRegistryRepo | Entity:LinkRegistry | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:51<br>src/repos/firestore/linkRegistryRepo.js:1 |
| Repo:llmActionLogsRepo | Entity:LlmActionLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:200<br>src/repos/firestore/llmActionLogsRepo.js:1 |
| Repo:llmBanditStateRepo | Entity:LlmBanditState | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:201<br>src/repos/firestore/llmBanditStateRepo.js:1 |
| Repo:llmContextualBanditStateRepo | Entity:LlmContextualBanditState | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:202<br>src/repos/firestore/llmContextualBanditStateRepo.js:1 |
| Repo:llmQualityLogsRepo | Entity:LlmQualityLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:211<br>src/repos/firestore/llmQualityLogsRepo.js:1 |
| Repo:llmUsageLogsRepo | Entity:LlmUsageLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:11<br>src/repos/firestore/llmUsageLogsRepo.js:1 |
| Repo:llmUsageStatsRepo | Entity:LlmUsageStats | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:155<br>src/repos/firestore/llmUsageStatsRepo.js:1 |
| Repo:municipalitySchoolsRepo | Entity:MunicipalitySchools | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:350<br>src/repos/firestore/municipalitySchoolsRepo.js:1 |
| Repo:noticesRepo | Entity:Notices | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:285<br>src/repos/firestore/noticesRepo.js:1 |
| Repo:notificationsRepo | Entity:Notifications | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:55<br>src/repos/firestore/notificationsRepo.js:1 |
| Repo:notificationTemplatesRepo | Entity:NotificationTemplates | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:186<br>src/repos/firestore/notificationTemplatesRepo.js:1 |
| Repo:notificationTestRunsRepo | Entity:NotificationTestRunItems | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:610<br>src/repos/firestore/notificationTestRunsRepo.js:1 |
| Repo:notificationTestRunsRepo | Entity:NotificationTestRuns | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:610<br>src/repos/firestore/notificationTestRunsRepo.js:1 |
| Repo:opsAssistCacheRepo | Entity:OpsAssistCache | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:268<br>src/repos/firestore/opsAssistCacheRepo.js:1 |
| Repo:opsConfigRepo | Entity:OpsConfig | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:35<br>src/repos/firestore/opsConfigRepo.js:1 |
| Repo:opsSegmentsRepo | Entity:OpsSegments | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:123<br>src/repos/firestore/opsSegmentsRepo.js:1 |
| Repo:opsSnapshotsRepo | Entity:OpsReadModelSnapshots | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:59<br>src/repos/firestore/opsSnapshotsRepo.js:1 |
| Repo:opsStateRepo | Entity:OpsStates | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:517<br>src/repos/firestore/opsStateRepo.js:1 |
| Repo:opsStatesRepo | Entity:OpsStates | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:174<br>src/repos/firestore/opsStatesRepo.js:1 |
| Repo:richMenuAssignmentRulesRepo | Entity:RichMenuAssignmentRules | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:536<br>src/repos/firestore/richMenuAssignmentRulesRepo.js:1 |
| Repo:richMenuBindingsRepo | Entity:RichMenuBindings | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:38<br>src/repos/firestore/richMenuBindingsRepo.js:1 |
| Repo:richMenuPhaseProfilesRepo | Entity:RichMenuPhaseProfiles | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:538<br>src/repos/firestore/richMenuPhaseProfilesRepo.js:1 |
| Repo:richMenuPolicyRepo | Entity:OpsConfig | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:39<br>src/repos/firestore/richMenuPolicyRepo.js:1 |
| Repo:richMenuRateBucketsRepo | Entity:RichMenuRateBuckets | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:40<br>src/repos/firestore/richMenuRateBucketsRepo.js:1 |
| Repo:richMenuTemplatesRepo | Entity:RichMenuTemplates | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:41<br>src/repos/firestore/richMenuTemplatesRepo.js:1 |
| Repo:scenarioReportsRepo | Entity:Phase2ReportsChecklistPending | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:616<br>src/repos/firestore/scenarioReportsRepo.js:1 |
| Repo:scenarioReportsRepo | Entity:Phase2ReportsDailyEvents | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:616<br>src/repos/firestore/scenarioReportsRepo.js:1 |
| Repo:scenarioReportsRepo | Entity:Phase2ReportsWeeklyEvents | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:616<br>src/repos/firestore/scenarioReportsRepo.js:1 |
| Repo:scenarioRunsRepo | Entity:Phase2Runs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:617<br>src/repos/firestore/scenarioRunsRepo.js:1 |
| Repo:sendRetryQueueRepo | Entity:SendRetryQueue | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:107<br>src/repos/firestore/sendRetryQueueRepo.js:1 |
| Repo:sourceAuditRunsRepo | Entity:SourceAuditRuns | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:576<br>src/repos/firestore/sourceAuditRunsRepo.js:1 |
| Repo:sourceEvidenceRepo | Entity:SourceEvidence | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:577<br>src/repos/firestore/sourceEvidenceRepo.js:1 |
| Repo:sourceRefsRepo | Entity:SourceRefs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:5<br>src/repos/firestore/sourceRefsRepo.js:1 |
| Repo:stepRuleChangeLogsRepo | Entity:StepRuleChangeLogs | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:46<br>src/repos/firestore/stepRuleChangeLogsRepo.js:1 |
| Repo:stepRulesRepo | Entity:StepRules | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:47<br>src/repos/firestore/stepRulesRepo.js:1 |
| Repo:stripeWebhookDeadLettersRepo | Entity:StripeWebhookDeadLetters | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:499<br>src/repos/firestore/stripeWebhookDeadLettersRepo.js:1 |
| Repo:stripeWebhookEventsRepo | Entity:StripeWebhookEvents | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:500<br>src/repos/firestore/stripeWebhookEventsRepo.js:1 |
| Repo:systemFlagsRepo | Entity:SystemFlags | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:17<br>src/repos/firestore/systemFlagsRepo.js:1 |
| Repo:taskContentsRepo | Entity:TaskContents | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:338<br>src/repos/firestore/taskContentsRepo.js:1 |
| Repo:tasksRepo | Entity:Tasks | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:99<br>src/repos/firestore/tasksRepo.js:1 |
| Repo:templatesVRepo | Entity:TemplatesV | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:190<br>src/repos/firestore/templatesVRepo.js:1 |
| Repo:userCityPackPreferencesRepo | Entity:UserCityPackPreferences | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:340<br>src/repos/firestore/userCityPackPreferencesRepo.js:1 |
| Repo:userConsentsRepo | Entity:UserConsents | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:520<br>src/repos/firestore/userConsentsRepo.js:1 |
| Repo:userContextSnapshotsRepo | Entity:UserContextSnapshots | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:71<br>src/repos/firestore/userContextSnapshotsRepo.js:1 |
| Repo:userJourneyProfilesRepo | Entity:UserJourneyProfiles | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:316<br>src/repos/firestore/userJourneyProfilesRepo.js:1 |
| Repo:userJourneySchedulesRepo | Entity:UserJourneySchedules | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:317<br>src/repos/firestore/userJourneySchedulesRepo.js:1 |
| Repo:usersPhase1Repo | Entity:Users | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:645<br>src/repos/firestore/usersPhase1Repo.js:1 |
| Repo:usersRepo | Entity:Users | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:66<br>src/repos/firestore/usersRepo.js:1 |
| Repo:userSubscriptionsRepo | Entity:UserSubscriptions | reads_writes_collection | docs/REPO_AUDIT_INPUTS/dependency_graph.json:12<br>src/repos/firestore/userSubscriptionsRepo.js:1 |
| Route:cityPackBulletins | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackBulletins.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:951 |
| Route:cityPackBulletins | Usecase:sendNotification | invokes | src/routes/admin/cityPackBulletins.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:951 |
| Route:cityPackDraftGeneratorJob | Usecase:runCityPackDraftJob | invokes | src/routes/internal/cityPackDraftGeneratorJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1239 |
| Route:cityPackEducationLinks | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackEducationLinks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:955 |
| Route:cityPackEvidence | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackEvidence.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:958 |
| Route:cityPackFeedback | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackFeedback.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:961 |
| Route:cityPackRequests | Usecase:activateCityPack | invokes | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:964 |
| Route:cityPackRequests | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:964 |
| Route:cityPackRequests | Usecase:runCityPackDraftJob | invokes | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:964 |
| Route:cityPackReviewInbox | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969 |
| Route:cityPackReviewInbox | Usecase:computeCityPackMetrics | invokes | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969 |
| Route:cityPackReviewInbox | Usecase:normalizeLimit | invokes | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969 |
| Route:cityPackReviewInbox | Usecase:normalizeWindowDays | invokes | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969 |
| Route:cityPackReviewInbox | Usecase:reviewSourceRefDecision | invokes | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969 |
| Route:cityPackReviewInbox | Usecase:runCityPackSourceAuditJob | invokes | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969 |
| Route:cityPacks | Usecase:activateCityPack | invokes | src/routes/admin/cityPacks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:977 |
| Route:cityPacks | Usecase:appendAuditLog | invokes | src/routes/admin/cityPacks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:977 |
| Route:cityPacks | Usecase:composeCityAndNationwidePacks | invokes | src/routes/admin/cityPacks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:977 |
| Route:cityPackSourceAuditJob | Usecase:runCityPackSourceAuditJob | invokes | src/routes/internal/cityPackSourceAuditJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1242 |
| Route:cityPackTemplateLibrary | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackTemplateLibrary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:982 |
| Route:cityPackUpdateProposals | Usecase:appendAuditLog | invokes | src/routes/admin/cityPackUpdateProposals.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:985 |
| Route:emergencyJobs | Usecase:fetchProviderSnapshot | invokes | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245 |
| Route:emergencyJobs | Usecase:normalizeAndDiffProvider | invokes | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245 |
| Route:emergencyJobs | Usecase:runEmergencySync | invokes | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245 |
| Route:emergencyJobs | Usecase:summarizeDraftWithLLM | invokes | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245 |
| Route:emergencyLayer | Usecase:appendAuditLog | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:approveEmergencyBulletin | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:fetchProviderSnapshot | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:getEmergencyBulletin | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:getEmergencyEvidence | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:listEmergencyBulletins | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:listEmergencyProviders | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:normalizeAndDiffProvider | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:previewEmergencyRule | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:rejectEmergencyBulletin | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:summarizeDraftWithLLM | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:emergencyLayer | Usecase:updateEmergencyProvider | invokes | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988 |
| Route:journeyBranchDispatchJob | Usecase:runJourneyBranchDispatchJob | invokes | src/routes/internal/journeyBranchDispatchJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1251 |
| Route:journeyGraphBranchQueue | Usecase:appendAuditLog | invokes | src/routes/admin/journeyGraphBranchQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1003 |
| Route:journeyGraphCatalogConfig | Usecase:appendAuditLog | invokes | src/routes/admin/journeyGraphCatalogConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1006 |
| Route:journeyGraphRuntime | Usecase:appendAuditLog | invokes | src/routes/admin/journeyGraphRuntime.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1009 |
| Route:journeyKpiBuildJob | Usecase:aggregateJourneyKpis | invokes | src/routes/internal/journeyKpiBuildJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1254 |
| Route:journeyParamConfig | Usecase:appendAuditLog | invokes | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012 |
| Route:journeyParamConfig | Usecase:applyJourneyParamVersion | invokes | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012 |
| Route:journeyParamConfig | Usecase:rollbackJourneyParamVersion | invokes | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012 |
| Route:journeyParamConfig | Usecase:runJourneyParamDryRun | invokes | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012 |
| Route:journeyParamConfig | Usecase:validateJourneyParamVersion | invokes | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012 |
| Route:journeyPolicyConfig | Usecase:appendAuditLog | invokes | src/routes/admin/journeyPolicyConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1019 |
| Route:journeyTodoReminderJob | Usecase:runJourneyTodoReminderJob | invokes | src/routes/internal/journeyTodoReminderJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1257 |
| Route:kbArticles | Usecase:appendAuditLog | invokes | src/routes/admin/kbArticles.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1022 |
| Route:legacyStatus | Usecase:appendAuditLog | invokes | src/routes/admin/legacyStatus.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1025 |
| Route:linkRegistry | Usecase:appendAuditLog | invokes | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028 |
| Route:linkRegistry | Usecase:checkLinkHealth | invokes | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028 |
| Route:linkRegistry | Usecase:createLink | invokes | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028 |
| Route:linkRegistry | Usecase:deleteLink | invokes | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028 |
| Route:linkRegistry | Usecase:listLinks | invokes | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028 |
| Route:linkRegistry | Usecase:updateLink | invokes | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028 |
| Route:llmActionRewardFinalizeJob | Usecase:appendLlmGateDecision | invokes | src/routes/internal/llmActionRewardFinalizeJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1260 |
| Route:llmActionRewardFinalizeJob | Usecase:finalizeLlmActionRewards | invokes | src/routes/internal/llmActionRewardFinalizeJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1260 |
| Route:llmConfig | Usecase:appendAuditLog | invokes | src/routes/admin/llmConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1036 |
| Route:llmConsent | Usecase:appendAuditLog | invokes | src/routes/admin/llmConsent.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1039 |
| Route:llmFaq | Usecase:answerFaqFromKb | invokes | src/routes/admin/llmFaq.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1042 |
| Route:llmFaq | Usecase:appendLlmGateDecision | invokes | src/routes/admin/llmFaq.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1042 |
| Route:llmOps | Usecase:appendLlmGateDecision | invokes | src/routes/admin/llmOps.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1046 |
| Route:llmOps | Usecase:getNextActionCandidates | invokes | src/routes/admin/llmOps.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1046 |
| Route:llmOps | Usecase:getOpsExplanation | invokes | src/routes/admin/llmOps.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1046 |
| Route:llmPolicyConfig | Usecase:appendAuditLog | invokes | src/routes/admin/llmPolicyConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1051 |
| Route:missingIndexSurface | Usecase:appendAuditLog | invokes | src/routes/admin/missingIndexSurface.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1055 |
| Route:monitorInsights | Usecase:appendAuditLog | invokes | src/routes/admin/monitorInsights.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1058 |
| Route:municipalitySchoolsImportJob | Usecase:importMunicipalitySchools | invokes | src/routes/internal/municipalitySchoolsImportJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1264 |
| Route:nextBestAction | Usecase:appendAuditLog | invokes | src/routes/admin/nextBestAction.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1061 |
| Route:nextBestAction | Usecase:computeNotificationFatigueWarning | invokes | src/routes/admin/nextBestAction.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1061 |
| Route:nextBestAction | Usecase:getNextBestAction | invokes | src/routes/admin/nextBestAction.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1061 |
| Route:notificationDeliveries | Usecase:getNotificationDeliveries | invokes | src/routes/admin/notificationDeliveries.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1066 |
| Route:notifications | Usecase:appendAuditLog | invokes | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069 |
| Route:notifications | Usecase:createNotification | invokes | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069 |
| Route:notifications | Usecase:listNotifications | invokes | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069 |
| Route:notifications | Usecase:sendNotification | invokes | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069 |
| Route:notifications | Usecase:testSendNotification | invokes | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069 |
| Route:notificationTest | Usecase:appendAuditLog | invokes | src/routes/admin/notificationTest.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1076 |
| Route:notificationTest | Usecase:runNotificationTest | invokes | src/routes/admin/notificationTest.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1076 |
| Route:opsFeatureCatalogStatus | Usecase:appendAuditLog | invokes | src/routes/admin/opsFeatureCatalogStatus.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1080 |
| Route:opsOverview | Usecase:appendAuditLog | invokes | src/routes/admin/opsOverview.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1083 |
| Route:opsOverview | Usecase:getNotificationOperationalSummary | invokes | src/routes/admin/opsOverview.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1083 |
| Route:opsOverview | Usecase:getUserOperationalSummary | invokes | src/routes/admin/opsOverview.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1083 |
| Route:opsSnapshotHealth | Usecase:appendAuditLog | invokes | src/routes/admin/opsSnapshotHealth.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1088 |
| Route:opsSnapshotJob | Usecase:buildOpsSnapshots | invokes | src/routes/internal/opsSnapshotJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1267 |
| Route:opsSystemSnapshot | Usecase:appendAuditLog | invokes | src/routes/admin/opsSystemSnapshot.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1091 |
| Route:opsSystemSnapshot | Usecase:buildOpsSnapshots | invokes | src/routes/admin/opsSystemSnapshot.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1091 |
| Route:osAlerts | Usecase:appendAuditLog | invokes | src/routes/admin/osAlerts.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1095 |
| Route:osAlerts | Usecase:getNotificationReadModel | invokes | src/routes/admin/osAlerts.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1095 |
| Route:osAutomationConfig | Usecase:appendAuditLog | invokes | src/routes/admin/osAutomationConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1099 |
| Route:osConfig | Usecase:appendAuditLog | invokes | src/routes/admin/osConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1102 |
| Route:osContext | Usecase:appendAuditLog | invokes | src/routes/admin/osContext.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1105 |
| Route:osDashboardKpi | Usecase:appendAuditLog | invokes | src/routes/admin/osDashboardKpi.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1108 |
| Route:osDeliveryBackfill | Usecase:appendAuditLog | invokes | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111 |
| Route:osDeliveryBackfill | Usecase:confirmTokenData | invokes | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111 |
| Route:osDeliveryBackfill | Usecase:executeBackfill | invokes | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111 |
| Route:osDeliveryBackfill | Usecase:getBackfillStatus | invokes | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111 |
| Route:osDeliveryBackfill | Usecase:normalizeLimit | invokes | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111 |
| Route:osDeliveryBackfill | Usecase:planBackfill | invokes | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111 |
| Route:osDeliveryRecovery | Usecase:appendAuditLog | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osDeliveryRecovery | Usecase:computePlanHash | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osDeliveryRecovery | Usecase:confirmTokenData | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osDeliveryRecovery | Usecase:executeRecovery | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osDeliveryRecovery | Usecase:getRecoveryStatus | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osDeliveryRecovery | Usecase:normalizeDeliveryId | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osDeliveryRecovery | Usecase:normalizeReason | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osDeliveryRecovery | Usecase:planRecovery | invokes | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119 |
| Route:osErrors | Usecase:appendAuditLog | invokes | src/routes/admin/osErrors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1129 |
| Route:osJourneyKpi | Usecase:aggregateJourneyKpis | invokes | src/routes/admin/osJourneyKpi.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1132 |
| Route:osJourneyKpi | Usecase:appendAuditLog | invokes | src/routes/admin/osJourneyKpi.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1132 |
| Route:osKillSwitch | Usecase:appendAuditLog | invokes | src/routes/admin/osKillSwitch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1136 |
| Route:osKillSwitch | Usecase:getKillSwitch | invokes | src/routes/admin/osKillSwitch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1136 |
| Route:osKillSwitch | Usecase:setKillSwitch | invokes | src/routes/admin/osKillSwitch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1136 |
| Route:osLinkRegistryImpact | Usecase:appendAuditLog | invokes | src/routes/admin/osLinkRegistryImpact.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1141 |
| Route:osLinkRegistryLookup | Usecase:appendAuditLog | invokes | src/routes/admin/osLinkRegistryLookup.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1144 |
| Route:osLlmUsageExport | Usecase:appendAuditLog | invokes | src/routes/admin/osLlmUsageExport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1147 |
| Route:osLlmUsageSummary | Usecase:appendAuditLog | invokes | src/routes/admin/osLlmUsageSummary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1150 |
| Route:osNotifications | Usecase:appendAuditLog | invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153 |
| Route:osNotifications | Usecase:approveNotification | invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153 |
| Route:osNotifications | Usecase:approveNotification | notification_pipeline_invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3 |
| Route:osNotifications | Usecase:createNotification | invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153 |
| Route:osNotifications | Usecase:createNotification | notification_pipeline_invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3 |
| Route:osNotifications | Usecase:executeNotificationSend | invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153 |
| Route:osNotifications | Usecase:executeNotificationSend | notification_pipeline_invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3 |
| Route:osNotifications | Usecase:planNotificationSend | invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153 |
| Route:osNotifications | Usecase:planNotificationSend | notification_pipeline_invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3 |
| Route:osNotifications | Usecase:previewNotification | invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153 |
| Route:osNotifications | Usecase:sendNotification | notification_pipeline_invokes | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3 |
| Route:osNotificationSeed | Usecase:appendAuditLog | invokes | src/routes/admin/osNotificationSeed.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1161 |
| Route:osRedacStatus | Usecase:appendAuditLog | invokes | src/routes/admin/osRedacStatus.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1164 |
| Route:osUsersSummaryAnalyze | Usecase:appendAuditLog | invokes | src/routes/admin/osUsersSummaryAnalyze.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1168 |
| Route:osUsersSummaryAnalyze | Usecase:getUsersSummaryFiltered | invokes | src/routes/admin/osUsersSummaryAnalyze.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1168 |
| Route:osUsersSummaryExport | Usecase:appendAuditLog | invokes | src/routes/admin/osUsersSummaryExport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1172 |
| Route:osUsersSummaryExport | Usecase:getUsersSummaryFiltered | invokes | src/routes/admin/osUsersSummaryExport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1172 |
| Route:osView | Usecase:appendAuditLog | invokes | src/routes/admin/osView.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1176 |
| Route:phase105OpsAssistAdopt | Usecase:appendLlmAdoptAudit | invokes | src/routes/phase105OpsAssistAdopt.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1292 |
| Route:phase121OpsNoticeSend | Usecase:sendOpsNotice | invokes | src/routes/phase121OpsNoticeSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1295 |
| Route:phase1Events | Usecase:appendAuditLog | invokes | src/routes/phase1Events.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1298 |
| Route:phase1Events | Usecase:logEventBestEffort | invokes | src/routes/phase1Events.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1298 |
| Route:phase1Notifications | Usecase:appendAuditLog | invokes | src/routes/admin/phase1Notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1179 |
| Route:phase1Notifications | Usecase:createNotificationPhase1 | invokes | src/routes/admin/phase1Notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1179 |
| Route:phase1Notifications | Usecase:sendNotificationPhase1 | invokes | src/routes/admin/phase1Notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1179 |
| Route:phase24DecisionLogs | Usecase:appendDecision | invokes | src/routes/phase24DecisionLogs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1302 |
| Route:phase24DecisionLogs | Usecase:getLatestDecision | invokes | src/routes/phase24DecisionLogs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1302 |
| Route:phase24DecisionLogs | Usecase:listDecisions | invokes | src/routes/phase24DecisionLogs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1302 |
| Route:phase24OpsState | Usecase:recordOpsNextAction | invokes | src/routes/phase24OpsState.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1307 |
| Route:phase25OpsConsole | Usecase:getOpsConsole | invokes | src/routes/phase25OpsConsole.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1310 |
| Route:phase25OpsDecision | Usecase:submitOpsDecision | invokes | src/routes/phase25OpsDecision.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1313 |
| Route:phase26OpsConsoleList | Usecase:listOpsConsole | invokes | src/routes/phase26OpsConsoleList.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1316 |
| Route:phase2Automation | Usecase:runPhase2Automation | invokes | src/routes/admin/phase2Automation.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1184 |
| Route:phase32OpsDecisionSuggest | Usecase:suggestOpsDecision | invokes | src/routes/phase32OpsDecisionSuggest.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1319 |
| Route:phase33OpsDecisionExecute | Usecase:executeOpsNextAction | invokes | src/routes/phase33OpsDecisionExecute.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1322 |
| Route:phase36NoticeSend | Usecase:sendNotice | invokes | src/routes/phase36NoticeSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1325 |
| Route:phase37DeliveryReactions | Usecase:markDeliveryReaction | invokes | src/routes/phase37DeliveryReactions.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1328 |
| Route:phase37DeliveryReactionsV2 | Usecase:markDeliveryReactionV2 | invokes | src/routes/phase37DeliveryReactionsV2.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1331 |
| Route:phase38OpsDashboard | Usecase:getOpsDashboard | invokes | src/routes/phase38OpsDashboard.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1334 |
| Route:phase39OpsAssistSuggestion | Usecase:getOpsAssistSuggestion | invokes | src/routes/phase39OpsAssistSuggestion.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1337 |
| Route:phase42OpsConsoleView | Usecase:getOpsAssistForConsole | invokes | src/routes/phase42OpsConsoleView.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1340 |
| Route:phase42OpsConsoleView | Usecase:getOpsConsoleView | invokes | src/routes/phase42OpsConsoleView.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1340 |
| Route:phase47AutomationDryRun | Usecase:dryRunAutomationDecision | invokes | src/routes/phase47AutomationDryRun.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1344 |
| Route:phase48AutomationConfig | Usecase:getAutomationConfig | invokes | src/routes/phase48AutomationConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1347 |
| Route:phase52OpsBatch | Usecase:runOpsBatch | invokes | src/routes/phase52OpsBatch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1350 |
| Route:phase5Ops | Usecase:appendAuditLog | invokes | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354 |
| Route:phase5Ops | Usecase:getNotificationsSummaryFiltered | invokes | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354 |
| Route:phase5Ops | Usecase:getStaleMemberNumberUsers | invokes | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354 |
| Route:phase5Ops | Usecase:getUsersSummaryFiltered | invokes | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354 |
| Route:phase5Review | Usecase:appendAuditLog | invokes | src/routes/phase5Review.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1360 |
| Route:phase5Review | Usecase:recordOpsReview | invokes | src/routes/phase5Review.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1360 |
| Route:phase5State | Usecase:appendAuditLog | invokes | src/routes/phase5State.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1364 |
| Route:phase5State | Usecase:getUserStateSummary | invokes | src/routes/phase5State.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1364 |
| Route:phase61Templates | Usecase:appendAuditLog | invokes | src/routes/phase61Templates.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1368 |
| Route:phase62OpsDailyReport | Usecase:generateOpsDailyReport | invokes | src/routes/phase62OpsDailyReport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1371 |
| Route:phase65OpsDailyJob | Usecase:generateOpsDailyReport | invokes | src/routes/phase65OpsDailyJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1374 |
| Route:phase66Segments | Usecase:buildSendSegment | invokes | src/routes/phase66Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1377 |
| Route:phase67PlanSend | Usecase:planSegmentSend | invokes | src/routes/phase67PlanSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1380 |
| Route:phase68ExecuteSend | Usecase:executeSegmentSend | invokes | src/routes/phase68ExecuteSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1383 |
| Route:phase6MemberSummary | Usecase:getMemberSummary | invokes | src/routes/phase6MemberSummary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1386 |
| Route:phase73RetryQueue | Usecase:giveUpRetryQueuedSend | invokes | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389 |
| Route:phase73RetryQueue | Usecase:listRetryQueue | invokes | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389 |
| Route:phase73RetryQueue | Usecase:planRetryQueuedSend | invokes | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389 |
| Route:phase73RetryQueue | Usecase:retryQueuedSend | invokes | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389 |
| Route:phase77Segments | Usecase:createOpsSegment | invokes | src/routes/phase77Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1395 |
| Route:phase77Segments | Usecase:getOpsSegment | invokes | src/routes/phase77Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1395 |
| Route:phase77Segments | Usecase:listOpsSegments | invokes | src/routes/phase77Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1395 |
| Route:phase81DryRun | Usecase:dryRunSegmentSend | invokes | src/routes/phase81DryRun.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1400 |
| Route:phaseLLM2OpsExplain | Usecase:appendLlmGateDecision | invokes | src/routes/phaseLLM2OpsExplain.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1404 |
| Route:phaseLLM2OpsExplain | Usecase:getOpsExplanation | invokes | src/routes/phaseLLM2OpsExplain.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1404 |
| Route:phaseLLM3OpsNextActions | Usecase:appendLlmGateDecision | invokes | src/routes/phaseLLM3OpsNextActions.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1408 |
| Route:phaseLLM3OpsNextActions | Usecase:getNextActionCandidates | invokes | src/routes/phaseLLM3OpsNextActions.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1408 |
| Route:phaseLLM4FaqAnswer | Usecase:answerFaqFromKb | invokes | src/routes/phaseLLM4FaqAnswer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1412 |
| Route:phaseLLM4FaqAnswer | Usecase:appendLlmGateDecision | invokes | src/routes/phaseLLM4FaqAnswer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1412 |
| Route:productReadiness | Usecase:appendAuditLog | invokes | src/routes/admin/productReadiness.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1187 |
| Route:readModel | Usecase:appendAuditLog | invokes | src/routes/admin/readModel.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1190 |
| Route:readModel | Usecase:getNotificationReadModel | invokes | src/routes/admin/readModel.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1190 |
| Route:readPathFallbackSummary | Usecase:appendAuditLog | invokes | src/routes/admin/readPathFallbackSummary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1194 |
| Route:redacMembershipUnlink | Usecase:appendAuditLog | invokes | src/routes/admin/redacMembershipUnlink.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1197 |
| Route:repoMap | Usecase:appendAuditLog | invokes | src/routes/admin/repoMap.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1200 |
| Route:retentionApplyJob | Usecase:appendAuditLog | invokes | src/routes/internal/retentionApplyJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1270 |
| Route:retentionDryRunJob | Usecase:appendAuditLog | invokes | src/routes/internal/retentionDryRunJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1273 |
| Route:retentionRuns | Usecase:appendAuditLog | invokes | src/routes/admin/retentionRuns.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1203 |
| Route:richMenuConfig | Usecase:appendAuditLog | invokes | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206 |
| Route:richMenuConfig | Usecase:applyRichMenuAssignment | invokes | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206 |
| Route:richMenuConfig | Usecase:resolvePlan | invokes | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206 |
| Route:richMenuConfig | Usecase:resolveRichMenuTemplate | invokes | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206 |
| Route:schoolCalendarAuditJob | Usecase:runCityPackSourceAuditJob | invokes | src/routes/internal/schoolCalendarAuditJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1276 |
| Route:structDriftBackfill | Usecase:appendAuditLog | invokes | src/routes/admin/structDriftBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1212 |
| Route:structDriftBackfill | Usecase:runStructDriftBackfill | invokes | src/routes/admin/structDriftBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1212 |
| Route:structDriftBackfillJob | Usecase:appendAuditLog | invokes | src/routes/internal/structDriftBackfillJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1279 |
| Route:structDriftBackfillJob | Usecase:runStructDriftBackfill | invokes | src/routes/internal/structDriftBackfillJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1279 |
| Route:taskNudgeJob | Usecase:runTaskNudgeJob | invokes | src/routes/internal/taskNudgeJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1283 |
| Route:taskRulesConfig | Usecase:appendAuditLog | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:applyTaskRulesForUser | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:applyTaskRulesTemplateSet | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:computeUserTasks | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:planTaskRulesApply | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:planTaskRulesTemplateSet | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:resolveTaskContentLinks | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:resolveTaskKeyWarnings | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:taskRulesConfig | Usecase:validateTaskContent | invokes | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216 |
| Route:tasks | Usecase:listUserTasks | invokes | src/routes/tasks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1416 |
| Route:tasks | Usecase:patchTaskState | invokes | src/routes/tasks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1416 |
| Route:traceSearch | Usecase:appendAuditLog | invokes | src/routes/admin/traceSearch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1227 |
| Route:traceSearch | Usecase:getTraceBundle | invokes | src/routes/admin/traceSearch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1227 |
| Route:trackClick | Usecase:appendAuditLog | invokes | src/routes/trackClick.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1420 |
| Route:trackClick | Usecase:recordClickAndRedirect | invokes | src/routes/trackClick.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1420 |
| Route:trackClickGet | Usecase:appendAuditLog | invokes | src/routes/trackClickGet.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1424 |
| Route:trackClickGet | Usecase:recordClickAndRedirect | invokes | src/routes/trackClickGet.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1424 |
| Route:userContextSnapshotJob | Usecase:buildUserContextSnapshot | invokes | src/routes/internal/userContextSnapshotJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1286 |
| Route:userContextSnapshotRecompressJob | Usecase:buildUserContextSnapshot | invokes | src/routes/internal/userContextSnapshotRecompressJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1289 |
| Route:userTimeline | Usecase:buildTemplateKey | invokes | src/routes/admin/userTimeline.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1231 |
| Route:vendors | Usecase:appendAuditLog | invokes | src/routes/admin/vendors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1234 |
| Route:vendors | Usecase:checkLinkHealth | invokes | src/routes/admin/vendors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1234 |
| Route:vendors | Usecase:updateLink | invokes | src/routes/admin/vendors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1234 |
| Route:webhookLine | Usecase:appendAuditLog | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:appendLlmGateDecision | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:buildConciergeContextSnapshot | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:classifyPaidIntent | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:composeConciergeReply | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:declareCityPackFeedbackFromLine | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:declareCityRegionFromLine | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:declareRedacMembershipIdFromLine | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:detectExplicitPaidIntent | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:detectMessagePosture | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:detectOpportunity | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:ensureUserFromWebhook | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:evaluateLlmAvailability | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:evaluateLLMBudget | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:FORBIDDEN_REPLY_PATTERN | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:generateFreeRetrievalReply | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:generatePaidAssistantReply | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:generatePaidCasualReply | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:generatePaidDomainConciergeReply | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:generatePaidFaqReply | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:generatePaidHousingConciergeReply | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:getRedacMembershipStatusForLine | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:getUserContextSnapshot | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:handleJourneyLineCommand | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:handleJourneyPostback | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:loadRecentInterventionSignals | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:logLineWebhookEventsBestEffort | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:recordLlmUsage | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:recordUserLlmConsent | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:resolvePlan | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:sendWelcomeMessage | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookLine | Usecase:syncCityPackRecommendedTasks | invokes | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428 |
| Route:webhookStripe | Usecase:appendAuditLog | invokes | src/routes/webhookStripe.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1462 |
| Route:webhookStripe | Usecase:processStripeWebhookEvent | invokes | src/routes/webhookStripe.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1462 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_approved | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_collecting | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_needs_review | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_queued | src/usecases/cityPack/declareCityRegionFromLine.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_rejected | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.approved | Entity:CityPackRequests | transition_write_to_active | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.approved | Entity:CityPacks | transition_write_to_active | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.collecting | Entity:CityPackRequests | transition_write_to_drafted | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.collecting | Entity:CityPackRequests | transition_write_to_failed | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.collecting | Entity:CityPackRequests | transition_write_to_needs_review | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.collecting | Entity:CityPacks | transition_write_to_drafted | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:city_pack_request.collecting | Entity:SourceRefs | transition_write_to_drafted | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| State:emergency.* | Entity:EmergencyBulletins | transition_write_to_draft | src/usecases/emergency/runEmergencySync.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| State:emergency.* | Entity:EmergencyDiffs | transition_write_to_draft | src/usecases/emergency/runEmergencySync.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| State:emergency.* | Entity:EmergencySnapshots | transition_write_to_draft | src/usecases/emergency/runEmergencySync.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| State:emergency.approved | Entity:DecisionTimeline | transition_write_to_sent | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| State:emergency.approved | Entity:EmergencyBulletins | transition_write_to_sent | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| State:emergency.approved | Entity:NotificationDeliveries | transition_write_to_sent | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| State:emergency.draft | Entity:EmergencyBulletins | transition_write_to_approved | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| State:notification.* | Entity:Notifications | transition_write_to_draft | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| State:notification.active | Entity:Notifications | transition_write_to_sent | src/usecases/notifications/sendNotification.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| State:notification.draft | Entity:Notifications | transition_write_to_active | src/usecases/adminOs/approveNotification.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| State:ops_decision.decided | Entity:DecisionLogs | transition_write_to_resolved | src/usecases/phase33/executeOpsNextAction.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| State:ops_decision.decided | Entity:OpsStates | transition_write_to_resolved | src/usecases/phase33/executeOpsNextAction.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| State:ops_decision.pending | Entity:DecisionLogs | transition_write_to_decided | src/usecases/phase25/submitOpsDecision.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| State:ops_decision.pending | Entity:OpsStates | transition_write_to_decided | src/usecases/phase25/submitOpsDecision.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| Usecase:activateCityPack | Repo:cityPacksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:3 |
| Usecase:activateCityPack | Repo:sourceRefsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:3 |
| Usecase:aggregateJourneyKpis | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7 |
| Usecase:aggregateJourneyKpis | Repo:journeyKpiDailyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7 |
| Usecase:aggregateJourneyKpis | Repo:journeyTodoStatsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7 |
| Usecase:aggregateJourneyKpis | Repo:llmUsageLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7 |
| Usecase:aggregateJourneyKpis | Repo:userSubscriptionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7 |
| Usecase:answerFaqFromKb | Repo:faqAnswerLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14 |
| Usecase:answerFaqFromKb | Repo:faqArticlesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14 |
| Usecase:answerFaqFromKb | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14 |
| Usecase:appendAuditLog | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:19 |
| Usecase:appendDecision | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:22 |
| Usecase:appendLlmAdoptAudit | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:25 |
| Usecase:applyJourneyParamVersion | Repo:journeyGraphCatalogRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29 |
| Usecase:applyJourneyParamVersion | Repo:journeyParamChangeLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29 |
| Usecase:applyJourneyParamVersion | Repo:journeyParamRuntimeRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29 |
| Usecase:applyJourneyParamVersion | Repo:journeyParamVersionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29 |
| Usecase:applyJourneyParamVersion | Repo:journeyPolicyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29 |
| Usecase:applyJourneyParamVersion | Repo:opsConfigRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29 |
| Usecase:applyRichMenuAssignment | Repo:richMenuBindingsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37 |
| Usecase:applyRichMenuAssignment | Repo:richMenuPolicyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37 |
| Usecase:applyRichMenuAssignment | Repo:richMenuRateBucketsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37 |
| Usecase:applyRichMenuAssignment | Repo:richMenuTemplatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37 |
| Usecase:applyTaskRulesTemplateSet | Repo:journeyTemplatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:44 |
| Usecase:applyTaskRulesTemplateSet | Repo:stepRuleChangeLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:44 |
| Usecase:applyTaskRulesTemplateSet | Repo:stepRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:44 |
| Usecase:approveEmergencyBulletin | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:49 |
| Usecase:approveEmergencyBulletin | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:49 |
| Usecase:approveEmergencyBulletin | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:49 |
| Usecase:approveNotification | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:54 |
| Usecase:buildOpsSnapshots | Repo:opsSnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:58 |
| Usecase:buildTemplateKey | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62 |
| Usecase:buildTemplateKey | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62 |
| Usecase:buildTemplateKey | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62 |
| Usecase:buildTemplateKey | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62 |
| Usecase:buildUserContextSnapshot | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68 |
| Usecase:buildUserContextSnapshot | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68 |
| Usecase:buildUserContextSnapshot | Repo:userContextSnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68 |
| Usecase:buildUserContextSnapshot | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68 |
| Usecase:checkLinkHealth | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:74 |
| Usecase:composeCityAndNationwidePacks | Repo:cityPacksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:78 |
| Usecase:computeCityPackMetrics | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82 |
| Usecase:computeCityPackMetrics | Repo:cityPackMetricsDailyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82 |
| Usecase:computeCityPackMetrics | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82 |
| Usecase:computeCityPackMetrics | Repo:sourceRefsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82 |
| Usecase:computeNotificationFatigueWarning | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:88 |
| Usecase:computePlanHash | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:91 |
| Usecase:computeUserTasks | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94 |
| Usecase:computeUserTasks | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94 |
| Usecase:computeUserTasks | Repo:stepRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94 |
| Usecase:computeUserTasks | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94 |
| Usecase:computeUserTasks | Repo:tasksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94 |
| Usecase:confirmTokenData | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:confirmTokenData | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:confirmTokenData | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:confirmTokenData | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:confirmTokenData | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:confirmTokenData | Repo:sendRetryQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:confirmTokenData | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:confirmTokenData | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101 |
| Usecase:createLink | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:111 |
| Usecase:createNotification | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:114 |
| Usecase:createNotification | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:114 |
| Usecase:createNotificationPhase1 | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:118 |
| Usecase:createNotificationPhase1 | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:118 |
| Usecase:createOpsSegment | Repo:opsSegmentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:122 |
| Usecase:declareCityPackFeedbackFromLine | Repo:cityPackFeedbackRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:125 |
| Usecase:declareCityPackFeedbackFromLine | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:125 |
| Usecase:declareCityPackFeedbackFromLine | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:125 |
| Usecase:declareCityRegionFromLine | Repo:cityPackRequestsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:130 |
| Usecase:declareCityRegionFromLine | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:130 |
| Usecase:declareCityRegionFromLine | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:130 |
| Usecase:declareRedacMembershipIdFromLine | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:135 |
| Usecase:deleteLink | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:138 |
| Usecase:dryRunAutomationDecision | Repo:automationConfigRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:144 |
| Usecase:ensureUserFromWebhook | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:148 |
| Usecase:evaluateLlmAvailability | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:151 |
| Usecase:evaluateLLMBudget | Repo:llmUsageStatsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154 |
| Usecase:evaluateLLMBudget | Repo:opsConfigRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154 |
| Usecase:evaluateLLMBudget | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154 |
| Usecase:executeBackfill | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:159 |
| Usecase:executeNotificationSend | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162 |
| Usecase:executeNotificationSend | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162 |
| Usecase:executeNotificationSend | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162 |
| Usecase:executeNotificationSend | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162 |
| Usecase:executeNotificationSend | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162 |
| Usecase:executeNotificationSend | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162 |
| Usecase:executeOpsNextAction | Repo:decisionDriftsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170 |
| Usecase:executeOpsNextAction | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170 |
| Usecase:executeOpsNextAction | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170 |
| Usecase:executeOpsNextAction | Repo:opsStatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170 |
| Usecase:executeOpsNextAction | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170 |
| Usecase:executeRecovery | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:177 |
| Usecase:executeSegmentSend | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:automationConfigRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:automationRunsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:notificationTemplatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:opsStatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:sendRetryQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:executeSegmentSend | Repo:templatesVRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180 |
| Usecase:fetchProviderSnapshot | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:192 |
| Usecase:fetchProviderSnapshot | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:192 |
| Usecase:fetchProviderSnapshot | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:192 |
| Usecase:finalizeLlmActionRewards | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197 |
| Usecase:finalizeLlmActionRewards | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197 |
| Usecase:finalizeLlmActionRewards | Repo:llmActionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197 |
| Usecase:finalizeLlmActionRewards | Repo:llmBanditStateRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197 |
| Usecase:finalizeLlmActionRewards | Repo:llmContextualBanditStateRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197 |
| Usecase:generatePaidFaqReply | Repo:llmQualityLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:210 |
| Usecase:getAutomationConfig | Repo:automationConfigRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:214 |
| Usecase:getBackfillStatus | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:217 |
| Usecase:getEmergencyBulletin | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220 |
| Usecase:getEmergencyBulletin | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220 |
| Usecase:getEmergencyBulletin | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220 |
| Usecase:getEmergencyBulletin | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220 |
| Usecase:getEmergencyBulletin | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220 |
| Usecase:getEmergencyBulletin | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220 |
| Usecase:getEmergencyEvidence | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228 |
| Usecase:getEmergencyEvidence | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228 |
| Usecase:getEmergencyEvidence | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228 |
| Usecase:getEmergencyEvidence | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228 |
| Usecase:getEmergencyEvidence | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228 |
| Usecase:getEmergencyEvidence | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228 |
| Usecase:getKillSwitch | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:236 |
| Usecase:getLatestDecision | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:239 |
| Usecase:getMemberSummary | Repo:opsStatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:242 |
| Usecase:getMemberSummary | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:242 |
| Usecase:getNextActionCandidates | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:246 |
| Usecase:getNotificationDeliveries | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250 |
| Usecase:getNotificationDeliveries | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250 |
| Usecase:getNotificationDeliveries | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250 |
| Usecase:getNotificationDeliveries | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250 |
| Usecase:getNotificationOperationalSummary | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:256 |
| Usecase:getNotificationOperationalSummary | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:256 |
| Usecase:getNotificationOperationalSummary | Repo:opsSnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:256 |
| Usecase:getNotificationReadModel | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:261 |
| Usecase:getNotificationReadModel | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:261 |
| Usecase:getNotificationReadModel | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:261 |
| Usecase:getOpsAssistForConsole | Repo:opsAssistCacheRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:267 |
| Usecase:getOpsAssistSuggestion | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270 |
| Usecase:getOpsAssistSuggestion | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270 |
| Usecase:getOpsAssistSuggestion | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270 |
| Usecase:getOpsAssistSuggestion | Repo:opsAssistCacheRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270 |
| Usecase:getOpsAssistSuggestion | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270 |
| Usecase:getOpsConsole | Repo:decisionDriftsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:277 |
| Usecase:getOpsConsole | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:277 |
| Usecase:getOpsDashboard | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282 |
| Usecase:getOpsDashboard | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282 |
| Usecase:getOpsDashboard | Repo:noticesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282 |
| Usecase:getOpsDashboard | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282 |
| Usecase:getOpsExplanation | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:288 |
| Usecase:getOpsSegment | Repo:opsSegmentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:291 |
| Usecase:getRecoveryStatus | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:294 |
| Usecase:getRedacMembershipStatusForLine | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:297 |
| Usecase:getStaleMemberNumberUsers | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:300 |
| Usecase:getTraceBundle | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:303 |
| Usecase:getTraceBundle | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:303 |
| Usecase:getTraceBundle | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:303 |
| Usecase:getUserContextSnapshot | Repo:userContextSnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:308 |
| Usecase:getUserOperationalSummary | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserOperationalSummary | Repo:journeyTodoStatsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserOperationalSummary | Repo:llmUsageStatsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserOperationalSummary | Repo:opsSnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserOperationalSummary | Repo:userJourneyProfilesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserOperationalSummary | Repo:userJourneySchedulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserOperationalSummary | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserOperationalSummary | Repo:userSubscriptionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311 |
| Usecase:getUserStateSummary | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322 |
| Usecase:getUserStateSummary | Repo:opsSnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322 |
| Usecase:getUserStateSummary | Repo:opsStatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322 |
| Usecase:getUserStateSummary | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322 |
| Usecase:giveUpRetryQueuedSend | Repo:sendRetryQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:328 |
| Usecase:handleJourneyLineCommand | Repo:cityPacksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:stepRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:taskContentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:tasksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:userCityPackPreferencesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:userJourneyProfilesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:userJourneySchedulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyLineCommand | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331 |
| Usecase:handleJourneyPostback | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:345 |
| Usecase:importMunicipalitySchools | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:348 |
| Usecase:importMunicipalitySchools | Repo:municipalitySchoolsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:348 |
| Usecase:listDecisions | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:352 |
| Usecase:listEmergencyBulletins | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355 |
| Usecase:listEmergencyBulletins | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355 |
| Usecase:listEmergencyBulletins | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355 |
| Usecase:listEmergencyBulletins | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355 |
| Usecase:listEmergencyBulletins | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355 |
| Usecase:listEmergencyBulletins | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355 |
| Usecase:listEmergencyProviders | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363 |
| Usecase:listEmergencyProviders | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363 |
| Usecase:listEmergencyProviders | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363 |
| Usecase:listEmergencyProviders | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363 |
| Usecase:listEmergencyProviders | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363 |
| Usecase:listEmergencyProviders | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363 |
| Usecase:listLinks | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:371 |
| Usecase:listNotifications | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:374 |
| Usecase:listOpsConsole | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:377 |
| Usecase:listOpsSegments | Repo:opsSegmentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:380 |
| Usecase:listRetryQueue | Repo:sendRetryQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:383 |
| Usecase:listUserTasks | Repo:tasksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:386 |
| Usecase:loadRecentInterventionSignals | Repo:llmActionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:389 |
| Usecase:logEventBestEffort | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:392 |
| Usecase:logEventBestEffort | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:392 |
| Usecase:logLineWebhookEventsBestEffort | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:396 |
| Usecase:markDeliveryReaction | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:399 |
| Usecase:markDeliveryReaction | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:399 |
| Usecase:markDeliveryReactionV2 | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403 |
| Usecase:markDeliveryReactionV2 | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403 |
| Usecase:markDeliveryReactionV2 | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403 |
| Usecase:markDeliveryReactionV2 | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409 |
| Usecase:normalizeAndDiffProvider | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409 |
| Usecase:normalizeAndDiffProvider | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409 |
| Usecase:normalizeDeliveryId | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:418 |
| Usecase:normalizeLimit | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:cityPackMetricsDailyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:cityPacksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:journeyGraphCatalogRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:journeyParamVersionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:journeyPolicyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:journeyReminderRunsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:sourceRefsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:stepRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:userCityPackPreferencesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:userJourneySchedulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeLimit | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421 |
| Usecase:normalizeReason | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445 |
| Usecase:normalizeReason | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445 |
| Usecase:normalizeReason | Repo:journeyKpiDailyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445 |
| Usecase:normalizeReason | Repo:journeyTodoStatsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445 |
| Usecase:normalizeReason | Repo:llmUsageLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445 |
| Usecase:normalizeReason | Repo:sendRetryQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445 |
| Usecase:normalizeReason | Repo:userSubscriptionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445 |
| Usecase:normalizeWindowDays | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454 |
| Usecase:normalizeWindowDays | Repo:cityPackMetricsDailyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454 |
| Usecase:normalizeWindowDays | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454 |
| Usecase:normalizeWindowDays | Repo:sourceRefsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454 |
| Usecase:patchTaskState | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:460 |
| Usecase:patchTaskState | Repo:tasksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:460 |
| Usecase:planBackfill | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:464 |
| Usecase:planNotificationSend | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467 |
| Usecase:planNotificationSend | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467 |
| Usecase:planNotificationSend | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467 |
| Usecase:planNotificationSend | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467 |
| Usecase:planRecovery | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:473 |
| Usecase:planRetryQueuedSend | Repo:sendRetryQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:476 |
| Usecase:planSegmentSend | Repo:notificationTemplatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:479 |
| Usecase:planSegmentSend | Repo:templatesVRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:479 |
| Usecase:planTaskRulesApply | Repo:stepRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:483 |
| Usecase:planTaskRulesApply | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:483 |
| Usecase:previewEmergencyRule | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:488 |
| Usecase:previewEmergencyRule | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:488 |
| Usecase:previewEmergencyRule | Repo:emergencyRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:488 |
| Usecase:previewNotification | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:493 |
| Usecase:previewNotification | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:493 |
| Usecase:processStripeWebhookEvent | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497 |
| Usecase:processStripeWebhookEvent | Repo:stripeWebhookDeadLettersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497 |
| Usecase:processStripeWebhookEvent | Repo:stripeWebhookEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497 |
| Usecase:processStripeWebhookEvent | Repo:userSubscriptionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497 |
| Usecase:recordClickAndRedirect | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:503 |
| Usecase:recordClickAndRedirect | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:503 |
| Usecase:recordClickAndRedirect | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:503 |
| Usecase:recordLlmUsage | Repo:llmUsageLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:508 |
| Usecase:recordLlmUsage | Repo:llmUsageStatsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:508 |
| Usecase:recordOpsNextAction | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:512 |
| Usecase:recordOpsNextAction | Repo:opsStatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:512 |
| Usecase:recordOpsReview | Repo:opsStateRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:516 |
| Usecase:recordUserLlmConsent | Repo:userConsentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:519 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522 |
| Usecase:rejectEmergencyBulletin | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522 |
| Usecase:rejectEmergencyBulletin | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522 |
| Usecase:resolvePlan | Repo:opsConfigRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:530 |
| Usecase:resolvePlan | Repo:userSubscriptionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:530 |
| Usecase:resolveRichMenuTemplate | Repo:journeyPolicyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuAssignmentRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuBindingsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuPhaseProfilesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuPolicyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuTemplatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534 |
| Usecase:resolveTaskContentLinks | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:542 |
| Usecase:resolveTaskContentLinks | Repo:taskContentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:542 |
| Usecase:resolveTaskKeyWarnings | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:546 |
| Usecase:resolveTaskKeyWarnings | Repo:taskContentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:546 |
| Usecase:retryQueuedSend | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550 |
| Usecase:retryQueuedSend | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550 |
| Usecase:retryQueuedSend | Repo:notificationTemplatesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550 |
| Usecase:retryQueuedSend | Repo:sendRetryQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550 |
| Usecase:retryQueuedSend | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550 |
| Usecase:reviewSourceRefDecision | Repo:sourceRefsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:557 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyGraphCatalogRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyParamChangeLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyParamRuntimeRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyParamVersionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyPolicyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560 |
| Usecase:rollbackJourneyParamVersion | Repo:opsConfigRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560 |
| Usecase:runCityPackDraftJob | Repo:cityPackRequestsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:568 |
| Usecase:runCityPackDraftJob | Repo:cityPacksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:568 |
| Usecase:runCityPackDraftJob | Repo:sourceRefsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:568 |
| Usecase:runCityPackSourceAuditJob | Repo:cityPackBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573 |
| Usecase:runCityPackSourceAuditJob | Repo:cityPacksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573 |
| Usecase:runCityPackSourceAuditJob | Repo:sourceAuditRunsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573 |
| Usecase:runCityPackSourceAuditJob | Repo:sourceEvidenceRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573 |
| Usecase:runCityPackSourceAuditJob | Repo:sourceRefsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573 |
| Usecase:runEmergencySync | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580 |
| Usecase:runEmergencySync | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580 |
| Usecase:runEmergencySync | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580 |
| Usecase:runEmergencySync | Repo:emergencyRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580 |
| Usecase:runEmergencySync | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580 |
| Usecase:runJourneyBranchDispatchJob | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587 |
| Usecase:runJourneyBranchDispatchJob | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587 |
| Usecase:runJourneyBranchDispatchJob | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587 |
| Usecase:runJourneyBranchDispatchJob | Repo:journeyBranchQueueRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587 |
| Usecase:runJourneyParamDryRun | Repo:journeyParamVersionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:593 |
| Usecase:runJourneyParamDryRun | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:593 |
| Usecase:runJourneyParamDryRun | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:593 |
| Usecase:runJourneyTodoReminderJob | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598 |
| Usecase:runJourneyTodoReminderJob | Repo:eventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyGraphCatalogRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyPolicyRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyReminderRunsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyTodoItemsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598 |
| Usecase:runJourneyTodoReminderJob | Repo:userJourneySchedulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598 |
| Usecase:runNotificationTest | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607 |
| Usecase:runNotificationTest | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607 |
| Usecase:runNotificationTest | Repo:notificationTestRunsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607 |
| Usecase:runNotificationTest | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607 |
| Usecase:runPhase2Automation | Repo:analyticsReadRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:614 |
| Usecase:runPhase2Automation | Repo:scenarioReportsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:614 |
| Usecase:runPhase2Automation | Repo:scenarioRunsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:614 |
| Usecase:runTaskNudgeJob | Repo:stepRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620 |
| Usecase:runTaskNudgeJob | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620 |
| Usecase:runTaskNudgeJob | Repo:tasksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620 |
| Usecase:runTaskNudgeJob | Repo:userJourneyProfilesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620 |
| Usecase:sendNotice | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:626 |
| Usecase:sendNotice | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:626 |
| Usecase:sendNotice | Repo:noticesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:626 |
| Usecase:sendNotification | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631 |
| Usecase:sendNotification | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631 |
| Usecase:sendNotification | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631 |
| Usecase:sendNotification | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631 |
| Usecase:sendNotification | Repo:userCityPackPreferencesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631 |
| Usecase:sendNotification | Repo:userJourneyProfilesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631 |
| Usecase:sendNotification | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631 |
| Usecase:sendNotificationPhase1 | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640 |
| Usecase:sendNotificationPhase1 | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640 |
| Usecase:sendNotificationPhase1 | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640 |
| Usecase:sendNotificationPhase1 | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640 |
| Usecase:sendNotificationPhase1 | Repo:usersPhase1Repo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640 |
| Usecase:sendOpsNotice | Repo:auditLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647 |
| Usecase:sendOpsNotice | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647 |
| Usecase:sendOpsNotice | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647 |
| Usecase:sendOpsNotice | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647 |
| Usecase:sendWelcomeMessage | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:653 |
| Usecase:setKillSwitch | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:656 |
| Usecase:submitOpsDecision | Repo:decisionLogsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:659 |
| Usecase:submitOpsDecision | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:659 |
| Usecase:summarizeDraftWithLLM | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664 |
| Usecase:summarizeDraftWithLLM | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664 |
| Usecase:summarizeDraftWithLLM | Repo:systemFlagsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664 |
| Usecase:syncCityPackRecommendedTasks | Repo:cityPacksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669 |
| Usecase:syncCityPackRecommendedTasks | Repo:stepRulesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669 |
| Usecase:syncCityPackRecommendedTasks | Repo:tasksRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669 |
| Usecase:syncCityPackRecommendedTasks | Repo:userCityPackPreferencesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669 |
| Usecase:syncCityPackRecommendedTasks | Repo:usersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669 |
| Usecase:testSendNotification | Repo:decisionTimelineRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:676 |
| Usecase:testSendNotification | Repo:deliveriesRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:676 |
| Usecase:testSendNotification | Repo:notificationsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:676 |
| Usecase:updateEmergencyProvider | Repo:emergencyBulletinsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681 |
| Usecase:updateEmergencyProvider | Repo:emergencyDiffsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681 |
| Usecase:updateEmergencyProvider | Repo:emergencyProvidersRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681 |
| Usecase:updateEmergencyProvider | Repo:emergencySnapshotsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681 |
| Usecase:updateEmergencyProvider | Repo:emergencyUnmappedEventsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681 |
| Usecase:updateEmergencyProvider | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681 |
| Usecase:updateLink | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:689 |
| Usecase:validateJourneyParamVersion | Repo:journeyParamVersionsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:692 |
| Usecase:validateTaskContent | Repo:linkRegistryRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:695 |
| Usecase:validateTaskContent | Repo:taskContentsRepo | uses_repo | docs/REPO_AUDIT_INPUTS/dependency_graph.json:695 |

<!-- KG_V2_RELATIONS_JOIN_BEGIN -->

## V2 Join/Cardinality Extension

| From | To | Relation | JoinField | Cardinality | Evidence |
| --- | --- | --- | --- | --- | --- |
| Entity:CityPacks | Entity:SourceRefs | references_vendor_sources | sourceRefId (CityPacks.sourceRefs[]) | 1:N | src/usecases/cityPack/runCityPackSourceAuditJob.js:71<br>src/repos/firestore/sourceRefsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:13 |
| Entity:LlmInputBoundary | Entity:LlmResponse | llm_inference | UNOBSERVED_IN_DOCS | 1:N | src/usecases/llm/buildLlmInputView.js:1<br>src/infra/llmClient.js:46<br>docs/knowledge-graph/ENTITY_RELATIONS.md:14 |
| Entity:LlmResponse | Entity:FaqAnswerLogs | persist_answer_trace | UNOBSERVED_IN_DOCS | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>src/repos/firestore/faqAnswerLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:15 |
| Pipeline:Notification | Entity:AuditLogs | writes | UNOBSERVED_IN_DOCS | 1:N | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:16 |
| Pipeline:Notification | Entity:DecisionTimeline | writes | UNOBSERVED_IN_DOCS | 1:N | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:17 |
| Pipeline:Notification | Entity:NotificationDeliveries | writes | UNOBSERVED_IN_DOCS | 1:N | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:18 |
| Pipeline:Notification | Entity:Notifications | writes | notificationId | 1:N | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:19 |
| Pipeline:Notification | Entity:SendRetryQueue | writes | UNOBSERVED_IN_DOCS | 1:N | docs/REPO_AUDIT_INPUTS/notification_flow.json:18<br>src/usecases/notifications/sendNotification.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:20 |
| Repo:analyticsReadRepo | Entity:Checklists | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:21 |
| Repo:analyticsReadRepo | Entity:Events | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:22 |
| Repo:analyticsReadRepo | Entity:NotificationDeliveries | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:23 |
| Repo:analyticsReadRepo | Entity:Notifications | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:24 |
| Repo:analyticsReadRepo | Entity:UserChecklists | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:25 |
| Repo:analyticsReadRepo | Entity:Users | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:8<br>src/repos/firestore/analyticsReadRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:26 |
| Repo:auditLogsRepo | Entity:AuditLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:20<br>src/repos/firestore/auditLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:27 |
| Repo:automationConfigRepo | Entity:AutomationConfig | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:145<br>src/repos/firestore/automationConfigRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:28 |
| Repo:automationRunsRepo | Entity:AutomationRuns | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:183<br>src/repos/firestore/automationRunsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:29 |
| Repo:cityPackBulletinsRepo | Entity:CityPackBulletins | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:574<br>src/repos/firestore/cityPackBulletinsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:30 |
| Repo:cityPackFeedbackRepo | Entity:CityPackFeedback | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:126<br>src/repos/firestore/cityPackFeedbackRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:31 |
| Repo:cityPackMetricsDailyRepo | Entity:CityPackMetricsDaily | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:84<br>src/repos/firestore/cityPackMetricsDailyRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:32 |
| Repo:cityPackRequestsRepo | Entity:CityPackRequests | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:131<br>src/repos/firestore/cityPackRequestsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:33 |
| Repo:cityPacksRepo | Entity:CityPacks | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:4<br>src/repos/firestore/cityPacksRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:34 |
| Repo:decisionDriftsRepo | Entity:DecisionDrifts | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:171<br>src/repos/firestore/decisionDriftsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:35 |
| Repo:decisionLogsRepo | Entity:DecisionLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:23<br>src/repos/firestore/decisionLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:36 |
| Repo:decisionTimelineRepo | Entity:DecisionTimeline | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:104<br>src/repos/firestore/decisionTimelineRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:37 |
| Repo:deliveriesRepo | Entity:NotificationDeliveries | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:89<br>src/repos/firestore/deliveriesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:38 |
| Repo:emergencyBulletinsRepo | Entity:EmergencyBulletins | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:50<br>src/repos/firestore/emergencyBulletinsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:39 |
| Repo:emergencyDiffsRepo | Entity:EmergencyDiffs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:222<br>src/repos/firestore/emergencyDiffsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:40 |
| Repo:emergencyEventsRepo | Entity:EmergencyEventsNormalized | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:412<br>src/repos/firestore/emergencyEventsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:41 |
| Repo:emergencyProvidersRepo | Entity:EmergencyProviders | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:193<br>src/repos/firestore/emergencyProvidersRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:42 |
| Repo:emergencyRulesRepo | Entity:EmergencyRules | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:491<br>src/repos/firestore/emergencyRulesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:43 |
| Repo:emergencySnapshotsRepo | Entity:EmergencySnapshots | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:194<br>src/repos/firestore/emergencySnapshotsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:44 |
| Repo:emergencyUnmappedEventsRepo | Entity:EmergencyUnmappedEvents | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:225<br>src/repos/firestore/emergencyUnmappedEventsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:45 |
| Repo:eventsRepo | Entity:Events | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:96<br>src/repos/firestore/eventsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:46 |
| Repo:faqAnswerLogsRepo | Entity:FaqAnswerLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:15<br>src/repos/firestore/faqAnswerLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:47 |
| Repo:faqArticlesRepo | Entity:FaqArticles | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:16<br>src/repos/firestore/faqArticlesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:48 |
| Repo:journeyBranchQueueRepo | Entity:JourneyBranchQueue | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:591<br>src/repos/firestore/journeyBranchQueueRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:49 |
| Repo:journeyGraphCatalogRepo | Entity:OpsConfig | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:30<br>src/repos/firestore/journeyGraphCatalogRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:50 |
| Repo:journeyKpiDailyRepo | Entity:JourneyKpiDaily | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:9<br>src/repos/firestore/journeyKpiDailyRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:51 |
| Repo:journeyParamChangeLogsRepo | Entity:JourneyParamChangeLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:31<br>src/repos/firestore/journeyParamChangeLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:52 |
| Repo:journeyParamRuntimeRepo | Entity:OpsConfig | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:32<br>src/repos/firestore/journeyParamRuntimeRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:53 |
| Repo:journeyParamVersionsRepo | Entity:JourneyParamVersions | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:33<br>src/repos/firestore/journeyParamVersionsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:54 |
| Repo:journeyPolicyRepo | Entity:OpsConfig | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:34<br>src/repos/firestore/journeyPolicyRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:55 |
| Repo:journeyReminderRunsRepo | Entity:JourneyReminderRuns | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:435<br>src/repos/firestore/journeyReminderRunsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:56 |
| Repo:journeyTemplatesRepo | Entity:JourneyTemplates | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:45<br>src/repos/firestore/journeyTemplatesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:57 |
| Repo:journeyTodoItemsRepo | Entity:JourneyTodoItems | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:70<br>src/repos/firestore/journeyTodoItemsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:58 |
| Repo:journeyTodoStatsRepo | Entity:JourneyTodoStats | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:10<br>src/repos/firestore/journeyTodoStatsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:59 |
| Repo:linkRegistryRepo | Entity:LinkRegistry | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:51<br>src/repos/firestore/linkRegistryRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:60 |
| Repo:llmActionLogsRepo | Entity:LlmActionLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:200<br>src/repos/firestore/llmActionLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:61 |
| Repo:llmBanditStateRepo | Entity:LlmBanditState | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:201<br>src/repos/firestore/llmBanditStateRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:62 |
| Repo:llmContextualBanditStateRepo | Entity:LlmContextualBanditState | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:202<br>src/repos/firestore/llmContextualBanditStateRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:63 |
| Repo:llmQualityLogsRepo | Entity:LlmQualityLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:211<br>src/repos/firestore/llmQualityLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:64 |
| Repo:llmUsageLogsRepo | Entity:LlmUsageLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:11<br>src/repos/firestore/llmUsageLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:65 |
| Repo:llmUsageStatsRepo | Entity:LlmUsageStats | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:155<br>src/repos/firestore/llmUsageStatsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:66 |
| Repo:municipalitySchoolsRepo | Entity:MunicipalitySchools | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:350<br>src/repos/firestore/municipalitySchoolsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:67 |
| Repo:noticesRepo | Entity:Notices | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:285<br>src/repos/firestore/noticesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:68 |
| Repo:notificationsRepo | Entity:Notifications | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:55<br>src/repos/firestore/notificationsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:69 |
| Repo:notificationTemplatesRepo | Entity:NotificationTemplates | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:186<br>src/repos/firestore/notificationTemplatesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:70 |
| Repo:notificationTestRunsRepo | Entity:NotificationTestRunItems | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:610<br>src/repos/firestore/notificationTestRunsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:71 |
| Repo:notificationTestRunsRepo | Entity:NotificationTestRuns | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:610<br>src/repos/firestore/notificationTestRunsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:72 |
| Repo:opsAssistCacheRepo | Entity:OpsAssistCache | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:268<br>src/repos/firestore/opsAssistCacheRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:73 |
| Repo:opsConfigRepo | Entity:OpsConfig | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:35<br>src/repos/firestore/opsConfigRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:74 |
| Repo:opsSegmentsRepo | Entity:OpsSegments | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:123<br>src/repos/firestore/opsSegmentsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:75 |
| Repo:opsSnapshotsRepo | Entity:OpsReadModelSnapshots | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:59<br>src/repos/firestore/opsSnapshotsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:76 |
| Repo:opsStateRepo | Entity:OpsStates | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:517<br>src/repos/firestore/opsStateRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:77 |
| Repo:opsStatesRepo | Entity:OpsStates | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:174<br>src/repos/firestore/opsStatesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:78 |
| Repo:richMenuAssignmentRulesRepo | Entity:RichMenuAssignmentRules | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:536<br>src/repos/firestore/richMenuAssignmentRulesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:79 |
| Repo:richMenuBindingsRepo | Entity:RichMenuBindings | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:38<br>src/repos/firestore/richMenuBindingsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:80 |
| Repo:richMenuPhaseProfilesRepo | Entity:RichMenuPhaseProfiles | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:538<br>src/repos/firestore/richMenuPhaseProfilesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:81 |
| Repo:richMenuPolicyRepo | Entity:OpsConfig | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:39<br>src/repos/firestore/richMenuPolicyRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:82 |
| Repo:richMenuRateBucketsRepo | Entity:RichMenuRateBuckets | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:40<br>src/repos/firestore/richMenuRateBucketsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:83 |
| Repo:richMenuTemplatesRepo | Entity:RichMenuTemplates | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:41<br>src/repos/firestore/richMenuTemplatesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:84 |
| Repo:scenarioReportsRepo | Entity:Phase2ReportsChecklistPending | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:616<br>src/repos/firestore/scenarioReportsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:85 |
| Repo:scenarioReportsRepo | Entity:Phase2ReportsDailyEvents | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:616<br>src/repos/firestore/scenarioReportsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:86 |
| Repo:scenarioReportsRepo | Entity:Phase2ReportsWeeklyEvents | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:616<br>src/repos/firestore/scenarioReportsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:87 |
| Repo:scenarioRunsRepo | Entity:Phase2Runs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:617<br>src/repos/firestore/scenarioRunsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:88 |
| Repo:sendRetryQueueRepo | Entity:SendRetryQueue | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:107<br>src/repos/firestore/sendRetryQueueRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:89 |
| Repo:sourceAuditRunsRepo | Entity:SourceAuditRuns | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:576<br>src/repos/firestore/sourceAuditRunsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:90 |
| Repo:sourceEvidenceRepo | Entity:SourceEvidence | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:577<br>src/repos/firestore/sourceEvidenceRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:91 |
| Repo:sourceRefsRepo | Entity:SourceRefs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:5<br>src/repos/firestore/sourceRefsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:92 |
| Repo:stepRuleChangeLogsRepo | Entity:StepRuleChangeLogs | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:46<br>src/repos/firestore/stepRuleChangeLogsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:93 |
| Repo:stepRulesRepo | Entity:StepRules | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:47<br>src/repos/firestore/stepRulesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:94 |
| Repo:stripeWebhookDeadLettersRepo | Entity:StripeWebhookDeadLetters | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:499<br>src/repos/firestore/stripeWebhookDeadLettersRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:95 |
| Repo:stripeWebhookEventsRepo | Entity:StripeWebhookEvents | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:500<br>src/repos/firestore/stripeWebhookEventsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:96 |
| Repo:systemFlagsRepo | Entity:SystemFlags | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:17<br>src/repos/firestore/systemFlagsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:97 |
| Repo:taskContentsRepo | Entity:TaskContents | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:338<br>src/repos/firestore/taskContentsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:98 |
| Repo:tasksRepo | Entity:Tasks | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:99<br>src/repos/firestore/tasksRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:99 |
| Repo:templatesVRepo | Entity:TemplatesV | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:190<br>src/repos/firestore/templatesVRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:100 |
| Repo:userCityPackPreferencesRepo | Entity:UserCityPackPreferences | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:340<br>src/repos/firestore/userCityPackPreferencesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:101 |
| Repo:userConsentsRepo | Entity:UserConsents | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:520<br>src/repos/firestore/userConsentsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:102 |
| Repo:userContextSnapshotsRepo | Entity:UserContextSnapshots | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:71<br>src/repos/firestore/userContextSnapshotsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:103 |
| Repo:userJourneyProfilesRepo | Entity:UserJourneyProfiles | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:316<br>src/repos/firestore/userJourneyProfilesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:104 |
| Repo:userJourneySchedulesRepo | Entity:UserJourneySchedules | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:317<br>src/repos/firestore/userJourneySchedulesRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:105 |
| Repo:usersPhase1Repo | Entity:Users | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:645<br>src/repos/firestore/usersPhase1Repo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:106 |
| Repo:usersRepo | Entity:Users | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:66<br>src/repos/firestore/usersRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:107 |
| Repo:userSubscriptionsRepo | Entity:UserSubscriptions | reads_writes_collection | N/A(control-flow) | N:1 | docs/REPO_AUDIT_INPUTS/dependency_graph.json:12<br>src/repos/firestore/userSubscriptionsRepo.js:1<br>docs/knowledge-graph/ENTITY_RELATIONS.md:108 |
| Route:cityPackBulletins | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackBulletins.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:951<br>docs/knowledge-graph/ENTITY_RELATIONS.md:109 |
| Route:cityPackBulletins | Usecase:sendNotification | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackBulletins.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:951<br>docs/knowledge-graph/ENTITY_RELATIONS.md:110 |
| Route:cityPackDraftGeneratorJob | Usecase:runCityPackDraftJob | invokes | N/A(control-flow) | 1:N | src/routes/internal/cityPackDraftGeneratorJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1239<br>docs/knowledge-graph/ENTITY_RELATIONS.md:111 |
| Route:cityPackEducationLinks | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackEducationLinks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:955<br>docs/knowledge-graph/ENTITY_RELATIONS.md:112 |
| Route:cityPackEvidence | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackEvidence.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:958<br>docs/knowledge-graph/ENTITY_RELATIONS.md:113 |
| Route:cityPackFeedback | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackFeedback.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:961<br>docs/knowledge-graph/ENTITY_RELATIONS.md:114 |
| Route:cityPackRequests | Usecase:activateCityPack | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:964<br>docs/knowledge-graph/ENTITY_RELATIONS.md:115 |
| Route:cityPackRequests | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:964<br>docs/knowledge-graph/ENTITY_RELATIONS.md:116 |
| Route:cityPackRequests | Usecase:runCityPackDraftJob | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:964<br>docs/knowledge-graph/ENTITY_RELATIONS.md:117 |
| Route:cityPackReviewInbox | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969<br>docs/knowledge-graph/ENTITY_RELATIONS.md:118 |
| Route:cityPackReviewInbox | Usecase:computeCityPackMetrics | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969<br>docs/knowledge-graph/ENTITY_RELATIONS.md:119 |
| Route:cityPackReviewInbox | Usecase:normalizeLimit | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969<br>docs/knowledge-graph/ENTITY_RELATIONS.md:120 |
| Route:cityPackReviewInbox | Usecase:normalizeWindowDays | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969<br>docs/knowledge-graph/ENTITY_RELATIONS.md:121 |
| Route:cityPackReviewInbox | Usecase:reviewSourceRefDecision | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969<br>docs/knowledge-graph/ENTITY_RELATIONS.md:122 |
| Route:cityPackReviewInbox | Usecase:runCityPackSourceAuditJob | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackReviewInbox.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:969<br>docs/knowledge-graph/ENTITY_RELATIONS.md:123 |
| Route:cityPacks | Usecase:activateCityPack | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPacks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:977<br>docs/knowledge-graph/ENTITY_RELATIONS.md:124 |
| Route:cityPacks | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPacks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:977<br>docs/knowledge-graph/ENTITY_RELATIONS.md:125 |
| Route:cityPacks | Usecase:composeCityAndNationwidePacks | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPacks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:977<br>docs/knowledge-graph/ENTITY_RELATIONS.md:126 |
| Route:cityPackSourceAuditJob | Usecase:runCityPackSourceAuditJob | invokes | N/A(control-flow) | 1:N | src/routes/internal/cityPackSourceAuditJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1242<br>docs/knowledge-graph/ENTITY_RELATIONS.md:127 |
| Route:cityPackTemplateLibrary | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackTemplateLibrary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:982<br>docs/knowledge-graph/ENTITY_RELATIONS.md:128 |
| Route:cityPackUpdateProposals | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/cityPackUpdateProposals.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:985<br>docs/knowledge-graph/ENTITY_RELATIONS.md:129 |
| Route:emergencyJobs | Usecase:fetchProviderSnapshot | invokes | N/A(control-flow) | 1:N | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245<br>docs/knowledge-graph/ENTITY_RELATIONS.md:130 |
| Route:emergencyJobs | Usecase:normalizeAndDiffProvider | invokes | N/A(control-flow) | 1:N | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245<br>docs/knowledge-graph/ENTITY_RELATIONS.md:131 |
| Route:emergencyJobs | Usecase:runEmergencySync | invokes | N/A(control-flow) | 1:N | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245<br>docs/knowledge-graph/ENTITY_RELATIONS.md:132 |
| Route:emergencyJobs | Usecase:summarizeDraftWithLLM | invokes | N/A(control-flow) | 1:N | src/routes/internal/emergencyJobs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1245<br>docs/knowledge-graph/ENTITY_RELATIONS.md:133 |
| Route:emergencyLayer | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:134 |
| Route:emergencyLayer | Usecase:approveEmergencyBulletin | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:135 |
| Route:emergencyLayer | Usecase:fetchProviderSnapshot | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:136 |
| Route:emergencyLayer | Usecase:getEmergencyBulletin | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:137 |
| Route:emergencyLayer | Usecase:getEmergencyEvidence | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:138 |
| Route:emergencyLayer | Usecase:listEmergencyBulletins | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:139 |
| Route:emergencyLayer | Usecase:listEmergencyProviders | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:140 |
| Route:emergencyLayer | Usecase:normalizeAndDiffProvider | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:141 |
| Route:emergencyLayer | Usecase:previewEmergencyRule | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:142 |
| Route:emergencyLayer | Usecase:rejectEmergencyBulletin | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:143 |
| Route:emergencyLayer | Usecase:summarizeDraftWithLLM | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:144 |
| Route:emergencyLayer | Usecase:updateEmergencyProvider | invokes | N/A(control-flow) | 1:N | src/routes/admin/emergencyLayer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:988<br>docs/knowledge-graph/ENTITY_RELATIONS.md:145 |
| Route:journeyBranchDispatchJob | Usecase:runJourneyBranchDispatchJob | invokes | N/A(control-flow) | 1:N | src/routes/internal/journeyBranchDispatchJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1251<br>docs/knowledge-graph/ENTITY_RELATIONS.md:146 |
| Route:journeyGraphBranchQueue | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyGraphBranchQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1003<br>docs/knowledge-graph/ENTITY_RELATIONS.md:147 |
| Route:journeyGraphCatalogConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyGraphCatalogConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1006<br>docs/knowledge-graph/ENTITY_RELATIONS.md:148 |
| Route:journeyGraphRuntime | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyGraphRuntime.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1009<br>docs/knowledge-graph/ENTITY_RELATIONS.md:149 |
| Route:journeyKpiBuildJob | Usecase:aggregateJourneyKpis | invokes | N/A(control-flow) | 1:N | src/routes/internal/journeyKpiBuildJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1254<br>docs/knowledge-graph/ENTITY_RELATIONS.md:150 |
| Route:journeyParamConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012<br>docs/knowledge-graph/ENTITY_RELATIONS.md:151 |
| Route:journeyParamConfig | Usecase:applyJourneyParamVersion | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012<br>docs/knowledge-graph/ENTITY_RELATIONS.md:152 |
| Route:journeyParamConfig | Usecase:rollbackJourneyParamVersion | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012<br>docs/knowledge-graph/ENTITY_RELATIONS.md:153 |
| Route:journeyParamConfig | Usecase:runJourneyParamDryRun | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012<br>docs/knowledge-graph/ENTITY_RELATIONS.md:154 |
| Route:journeyParamConfig | Usecase:validateJourneyParamVersion | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyParamConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1012<br>docs/knowledge-graph/ENTITY_RELATIONS.md:155 |
| Route:journeyPolicyConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/journeyPolicyConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1019<br>docs/knowledge-graph/ENTITY_RELATIONS.md:156 |
| Route:journeyTodoReminderJob | Usecase:runJourneyTodoReminderJob | invokes | N/A(control-flow) | 1:N | src/routes/internal/journeyTodoReminderJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1257<br>docs/knowledge-graph/ENTITY_RELATIONS.md:157 |
| Route:kbArticles | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/kbArticles.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1022<br>docs/knowledge-graph/ENTITY_RELATIONS.md:158 |
| Route:legacyStatus | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/legacyStatus.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1025<br>docs/knowledge-graph/ENTITY_RELATIONS.md:159 |
| Route:linkRegistry | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028<br>docs/knowledge-graph/ENTITY_RELATIONS.md:160 |
| Route:linkRegistry | Usecase:checkLinkHealth | invokes | N/A(control-flow) | 1:N | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028<br>docs/knowledge-graph/ENTITY_RELATIONS.md:161 |
| Route:linkRegistry | Usecase:createLink | invokes | N/A(control-flow) | 1:N | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028<br>docs/knowledge-graph/ENTITY_RELATIONS.md:162 |
| Route:linkRegistry | Usecase:deleteLink | invokes | N/A(control-flow) | 1:N | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028<br>docs/knowledge-graph/ENTITY_RELATIONS.md:163 |
| Route:linkRegistry | Usecase:listLinks | invokes | N/A(control-flow) | 1:N | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028<br>docs/knowledge-graph/ENTITY_RELATIONS.md:164 |
| Route:linkRegistry | Usecase:updateLink | invokes | N/A(control-flow) | 1:N | src/routes/admin/linkRegistry.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1028<br>docs/knowledge-graph/ENTITY_RELATIONS.md:165 |
| Route:llmActionRewardFinalizeJob | Usecase:appendLlmGateDecision | invokes | N/A(control-flow) | 1:N | src/routes/internal/llmActionRewardFinalizeJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1260<br>docs/knowledge-graph/ENTITY_RELATIONS.md:166 |
| Route:llmActionRewardFinalizeJob | Usecase:finalizeLlmActionRewards | invokes | N/A(control-flow) | 1:N | src/routes/internal/llmActionRewardFinalizeJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1260<br>docs/knowledge-graph/ENTITY_RELATIONS.md:167 |
| Route:llmConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1036<br>docs/knowledge-graph/ENTITY_RELATIONS.md:168 |
| Route:llmConsent | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmConsent.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1039<br>docs/knowledge-graph/ENTITY_RELATIONS.md:169 |
| Route:llmFaq | Usecase:answerFaqFromKb | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmFaq.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1042<br>docs/knowledge-graph/ENTITY_RELATIONS.md:170 |
| Route:llmFaq | Usecase:appendLlmGateDecision | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmFaq.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1042<br>docs/knowledge-graph/ENTITY_RELATIONS.md:171 |
| Route:llmOps | Usecase:appendLlmGateDecision | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmOps.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1046<br>docs/knowledge-graph/ENTITY_RELATIONS.md:172 |
| Route:llmOps | Usecase:getNextActionCandidates | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmOps.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1046<br>docs/knowledge-graph/ENTITY_RELATIONS.md:173 |
| Route:llmOps | Usecase:getOpsExplanation | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmOps.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1046<br>docs/knowledge-graph/ENTITY_RELATIONS.md:174 |
| Route:llmPolicyConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/llmPolicyConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1051<br>docs/knowledge-graph/ENTITY_RELATIONS.md:175 |
| Route:missingIndexSurface | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/missingIndexSurface.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1055<br>docs/knowledge-graph/ENTITY_RELATIONS.md:176 |
| Route:monitorInsights | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/monitorInsights.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1058<br>docs/knowledge-graph/ENTITY_RELATIONS.md:177 |
| Route:municipalitySchoolsImportJob | Usecase:importMunicipalitySchools | invokes | N/A(control-flow) | 1:N | src/routes/internal/municipalitySchoolsImportJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1264<br>docs/knowledge-graph/ENTITY_RELATIONS.md:178 |
| Route:nextBestAction | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/nextBestAction.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1061<br>docs/knowledge-graph/ENTITY_RELATIONS.md:179 |
| Route:nextBestAction | Usecase:computeNotificationFatigueWarning | invokes | N/A(control-flow) | 1:N | src/routes/admin/nextBestAction.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1061<br>docs/knowledge-graph/ENTITY_RELATIONS.md:180 |
| Route:nextBestAction | Usecase:getNextBestAction | invokes | N/A(control-flow) | 1:N | src/routes/admin/nextBestAction.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1061<br>docs/knowledge-graph/ENTITY_RELATIONS.md:181 |
| Route:notificationDeliveries | Usecase:getNotificationDeliveries | invokes | N/A(control-flow) | 1:N | src/routes/admin/notificationDeliveries.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1066<br>docs/knowledge-graph/ENTITY_RELATIONS.md:182 |
| Route:notifications | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069<br>docs/knowledge-graph/ENTITY_RELATIONS.md:183 |
| Route:notifications | Usecase:createNotification | invokes | N/A(control-flow) | 1:N | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069<br>docs/knowledge-graph/ENTITY_RELATIONS.md:184 |
| Route:notifications | Usecase:listNotifications | invokes | N/A(control-flow) | 1:N | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069<br>docs/knowledge-graph/ENTITY_RELATIONS.md:185 |
| Route:notifications | Usecase:sendNotification | invokes | N/A(control-flow) | 1:N | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069<br>docs/knowledge-graph/ENTITY_RELATIONS.md:186 |
| Route:notifications | Usecase:testSendNotification | invokes | N/A(control-flow) | 1:N | src/routes/admin/notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1069<br>docs/knowledge-graph/ENTITY_RELATIONS.md:187 |
| Route:notificationTest | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/notificationTest.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1076<br>docs/knowledge-graph/ENTITY_RELATIONS.md:188 |
| Route:notificationTest | Usecase:runNotificationTest | invokes | N/A(control-flow) | 1:N | src/routes/admin/notificationTest.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1076<br>docs/knowledge-graph/ENTITY_RELATIONS.md:189 |
| Route:opsFeatureCatalogStatus | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/opsFeatureCatalogStatus.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1080<br>docs/knowledge-graph/ENTITY_RELATIONS.md:190 |
| Route:opsOverview | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/opsOverview.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1083<br>docs/knowledge-graph/ENTITY_RELATIONS.md:191 |
| Route:opsOverview | Usecase:getNotificationOperationalSummary | invokes | N/A(control-flow) | 1:N | src/routes/admin/opsOverview.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1083<br>docs/knowledge-graph/ENTITY_RELATIONS.md:192 |
| Route:opsOverview | Usecase:getUserOperationalSummary | invokes | N/A(control-flow) | 1:N | src/routes/admin/opsOverview.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1083<br>docs/knowledge-graph/ENTITY_RELATIONS.md:193 |
| Route:opsSnapshotHealth | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/opsSnapshotHealth.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1088<br>docs/knowledge-graph/ENTITY_RELATIONS.md:194 |
| Route:opsSnapshotJob | Usecase:buildOpsSnapshots | invokes | N/A(control-flow) | 1:N | src/routes/internal/opsSnapshotJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1267<br>docs/knowledge-graph/ENTITY_RELATIONS.md:195 |
| Route:opsSystemSnapshot | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/opsSystemSnapshot.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1091<br>docs/knowledge-graph/ENTITY_RELATIONS.md:196 |
| Route:opsSystemSnapshot | Usecase:buildOpsSnapshots | invokes | N/A(control-flow) | 1:N | src/routes/admin/opsSystemSnapshot.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1091<br>docs/knowledge-graph/ENTITY_RELATIONS.md:197 |
| Route:osAlerts | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osAlerts.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1095<br>docs/knowledge-graph/ENTITY_RELATIONS.md:198 |
| Route:osAlerts | Usecase:getNotificationReadModel | invokes | N/A(control-flow) | 1:N | src/routes/admin/osAlerts.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1095<br>docs/knowledge-graph/ENTITY_RELATIONS.md:199 |
| Route:osAutomationConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osAutomationConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1099<br>docs/knowledge-graph/ENTITY_RELATIONS.md:200 |
| Route:osConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1102<br>docs/knowledge-graph/ENTITY_RELATIONS.md:201 |
| Route:osContext | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osContext.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1105<br>docs/knowledge-graph/ENTITY_RELATIONS.md:202 |
| Route:osDashboardKpi | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDashboardKpi.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1108<br>docs/knowledge-graph/ENTITY_RELATIONS.md:203 |
| Route:osDeliveryBackfill | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111<br>docs/knowledge-graph/ENTITY_RELATIONS.md:204 |
| Route:osDeliveryBackfill | Usecase:confirmTokenData | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111<br>docs/knowledge-graph/ENTITY_RELATIONS.md:205 |
| Route:osDeliveryBackfill | Usecase:executeBackfill | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111<br>docs/knowledge-graph/ENTITY_RELATIONS.md:206 |
| Route:osDeliveryBackfill | Usecase:getBackfillStatus | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111<br>docs/knowledge-graph/ENTITY_RELATIONS.md:207 |
| Route:osDeliveryBackfill | Usecase:normalizeLimit | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111<br>docs/knowledge-graph/ENTITY_RELATIONS.md:208 |
| Route:osDeliveryBackfill | Usecase:planBackfill | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1111<br>docs/knowledge-graph/ENTITY_RELATIONS.md:209 |
| Route:osDeliveryRecovery | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:210 |
| Route:osDeliveryRecovery | Usecase:computePlanHash | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:211 |
| Route:osDeliveryRecovery | Usecase:confirmTokenData | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:212 |
| Route:osDeliveryRecovery | Usecase:executeRecovery | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:213 |
| Route:osDeliveryRecovery | Usecase:getRecoveryStatus | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:214 |
| Route:osDeliveryRecovery | Usecase:normalizeDeliveryId | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:215 |
| Route:osDeliveryRecovery | Usecase:normalizeReason | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:216 |
| Route:osDeliveryRecovery | Usecase:planRecovery | invokes | N/A(control-flow) | 1:N | src/routes/admin/osDeliveryRecovery.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1119<br>docs/knowledge-graph/ENTITY_RELATIONS.md:217 |
| Route:osErrors | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osErrors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1129<br>docs/knowledge-graph/ENTITY_RELATIONS.md:218 |
| Route:osJourneyKpi | Usecase:aggregateJourneyKpis | invokes | N/A(control-flow) | 1:N | src/routes/admin/osJourneyKpi.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1132<br>docs/knowledge-graph/ENTITY_RELATIONS.md:219 |
| Route:osJourneyKpi | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osJourneyKpi.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1132<br>docs/knowledge-graph/ENTITY_RELATIONS.md:220 |
| Route:osKillSwitch | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osKillSwitch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1136<br>docs/knowledge-graph/ENTITY_RELATIONS.md:221 |
| Route:osKillSwitch | Usecase:getKillSwitch | invokes | N/A(control-flow) | 1:N | src/routes/admin/osKillSwitch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1136<br>docs/knowledge-graph/ENTITY_RELATIONS.md:222 |
| Route:osKillSwitch | Usecase:setKillSwitch | invokes | N/A(control-flow) | 1:N | src/routes/admin/osKillSwitch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1136<br>docs/knowledge-graph/ENTITY_RELATIONS.md:223 |
| Route:osLinkRegistryImpact | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osLinkRegistryImpact.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1141<br>docs/knowledge-graph/ENTITY_RELATIONS.md:224 |
| Route:osLinkRegistryLookup | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osLinkRegistryLookup.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1144<br>docs/knowledge-graph/ENTITY_RELATIONS.md:225 |
| Route:osLlmUsageExport | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osLlmUsageExport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:226 |
| Route:osLlmUsageSummary | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osLlmUsageSummary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1150<br>docs/knowledge-graph/ENTITY_RELATIONS.md:227 |
| Route:osNotifications | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153<br>docs/knowledge-graph/ENTITY_RELATIONS.md:228 |
| Route:osNotifications | Usecase:approveNotification | invokes | N/A(control-flow) | 1:N | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153<br>docs/knowledge-graph/ENTITY_RELATIONS.md:229 |
| Route:osNotifications | Usecase:approveNotification | notification_pipeline_invokes | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3<br>docs/knowledge-graph/ENTITY_RELATIONS.md:230 |
| Route:osNotifications | Usecase:createNotification | invokes | N/A(control-flow) | 1:N | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153<br>docs/knowledge-graph/ENTITY_RELATIONS.md:231 |
| Route:osNotifications | Usecase:createNotification | notification_pipeline_invokes | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3<br>docs/knowledge-graph/ENTITY_RELATIONS.md:232 |
| Route:osNotifications | Usecase:executeNotificationSend | invokes | N/A(control-flow) | 1:N | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153<br>docs/knowledge-graph/ENTITY_RELATIONS.md:233 |
| Route:osNotifications | Usecase:executeNotificationSend | notification_pipeline_invokes | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3<br>docs/knowledge-graph/ENTITY_RELATIONS.md:234 |
| Route:osNotifications | Usecase:planNotificationSend | invokes | N/A(control-flow) | 1:N | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153<br>docs/knowledge-graph/ENTITY_RELATIONS.md:235 |
| Route:osNotifications | Usecase:planNotificationSend | notification_pipeline_invokes | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3<br>docs/knowledge-graph/ENTITY_RELATIONS.md:236 |
| Route:osNotifications | Usecase:previewNotification | invokes | N/A(control-flow) | 1:N | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1153<br>docs/knowledge-graph/ENTITY_RELATIONS.md:237 |
| Route:osNotifications | Usecase:sendNotification | notification_pipeline_invokes | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/notification_flow.json:3<br>docs/knowledge-graph/ENTITY_RELATIONS.md:238 |
| Route:osNotificationSeed | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osNotificationSeed.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1161<br>docs/knowledge-graph/ENTITY_RELATIONS.md:239 |
| Route:osRedacStatus | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osRedacStatus.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1164<br>docs/knowledge-graph/ENTITY_RELATIONS.md:240 |
| Route:osUsersSummaryAnalyze | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osUsersSummaryAnalyze.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1168<br>docs/knowledge-graph/ENTITY_RELATIONS.md:241 |
| Route:osUsersSummaryAnalyze | Usecase:getUsersSummaryFiltered | invokes | N/A(control-flow) | 1:N | src/routes/admin/osUsersSummaryAnalyze.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1168<br>docs/knowledge-graph/ENTITY_RELATIONS.md:242 |
| Route:osUsersSummaryExport | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osUsersSummaryExport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1172<br>docs/knowledge-graph/ENTITY_RELATIONS.md:243 |
| Route:osUsersSummaryExport | Usecase:getUsersSummaryFiltered | invokes | N/A(control-flow) | 1:N | src/routes/admin/osUsersSummaryExport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1172<br>docs/knowledge-graph/ENTITY_RELATIONS.md:244 |
| Route:osView | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/osView.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1176<br>docs/knowledge-graph/ENTITY_RELATIONS.md:245 |
| Route:phase105OpsAssistAdopt | Usecase:appendLlmAdoptAudit | invokes | N/A(control-flow) | 1:N | src/routes/phase105OpsAssistAdopt.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1292<br>docs/knowledge-graph/ENTITY_RELATIONS.md:246 |
| Route:phase121OpsNoticeSend | Usecase:sendOpsNotice | invokes | N/A(control-flow) | 1:N | src/routes/phase121OpsNoticeSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1295<br>docs/knowledge-graph/ENTITY_RELATIONS.md:247 |
| Route:phase1Events | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/phase1Events.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1298<br>docs/knowledge-graph/ENTITY_RELATIONS.md:248 |
| Route:phase1Events | Usecase:logEventBestEffort | invokes | N/A(control-flow) | 1:N | src/routes/phase1Events.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1298<br>docs/knowledge-graph/ENTITY_RELATIONS.md:249 |
| Route:phase1Notifications | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/phase1Notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1179<br>docs/knowledge-graph/ENTITY_RELATIONS.md:250 |
| Route:phase1Notifications | Usecase:createNotificationPhase1 | invokes | N/A(control-flow) | 1:N | src/routes/admin/phase1Notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1179<br>docs/knowledge-graph/ENTITY_RELATIONS.md:251 |
| Route:phase1Notifications | Usecase:sendNotificationPhase1 | invokes | N/A(control-flow) | 1:N | src/routes/admin/phase1Notifications.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1179<br>docs/knowledge-graph/ENTITY_RELATIONS.md:252 |
| Route:phase24DecisionLogs | Usecase:appendDecision | invokes | N/A(control-flow) | 1:N | src/routes/phase24DecisionLogs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1302<br>docs/knowledge-graph/ENTITY_RELATIONS.md:253 |
| Route:phase24DecisionLogs | Usecase:getLatestDecision | invokes | N/A(control-flow) | 1:N | src/routes/phase24DecisionLogs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1302<br>docs/knowledge-graph/ENTITY_RELATIONS.md:254 |
| Route:phase24DecisionLogs | Usecase:listDecisions | invokes | N/A(control-flow) | 1:N | src/routes/phase24DecisionLogs.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1302<br>docs/knowledge-graph/ENTITY_RELATIONS.md:255 |
| Route:phase24OpsState | Usecase:recordOpsNextAction | invokes | N/A(control-flow) | 1:N | src/routes/phase24OpsState.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1307<br>docs/knowledge-graph/ENTITY_RELATIONS.md:256 |
| Route:phase25OpsConsole | Usecase:getOpsConsole | invokes | N/A(control-flow) | 1:N | src/routes/phase25OpsConsole.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1310<br>docs/knowledge-graph/ENTITY_RELATIONS.md:257 |
| Route:phase25OpsDecision | Usecase:submitOpsDecision | invokes | N/A(control-flow) | 1:N | src/routes/phase25OpsDecision.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1313<br>docs/knowledge-graph/ENTITY_RELATIONS.md:258 |
| Route:phase26OpsConsoleList | Usecase:listOpsConsole | invokes | N/A(control-flow) | 1:N | src/routes/phase26OpsConsoleList.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1316<br>docs/knowledge-graph/ENTITY_RELATIONS.md:259 |
| Route:phase2Automation | Usecase:runPhase2Automation | invokes | N/A(control-flow) | 1:N | src/routes/admin/phase2Automation.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1184<br>docs/knowledge-graph/ENTITY_RELATIONS.md:260 |
| Route:phase32OpsDecisionSuggest | Usecase:suggestOpsDecision | invokes | N/A(control-flow) | 1:N | src/routes/phase32OpsDecisionSuggest.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1319<br>docs/knowledge-graph/ENTITY_RELATIONS.md:261 |
| Route:phase33OpsDecisionExecute | Usecase:executeOpsNextAction | invokes | N/A(control-flow) | 1:N | src/routes/phase33OpsDecisionExecute.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1322<br>docs/knowledge-graph/ENTITY_RELATIONS.md:262 |
| Route:phase36NoticeSend | Usecase:sendNotice | invokes | N/A(control-flow) | 1:N | src/routes/phase36NoticeSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1325<br>docs/knowledge-graph/ENTITY_RELATIONS.md:263 |
| Route:phase37DeliveryReactions | Usecase:markDeliveryReaction | invokes | N/A(control-flow) | 1:N | src/routes/phase37DeliveryReactions.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1328<br>docs/knowledge-graph/ENTITY_RELATIONS.md:264 |
| Route:phase37DeliveryReactionsV2 | Usecase:markDeliveryReactionV2 | invokes | N/A(control-flow) | 1:N | src/routes/phase37DeliveryReactionsV2.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:265 |
| Route:phase38OpsDashboard | Usecase:getOpsDashboard | invokes | N/A(control-flow) | 1:N | src/routes/phase38OpsDashboard.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1334<br>docs/knowledge-graph/ENTITY_RELATIONS.md:266 |
| Route:phase39OpsAssistSuggestion | Usecase:getOpsAssistSuggestion | invokes | N/A(control-flow) | 1:N | src/routes/phase39OpsAssistSuggestion.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1337<br>docs/knowledge-graph/ENTITY_RELATIONS.md:267 |
| Route:phase42OpsConsoleView | Usecase:getOpsAssistForConsole | invokes | N/A(control-flow) | 1:N | src/routes/phase42OpsConsoleView.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1340<br>docs/knowledge-graph/ENTITY_RELATIONS.md:268 |
| Route:phase42OpsConsoleView | Usecase:getOpsConsoleView | invokes | N/A(control-flow) | 1:N | src/routes/phase42OpsConsoleView.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1340<br>docs/knowledge-graph/ENTITY_RELATIONS.md:269 |
| Route:phase47AutomationDryRun | Usecase:dryRunAutomationDecision | invokes | N/A(control-flow) | 1:N | src/routes/phase47AutomationDryRun.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1344<br>docs/knowledge-graph/ENTITY_RELATIONS.md:270 |
| Route:phase48AutomationConfig | Usecase:getAutomationConfig | invokes | N/A(control-flow) | 1:N | src/routes/phase48AutomationConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1347<br>docs/knowledge-graph/ENTITY_RELATIONS.md:271 |
| Route:phase52OpsBatch | Usecase:runOpsBatch | invokes | N/A(control-flow) | 1:N | src/routes/phase52OpsBatch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1350<br>docs/knowledge-graph/ENTITY_RELATIONS.md:272 |
| Route:phase5Ops | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354<br>docs/knowledge-graph/ENTITY_RELATIONS.md:273 |
| Route:phase5Ops | Usecase:getNotificationsSummaryFiltered | invokes | N/A(control-flow) | 1:N | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354<br>docs/knowledge-graph/ENTITY_RELATIONS.md:274 |
| Route:phase5Ops | Usecase:getStaleMemberNumberUsers | invokes | N/A(control-flow) | 1:N | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354<br>docs/knowledge-graph/ENTITY_RELATIONS.md:275 |
| Route:phase5Ops | Usecase:getUsersSummaryFiltered | invokes | N/A(control-flow) | 1:N | src/routes/phase5Ops.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1354<br>docs/knowledge-graph/ENTITY_RELATIONS.md:276 |
| Route:phase5Review | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/phase5Review.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1360<br>docs/knowledge-graph/ENTITY_RELATIONS.md:277 |
| Route:phase5Review | Usecase:recordOpsReview | invokes | N/A(control-flow) | 1:N | src/routes/phase5Review.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1360<br>docs/knowledge-graph/ENTITY_RELATIONS.md:278 |
| Route:phase5State | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/phase5State.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1364<br>docs/knowledge-graph/ENTITY_RELATIONS.md:279 |
| Route:phase5State | Usecase:getUserStateSummary | invokes | N/A(control-flow) | 1:N | src/routes/phase5State.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1364<br>docs/knowledge-graph/ENTITY_RELATIONS.md:280 |
| Route:phase61Templates | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/phase61Templates.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1368<br>docs/knowledge-graph/ENTITY_RELATIONS.md:281 |
| Route:phase62OpsDailyReport | Usecase:generateOpsDailyReport | invokes | N/A(control-flow) | 1:N | src/routes/phase62OpsDailyReport.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1371<br>docs/knowledge-graph/ENTITY_RELATIONS.md:282 |
| Route:phase65OpsDailyJob | Usecase:generateOpsDailyReport | invokes | N/A(control-flow) | 1:N | src/routes/phase65OpsDailyJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1374<br>docs/knowledge-graph/ENTITY_RELATIONS.md:283 |
| Route:phase66Segments | Usecase:buildSendSegment | invokes | N/A(control-flow) | 1:N | src/routes/phase66Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1377<br>docs/knowledge-graph/ENTITY_RELATIONS.md:284 |
| Route:phase67PlanSend | Usecase:planSegmentSend | invokes | N/A(control-flow) | 1:N | src/routes/phase67PlanSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1380<br>docs/knowledge-graph/ENTITY_RELATIONS.md:285 |
| Route:phase68ExecuteSend | Usecase:executeSegmentSend | invokes | N/A(control-flow) | 1:N | src/routes/phase68ExecuteSend.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1383<br>docs/knowledge-graph/ENTITY_RELATIONS.md:286 |
| Route:phase6MemberSummary | Usecase:getMemberSummary | invokes | N/A(control-flow) | 1:N | src/routes/phase6MemberSummary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1386<br>docs/knowledge-graph/ENTITY_RELATIONS.md:287 |
| Route:phase73RetryQueue | Usecase:giveUpRetryQueuedSend | invokes | N/A(control-flow) | 1:N | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389<br>docs/knowledge-graph/ENTITY_RELATIONS.md:288 |
| Route:phase73RetryQueue | Usecase:listRetryQueue | invokes | N/A(control-flow) | 1:N | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389<br>docs/knowledge-graph/ENTITY_RELATIONS.md:289 |
| Route:phase73RetryQueue | Usecase:planRetryQueuedSend | invokes | N/A(control-flow) | 1:N | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389<br>docs/knowledge-graph/ENTITY_RELATIONS.md:290 |
| Route:phase73RetryQueue | Usecase:retryQueuedSend | invokes | N/A(control-flow) | 1:N | src/routes/phase73RetryQueue.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1389<br>docs/knowledge-graph/ENTITY_RELATIONS.md:291 |
| Route:phase77Segments | Usecase:createOpsSegment | invokes | N/A(control-flow) | 1:N | src/routes/phase77Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1395<br>docs/knowledge-graph/ENTITY_RELATIONS.md:292 |
| Route:phase77Segments | Usecase:getOpsSegment | invokes | N/A(control-flow) | 1:N | src/routes/phase77Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1395<br>docs/knowledge-graph/ENTITY_RELATIONS.md:293 |
| Route:phase77Segments | Usecase:listOpsSegments | invokes | N/A(control-flow) | 1:N | src/routes/phase77Segments.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1395<br>docs/knowledge-graph/ENTITY_RELATIONS.md:294 |
| Route:phase81DryRun | Usecase:dryRunSegmentSend | invokes | N/A(control-flow) | 1:N | src/routes/phase81DryRun.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1400<br>docs/knowledge-graph/ENTITY_RELATIONS.md:295 |
| Route:phaseLLM2OpsExplain | Usecase:appendLlmGateDecision | invokes | N/A(control-flow) | 1:N | src/routes/phaseLLM2OpsExplain.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1404<br>docs/knowledge-graph/ENTITY_RELATIONS.md:296 |
| Route:phaseLLM2OpsExplain | Usecase:getOpsExplanation | invokes | N/A(control-flow) | 1:N | src/routes/phaseLLM2OpsExplain.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1404<br>docs/knowledge-graph/ENTITY_RELATIONS.md:297 |
| Route:phaseLLM3OpsNextActions | Usecase:appendLlmGateDecision | invokes | N/A(control-flow) | 1:N | src/routes/phaseLLM3OpsNextActions.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1408<br>docs/knowledge-graph/ENTITY_RELATIONS.md:298 |
| Route:phaseLLM3OpsNextActions | Usecase:getNextActionCandidates | invokes | N/A(control-flow) | 1:N | src/routes/phaseLLM3OpsNextActions.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1408<br>docs/knowledge-graph/ENTITY_RELATIONS.md:299 |
| Route:phaseLLM4FaqAnswer | Usecase:answerFaqFromKb | invokes | N/A(control-flow) | 1:N | src/routes/phaseLLM4FaqAnswer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1412<br>docs/knowledge-graph/ENTITY_RELATIONS.md:300 |
| Route:phaseLLM4FaqAnswer | Usecase:appendLlmGateDecision | invokes | N/A(control-flow) | 1:N | src/routes/phaseLLM4FaqAnswer.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1412<br>docs/knowledge-graph/ENTITY_RELATIONS.md:301 |
| Route:productReadiness | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/productReadiness.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1187<br>docs/knowledge-graph/ENTITY_RELATIONS.md:302 |
| Route:readModel | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/readModel.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1190<br>docs/knowledge-graph/ENTITY_RELATIONS.md:303 |
| Route:readModel | Usecase:getNotificationReadModel | invokes | N/A(control-flow) | 1:N | src/routes/admin/readModel.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1190<br>docs/knowledge-graph/ENTITY_RELATIONS.md:304 |
| Route:readPathFallbackSummary | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/readPathFallbackSummary.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1194<br>docs/knowledge-graph/ENTITY_RELATIONS.md:305 |
| Route:redacMembershipUnlink | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/redacMembershipUnlink.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1197<br>docs/knowledge-graph/ENTITY_RELATIONS.md:306 |
| Route:repoMap | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/repoMap.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1200<br>docs/knowledge-graph/ENTITY_RELATIONS.md:307 |
| Route:retentionApplyJob | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/internal/retentionApplyJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1270<br>docs/knowledge-graph/ENTITY_RELATIONS.md:308 |
| Route:retentionDryRunJob | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/internal/retentionDryRunJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1273<br>docs/knowledge-graph/ENTITY_RELATIONS.md:309 |
| Route:retentionRuns | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/retentionRuns.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1203<br>docs/knowledge-graph/ENTITY_RELATIONS.md:310 |
| Route:richMenuConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206<br>docs/knowledge-graph/ENTITY_RELATIONS.md:311 |
| Route:richMenuConfig | Usecase:applyRichMenuAssignment | invokes | N/A(control-flow) | 1:N | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206<br>docs/knowledge-graph/ENTITY_RELATIONS.md:312 |
| Route:richMenuConfig | Usecase:resolvePlan | invokes | N/A(control-flow) | 1:N | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206<br>docs/knowledge-graph/ENTITY_RELATIONS.md:313 |
| Route:richMenuConfig | Usecase:resolveRichMenuTemplate | invokes | N/A(control-flow) | 1:N | src/routes/admin/richMenuConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1206<br>docs/knowledge-graph/ENTITY_RELATIONS.md:314 |
| Route:schoolCalendarAuditJob | Usecase:runCityPackSourceAuditJob | invokes | N/A(control-flow) | 1:N | src/routes/internal/schoolCalendarAuditJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1276<br>docs/knowledge-graph/ENTITY_RELATIONS.md:315 |
| Route:structDriftBackfill | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/structDriftBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1212<br>docs/knowledge-graph/ENTITY_RELATIONS.md:316 |
| Route:structDriftBackfill | Usecase:runStructDriftBackfill | invokes | N/A(control-flow) | 1:N | src/routes/admin/structDriftBackfill.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1212<br>docs/knowledge-graph/ENTITY_RELATIONS.md:317 |
| Route:structDriftBackfillJob | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/internal/structDriftBackfillJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1279<br>docs/knowledge-graph/ENTITY_RELATIONS.md:318 |
| Route:structDriftBackfillJob | Usecase:runStructDriftBackfill | invokes | N/A(control-flow) | 1:N | src/routes/internal/structDriftBackfillJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1279<br>docs/knowledge-graph/ENTITY_RELATIONS.md:319 |
| Route:taskNudgeJob | Usecase:runTaskNudgeJob | invokes | N/A(control-flow) | 1:N | src/routes/internal/taskNudgeJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1283<br>docs/knowledge-graph/ENTITY_RELATIONS.md:320 |
| Route:taskRulesConfig | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:321 |
| Route:taskRulesConfig | Usecase:applyTaskRulesForUser | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:322 |
| Route:taskRulesConfig | Usecase:applyTaskRulesTemplateSet | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:323 |
| Route:taskRulesConfig | Usecase:computeUserTasks | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:324 |
| Route:taskRulesConfig | Usecase:planTaskRulesApply | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:325 |
| Route:taskRulesConfig | Usecase:planTaskRulesTemplateSet | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:326 |
| Route:taskRulesConfig | Usecase:resolveTaskContentLinks | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:327 |
| Route:taskRulesConfig | Usecase:resolveTaskKeyWarnings | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:328 |
| Route:taskRulesConfig | Usecase:validateTaskContent | invokes | N/A(control-flow) | 1:N | src/routes/admin/taskRulesConfig.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1216<br>docs/knowledge-graph/ENTITY_RELATIONS.md:329 |
| Route:tasks | Usecase:listUserTasks | invokes | N/A(control-flow) | 1:N | src/routes/tasks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1416<br>docs/knowledge-graph/ENTITY_RELATIONS.md:330 |
| Route:tasks | Usecase:patchTaskState | invokes | N/A(control-flow) | 1:N | src/routes/tasks.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1416<br>docs/knowledge-graph/ENTITY_RELATIONS.md:331 |
| Route:traceSearch | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/traceSearch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1227<br>docs/knowledge-graph/ENTITY_RELATIONS.md:332 |
| Route:traceSearch | Usecase:getTraceBundle | invokes | N/A(control-flow) | 1:N | src/routes/admin/traceSearch.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1227<br>docs/knowledge-graph/ENTITY_RELATIONS.md:333 |
| Route:trackClick | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/trackClick.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1420<br>docs/knowledge-graph/ENTITY_RELATIONS.md:334 |
| Route:trackClick | Usecase:recordClickAndRedirect | invokes | N/A(control-flow) | 1:N | src/routes/trackClick.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1420<br>docs/knowledge-graph/ENTITY_RELATIONS.md:335 |
| Route:trackClickGet | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/trackClickGet.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1424<br>docs/knowledge-graph/ENTITY_RELATIONS.md:336 |
| Route:trackClickGet | Usecase:recordClickAndRedirect | invokes | N/A(control-flow) | 1:N | src/routes/trackClickGet.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1424<br>docs/knowledge-graph/ENTITY_RELATIONS.md:337 |
| Route:userContextSnapshotJob | Usecase:buildUserContextSnapshot | invokes | N/A(control-flow) | 1:N | src/routes/internal/userContextSnapshotJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1286<br>docs/knowledge-graph/ENTITY_RELATIONS.md:338 |
| Route:userContextSnapshotRecompressJob | Usecase:buildUserContextSnapshot | invokes | N/A(control-flow) | 1:N | src/routes/internal/userContextSnapshotRecompressJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1289<br>docs/knowledge-graph/ENTITY_RELATIONS.md:339 |
| Route:userTimeline | Usecase:buildTemplateKey | invokes | N/A(control-flow) | 1:N | src/routes/admin/userTimeline.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1231<br>docs/knowledge-graph/ENTITY_RELATIONS.md:340 |
| Route:vendors | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/admin/vendors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1234<br>docs/knowledge-graph/ENTITY_RELATIONS.md:341 |
| Route:vendors | Usecase:checkLinkHealth | invokes | N/A(control-flow) | 1:N | src/routes/admin/vendors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1234<br>docs/knowledge-graph/ENTITY_RELATIONS.md:342 |
| Route:vendors | Usecase:updateLink | invokes | N/A(control-flow) | 1:N | src/routes/admin/vendors.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1234<br>docs/knowledge-graph/ENTITY_RELATIONS.md:343 |
| Route:webhookLine | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:344 |
| Route:webhookLine | Usecase:appendLlmGateDecision | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:345 |
| Route:webhookLine | Usecase:buildConciergeContextSnapshot | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:346 |
| Route:webhookLine | Usecase:classifyPaidIntent | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:347 |
| Route:webhookLine | Usecase:composeConciergeReply | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:348 |
| Route:webhookLine | Usecase:declareCityPackFeedbackFromLine | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:349 |
| Route:webhookLine | Usecase:declareCityRegionFromLine | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:350 |
| Route:webhookLine | Usecase:declareRedacMembershipIdFromLine | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:351 |
| Route:webhookLine | Usecase:detectExplicitPaidIntent | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:352 |
| Route:webhookLine | Usecase:detectMessagePosture | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:353 |
| Route:webhookLine | Usecase:detectOpportunity | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:354 |
| Route:webhookLine | Usecase:ensureUserFromWebhook | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:355 |
| Route:webhookLine | Usecase:evaluateLlmAvailability | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:356 |
| Route:webhookLine | Usecase:evaluateLLMBudget | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:357 |
| Route:webhookLine | Usecase:FORBIDDEN_REPLY_PATTERN | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:358 |
| Route:webhookLine | Usecase:generateFreeRetrievalReply | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:359 |
| Route:webhookLine | Usecase:generatePaidAssistantReply | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:360 |
| Route:webhookLine | Usecase:generatePaidCasualReply | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:361 |
| Route:webhookLine | Usecase:generatePaidDomainConciergeReply | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:362 |
| Route:webhookLine | Usecase:generatePaidFaqReply | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:363 |
| Route:webhookLine | Usecase:generatePaidHousingConciergeReply | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:364 |
| Route:webhookLine | Usecase:getRedacMembershipStatusForLine | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:365 |
| Route:webhookLine | Usecase:getUserContextSnapshot | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:366 |
| Route:webhookLine | Usecase:handleJourneyLineCommand | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:367 |
| Route:webhookLine | Usecase:handleJourneyPostback | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:368 |
| Route:webhookLine | Usecase:loadRecentInterventionSignals | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:369 |
| Route:webhookLine | Usecase:logLineWebhookEventsBestEffort | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:370 |
| Route:webhookLine | Usecase:recordLlmUsage | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:371 |
| Route:webhookLine | Usecase:recordUserLlmConsent | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:372 |
| Route:webhookLine | Usecase:resolvePlan | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:373 |
| Route:webhookLine | Usecase:sendWelcomeMessage | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:374 |
| Route:webhookLine | Usecase:syncCityPackRecommendedTasks | invokes | N/A(control-flow) | 1:N | src/routes/webhookLine.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1428<br>docs/knowledge-graph/ENTITY_RELATIONS.md:375 |
| Route:webhookStripe | Usecase:appendAuditLog | invokes | N/A(control-flow) | 1:N | src/routes/webhookStripe.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1462<br>docs/knowledge-graph/ENTITY_RELATIONS.md:376 |
| Route:webhookStripe | Usecase:processStripeWebhookEvent | invokes | N/A(control-flow) | 1:N | src/routes/webhookStripe.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:1462<br>docs/knowledge-graph/ENTITY_RELATIONS.md:377 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_approved | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:378 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_collecting | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:379 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_needs_review | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:380 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_queued | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/cityPack/declareCityRegionFromLine.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:381 |
| State:city_pack_request.* | Entity:CityPackRequests | transition_write_to_rejected | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:382 |
| State:city_pack_request.approved | Entity:CityPackRequests | transition_write_to_active | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:383 |
| State:city_pack_request.approved | Entity:CityPacks | transition_write_to_active | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:384 |
| State:city_pack_request.collecting | Entity:CityPackRequests | transition_write_to_drafted | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:385 |
| State:city_pack_request.collecting | Entity:CityPackRequests | transition_write_to_failed | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:386 |
| State:city_pack_request.collecting | Entity:CityPackRequests | transition_write_to_needs_review | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:387 |
| State:city_pack_request.collecting | Entity:CityPacks | transition_write_to_drafted | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:388 |
| State:city_pack_request.collecting | Entity:SourceRefs | transition_write_to_drafted | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35<br>docs/knowledge-graph/ENTITY_RELATIONS.md:389 |
| State:emergency.* | Entity:EmergencyBulletins | transition_write_to_draft | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/emergency/runEmergencySync.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:390 |
| State:emergency.* | Entity:EmergencyDiffs | transition_write_to_draft | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/emergency/runEmergencySync.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:391 |
| State:emergency.* | Entity:EmergencySnapshots | transition_write_to_draft | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/emergency/runEmergencySync.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:392 |
| State:emergency.approved | Entity:DecisionTimeline | transition_write_to_sent | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:393 |
| State:emergency.approved | Entity:EmergencyBulletins | transition_write_to_sent | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:394 |
| State:emergency.approved | Entity:NotificationDeliveries | transition_write_to_sent | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:395 |
| State:emergency.draft | Entity:EmergencyBulletins | transition_write_to_approved | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147<br>docs/knowledge-graph/ENTITY_RELATIONS.md:396 |
| State:notification.* | Entity:Notifications | transition_write_to_draft | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2<br>docs/knowledge-graph/ENTITY_RELATIONS.md:397 |
| State:notification.active | Entity:Notifications | transition_write_to_sent | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/notifications/sendNotification.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2<br>docs/knowledge-graph/ENTITY_RELATIONS.md:398 |
| State:notification.draft | Entity:Notifications | transition_write_to_active | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/adminOs/approveNotification.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2<br>docs/knowledge-graph/ENTITY_RELATIONS.md:399 |
| State:ops_decision.decided | Entity:DecisionLogs | transition_write_to_resolved | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/phase33/executeOpsNextAction.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121<br>docs/knowledge-graph/ENTITY_RELATIONS.md:400 |
| State:ops_decision.decided | Entity:OpsStates | transition_write_to_resolved | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/phase33/executeOpsNextAction.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121<br>docs/knowledge-graph/ENTITY_RELATIONS.md:401 |
| State:ops_decision.pending | Entity:DecisionLogs | transition_write_to_decided | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/phase25/submitOpsDecision.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121<br>docs/knowledge-graph/ENTITY_RELATIONS.md:402 |
| State:ops_decision.pending | Entity:OpsStates | transition_write_to_decided | UNOBSERVED_IN_DOCS | UNOBSERVED_IN_DOCS | src/usecases/phase25/submitOpsDecision.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121<br>docs/knowledge-graph/ENTITY_RELATIONS.md:403 |
| Usecase:activateCityPack | Repo:cityPacksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:3<br>docs/knowledge-graph/ENTITY_RELATIONS.md:404 |
| Usecase:activateCityPack | Repo:sourceRefsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:3<br>docs/knowledge-graph/ENTITY_RELATIONS.md:405 |
| Usecase:aggregateJourneyKpis | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7<br>docs/knowledge-graph/ENTITY_RELATIONS.md:406 |
| Usecase:aggregateJourneyKpis | Repo:journeyKpiDailyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7<br>docs/knowledge-graph/ENTITY_RELATIONS.md:407 |
| Usecase:aggregateJourneyKpis | Repo:journeyTodoStatsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7<br>docs/knowledge-graph/ENTITY_RELATIONS.md:408 |
| Usecase:aggregateJourneyKpis | Repo:llmUsageLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7<br>docs/knowledge-graph/ENTITY_RELATIONS.md:409 |
| Usecase:aggregateJourneyKpis | Repo:userSubscriptionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:7<br>docs/knowledge-graph/ENTITY_RELATIONS.md:410 |
| Usecase:answerFaqFromKb | Repo:faqAnswerLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>docs/knowledge-graph/ENTITY_RELATIONS.md:411 |
| Usecase:answerFaqFromKb | Repo:faqArticlesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>docs/knowledge-graph/ENTITY_RELATIONS.md:412 |
| Usecase:answerFaqFromKb | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>docs/knowledge-graph/ENTITY_RELATIONS.md:413 |
| Usecase:appendAuditLog | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:19<br>docs/knowledge-graph/ENTITY_RELATIONS.md:414 |
| Usecase:appendDecision | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:22<br>docs/knowledge-graph/ENTITY_RELATIONS.md:415 |
| Usecase:appendLlmAdoptAudit | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:25<br>docs/knowledge-graph/ENTITY_RELATIONS.md:416 |
| Usecase:applyJourneyParamVersion | Repo:journeyGraphCatalogRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29<br>docs/knowledge-graph/ENTITY_RELATIONS.md:417 |
| Usecase:applyJourneyParamVersion | Repo:journeyParamChangeLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29<br>docs/knowledge-graph/ENTITY_RELATIONS.md:418 |
| Usecase:applyJourneyParamVersion | Repo:journeyParamRuntimeRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29<br>docs/knowledge-graph/ENTITY_RELATIONS.md:419 |
| Usecase:applyJourneyParamVersion | Repo:journeyParamVersionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29<br>docs/knowledge-graph/ENTITY_RELATIONS.md:420 |
| Usecase:applyJourneyParamVersion | Repo:journeyPolicyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29<br>docs/knowledge-graph/ENTITY_RELATIONS.md:421 |
| Usecase:applyJourneyParamVersion | Repo:opsConfigRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:29<br>docs/knowledge-graph/ENTITY_RELATIONS.md:422 |
| Usecase:applyRichMenuAssignment | Repo:richMenuBindingsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37<br>docs/knowledge-graph/ENTITY_RELATIONS.md:423 |
| Usecase:applyRichMenuAssignment | Repo:richMenuPolicyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37<br>docs/knowledge-graph/ENTITY_RELATIONS.md:424 |
| Usecase:applyRichMenuAssignment | Repo:richMenuRateBucketsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37<br>docs/knowledge-graph/ENTITY_RELATIONS.md:425 |
| Usecase:applyRichMenuAssignment | Repo:richMenuTemplatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:37<br>docs/knowledge-graph/ENTITY_RELATIONS.md:426 |
| Usecase:applyTaskRulesTemplateSet | Repo:journeyTemplatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:44<br>docs/knowledge-graph/ENTITY_RELATIONS.md:427 |
| Usecase:applyTaskRulesTemplateSet | Repo:stepRuleChangeLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:44<br>docs/knowledge-graph/ENTITY_RELATIONS.md:428 |
| Usecase:applyTaskRulesTemplateSet | Repo:stepRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:44<br>docs/knowledge-graph/ENTITY_RELATIONS.md:429 |
| Usecase:approveEmergencyBulletin | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:49<br>docs/knowledge-graph/ENTITY_RELATIONS.md:430 |
| Usecase:approveEmergencyBulletin | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:49<br>docs/knowledge-graph/ENTITY_RELATIONS.md:431 |
| Usecase:approveEmergencyBulletin | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:49<br>docs/knowledge-graph/ENTITY_RELATIONS.md:432 |
| Usecase:approveNotification | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:54<br>docs/knowledge-graph/ENTITY_RELATIONS.md:433 |
| Usecase:buildOpsSnapshots | Repo:opsSnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:58<br>docs/knowledge-graph/ENTITY_RELATIONS.md:434 |
| Usecase:buildTemplateKey | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62<br>docs/knowledge-graph/ENTITY_RELATIONS.md:435 |
| Usecase:buildTemplateKey | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62<br>docs/knowledge-graph/ENTITY_RELATIONS.md:436 |
| Usecase:buildTemplateKey | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62<br>docs/knowledge-graph/ENTITY_RELATIONS.md:437 |
| Usecase:buildTemplateKey | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:62<br>docs/knowledge-graph/ENTITY_RELATIONS.md:438 |
| Usecase:buildUserContextSnapshot | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68<br>docs/knowledge-graph/ENTITY_RELATIONS.md:439 |
| Usecase:buildUserContextSnapshot | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68<br>docs/knowledge-graph/ENTITY_RELATIONS.md:440 |
| Usecase:buildUserContextSnapshot | Repo:userContextSnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68<br>docs/knowledge-graph/ENTITY_RELATIONS.md:441 |
| Usecase:buildUserContextSnapshot | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:68<br>docs/knowledge-graph/ENTITY_RELATIONS.md:442 |
| Usecase:checkLinkHealth | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:74<br>docs/knowledge-graph/ENTITY_RELATIONS.md:443 |
| Usecase:composeCityAndNationwidePacks | Repo:cityPacksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:78<br>docs/knowledge-graph/ENTITY_RELATIONS.md:444 |
| Usecase:computeCityPackMetrics | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82<br>docs/knowledge-graph/ENTITY_RELATIONS.md:445 |
| Usecase:computeCityPackMetrics | Repo:cityPackMetricsDailyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82<br>docs/knowledge-graph/ENTITY_RELATIONS.md:446 |
| Usecase:computeCityPackMetrics | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82<br>docs/knowledge-graph/ENTITY_RELATIONS.md:447 |
| Usecase:computeCityPackMetrics | Repo:sourceRefsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:82<br>docs/knowledge-graph/ENTITY_RELATIONS.md:448 |
| Usecase:computeNotificationFatigueWarning | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:88<br>docs/knowledge-graph/ENTITY_RELATIONS.md:449 |
| Usecase:computePlanHash | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:91<br>docs/knowledge-graph/ENTITY_RELATIONS.md:450 |
| Usecase:computeUserTasks | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94<br>docs/knowledge-graph/ENTITY_RELATIONS.md:451 |
| Usecase:computeUserTasks | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94<br>docs/knowledge-graph/ENTITY_RELATIONS.md:452 |
| Usecase:computeUserTasks | Repo:stepRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94<br>docs/knowledge-graph/ENTITY_RELATIONS.md:453 |
| Usecase:computeUserTasks | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94<br>docs/knowledge-graph/ENTITY_RELATIONS.md:454 |
| Usecase:computeUserTasks | Repo:tasksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:94<br>docs/knowledge-graph/ENTITY_RELATIONS.md:455 |
| Usecase:confirmTokenData | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:456 |
| Usecase:confirmTokenData | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:457 |
| Usecase:confirmTokenData | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:458 |
| Usecase:confirmTokenData | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:459 |
| Usecase:confirmTokenData | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:460 |
| Usecase:confirmTokenData | Repo:sendRetryQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:461 |
| Usecase:confirmTokenData | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:462 |
| Usecase:confirmTokenData | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:101<br>docs/knowledge-graph/ENTITY_RELATIONS.md:463 |
| Usecase:createLink | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:111<br>docs/knowledge-graph/ENTITY_RELATIONS.md:464 |
| Usecase:createNotification | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:114<br>docs/knowledge-graph/ENTITY_RELATIONS.md:465 |
| Usecase:createNotification | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:114<br>docs/knowledge-graph/ENTITY_RELATIONS.md:466 |
| Usecase:createNotificationPhase1 | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:118<br>docs/knowledge-graph/ENTITY_RELATIONS.md:467 |
| Usecase:createNotificationPhase1 | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:118<br>docs/knowledge-graph/ENTITY_RELATIONS.md:468 |
| Usecase:createOpsSegment | Repo:opsSegmentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:122<br>docs/knowledge-graph/ENTITY_RELATIONS.md:469 |
| Usecase:declareCityPackFeedbackFromLine | Repo:cityPackFeedbackRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:125<br>docs/knowledge-graph/ENTITY_RELATIONS.md:470 |
| Usecase:declareCityPackFeedbackFromLine | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:125<br>docs/knowledge-graph/ENTITY_RELATIONS.md:471 |
| Usecase:declareCityPackFeedbackFromLine | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:125<br>docs/knowledge-graph/ENTITY_RELATIONS.md:472 |
| Usecase:declareCityRegionFromLine | Repo:cityPackRequestsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:130<br>docs/knowledge-graph/ENTITY_RELATIONS.md:473 |
| Usecase:declareCityRegionFromLine | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:130<br>docs/knowledge-graph/ENTITY_RELATIONS.md:474 |
| Usecase:declareCityRegionFromLine | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:130<br>docs/knowledge-graph/ENTITY_RELATIONS.md:475 |
| Usecase:declareRedacMembershipIdFromLine | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:135<br>docs/knowledge-graph/ENTITY_RELATIONS.md:476 |
| Usecase:deleteLink | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:138<br>docs/knowledge-graph/ENTITY_RELATIONS.md:477 |
| Usecase:dryRunAutomationDecision | Repo:automationConfigRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:144<br>docs/knowledge-graph/ENTITY_RELATIONS.md:478 |
| Usecase:ensureUserFromWebhook | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:148<br>docs/knowledge-graph/ENTITY_RELATIONS.md:479 |
| Usecase:evaluateLlmAvailability | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:151<br>docs/knowledge-graph/ENTITY_RELATIONS.md:480 |
| Usecase:evaluateLLMBudget | Repo:llmUsageStatsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154<br>docs/knowledge-graph/ENTITY_RELATIONS.md:481 |
| Usecase:evaluateLLMBudget | Repo:opsConfigRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154<br>docs/knowledge-graph/ENTITY_RELATIONS.md:482 |
| Usecase:evaluateLLMBudget | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154<br>docs/knowledge-graph/ENTITY_RELATIONS.md:483 |
| Usecase:executeBackfill | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:159<br>docs/knowledge-graph/ENTITY_RELATIONS.md:484 |
| Usecase:executeNotificationSend | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162<br>docs/knowledge-graph/ENTITY_RELATIONS.md:485 |
| Usecase:executeNotificationSend | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162<br>docs/knowledge-graph/ENTITY_RELATIONS.md:486 |
| Usecase:executeNotificationSend | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162<br>docs/knowledge-graph/ENTITY_RELATIONS.md:487 |
| Usecase:executeNotificationSend | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162<br>docs/knowledge-graph/ENTITY_RELATIONS.md:488 |
| Usecase:executeNotificationSend | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162<br>docs/knowledge-graph/ENTITY_RELATIONS.md:489 |
| Usecase:executeNotificationSend | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:162<br>docs/knowledge-graph/ENTITY_RELATIONS.md:490 |
| Usecase:executeOpsNextAction | Repo:decisionDriftsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170<br>docs/knowledge-graph/ENTITY_RELATIONS.md:491 |
| Usecase:executeOpsNextAction | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170<br>docs/knowledge-graph/ENTITY_RELATIONS.md:492 |
| Usecase:executeOpsNextAction | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170<br>docs/knowledge-graph/ENTITY_RELATIONS.md:493 |
| Usecase:executeOpsNextAction | Repo:opsStatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170<br>docs/knowledge-graph/ENTITY_RELATIONS.md:494 |
| Usecase:executeOpsNextAction | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:170<br>docs/knowledge-graph/ENTITY_RELATIONS.md:495 |
| Usecase:executeRecovery | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:177<br>docs/knowledge-graph/ENTITY_RELATIONS.md:496 |
| Usecase:executeSegmentSend | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:497 |
| Usecase:executeSegmentSend | Repo:automationConfigRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:498 |
| Usecase:executeSegmentSend | Repo:automationRunsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:499 |
| Usecase:executeSegmentSend | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:500 |
| Usecase:executeSegmentSend | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:501 |
| Usecase:executeSegmentSend | Repo:notificationTemplatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:502 |
| Usecase:executeSegmentSend | Repo:opsStatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:503 |
| Usecase:executeSegmentSend | Repo:sendRetryQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:504 |
| Usecase:executeSegmentSend | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:505 |
| Usecase:executeSegmentSend | Repo:templatesVRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:180<br>docs/knowledge-graph/ENTITY_RELATIONS.md:506 |
| Usecase:fetchProviderSnapshot | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:192<br>docs/knowledge-graph/ENTITY_RELATIONS.md:507 |
| Usecase:fetchProviderSnapshot | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:192<br>docs/knowledge-graph/ENTITY_RELATIONS.md:508 |
| Usecase:fetchProviderSnapshot | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:192<br>docs/knowledge-graph/ENTITY_RELATIONS.md:509 |
| Usecase:finalizeLlmActionRewards | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>docs/knowledge-graph/ENTITY_RELATIONS.md:510 |
| Usecase:finalizeLlmActionRewards | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>docs/knowledge-graph/ENTITY_RELATIONS.md:511 |
| Usecase:finalizeLlmActionRewards | Repo:llmActionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>docs/knowledge-graph/ENTITY_RELATIONS.md:512 |
| Usecase:finalizeLlmActionRewards | Repo:llmBanditStateRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>docs/knowledge-graph/ENTITY_RELATIONS.md:513 |
| Usecase:finalizeLlmActionRewards | Repo:llmContextualBanditStateRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>docs/knowledge-graph/ENTITY_RELATIONS.md:514 |
| Usecase:generatePaidFaqReply | Repo:llmQualityLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:210<br>docs/knowledge-graph/ENTITY_RELATIONS.md:515 |
| Usecase:getAutomationConfig | Repo:automationConfigRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:214<br>docs/knowledge-graph/ENTITY_RELATIONS.md:516 |
| Usecase:getBackfillStatus | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:217<br>docs/knowledge-graph/ENTITY_RELATIONS.md:517 |
| Usecase:getEmergencyBulletin | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220<br>docs/knowledge-graph/ENTITY_RELATIONS.md:518 |
| Usecase:getEmergencyBulletin | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220<br>docs/knowledge-graph/ENTITY_RELATIONS.md:519 |
| Usecase:getEmergencyBulletin | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220<br>docs/knowledge-graph/ENTITY_RELATIONS.md:520 |
| Usecase:getEmergencyBulletin | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220<br>docs/knowledge-graph/ENTITY_RELATIONS.md:521 |
| Usecase:getEmergencyBulletin | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220<br>docs/knowledge-graph/ENTITY_RELATIONS.md:522 |
| Usecase:getEmergencyBulletin | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:220<br>docs/knowledge-graph/ENTITY_RELATIONS.md:523 |
| Usecase:getEmergencyEvidence | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228<br>docs/knowledge-graph/ENTITY_RELATIONS.md:524 |
| Usecase:getEmergencyEvidence | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228<br>docs/knowledge-graph/ENTITY_RELATIONS.md:525 |
| Usecase:getEmergencyEvidence | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228<br>docs/knowledge-graph/ENTITY_RELATIONS.md:526 |
| Usecase:getEmergencyEvidence | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228<br>docs/knowledge-graph/ENTITY_RELATIONS.md:527 |
| Usecase:getEmergencyEvidence | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228<br>docs/knowledge-graph/ENTITY_RELATIONS.md:528 |
| Usecase:getEmergencyEvidence | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:228<br>docs/knowledge-graph/ENTITY_RELATIONS.md:529 |
| Usecase:getKillSwitch | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:236<br>docs/knowledge-graph/ENTITY_RELATIONS.md:530 |
| Usecase:getLatestDecision | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:239<br>docs/knowledge-graph/ENTITY_RELATIONS.md:531 |
| Usecase:getMemberSummary | Repo:opsStatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:242<br>docs/knowledge-graph/ENTITY_RELATIONS.md:532 |
| Usecase:getMemberSummary | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:242<br>docs/knowledge-graph/ENTITY_RELATIONS.md:533 |
| Usecase:getNextActionCandidates | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:246<br>docs/knowledge-graph/ENTITY_RELATIONS.md:534 |
| Usecase:getNotificationDeliveries | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250<br>docs/knowledge-graph/ENTITY_RELATIONS.md:535 |
| Usecase:getNotificationDeliveries | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250<br>docs/knowledge-graph/ENTITY_RELATIONS.md:536 |
| Usecase:getNotificationDeliveries | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250<br>docs/knowledge-graph/ENTITY_RELATIONS.md:537 |
| Usecase:getNotificationDeliveries | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:250<br>docs/knowledge-graph/ENTITY_RELATIONS.md:538 |
| Usecase:getNotificationOperationalSummary | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:256<br>docs/knowledge-graph/ENTITY_RELATIONS.md:539 |
| Usecase:getNotificationOperationalSummary | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:256<br>docs/knowledge-graph/ENTITY_RELATIONS.md:540 |
| Usecase:getNotificationOperationalSummary | Repo:opsSnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:256<br>docs/knowledge-graph/ENTITY_RELATIONS.md:541 |
| Usecase:getNotificationReadModel | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:261<br>docs/knowledge-graph/ENTITY_RELATIONS.md:542 |
| Usecase:getNotificationReadModel | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:261<br>docs/knowledge-graph/ENTITY_RELATIONS.md:543 |
| Usecase:getNotificationReadModel | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:261<br>docs/knowledge-graph/ENTITY_RELATIONS.md:544 |
| Usecase:getOpsAssistForConsole | Repo:opsAssistCacheRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:267<br>docs/knowledge-graph/ENTITY_RELATIONS.md:545 |
| Usecase:getOpsAssistSuggestion | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270<br>docs/knowledge-graph/ENTITY_RELATIONS.md:546 |
| Usecase:getOpsAssistSuggestion | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270<br>docs/knowledge-graph/ENTITY_RELATIONS.md:547 |
| Usecase:getOpsAssistSuggestion | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270<br>docs/knowledge-graph/ENTITY_RELATIONS.md:548 |
| Usecase:getOpsAssistSuggestion | Repo:opsAssistCacheRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270<br>docs/knowledge-graph/ENTITY_RELATIONS.md:549 |
| Usecase:getOpsAssistSuggestion | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:270<br>docs/knowledge-graph/ENTITY_RELATIONS.md:550 |
| Usecase:getOpsConsole | Repo:decisionDriftsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:277<br>docs/knowledge-graph/ENTITY_RELATIONS.md:551 |
| Usecase:getOpsConsole | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:277<br>docs/knowledge-graph/ENTITY_RELATIONS.md:552 |
| Usecase:getOpsDashboard | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282<br>docs/knowledge-graph/ENTITY_RELATIONS.md:553 |
| Usecase:getOpsDashboard | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282<br>docs/knowledge-graph/ENTITY_RELATIONS.md:554 |
| Usecase:getOpsDashboard | Repo:noticesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282<br>docs/knowledge-graph/ENTITY_RELATIONS.md:555 |
| Usecase:getOpsDashboard | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:282<br>docs/knowledge-graph/ENTITY_RELATIONS.md:556 |
| Usecase:getOpsExplanation | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:288<br>docs/knowledge-graph/ENTITY_RELATIONS.md:557 |
| Usecase:getOpsSegment | Repo:opsSegmentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:291<br>docs/knowledge-graph/ENTITY_RELATIONS.md:558 |
| Usecase:getRecoveryStatus | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:294<br>docs/knowledge-graph/ENTITY_RELATIONS.md:559 |
| Usecase:getRedacMembershipStatusForLine | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:297<br>docs/knowledge-graph/ENTITY_RELATIONS.md:560 |
| Usecase:getStaleMemberNumberUsers | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:300<br>docs/knowledge-graph/ENTITY_RELATIONS.md:561 |
| Usecase:getTraceBundle | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:303<br>docs/knowledge-graph/ENTITY_RELATIONS.md:562 |
| Usecase:getTraceBundle | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:303<br>docs/knowledge-graph/ENTITY_RELATIONS.md:563 |
| Usecase:getTraceBundle | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:303<br>docs/knowledge-graph/ENTITY_RELATIONS.md:564 |
| Usecase:getUserContextSnapshot | Repo:userContextSnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:308<br>docs/knowledge-graph/ENTITY_RELATIONS.md:565 |
| Usecase:getUserOperationalSummary | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:566 |
| Usecase:getUserOperationalSummary | Repo:journeyTodoStatsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:567 |
| Usecase:getUserOperationalSummary | Repo:llmUsageStatsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:568 |
| Usecase:getUserOperationalSummary | Repo:opsSnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:569 |
| Usecase:getUserOperationalSummary | Repo:userJourneyProfilesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:570 |
| Usecase:getUserOperationalSummary | Repo:userJourneySchedulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:571 |
| Usecase:getUserOperationalSummary | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:572 |
| Usecase:getUserOperationalSummary | Repo:userSubscriptionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:311<br>docs/knowledge-graph/ENTITY_RELATIONS.md:573 |
| Usecase:getUserStateSummary | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322<br>docs/knowledge-graph/ENTITY_RELATIONS.md:574 |
| Usecase:getUserStateSummary | Repo:opsSnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322<br>docs/knowledge-graph/ENTITY_RELATIONS.md:575 |
| Usecase:getUserStateSummary | Repo:opsStatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322<br>docs/knowledge-graph/ENTITY_RELATIONS.md:576 |
| Usecase:getUserStateSummary | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:322<br>docs/knowledge-graph/ENTITY_RELATIONS.md:577 |
| Usecase:giveUpRetryQueuedSend | Repo:sendRetryQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:328<br>docs/knowledge-graph/ENTITY_RELATIONS.md:578 |
| Usecase:handleJourneyLineCommand | Repo:cityPacksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:579 |
| Usecase:handleJourneyLineCommand | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:580 |
| Usecase:handleJourneyLineCommand | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:581 |
| Usecase:handleJourneyLineCommand | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:582 |
| Usecase:handleJourneyLineCommand | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:583 |
| Usecase:handleJourneyLineCommand | Repo:stepRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:584 |
| Usecase:handleJourneyLineCommand | Repo:taskContentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:585 |
| Usecase:handleJourneyLineCommand | Repo:tasksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:586 |
| Usecase:handleJourneyLineCommand | Repo:userCityPackPreferencesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:587 |
| Usecase:handleJourneyLineCommand | Repo:userJourneyProfilesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:588 |
| Usecase:handleJourneyLineCommand | Repo:userJourneySchedulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:589 |
| Usecase:handleJourneyLineCommand | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:331<br>docs/knowledge-graph/ENTITY_RELATIONS.md:590 |
| Usecase:handleJourneyPostback | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:345<br>docs/knowledge-graph/ENTITY_RELATIONS.md:591 |
| Usecase:importMunicipalitySchools | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:348<br>docs/knowledge-graph/ENTITY_RELATIONS.md:592 |
| Usecase:importMunicipalitySchools | Repo:municipalitySchoolsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:348<br>docs/knowledge-graph/ENTITY_RELATIONS.md:593 |
| Usecase:listDecisions | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:352<br>docs/knowledge-graph/ENTITY_RELATIONS.md:594 |
| Usecase:listEmergencyBulletins | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355<br>docs/knowledge-graph/ENTITY_RELATIONS.md:595 |
| Usecase:listEmergencyBulletins | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355<br>docs/knowledge-graph/ENTITY_RELATIONS.md:596 |
| Usecase:listEmergencyBulletins | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355<br>docs/knowledge-graph/ENTITY_RELATIONS.md:597 |
| Usecase:listEmergencyBulletins | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355<br>docs/knowledge-graph/ENTITY_RELATIONS.md:598 |
| Usecase:listEmergencyBulletins | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355<br>docs/knowledge-graph/ENTITY_RELATIONS.md:599 |
| Usecase:listEmergencyBulletins | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:355<br>docs/knowledge-graph/ENTITY_RELATIONS.md:600 |
| Usecase:listEmergencyProviders | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363<br>docs/knowledge-graph/ENTITY_RELATIONS.md:601 |
| Usecase:listEmergencyProviders | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363<br>docs/knowledge-graph/ENTITY_RELATIONS.md:602 |
| Usecase:listEmergencyProviders | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363<br>docs/knowledge-graph/ENTITY_RELATIONS.md:603 |
| Usecase:listEmergencyProviders | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363<br>docs/knowledge-graph/ENTITY_RELATIONS.md:604 |
| Usecase:listEmergencyProviders | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363<br>docs/knowledge-graph/ENTITY_RELATIONS.md:605 |
| Usecase:listEmergencyProviders | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:363<br>docs/knowledge-graph/ENTITY_RELATIONS.md:606 |
| Usecase:listLinks | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:371<br>docs/knowledge-graph/ENTITY_RELATIONS.md:607 |
| Usecase:listNotifications | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:374<br>docs/knowledge-graph/ENTITY_RELATIONS.md:608 |
| Usecase:listOpsConsole | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:377<br>docs/knowledge-graph/ENTITY_RELATIONS.md:609 |
| Usecase:listOpsSegments | Repo:opsSegmentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:380<br>docs/knowledge-graph/ENTITY_RELATIONS.md:610 |
| Usecase:listRetryQueue | Repo:sendRetryQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:383<br>docs/knowledge-graph/ENTITY_RELATIONS.md:611 |
| Usecase:listUserTasks | Repo:tasksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:386<br>docs/knowledge-graph/ENTITY_RELATIONS.md:612 |
| Usecase:loadRecentInterventionSignals | Repo:llmActionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:389<br>docs/knowledge-graph/ENTITY_RELATIONS.md:613 |
| Usecase:logEventBestEffort | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:392<br>docs/knowledge-graph/ENTITY_RELATIONS.md:614 |
| Usecase:logEventBestEffort | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:392<br>docs/knowledge-graph/ENTITY_RELATIONS.md:615 |
| Usecase:logLineWebhookEventsBestEffort | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:396<br>docs/knowledge-graph/ENTITY_RELATIONS.md:616 |
| Usecase:markDeliveryReaction | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:399<br>docs/knowledge-graph/ENTITY_RELATIONS.md:617 |
| Usecase:markDeliveryReaction | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:399<br>docs/knowledge-graph/ENTITY_RELATIONS.md:618 |
| Usecase:markDeliveryReactionV2 | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403<br>docs/knowledge-graph/ENTITY_RELATIONS.md:619 |
| Usecase:markDeliveryReactionV2 | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403<br>docs/knowledge-graph/ENTITY_RELATIONS.md:620 |
| Usecase:markDeliveryReactionV2 | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403<br>docs/knowledge-graph/ENTITY_RELATIONS.md:621 |
| Usecase:markDeliveryReactionV2 | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:403<br>docs/knowledge-graph/ENTITY_RELATIONS.md:622 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409<br>docs/knowledge-graph/ENTITY_RELATIONS.md:623 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409<br>docs/knowledge-graph/ENTITY_RELATIONS.md:624 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409<br>docs/knowledge-graph/ENTITY_RELATIONS.md:625 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409<br>docs/knowledge-graph/ENTITY_RELATIONS.md:626 |
| Usecase:normalizeAndDiffProvider | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409<br>docs/knowledge-graph/ENTITY_RELATIONS.md:627 |
| Usecase:normalizeAndDiffProvider | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409<br>docs/knowledge-graph/ENTITY_RELATIONS.md:628 |
| Usecase:normalizeAndDiffProvider | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:409<br>docs/knowledge-graph/ENTITY_RELATIONS.md:629 |
| Usecase:normalizeDeliveryId | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:418<br>docs/knowledge-graph/ENTITY_RELATIONS.md:630 |
| Usecase:normalizeLimit | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:631 |
| Usecase:normalizeLimit | Repo:cityPackMetricsDailyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:632 |
| Usecase:normalizeLimit | Repo:cityPacksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:633 |
| Usecase:normalizeLimit | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:634 |
| Usecase:normalizeLimit | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:635 |
| Usecase:normalizeLimit | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:636 |
| Usecase:normalizeLimit | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:637 |
| Usecase:normalizeLimit | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:638 |
| Usecase:normalizeLimit | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:639 |
| Usecase:normalizeLimit | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:640 |
| Usecase:normalizeLimit | Repo:journeyGraphCatalogRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:641 |
| Usecase:normalizeLimit | Repo:journeyParamVersionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:642 |
| Usecase:normalizeLimit | Repo:journeyPolicyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:643 |
| Usecase:normalizeLimit | Repo:journeyReminderRunsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:644 |
| Usecase:normalizeLimit | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:645 |
| Usecase:normalizeLimit | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:646 |
| Usecase:normalizeLimit | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:647 |
| Usecase:normalizeLimit | Repo:sourceRefsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:648 |
| Usecase:normalizeLimit | Repo:stepRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:649 |
| Usecase:normalizeLimit | Repo:userCityPackPreferencesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:650 |
| Usecase:normalizeLimit | Repo:userJourneySchedulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:651 |
| Usecase:normalizeLimit | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:421<br>docs/knowledge-graph/ENTITY_RELATIONS.md:652 |
| Usecase:normalizeReason | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445<br>docs/knowledge-graph/ENTITY_RELATIONS.md:653 |
| Usecase:normalizeReason | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445<br>docs/knowledge-graph/ENTITY_RELATIONS.md:654 |
| Usecase:normalizeReason | Repo:journeyKpiDailyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445<br>docs/knowledge-graph/ENTITY_RELATIONS.md:655 |
| Usecase:normalizeReason | Repo:journeyTodoStatsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445<br>docs/knowledge-graph/ENTITY_RELATIONS.md:656 |
| Usecase:normalizeReason | Repo:llmUsageLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445<br>docs/knowledge-graph/ENTITY_RELATIONS.md:657 |
| Usecase:normalizeReason | Repo:sendRetryQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445<br>docs/knowledge-graph/ENTITY_RELATIONS.md:658 |
| Usecase:normalizeReason | Repo:userSubscriptionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:445<br>docs/knowledge-graph/ENTITY_RELATIONS.md:659 |
| Usecase:normalizeWindowDays | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454<br>docs/knowledge-graph/ENTITY_RELATIONS.md:660 |
| Usecase:normalizeWindowDays | Repo:cityPackMetricsDailyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454<br>docs/knowledge-graph/ENTITY_RELATIONS.md:661 |
| Usecase:normalizeWindowDays | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454<br>docs/knowledge-graph/ENTITY_RELATIONS.md:662 |
| Usecase:normalizeWindowDays | Repo:sourceRefsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:454<br>docs/knowledge-graph/ENTITY_RELATIONS.md:663 |
| Usecase:patchTaskState | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:460<br>docs/knowledge-graph/ENTITY_RELATIONS.md:664 |
| Usecase:patchTaskState | Repo:tasksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:460<br>docs/knowledge-graph/ENTITY_RELATIONS.md:665 |
| Usecase:planBackfill | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:464<br>docs/knowledge-graph/ENTITY_RELATIONS.md:666 |
| Usecase:planNotificationSend | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467<br>docs/knowledge-graph/ENTITY_RELATIONS.md:667 |
| Usecase:planNotificationSend | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467<br>docs/knowledge-graph/ENTITY_RELATIONS.md:668 |
| Usecase:planNotificationSend | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467<br>docs/knowledge-graph/ENTITY_RELATIONS.md:669 |
| Usecase:planNotificationSend | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:467<br>docs/knowledge-graph/ENTITY_RELATIONS.md:670 |
| Usecase:planRecovery | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:473<br>docs/knowledge-graph/ENTITY_RELATIONS.md:671 |
| Usecase:planRetryQueuedSend | Repo:sendRetryQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:476<br>docs/knowledge-graph/ENTITY_RELATIONS.md:672 |
| Usecase:planSegmentSend | Repo:notificationTemplatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:479<br>docs/knowledge-graph/ENTITY_RELATIONS.md:673 |
| Usecase:planSegmentSend | Repo:templatesVRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:479<br>docs/knowledge-graph/ENTITY_RELATIONS.md:674 |
| Usecase:planTaskRulesApply | Repo:stepRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:483<br>docs/knowledge-graph/ENTITY_RELATIONS.md:675 |
| Usecase:planTaskRulesApply | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:483<br>docs/knowledge-graph/ENTITY_RELATIONS.md:676 |
| Usecase:previewEmergencyRule | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:488<br>docs/knowledge-graph/ENTITY_RELATIONS.md:677 |
| Usecase:previewEmergencyRule | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:488<br>docs/knowledge-graph/ENTITY_RELATIONS.md:678 |
| Usecase:previewEmergencyRule | Repo:emergencyRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:488<br>docs/knowledge-graph/ENTITY_RELATIONS.md:679 |
| Usecase:previewNotification | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:493<br>docs/knowledge-graph/ENTITY_RELATIONS.md:680 |
| Usecase:previewNotification | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:493<br>docs/knowledge-graph/ENTITY_RELATIONS.md:681 |
| Usecase:processStripeWebhookEvent | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497<br>docs/knowledge-graph/ENTITY_RELATIONS.md:682 |
| Usecase:processStripeWebhookEvent | Repo:stripeWebhookDeadLettersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497<br>docs/knowledge-graph/ENTITY_RELATIONS.md:683 |
| Usecase:processStripeWebhookEvent | Repo:stripeWebhookEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497<br>docs/knowledge-graph/ENTITY_RELATIONS.md:684 |
| Usecase:processStripeWebhookEvent | Repo:userSubscriptionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:497<br>docs/knowledge-graph/ENTITY_RELATIONS.md:685 |
| Usecase:recordClickAndRedirect | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:503<br>docs/knowledge-graph/ENTITY_RELATIONS.md:686 |
| Usecase:recordClickAndRedirect | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:503<br>docs/knowledge-graph/ENTITY_RELATIONS.md:687 |
| Usecase:recordClickAndRedirect | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:503<br>docs/knowledge-graph/ENTITY_RELATIONS.md:688 |
| Usecase:recordLlmUsage | Repo:llmUsageLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:508<br>docs/knowledge-graph/ENTITY_RELATIONS.md:689 |
| Usecase:recordLlmUsage | Repo:llmUsageStatsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:508<br>docs/knowledge-graph/ENTITY_RELATIONS.md:690 |
| Usecase:recordOpsNextAction | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:512<br>docs/knowledge-graph/ENTITY_RELATIONS.md:691 |
| Usecase:recordOpsNextAction | Repo:opsStatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:512<br>docs/knowledge-graph/ENTITY_RELATIONS.md:692 |
| Usecase:recordOpsReview | Repo:opsStateRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:516<br>docs/knowledge-graph/ENTITY_RELATIONS.md:693 |
| Usecase:recordUserLlmConsent | Repo:userConsentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:519<br>docs/knowledge-graph/ENTITY_RELATIONS.md:694 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522<br>docs/knowledge-graph/ENTITY_RELATIONS.md:695 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522<br>docs/knowledge-graph/ENTITY_RELATIONS.md:696 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522<br>docs/knowledge-graph/ENTITY_RELATIONS.md:697 |
| Usecase:rejectEmergencyBulletin | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522<br>docs/knowledge-graph/ENTITY_RELATIONS.md:698 |
| Usecase:rejectEmergencyBulletin | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522<br>docs/knowledge-graph/ENTITY_RELATIONS.md:699 |
| Usecase:rejectEmergencyBulletin | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:522<br>docs/knowledge-graph/ENTITY_RELATIONS.md:700 |
| Usecase:resolvePlan | Repo:opsConfigRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:530<br>docs/knowledge-graph/ENTITY_RELATIONS.md:701 |
| Usecase:resolvePlan | Repo:userSubscriptionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:530<br>docs/knowledge-graph/ENTITY_RELATIONS.md:702 |
| Usecase:resolveRichMenuTemplate | Repo:journeyPolicyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534<br>docs/knowledge-graph/ENTITY_RELATIONS.md:703 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuAssignmentRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534<br>docs/knowledge-graph/ENTITY_RELATIONS.md:704 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuBindingsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534<br>docs/knowledge-graph/ENTITY_RELATIONS.md:705 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuPhaseProfilesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534<br>docs/knowledge-graph/ENTITY_RELATIONS.md:706 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuPolicyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534<br>docs/knowledge-graph/ENTITY_RELATIONS.md:707 |
| Usecase:resolveRichMenuTemplate | Repo:richMenuTemplatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:534<br>docs/knowledge-graph/ENTITY_RELATIONS.md:708 |
| Usecase:resolveTaskContentLinks | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:542<br>docs/knowledge-graph/ENTITY_RELATIONS.md:709 |
| Usecase:resolveTaskContentLinks | Repo:taskContentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:542<br>docs/knowledge-graph/ENTITY_RELATIONS.md:710 |
| Usecase:resolveTaskKeyWarnings | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:546<br>docs/knowledge-graph/ENTITY_RELATIONS.md:711 |
| Usecase:resolveTaskKeyWarnings | Repo:taskContentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:546<br>docs/knowledge-graph/ENTITY_RELATIONS.md:712 |
| Usecase:retryQueuedSend | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550<br>docs/knowledge-graph/ENTITY_RELATIONS.md:713 |
| Usecase:retryQueuedSend | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550<br>docs/knowledge-graph/ENTITY_RELATIONS.md:714 |
| Usecase:retryQueuedSend | Repo:notificationTemplatesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550<br>docs/knowledge-graph/ENTITY_RELATIONS.md:715 |
| Usecase:retryQueuedSend | Repo:sendRetryQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550<br>docs/knowledge-graph/ENTITY_RELATIONS.md:716 |
| Usecase:retryQueuedSend | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:550<br>docs/knowledge-graph/ENTITY_RELATIONS.md:717 |
| Usecase:reviewSourceRefDecision | Repo:sourceRefsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:557<br>docs/knowledge-graph/ENTITY_RELATIONS.md:718 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyGraphCatalogRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560<br>docs/knowledge-graph/ENTITY_RELATIONS.md:719 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyParamChangeLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560<br>docs/knowledge-graph/ENTITY_RELATIONS.md:720 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyParamRuntimeRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560<br>docs/knowledge-graph/ENTITY_RELATIONS.md:721 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyParamVersionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560<br>docs/knowledge-graph/ENTITY_RELATIONS.md:722 |
| Usecase:rollbackJourneyParamVersion | Repo:journeyPolicyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560<br>docs/knowledge-graph/ENTITY_RELATIONS.md:723 |
| Usecase:rollbackJourneyParamVersion | Repo:opsConfigRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:560<br>docs/knowledge-graph/ENTITY_RELATIONS.md:724 |
| Usecase:runCityPackDraftJob | Repo:cityPackRequestsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:568<br>docs/knowledge-graph/ENTITY_RELATIONS.md:725 |
| Usecase:runCityPackDraftJob | Repo:cityPacksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:568<br>docs/knowledge-graph/ENTITY_RELATIONS.md:726 |
| Usecase:runCityPackDraftJob | Repo:sourceRefsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:568<br>docs/knowledge-graph/ENTITY_RELATIONS.md:727 |
| Usecase:runCityPackSourceAuditJob | Repo:cityPackBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573<br>docs/knowledge-graph/ENTITY_RELATIONS.md:728 |
| Usecase:runCityPackSourceAuditJob | Repo:cityPacksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573<br>docs/knowledge-graph/ENTITY_RELATIONS.md:729 |
| Usecase:runCityPackSourceAuditJob | Repo:sourceAuditRunsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573<br>docs/knowledge-graph/ENTITY_RELATIONS.md:730 |
| Usecase:runCityPackSourceAuditJob | Repo:sourceEvidenceRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573<br>docs/knowledge-graph/ENTITY_RELATIONS.md:731 |
| Usecase:runCityPackSourceAuditJob | Repo:sourceRefsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:573<br>docs/knowledge-graph/ENTITY_RELATIONS.md:732 |
| Usecase:runEmergencySync | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580<br>docs/knowledge-graph/ENTITY_RELATIONS.md:733 |
| Usecase:runEmergencySync | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580<br>docs/knowledge-graph/ENTITY_RELATIONS.md:734 |
| Usecase:runEmergencySync | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580<br>docs/knowledge-graph/ENTITY_RELATIONS.md:735 |
| Usecase:runEmergencySync | Repo:emergencyRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580<br>docs/knowledge-graph/ENTITY_RELATIONS.md:736 |
| Usecase:runEmergencySync | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:580<br>docs/knowledge-graph/ENTITY_RELATIONS.md:737 |
| Usecase:runJourneyBranchDispatchJob | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587<br>docs/knowledge-graph/ENTITY_RELATIONS.md:738 |
| Usecase:runJourneyBranchDispatchJob | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587<br>docs/knowledge-graph/ENTITY_RELATIONS.md:739 |
| Usecase:runJourneyBranchDispatchJob | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587<br>docs/knowledge-graph/ENTITY_RELATIONS.md:740 |
| Usecase:runJourneyBranchDispatchJob | Repo:journeyBranchQueueRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:587<br>docs/knowledge-graph/ENTITY_RELATIONS.md:741 |
| Usecase:runJourneyParamDryRun | Repo:journeyParamVersionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:593<br>docs/knowledge-graph/ENTITY_RELATIONS.md:742 |
| Usecase:runJourneyParamDryRun | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:593<br>docs/knowledge-graph/ENTITY_RELATIONS.md:743 |
| Usecase:runJourneyParamDryRun | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:593<br>docs/knowledge-graph/ENTITY_RELATIONS.md:744 |
| Usecase:runJourneyTodoReminderJob | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598<br>docs/knowledge-graph/ENTITY_RELATIONS.md:745 |
| Usecase:runJourneyTodoReminderJob | Repo:eventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598<br>docs/knowledge-graph/ENTITY_RELATIONS.md:746 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyGraphCatalogRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598<br>docs/knowledge-graph/ENTITY_RELATIONS.md:747 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyPolicyRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598<br>docs/knowledge-graph/ENTITY_RELATIONS.md:748 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyReminderRunsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598<br>docs/knowledge-graph/ENTITY_RELATIONS.md:749 |
| Usecase:runJourneyTodoReminderJob | Repo:journeyTodoItemsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598<br>docs/knowledge-graph/ENTITY_RELATIONS.md:750 |
| Usecase:runJourneyTodoReminderJob | Repo:userJourneySchedulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:598<br>docs/knowledge-graph/ENTITY_RELATIONS.md:751 |
| Usecase:runNotificationTest | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607<br>docs/knowledge-graph/ENTITY_RELATIONS.md:752 |
| Usecase:runNotificationTest | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607<br>docs/knowledge-graph/ENTITY_RELATIONS.md:753 |
| Usecase:runNotificationTest | Repo:notificationTestRunsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607<br>docs/knowledge-graph/ENTITY_RELATIONS.md:754 |
| Usecase:runNotificationTest | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:607<br>docs/knowledge-graph/ENTITY_RELATIONS.md:755 |
| Usecase:runPhase2Automation | Repo:analyticsReadRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:614<br>docs/knowledge-graph/ENTITY_RELATIONS.md:756 |
| Usecase:runPhase2Automation | Repo:scenarioReportsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:614<br>docs/knowledge-graph/ENTITY_RELATIONS.md:757 |
| Usecase:runPhase2Automation | Repo:scenarioRunsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:614<br>docs/knowledge-graph/ENTITY_RELATIONS.md:758 |
| Usecase:runTaskNudgeJob | Repo:stepRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620<br>docs/knowledge-graph/ENTITY_RELATIONS.md:759 |
| Usecase:runTaskNudgeJob | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620<br>docs/knowledge-graph/ENTITY_RELATIONS.md:760 |
| Usecase:runTaskNudgeJob | Repo:tasksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620<br>docs/knowledge-graph/ENTITY_RELATIONS.md:761 |
| Usecase:runTaskNudgeJob | Repo:userJourneyProfilesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:620<br>docs/knowledge-graph/ENTITY_RELATIONS.md:762 |
| Usecase:sendNotice | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:626<br>docs/knowledge-graph/ENTITY_RELATIONS.md:763 |
| Usecase:sendNotice | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:626<br>docs/knowledge-graph/ENTITY_RELATIONS.md:764 |
| Usecase:sendNotice | Repo:noticesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:626<br>docs/knowledge-graph/ENTITY_RELATIONS.md:765 |
| Usecase:sendNotification | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631<br>docs/knowledge-graph/ENTITY_RELATIONS.md:766 |
| Usecase:sendNotification | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631<br>docs/knowledge-graph/ENTITY_RELATIONS.md:767 |
| Usecase:sendNotification | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631<br>docs/knowledge-graph/ENTITY_RELATIONS.md:768 |
| Usecase:sendNotification | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631<br>docs/knowledge-graph/ENTITY_RELATIONS.md:769 |
| Usecase:sendNotification | Repo:userCityPackPreferencesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631<br>docs/knowledge-graph/ENTITY_RELATIONS.md:770 |
| Usecase:sendNotification | Repo:userJourneyProfilesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631<br>docs/knowledge-graph/ENTITY_RELATIONS.md:771 |
| Usecase:sendNotification | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:631<br>docs/knowledge-graph/ENTITY_RELATIONS.md:772 |
| Usecase:sendNotificationPhase1 | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640<br>docs/knowledge-graph/ENTITY_RELATIONS.md:773 |
| Usecase:sendNotificationPhase1 | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640<br>docs/knowledge-graph/ENTITY_RELATIONS.md:774 |
| Usecase:sendNotificationPhase1 | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640<br>docs/knowledge-graph/ENTITY_RELATIONS.md:775 |
| Usecase:sendNotificationPhase1 | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640<br>docs/knowledge-graph/ENTITY_RELATIONS.md:776 |
| Usecase:sendNotificationPhase1 | Repo:usersPhase1Repo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:640<br>docs/knowledge-graph/ENTITY_RELATIONS.md:777 |
| Usecase:sendOpsNotice | Repo:auditLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647<br>docs/knowledge-graph/ENTITY_RELATIONS.md:778 |
| Usecase:sendOpsNotice | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647<br>docs/knowledge-graph/ENTITY_RELATIONS.md:779 |
| Usecase:sendOpsNotice | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647<br>docs/knowledge-graph/ENTITY_RELATIONS.md:780 |
| Usecase:sendOpsNotice | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:647<br>docs/knowledge-graph/ENTITY_RELATIONS.md:781 |
| Usecase:sendWelcomeMessage | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:653<br>docs/knowledge-graph/ENTITY_RELATIONS.md:782 |
| Usecase:setKillSwitch | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:656<br>docs/knowledge-graph/ENTITY_RELATIONS.md:783 |
| Usecase:submitOpsDecision | Repo:decisionLogsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:659<br>docs/knowledge-graph/ENTITY_RELATIONS.md:784 |
| Usecase:submitOpsDecision | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:659<br>docs/knowledge-graph/ENTITY_RELATIONS.md:785 |
| Usecase:summarizeDraftWithLLM | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664<br>docs/knowledge-graph/ENTITY_RELATIONS.md:786 |
| Usecase:summarizeDraftWithLLM | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664<br>docs/knowledge-graph/ENTITY_RELATIONS.md:787 |
| Usecase:summarizeDraftWithLLM | Repo:systemFlagsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664<br>docs/knowledge-graph/ENTITY_RELATIONS.md:788 |
| Usecase:syncCityPackRecommendedTasks | Repo:cityPacksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669<br>docs/knowledge-graph/ENTITY_RELATIONS.md:789 |
| Usecase:syncCityPackRecommendedTasks | Repo:stepRulesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669<br>docs/knowledge-graph/ENTITY_RELATIONS.md:790 |
| Usecase:syncCityPackRecommendedTasks | Repo:tasksRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669<br>docs/knowledge-graph/ENTITY_RELATIONS.md:791 |
| Usecase:syncCityPackRecommendedTasks | Repo:userCityPackPreferencesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669<br>docs/knowledge-graph/ENTITY_RELATIONS.md:792 |
| Usecase:syncCityPackRecommendedTasks | Repo:usersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:669<br>docs/knowledge-graph/ENTITY_RELATIONS.md:793 |
| Usecase:testSendNotification | Repo:decisionTimelineRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:676<br>docs/knowledge-graph/ENTITY_RELATIONS.md:794 |
| Usecase:testSendNotification | Repo:deliveriesRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:676<br>docs/knowledge-graph/ENTITY_RELATIONS.md:795 |
| Usecase:testSendNotification | Repo:notificationsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:676<br>docs/knowledge-graph/ENTITY_RELATIONS.md:796 |
| Usecase:updateEmergencyProvider | Repo:emergencyBulletinsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681<br>docs/knowledge-graph/ENTITY_RELATIONS.md:797 |
| Usecase:updateEmergencyProvider | Repo:emergencyDiffsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681<br>docs/knowledge-graph/ENTITY_RELATIONS.md:798 |
| Usecase:updateEmergencyProvider | Repo:emergencyProvidersRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681<br>docs/knowledge-graph/ENTITY_RELATIONS.md:799 |
| Usecase:updateEmergencyProvider | Repo:emergencySnapshotsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681<br>docs/knowledge-graph/ENTITY_RELATIONS.md:800 |
| Usecase:updateEmergencyProvider | Repo:emergencyUnmappedEventsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681<br>docs/knowledge-graph/ENTITY_RELATIONS.md:801 |
| Usecase:updateEmergencyProvider | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:681<br>docs/knowledge-graph/ENTITY_RELATIONS.md:802 |
| Usecase:updateLink | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:689<br>docs/knowledge-graph/ENTITY_RELATIONS.md:803 |
| Usecase:validateJourneyParamVersion | Repo:journeyParamVersionsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:692<br>docs/knowledge-graph/ENTITY_RELATIONS.md:804 |
| Usecase:validateTaskContent | Repo:linkRegistryRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:695<br>docs/knowledge-graph/ENTITY_RELATIONS.md:805 |
| Usecase:validateTaskContent | Repo:taskContentsRepo | uses_repo | N/A(control-flow) | 1:N | docs/REPO_AUDIT_INPUTS/dependency_graph.json:695<br>docs/knowledge-graph/ENTITY_RELATIONS.md:806 |

<!-- KG_V2_RELATIONS_JOIN_END -->
