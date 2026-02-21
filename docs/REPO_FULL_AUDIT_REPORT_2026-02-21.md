# Member Repo Structural Audit v2

## 0. 実行ログ要約
### FACT
- git status: `## codex/phase306...origin/codex/phase306
?? docs/REPO_AUDIT_INPUTS/
?? docs/REPO_FULL_AUDIT_REPORT_2026-02-21.md`
- npm test: PASS (876/876)
- route/usecase/repo/test files: 81/116/51/516
- endpoints detected in index dispatch: 105
### ISSUE
- Endpoint map is static (runtime condition branches are approximated).
### RISK
- Runtime-only edges may be undercounted.
### ACTION
- Validate top HIGH risk usecases with runtime trace sampling.

## 1. 重大問題Top10
### 1. Duplicate Firestore repos
**FACT**
- duplicate groups=6
- Evidence: `src/repos/firestore/*`
**ISSUE**
- Duplicate Firestore repos
**RISK**
- Patch drift across aliases
**ACTION**
- Define canonical repo + DEPRECATE aliases
### 2. SSOT index gap
**FACT**
- missing docs in index=503
- Evidence: `docs/SSOT_INDEX.md`
**ISSUE**
- SSOT index gap
**RISK**
- Documentation governance drift
**ACTION**
- CI check: new docs must be indexed
### 3. Legacy admin route alive
**FACT**
- /admin/phase1/notifications still reachable
- Evidence: `src/index.js:2383-2428`
**ISSUE**
- Legacy admin route alive
**RISK**
- Parallel flow confusion
**ACTION**
- Deprecate + redirect
### 4. Collection drift
**FACT**
- ops_state and ops_states both exist
- Evidence: `src/repos/firestore/opsStateRepo.js:5 + src/repos/firestore/opsStatesRepo.js:5`
**ISSUE**
- Collection drift
**RISK**
- Split writes/reads
**ACTION**
- Canonicalize naming
### 5. Field drift
**FACT**
- scenario and scenarioKey coexist
- Evidence: `src/repos/firestore/usersPhase1Repo.js + src/usecases/notifications/sendNotification.js:100`
**ISSUE**
- Field drift
**RISK**
- Contract mismatches
**ACTION**
- Introduce mapper + lint
### 6. Full scan hotspots
**FACT**
- listAll hotspots=28
- Evidence: `src/usecases/admin/getUserOperationalSummary.js + src/routes/admin/osDashboardKpi.js`
**ISSUE**
- Full scan hotspots
**RISK**
- Cost/latency spikes
**ACTION**
- Bounded indexed queries
### 7. Missing-index fallback breadth
**FACT**
- fallback points=40
- Evidence: `src/repos/firestore/queryFallback.js:47-52`
**ISSUE**
- Missing-index fallback breadth
**RISK**
- In-memory sort on large sets
**ACTION**
- Provision indexes + CI gate
### 8. Internal guard fragility
**FACT**
- /internal relies on per-route token guard
- Evidence: `src/index.js:859-902`
**ISSUE**
- Internal guard fragility
**RISK**
- Accidental unguarded endpoint risk
**ACTION**
- Protection matrix CI
### 9. Retention undefined
**FACT**
- Most collections have UNDEFINED_IN_CODE retention
- Evidence: `docs/DATA_MAP.md + docs/REPO_AUDIT_INPUTS/data_lifecycle.json`
**ISSUE**
- Retention undefined
**RISK**
- Compliance/cost ambiguity
**ACTION**
- Define retention in SSOT add-only
### 10. Unreachable files
**FACT**
- unreachable JS from src/index.js graph=20
- Evidence: `static require graph`
**ISSUE**
- Unreachable files
**RISK**
- Dead code and confusion
**ACTION**
- Tag LEGACY/DEAD and freeze references

