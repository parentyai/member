# P1_CONSISTENCY_BURNDOWN_PLAN_V1

P0で導入した整合ゲートの次段（未実装計画）を、add-onlyで固定する。

## Scope
- collection drift の実件数削減（baseline固定から解消へ）
- scenarioKey naming drift 44件の段階収束
- unreachable分類済み2ファイルの最終処置方針確定

## Current Snapshot
- command: `npm run audit:consistency:status`
- detail command: `node scripts/report_collection_drift_details.js`
- detail command: `npm run audit:collection-drift:queue`
- detail command: `npm run audit:scenariokey-drift:details`
- detail command: `npm run audit:scenariokey-drift:queue`
- detail command: `npm run audit:unreachable:status`
- report source:
  - `docs/REPO_AUDIT_INPUTS/data_model_map.json`
  - `docs/REPO_AUDIT_INPUTS/data_lifecycle.json`
  - `docs/REPO_AUDIT_INPUTS/design_ai_meta.json`
  - `docs/REPO_AUDIT_INPUTS/phase_origin_evidence.json`
  - `docs/REPO_AUDIT_INPUTS/unreachable_classification.json`

## P1 Tracks
1. Collection Drift Burn-down
   - target: `data_model_only`, `data_lifecycle_only` の件数を段階削減
   - gate: `audit:collection-drift:check` は維持（増悪停止）
   - detail visibility: `report_collection_drift_details.js` で collection単位の根拠（repo/policy）を固定観測する
   - remediation queue: `report_collection_drift_remediation_queue.js` で drift collectionを priorityScore/priorityBand 順に並べ、解消順序を固定化する
   - progress: `step_rules` / `tasks` と emergency/journey 周辺11 collection を retention policy + data_lifecycle に追加し、続いて data_model_map へ lifecycle補完を追加して `data_model_only` 13 -> 0 / `data_lifecycle_only` 11 -> 0 を達成
   - completion: baseline allowlist の件数が連続PRで減少

2. ScenarioKey Canonical Migration
   - target: `design_ai_meta.naming_drift.scenarioKey` 件数を段階削減
   - gate: `audit:scenariokey-drift:check` は維持（増悪停止）
   - detail visibility: `report_scenariokey_drift_details.js` で alias別（`scenario`/`scenarioKey`）と領域別（route/usecase/repo/domain）の内訳を固定観測する
   - remediation queue: `report_scenariokey_remediation_queue.js` で dependency_graph × feature_map を使い、優先度（priorityScore/priorityBand）付きの修正順序を固定化する
   - progress: low-risk 4path（`ensureUser`/`getNotificationHealthSummary`/`resolvePersonalizedLlmContext`/`osUserBillingDetail`）の direct token を解消し、`scenarioKey` drift を 44 -> 40 へ削減。`scenario_key_drift_allowlist.json` の `resolved.scenarioKey` で再導入禁止を固定。
   - progress: low-risk batch2 8path（`monitorInsights`/`userTimeline`/`getNotificationDeliveries`/`runTaskNudgeJob`/`syncUserTasksProjection`/`handleJourneyLineCommand`/`syncJourneyTodoPlan`/`declareRedacMembershipIdFromLine`）の direct token を解消し、`scenarioKey` drift を 40 -> 32 へ削減。`resolved.scenarioKey` を12件へ拡張し再導入禁止を固定。
   - progress: low-risk batch3 7path（`notifications`/`opsOverview`/`osNotifications`/`readModel`/`taskRulesConfig`/`getNotificationOperationalSummary`/`getNotificationReadModel`）の direct token を解消し、`scenarioKey` drift を 32 -> 25 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を19件へ拡張。
   - progress: low-risk batch4 2path（`getUserOperationalSummary`/`getUserStateSummary`）の direct token を解消し、`scenarioKey` drift を 25 -> 23 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を21件へ拡張。
   - progress: low-risk batch5 2path（`lineCommandParsers`/`scenarioKeyNormalizer`）の direct token を解消し、`scenarioKey` drift を 23 -> 21 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を23件へ拡張。
   - progress: low-risk batch6 2path（`createNotification`/`createNotificationPhase1`）の direct token を解消し、`scenarioKey` drift を 21 -> 19 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を25件へ拡張。
   - progress: low-risk batch7 2path（`journeyTodoItemsRepo`/`tasksRepo`）の direct token を解消し、`scenarioKey` drift を 19 -> 17 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を27件へ拡張。
   - progress: low-risk batch8 2path（`notificationsRepo`/`stepRulesRepo`）の direct token を解消し、`scenarioKey` drift を 17 -> 15 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を29件へ拡張。
   - progress: low-risk batch9 2path（`userJourneyProfilesRepo`/`usersPhase1Repo`）の direct token を解消し、`scenarioKey` drift を 15 -> 13 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を31件へ拡張。
   - progress: low-risk batch10 2path（`scenarioReportsRepo`/`usersRepo`）の direct token を解消し、`scenarioKey` drift を 13 -> 11 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を33件へ拡張。
   - progress: low-risk batch11 2path（`runAutomation`/`runStructDriftBackfill`）の direct token を解消し、`scenarioKey` drift を 11 -> 9 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を35件へ拡張。
   - progress: low-risk batch12 2path（`runJourneyParamDryRun`/`executeOpsNextAction`）の direct token を解消し、`scenarioKey` drift を 9 -> 7 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を37件へ拡張。
   - progress: low-risk batch13 2path（`sendNotification`/`sendNotificationPhase1`）の direct token を解消し、`scenarioKey` drift を 7 -> 5 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を39件へ拡張。
   - progress: low-risk batch14 2path（`executeNotificationSend`/`planNotificationSend`）の direct token を解消し、`scenarioKey` drift を 5 -> 3 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を41件へ拡張。
   - progress: low-risk batch15 2path（`approveEmergencyBulletin`/`computeUserTasks`）の direct token を解消し、`scenarioKey` drift を 3 -> 1 へ削減。`scenario` drift は 0 を維持し、`resolved.scenarioKey` を43件へ拡張。
   - completion: allowlist 件数が連続PRで減少

3. Unreachable Finalization
   - target files:
     - `src/repos/firestore/indexFallbackPolicy.js`
     - `src/shared/phaseDocPathResolver.js`
   - gate: `audit:unreachable:check` は維持（分類矛盾停止）
   - detail visibility: `report_unreachable_finalization_status.js` で static graph到達判定 / 分類 / disposition別推奨処置を固定観測する
   - progress: `docs/SSOT_UNREACHABLE_FINALIZATION_V1.md` を追加し、2対象の最終処置（frozen/monitor）と runtime非再接続方針を確定
   - completion: 処置方針（凍結継続 / build helper化 / 削除候補）をSSOTで確定

## Rollback
- P1作業で異常が出た場合はPR revert。
- P0ゲート（増悪停止）は維持し、fail-openにしない。
