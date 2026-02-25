# STRUCTURE_DEBT_REDUCTION_QUEUE

構造負債（legacy repo / merge candidates / naming drift）を
4週間キャッチアップで段階圧縮するための優先キュー（add-only）。

更新日: 2026-02-25
基準: `docs/REPO_AUDIT_INPUTS/structure_risk.json`

## 1. Current Snapshot
- legacy_repos_count: `6`
- merge_candidates_count: `6`
- naming_drift_scenario_count: `0`
- unresolved_dynamic_dep_count: `0`
- active_legacy_repo_imports_count: `0`

## 2. W2 Priority Queue (Legacy Repo)
| Priority | legacy repo | canonical target | guard |
| --- | --- | --- | --- |
| P1 | `phase2ReadRepo` | `analyticsReadRepo` | `structure-risk:check` で増悪停止 |
| P2 | `phase2ReportsRepo` | `scenarioReportsRepo` の収束先を1つに固定 | `structure-risk:check` で増悪停止 |
| P3 | `phase2RunsRepo` | `scenarioRunsRepo` の収束先を1つに固定 | `structure-risk:check` で増悪停止 |
| P4 | `phase18StatsRepo` | `ctaStatsRepo` | `structure-risk:check` で増悪停止 |
| P5 | `phase22KpiSnapshotsReadRepo` | `kpiSnapshotsReadRepo` | `structure-risk:check` で増悪停止 |
| P6 | `phase22KpiSnapshotsRepo` | `kpiSnapshotsRepo` | `structure-risk:check` で増悪停止 |

## 3. W2 Priority Queue (Naming Drift: scenario)
対象（9ファイル）:
- `src/repos/firestore/checklistsRepo.js`
- `src/repos/firestore/phase2ReportsRepo.js`
- `src/repos/firestore/scenarioReportsRepo.js`
- `src/repos/firestore/usersPhase1Repo.js`
- `src/usecases/checklists/getChecklistForUser.js`
- `src/usecases/checklists/getChecklistWithStatus.js`
- `src/usecases/notifications/createNotificationPhase1.js`
- `src/usecases/notifications/sendNotificationPhase1.js`
- `src/usecases/phase2/runAutomation.js`

収束ルール（固定）:
1. read path は `scenarioKey` 優先、legacy `scenario` は fallback のみ
2. write path は `scenarioKey` のみ
3. legacy path の新規追加は禁止

## 3.1 Progress (2026-02-25 / W5 kickoff)
- 完了:
  - `src/usecases/notifications/createNotificationPhase1.js`
  - `src/usecases/notifications/sendNotificationPhase1.js`
- 変更要点:
  - read: `scenarioKey` 優先、legacy `scenario` fallback
  - write: `scenarioKey` canonical write
- 結果:
  - `naming_drift_scenario_count` は `9 -> 7` に改善
  - `legacy_repos_count=6` / `active_legacy_repo_imports_count=0` は維持

## 3.2 Progress (2026-02-25 / W5.1 checklist path)
- 完了:
  - `src/usecases/checklists/getChecklistForUser.js`
  - `src/usecases/checklists/getChecklistWithStatus.js`
  - `src/repos/firestore/usersPhase1Repo.js`（W5 kickoffで canonical+fallback 統合済み）
- 変更要点:
  - read: `scenarioKey` 優先、legacy `scenario` fallback
  - response: checklist系 usecase に `scenarioKey` add-only 追加（legacy `scenario` は維持）
- 結果:
  - `naming_drift_scenario_count` は `7 -> 4` に改善
  - 残対象は `checklistsRepo / phase2ReportsRepo / scenarioReportsRepo / runAutomation`

## 3.3 Progress (2026-02-25 / W5.2)
- 完了:
  - `src/repos/firestore/checklistsRepo.js`
  - `src/repos/firestore/scenarioReportsRepo.js`
  - `src/usecases/phase2/runAutomation.js`
  - `src/repos/firestore/phase2ReportsRepo.js`（legacy forwarderで直接DB依存を排除）
- 変更要点:
  - read: `scenarioKey` 優先、legacy `scenario` fallback
  - write: `scenarioKey` canonical write（legacy `scenario` の受け取りのみ）
- 結果:
  - `naming_drift_scenario_count` は `4 -> 0` に改善
  - `legacy_repos_count=6` / `active_legacy_repo_imports_count=0` は維持

## 3.4 Progress (2026-02-25 / W5.3)
- 完了（対象4件）:
  - `src/repos/firestore/phase2RunsRepo.js`
  - `src/repos/firestore/phase18StatsRepo.js`
  - `src/repos/firestore/phase22KpiSnapshotsReadRepo.js`
  - `src/repos/firestore/phase22KpiSnapshotsRepo.js`
- 追加固定項目:
  - `tests/phase315/phase315_t04_legacy_alias_identity_contract.test.js`
- 変更要点:
  - legacy alias が canonical と同一モジュール参照を持つことを固定化
  - export キーが一致し、将来の差異回帰を早期検知
- 残件影響:
  - `legacy_repos_count=6` / `active_legacy_repo_imports_count=0` / `naming_drift_scenario=0` は維持

## 4. Gate Rules
- `npm run structure-risk:check` をPRで必須化
- 予算基準は `docs/STRUCTURE_BUDGETS.md` の最新 baseline を採用
- 予算超過時は修正を優先し、機能拡張を開始しない

## 5. Evidence Rule
- 実行証跡は `docs/CATCHUP_4W_EVIDENCE.md` に追記する
- struct drift の dry-run/apply 実行時は
  - `traceId`
  - `changedCount`
  - `resumeAfterUserId`
  を必須で記録する