## 2. ゴミ・重複一覧
### FACT
- duplicate: `src/repos/firestore/scenarioReportsRepo.js`, `src/repos/firestore/phase2ReportsRepo.js`
- duplicate: `src/repos/firestore/phase2ReadRepo.js`, `src/repos/firestore/analyticsReadRepo.js`
- duplicate: `src/repos/firestore/scenarioRunsRepo.js`, `src/repos/firestore/phase2RunsRepo.js`
- duplicate: `src/repos/firestore/ctaStatsRepo.js`, `src/repos/firestore/phase18StatsRepo.js`
- duplicate: `src/repos/firestore/phase22KpiSnapshotsRepo.js`, `src/repos/firestore/kpiSnapshotsRepo.js`
- duplicate: `src/repos/firestore/phase22KpiSnapshotsReadRepo.js`, `src/repos/firestore/kpiSnapshotsReadRepo.js`
- unreachable JS files (static graph): 20
  - `src/repos/firestore/checklistsRepo.js`
  - `src/repos/firestore/kpiSnapshotsRepo.js`
  - `src/repos/firestore/phase18StatsRepo.js`
  - `src/repos/firestore/phase22KpiSnapshotsReadRepo.js`
  - `src/repos/firestore/phase22KpiSnapshotsRepo.js`
  - `src/repos/firestore/phase2ReportsRepo.js`
  - `src/repos/firestore/phase2RunsRepo.js`
  - `src/repos/firestore/redacMembershipLinksRepo.js`
  - `src/repos/firestore/userChecklistsRepo.js`
  - `src/routes/admin/killSwitch.js`
  - `src/usecases/checklists/getChecklistForUser.js`
  - `src/usecases/checklists/getChecklistWithStatus.js`
  - `src/usecases/checklists/setChecklistItemDone.js`
  - `src/usecases/checklists/toggleChecklistItem.js`
  - `src/usecases/phase117/resolveAutomationTargets.js`
  - `src/usecases/phase43/executeAutomationDecision.js`
  - `src/usecases/phase48/listAutomationConfigs.js`
  - `src/usecases/phaseLLM4/getFaqAnswer.js`
  - `src/usecases/users/getMemberProfile.js`
  - `src/usecases/users/setMemberNumber.js`
### ISSUE
- Duplicate/legacy assets coexist with active paths.
### RISK
- Fixes diverge and regressions are harder to contain.
### ACTION
- 3-step deprecate plan for each duplicate pair/group.

## 3. Firestore構造診断
### FACT
- `audit_logs` repos=1
- `automation_config` repos=1
- `automation_runs` repos=1
- `checklists` repos=3
- `city_pack_bulletins` repos=1
- `city_pack_feedback` repos=1
- `city_pack_metrics_daily` repos=1
- `city_pack_requests` repos=1
- `city_pack_template_library` repos=1
- `city_pack_update_proposals` repos=1
- `city_packs` repos=1
- `decision_drifts` repos=1
- `decision_logs` repos=1
- `decision_timeline` repos=1
- `events` repos=3
- `faq_answer_logs` repos=1
- `faq_articles` repos=1
- `link_registry` repos=1
- `notices` repos=1
- `notification_deliveries` repos=3
- `notification_templates` repos=1
- `notification_test_run_items` repos=1
- `notification_test_runs` repos=1
- `notifications` repos=3
- `ops_assist_cache` repos=1
- `ops_segments` repos=1
- `ops_state` repos=1
- `ops_states` repos=1
- `phase18_cta_stats` repos=2
- `phase22_kpi_snapshots` repos=4
- `phase2_reports_checklist_pending` repos=2
- `phase2_reports_daily_events` repos=2
- `phase2_reports_weekly_events` repos=2
- `phase2_runs` repos=2
- `redac_membership_links` repos=1
- `send_retry_queue` repos=1
- `source_audit_runs` repos=1
- `source_evidence` repos=1
- `source_refs` repos=1
- `system_flags` repos=1
- `templates_v` repos=1
- `user_checklists` repos=3
- `user_consents` repos=1
- `users` repos=4
### ISSUE
- Multi-repo ownership exists for several collections.
### RISK
- Inconsistent read/write semantics and fallback behavior.
### ACTION
- Canonical owner repo per collection + block new alternate repos.

