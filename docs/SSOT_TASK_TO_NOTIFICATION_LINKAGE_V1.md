# SSOT_TASK_TO_NOTIFICATION_LINKAGE_V1

Task起点通知連携のSSOT（add-only）。
`SSOT_TASK_NOTIFICATION_LINKAGE_V1.md` と同一方針で、運用契約名を統一する補助文書。

## 定義（用語）
- Task Derived Notification:
  - `tasks` の状態から派生する nudge 通知。
- Nudge Source:
  - `runTaskNudgeJob` が対象 task を抽出して通知を生成する。
- Linkage Meta:
  - 通知/配信監査に付与する `taskId/ruleId/decision/checkedAt/blockedReason`。

## スキーマ（JSON例）
```json
{
  "notificationMeta": {
    "source": "task_engine_v1",
    "taskId": "U123__journey_us_v1__onboarding__visa_precheck",
    "ruleId": "journey_us_v1__onboarding__visa_precheck",
    "planHash": "taskplan_abc123"
  },
  "auditContext": {
    "taskId": "U123__journey_us_v1__onboarding__visa_precheck",
    "ruleId": "journey_us_v1__onboarding__visa_precheck",
    "decision": "task_nudge",
    "checkedAt": "2026-03-03T10:00:00.000Z",
    "blockedReason": null
  }
}
```

## 生成/更新ルール
1. nudge対象条件:
  - `status in todo|doing`
  - `nextNudgeAt <= now`
  - `status not in done|blocked|snoozed`
2. kill switch/cap で送信不可の場合は fail-closed とし、task側状態を監査に残す。
3. 通知本体は既存 `createNotification -> sendNotification` を利用し、既存契約を変更しない。
4. Task更新時の状態変化は `task_events` に append-only 記録する（dry-runは非書込）。
5. nudge copy 優先順:
   - `tasks.meaning`
   - `step_rules.meaning`
   - `step_rules.nudgeTemplate`
   - technical fallback
6. link policy:
   - `TASK_NUDGE_LINK_POLICY=strict` は `link_registry_missing` で suppress
   - `TASK_NUDGE_LINK_POLICY=lenient` は `task_todo_list` fallback を試行

## 監査キー
- notification meta: `taskId`, `ruleId`, `planHash`
- task event: `decision`, `beforeStatus`, `afterStatus`, `beforeBlockedReason`, `afterBlockedReason`
- trace: `traceId`, `requestId`, `actor`, `source`

## ロールバック
1. `ENABLE_TASK_NUDGE_V1=0` で通知派生を停止
2. `ENABLE_TASK_EVENTS_V1=0` で task_events append を停止
3. 既存通知フローは非破壊で存続
