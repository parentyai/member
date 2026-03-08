# LLM_DATA_FLOW

- generatedAt: 2026-03-08T04:34:11.724Z
- gitCommit: 690e9ec95691e2bb60ab84db1dc2c33a9fcfff4f
- branch: codex/member-integrated-remediation-v1
- sourceDigest: ff4e927a1bcdeab1716540ca6dc05844deac4ac0788ef6be90eccf827bf53653
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| Input | Output | Entity | Evidence |
| --- | --- | --- | --- |
| boundary:buildLlmInputView | bounded_llm_payload | LlmInputBoundary | src/usecases/llm/buildLlmInputView.js:1<br>docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json:4 |
| boundary:recordUserLlmConsent | bounded_llm_payload | LlmInputBoundary | src/usecases/llm/recordUserLlmConsent.js:1<br>docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json:8 |
| boundary:guardLlmOutput | bounded_llm_payload | LlmInputBoundary | src/usecases/llm/guardLlmOutput.js:1<br>docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json:12 |
| boundary:allowList | bounded_llm_payload | LlmInputBoundary | src/llm/allowList.js:1<br>docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json:16 |
| bounded_llm_payload | openai_chat_completions_json | LlmResponse | src/infra/llmClient.js:63<br>src/infra/llmClient.js:69 |
| usecase:answerFaqFromKb | persist:faq_answer_logs | FaqAnswerLogs | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>src/repos/firestore/faqAnswerLogsRepo.js:1 |
| usecase:answerFaqFromKb | persist:faq_articles | FaqArticles | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>src/repos/firestore/faqArticlesRepo.js:1 |
| usecase:answerFaqFromKb | persist:system_flags | SystemFlags | docs/REPO_AUDIT_INPUTS/dependency_graph.json:14<br>src/repos/firestore/systemFlagsRepo.js:1 |
| usecase:appendLlmAdoptAudit | persist:audit_logs | AuditLogs | docs/REPO_AUDIT_INPUTS/dependency_graph.json:25<br>src/repos/firestore/auditLogsRepo.js:1 |
| usecase:evaluateLlmAvailability | persist:system_flags | SystemFlags | docs/REPO_AUDIT_INPUTS/dependency_graph.json:151<br>src/repos/firestore/systemFlagsRepo.js:1 |
| usecase:evaluateLLMBudget | persist:llm_usage_stats | LlmUsageStats | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154<br>src/repos/firestore/llmUsageStatsRepo.js:1 |
| usecase:evaluateLLMBudget | persist:opsConfig | OpsConfig | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154<br>src/repos/firestore/opsConfigRepo.js:1 |
| usecase:evaluateLLMBudget | persist:system_flags | SystemFlags | docs/REPO_AUDIT_INPUTS/dependency_graph.json:154<br>src/repos/firestore/systemFlagsRepo.js:1 |
| usecase:finalizeLlmActionRewards | persist:notification_deliveries | NotificationDeliveries | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>src/repos/firestore/deliveriesRepo.js:1 |
| usecase:finalizeLlmActionRewards | persist:journey_todo_items | JourneyTodoItems | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>src/repos/firestore/journeyTodoItemsRepo.js:1 |
| usecase:finalizeLlmActionRewards | persist:llm_action_logs | LlmActionLogs | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>src/repos/firestore/llmActionLogsRepo.js:1 |
| usecase:finalizeLlmActionRewards | persist:llm_bandit_state | LlmBanditState | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>src/repos/firestore/llmBanditStateRepo.js:1 |
| usecase:finalizeLlmActionRewards | persist:llm_contextual_bandit_state | LlmContextualBanditState | docs/REPO_AUDIT_INPUTS/dependency_graph.json:197<br>src/repos/firestore/llmContextualBanditStateRepo.js:1 |
| usecase:generatePaidFaqReply | persist:llm_quality_logs | LlmQualityLogs | docs/REPO_AUDIT_INPUTS/dependency_graph.json:210<br>src/repos/firestore/llmQualityLogsRepo.js:1 |
| usecase:recordLlmUsage | persist:llm_usage_logs | LlmUsageLogs | docs/REPO_AUDIT_INPUTS/dependency_graph.json:508<br>src/repos/firestore/llmUsageLogsRepo.js:1 |
| usecase:recordLlmUsage | persist:llm_usage_stats | LlmUsageStats | docs/REPO_AUDIT_INPUTS/dependency_graph.json:508<br>src/repos/firestore/llmUsageStatsRepo.js:1 |
| usecase:recordUserLlmConsent | persist:user_consents | UserConsents | docs/REPO_AUDIT_INPUTS/dependency_graph.json:519<br>src/repos/firestore/userConsentsRepo.js:1 |
| usecase:summarizeDraftWithLLM | persist:emergency_bulletins | EmergencyBulletins | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664<br>src/repos/firestore/emergencyBulletinsRepo.js:1 |
| usecase:summarizeDraftWithLLM | persist:emergency_diffs | EmergencyDiffs | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664<br>src/repos/firestore/emergencyDiffsRepo.js:1 |
| usecase:summarizeDraftWithLLM | persist:system_flags | SystemFlags | docs/REPO_AUDIT_INPUTS/dependency_graph.json:664<br>src/repos/firestore/systemFlagsRepo.js:1 |
| line_user_message | faq_answer_or_guarded_refusal | FaqAnswerLogs | src/routes/phaseLLM4FaqAnswer.js:1<br>src/usecases/llm/guardLlmOutput.js:1<br>src/repos/firestore/faqAnswerLogsRepo.js:1 |