## 4. 機能別棚卸し
### FACT
- `cityPackBulletins` endpoints=0 usecases=2 collections=8 auth=public tests=2 completion=completed
- `cityPackEvidence` endpoints=0 usecases=1 collections=4 auth=public tests=0 completion=completed
- `cityPackFeedback` endpoints=0 usecases=1 collections=3 auth=public tests=3 completion=completed
- `cityPackRequests` endpoints=0 usecases=3 collections=5 auth=public tests=8 completion=completed
- `cityPackReviewInbox` endpoints=0 usecases=6 collections=13 auth=public tests=0 completion=completed
- `cityPackTemplateLibrary` endpoints=0 usecases=1 collections=2 auth=public tests=1 completion=completed
- `cityPackUpdateProposals` endpoints=0 usecases=1 collections=3 auth=public tests=0 completion=completed
- `cityPacks` endpoints=0 usecases=2 collections=3 auth=public tests=9 completion=completed
- `implementationTargets` endpoints=0 usecases=0 collections=0 auth=public tests=3 completion=completed
- `kbArticles` endpoints=0 usecases=1 collections=2 auth=public tests=1 completion=completed
- `killSwitch` endpoints=0 usecases=2 collections=2 auth=public tests=13 completion=completed
- `linkRegistry` endpoints=2 usecases=6 collections=2 auth=admin tests=73 completion=completed
- `llmConfig` endpoints=0 usecases=1 collections=2 auth=public tests=0 completion=completed
- `llmConsent` endpoints=5 usecases=1 collections=2 auth=admin tests=4 completion=completed
- `llmFaq` endpoints=3 usecases=1 collections=3 auth=admin tests=0 completion=completed
- `llmOps` endpoints=4 usecases=2 collections=1 auth=admin tests=2 completion=completed
- `monitorInsights` endpoints=0 usecases=1 collections=10 auth=public tests=0 completion=completed
- `notificationDeliveries` endpoints=0 usecases=1 collections=5 auth=public tests=0 completion=completed
- `notificationTest` endpoints=2 usecases=2 collections=6 auth=admin tests=0 completion=completed
- `notifications` endpoints=2 usecases=5 collections=7 auth=admin tests=47 completion=completed
- `opsOverview` endpoints=2 usecases=2 collections=6 auth=public tests=0 completion=completed
- `osAutomationConfig` endpoints=3 usecases=1 collections=2 auth=admin tests=0 completion=completed
- `osConfig` endpoints=0 usecases=1 collections=4 auth=public tests=0 completion=completed
- `osContext` endpoints=0 usecases=1 collections=1 auth=public tests=1 completion=completed
- `osDashboardKpi` endpoints=3 usecases=0 collections=8 auth=admin tests=1 completion=completed
- `osDeliveryBackfill` endpoints=2 usecases=1 collections=2 auth=admin tests=0 completion=completed
- `osDeliveryRecovery` endpoints=0 usecases=1 collections=2 auth=public tests=0 completion=completed
- `osErrors` endpoints=3 usecases=1 collections=3 auth=admin tests=0 completion=completed
- `osKillSwitch` endpoints=0 usecases=3 collections=2 auth=public tests=0 completion=completed
- `osLinkRegistryLookup` endpoints=0 usecases=1 collections=2 auth=public tests=0 completion=completed
- `osNotifications` endpoints=10 usecases=6 collections=7 auth=admin tests=1 completion=completed
- `osRedacStatus` endpoints=0 usecases=1 collections=2 auth=public tests=0 completion=completed
- `osView` endpoints=3 usecases=1 collections=1 auth=admin tests=0 completion=completed
- `phase1Notifications` endpoints=1 usecases=2 collections=6 auth=admin tests=0 completion=legacy
- `phase2Automation` endpoints=1 usecases=1 collections=0 auth=admin tests=0 completion=completed
- `readModel` endpoints=1 usecases=2 collections=3 auth=admin tests=4 completion=completed
- `redacMembershipUnlink` endpoints=0 usecases=1 collections=2 auth=public tests=4 completion=completed
- `traceSearch` endpoints=0 usecases=2 collections=3 auth=public tests=0 completion=completed
- `userTimeline` endpoints=0 usecases=1 collections=5 auth=public tests=0 completion=completed
- `vendors` endpoints=0 usecases=3 collections=2 auth=public tests=5 completion=completed
- `cityPackDraftGeneratorJob` endpoints=0 usecases=1 collections=4 auth=public tests=0 completion=completed
- `cityPackSourceAuditJob` endpoints=0 usecases=1 collections=4 auth=public tests=0 completion=completed
- `phase105OpsAssistAdopt` endpoints=1 usecases=1 collections=1 auth=public tests=0 completion=legacy
- `phase121OpsNoticeSend` endpoints=1 usecases=1 collections=4 auth=public tests=0 completion=legacy
- `phase1Events` endpoints=0 usecases=1 collections=0 auth=public tests=0 completion=legacy
- `phase24DecisionLogs` endpoints=3 usecases=3 collections=0 auth=public tests=0 completion=completed
- `phase24OpsState` endpoints=2 usecases=1 collections=2 auth=public tests=0 completion=completed
- `phase25OpsConsole` endpoints=1 usecases=1 collections=3 auth=public tests=0 completion=completed
- `phase25OpsDecision` endpoints=1 usecases=1 collections=2 auth=public tests=0 completion=completed
- `phase26OpsConsoleList` endpoints=1 usecases=1 collections=1 auth=public tests=0 completion=completed
- `phase32OpsDecisionSuggest` endpoints=1 usecases=1 collections=0 auth=public tests=0 completion=completed
- `phase33OpsDecisionExecute` endpoints=1 usecases=1 collections=5 auth=public tests=0 completion=completed
- `phase36NoticeSend` endpoints=1 usecases=1 collections=3 auth=public tests=0 completion=completed
- `phase37DeliveryReactions` endpoints=2 usecases=1 collections=2 auth=public tests=0 completion=completed
- `phase38OpsDashboard` endpoints=1 usecases=1 collections=4 auth=public tests=0 completion=completed
- `phase39OpsAssistSuggestion` endpoints=1 usecases=1 collections=2 auth=public tests=0 completion=completed
- `phase42OpsConsoleView` endpoints=1 usecases=2 collections=1 auth=public tests=0 completion=completed
- `phase47AutomationDryRun` endpoints=1 usecases=1 collections=1 auth=public tests=0 completion=completed
- `phase48AutomationConfig` endpoints=1 usecases=1 collections=1 auth=public tests=0 completion=completed
- `phase52OpsBatch` endpoints=1 usecases=1 collections=0 auth=public tests=0 completion=completed
### ISSUE
- Ownership and responsibility are route-fragmented.
### RISK
- Change impact is non-obvious without graph artifacts.
### ACTION
- Use `feature_map.json` as pre-change checklist input.

