# SSOT_TASK_NOTIFICATION_LINKAGE_V1

Task と Notification の連携契約（add-only）。
運用契約名の統一版は `docs/SSOT_TASK_TO_NOTIFICATION_LINKAGE_V1.md` を参照。

## Principle
- Notification は Task の派生（nudge）であり主語ではない。
- 既存 Notification Composer 契約は維持する。

## Source of Truth
- Task state SSOT:
  - `tasks`
  - `journey_todo_items`（既存実行互換）
- Notification SSOT:
  - `notifications`
  - `notification_deliveries`

## Nudge Trigger
- 対象条件:
  - `now >= nextNudgeAt`
  - `status in todo|doing`
  - `status != blocked|snoozed|done`
- 送信抑制:
  - kill switch
  - cap check
  - quiet-hours/blocked reason

## Send Path
1. `runTaskNudgeJob` が対象 task を走査
2. rule/template から通知 payload を構築
3. `createNotification`（trigger=`manual`, order固定）
4. `sendNotification({ lineUserIds: [userId], auditContext })`
5. task 側へ `nudgeCount/lastNotifiedAt/nextNudgeAt` を反映

## Copy Priority (add-only)
- nudge本文/件名は以下の優先順で解決:
  1. `tasks.meaning`
  2. `step_rules.meaning`
  3. `step_rules.nudgeTemplate`
  4. technical fallback
- suppress監査:
  - `tasks.nudge.suppressed`（`status_not_sendable|link_registry_missing|cap_blocked|kill_switch`）
- link policy:
  - `TASK_NUDGE_LINK_POLICY=strict`（default）
  - `TASK_NUDGE_LINK_POLICY=lenient`（`task_todo_list` fallback を試行）

## Audit Linkage (add-only)
- `sendNotification` の delivery/timeline に以下を保持:
  - `taskId`
  - `ruleId`
  - `decision`
  - `checkedAt`
  - `blockedReason`

## Send Plane Summary (add-only)
- 送信結果は `sendSummary` を追加で保持し、以下を最低限返す:
  - `status` (`completed|completed_with_failures`)
  - `partialFailure` (`true|false`)
  - `totalRecipients`
  - `attemptedRecipients`
  - `deliveredCount`
  - `skippedCount`
  - `failedCount`
- `partialFailure=true` の場合:
  - route は `207` を返す
  - 再実行は `deliveryId` 冪等制御で duplicate send を防止する

## planHash
- task nudge の planHash:
  - `sha256(taskId + ruleId + dueAtBucket + templateVersion)`
- 目的:
  - 冪等性の高い配信根拠を監査に残す

## Compatibility
- 既存 send/plan/execute API は非破壊
- manual trigger/order 契約は維持
- task起点経路は add-only で分離

## Rollback
- `ENABLE_TASK_NUDGE_V1=0` で即時停止
- `tasks` 状態は保持し通知だけ止めることができる