## 5. Docs/SSOT差分
### FACT
- docs(.md/.json)=503, ssot_index_entries=0, missing_in_index=503, index_missing_on_disk=0
  - `docs/ACCEPTANCE_P4-106.md`
  - `docs/ACCEPTANCE_PHASE0.md`
  - `docs/ACCEPTANCE_PHASE1.md`
  - `docs/ACCEPTANCE_PHASE10.md`
  - `docs/ACCEPTANCE_PHASE11.md`
  - `docs/ACCEPTANCE_PHASE12.md`
  - `docs/ACCEPTANCE_PHASE13.md`
  - `docs/ACCEPTANCE_PHASE14.md`
  - `docs/ACCEPTANCE_PHASE15.md`
  - `docs/ACCEPTANCE_PHASE16.md`
  - `docs/ACCEPTANCE_PHASE17.md`
  - `docs/ACCEPTANCE_PHASE17_FAST.md`
  - `docs/ACCEPTANCE_PHASE2.md`
  - `docs/ACCEPTANCE_PHASE3.md`
  - `docs/ACCEPTANCE_PHASE4.md`
  - `docs/ACCEPTANCE_PHASE5.md`
  - `docs/ACCEPTANCE_PHASE6.md`
  - `docs/ACCEPTANCE_PHASE7.md`
  - `docs/ACCEPTANCE_PHASE8.md`
  - `docs/ACCEPTANCE_PHASE9.md`
  - `docs/ADMIN_MANUAL_JA.md`
  - `docs/ADMIN_UI_DICTIONARY_JA.md`
  - `docs/ADMIN_UI_REDESIGN_2026_PLAN.md`
  - `docs/ARCHITECTURE_PHASE0.md`
  - `docs/ARCHITECTURE_PHASE1.md`
  - `docs/ARCHITECTURE_PHASE2.md`
  - `docs/ARCHITECTURE_PHASE6.md`
  - `docs/AUDIT_REPORT_STG_2026-02-10.md`
  - `docs/BACKLOG_PHASE20_PREPARE.md`
  - `docs/CHANGELOG_DOCS.md`
  - `docs/DATA_MAP.md`
  - `docs/DATA_MODEL_PHASE1.md`
  - `docs/DATA_MODEL_PHASE2.md`
  - `docs/DECISION_PACKAGE_PHASE17_CLOSE.md`
  - `docs/EVIDENCE_LEDGER_REPAIR.md`
  - `docs/EXECUTION_LOG_TEMPLATE_STG_NOTIFICATION.md`
  - `docs/GCP_SETUP.md`
  - `docs/GITHUB_SETUP.md`
  - `docs/GO_SCOPE.md`
  - `docs/GUARDRAILS_PHASE0.md`
### ISSUE
- SSOT index coverage is incomplete.
### RISK
- docs verification blind spots.
### ACTION
- Add CI registration gate for docs.

## 6. 構造再設計案
### FACT
- `src/index.js` contains monolithic dispatch with >100 endpoint checks.
### ISSUE
- High conflict and guard regression risk.
### RISK
- Endpoint additions can bypass intended patterns.
### ACTION
- Incremental module split with compatibility shims (add-only).

## 7. 軽量化提案
### FACT
- estimated_worst_case_docs_scan=62000, listAll_hotspots=28, missingIndexFallback=40
### ISSUE
- Full scans and missing-index fallbacks in admin paths.
### RISK
- Latency and cost spikes at moderate scale.
### ACTION
- Prioritize indexed replacements for KPI and summary usecases.

## 8. 将来拡張入力JSON（A–H）
### FACT
- `docs/REPO_AUDIT_INPUTS/feature_map.json`
- `docs/REPO_AUDIT_INPUTS/data_model_map.json`
- `docs/REPO_AUDIT_INPUTS/auth_flow.json`
- `docs/REPO_AUDIT_INPUTS/notification_flow.json`
- `docs/REPO_AUDIT_INPUTS/kill_switch_points.json`
- `docs/REPO_AUDIT_INPUTS/decision_timeline_map.json`
- `docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json`
- `docs/REPO_AUDIT_INPUTS/recommended_architecture.json`
### ISSUE
- Artifacts require regeneration discipline.
### RISK
- stale JSON may mislead automation.
### ACTION
- Add generation command to CI or runbook.

## 9. 依存グラフ（STEP9）
### FACT
- `docs/REPO_AUDIT_INPUTS/dependency_graph.json` generated.
### ISSUE
- Static-only derivation where runtime evidence is not available.
### RISK
- Potential under/over-count in dynamic branches.
### ACTION
- Validate top hotspots with runtime tracing before structural refactor.

## 10. 変更影響半径（STEP10）
### FACT
- `docs/REPO_AUDIT_INPUTS/impact_radius.json` generated.
- HIGH risk usecases=59.
### ISSUE
- Static-only derivation where runtime evidence is not available.
### RISK
- Potential under/over-count in dynamic branches.
### ACTION
- Validate top hotspots with runtime tracing before structural refactor.

## 11. 状態遷移図（STEP11）
### FACT
- `docs/REPO_AUDIT_INPUTS/state_transitions.json` generated.
### ISSUE
- Static-only derivation where runtime evidence is not available.
### RISK
- Potential under/over-count in dynamic branches.
### ACTION
- Validate top hotspots with runtime tracing before structural refactor.

## 12. データ寿命分類（STEP12）
### FACT
- `docs/REPO_AUDIT_INPUTS/data_lifecycle.json` generated.
### ISSUE
- Static-only derivation where runtime evidence is not available.
### RISK
- Potential under/over-count in dynamic branches.
### ACTION
- Validate top hotspots with runtime tracing before structural refactor.

## 13. 動的負荷推定（STEP13）
### FACT
- `docs/REPO_AUDIT_INPUTS/load_risk.json` generated.
- estimated_worst_case_docs_scan=62000.
### ISSUE
- Static-only derivation where runtime evidence is not available.
### RISK
- Potential under/over-count in dynamic branches.
### ACTION
- Validate top hotspots with runtime tracing before structural refactor.

## 14. 設計AIメタ出力（STEP14）
### FACT
- `docs/REPO_AUDIT_INPUTS/design_ai_meta.json` generated.
### ISSUE
- Static-only derivation where runtime evidence is not available.
### RISK
- Potential under/over-count in dynamic branches.
### ACTION
- Validate top hotspots with runtime tracing before structural refactor.

## 15. 実行ロードマップ（P0/P1/P2）
### FACT
- Priorities are based on dependency_graph, impact_radius, and load_risk.
### ISSUE
- Cross-cutting legacy aliases and full-scan paths remain active.
### RISK
- Large refactor without staging may break compatibility.
### ACTION
- P0: endpoint protection CI + fullscan hotspot fixes + naming drift guard.
- P1: duplicate repo canonicalization (deprecate aliases).
- P2: index.js modular split + retention policy formalization.
