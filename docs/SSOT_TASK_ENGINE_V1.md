# SSOT_TASK_ENGINE_V1

Task Engine v1 の add-only SSOT。  
通知中心ではなく `Step = Task` を実行主体とする。

## Purpose
- Step定義から Task 実体をルール駆動で生成する。
- Notification を Task 派生（nudge）として従属化する。
- 既存 `journey_todo_items / task_nodes / notifications` 契約を壊さず接続する。

## Scope
- in-scope:
  - `journey_templates`（新規）
  - `step_rules`（新規）
  - `tasks`（新規）
  - `task_events`（新規 append-only）
  - `computeUserTasks`（決定エンジン）
  - `template compile/set`（`journey_templates -> step_rules`）
  - `single-user apply`（lineUserId/memberNumber）
  - `/api/tasks`（署名付き）
  - `runTaskNudgeJob`（Task派生通知）
- out-of-scope:
  - 既存 Composer trigger/order 契約の変更
  - 既存 Firestore フィールド意味変更
  - LLM による意思決定

## Runtime Flow
1. user event timeline 取得
2. enabled `step_rules` 取得
3. `computeUserTasks` 実行（deterministic）
4. `tasks` へ projection
5. 状態変化時のみ `task_events` へ append
6. `journey_todo_items` へ非破壊同期
7. nudge対象のみ `sendNotification` で送信

## Deterministic Decision Contract
- 入力:
  - events
  - step_rules
  - existing tasks
  - deliveries
  - kill-switch state
- 出力:
  - `tasks[]`
  - `nextActions[]`（max 3）
  - `blocked[]`
  - `explain[]`（decision理由）
- 決定キー:
  - `create|update|noop|skip_not_triggered`
- blockedReason:
  - `dependency_unmet|quiet_hours|kill_switch|plan_limit|max_actions|invalid_trigger`

## Feature Flags
- `ENABLE_TASK_ENGINE_V1`
  - `0`: Task projection/no-op（既存 TODO 導線のみ）
  - `1`: Task Engine を有効化
- `ENABLE_TASK_NUDGE_V1`
  - `0`: Task nudge送信停止
  - `1`: Task nudge送信有効
- `ENABLE_TASK_EVENTS_V1`
  - `0`: task_events append停止
  - `1`: 状態変化時のみ task_events append
- `ENABLE_JOURNEY_TEMPLATE_V1`
  - `0`: journey template plan/set停止
  - `1`: journey template plan/set有効

## API Contract (Public Signed)
- `GET /api/tasks?userId=...&ts=...&sig=...`
- `PATCH /api/tasks/{taskId}?userId=...&ts=...&sig=...`
- 署名:
  - HMAC-SHA256
  - payload: `method|pathname|userId|ts|taskId`
  - secret: `TASK_API_SIGNING_SECRET`
- TTL: `TASK_API_SIGNATURE_TTL_SECONDS`（既定5分）

## API Contract (Admin OS / Add-only)
- `POST /api/admin/os/task-rules/template/plan`
- `POST /api/admin/os/task-rules/template/set`
- `POST /api/admin/os/task-rules/apply/plan`
- `POST /api/admin/os/task-rules/apply`
- write endpoint は managed flow action で保護:
  - `task_rules.template_set`
  - `task_rules.apply`

## Internal Job Contract
- endpoint: `POST /internal/jobs/task-nudge`
- guard:
  - `TASK_JOB_TOKEN` 必須
  - kill switch ON 時 fail-closed
- body:
  - `dryRun`, `limit`, `now`, `traceId`, `requestId`, `actor`

## Compatibility
- add-only:
  - 既存 `notifications` / `notification_deliveries` を再利用
  - 既存 `journey_todo_items` は書き込み互換を維持
- non-breaking:
  - 既存 Line command (`TODO完了`, `TODO進行中`, `TODO未着手`, `TODO一覧`) 維持
  - `TODOスヌーズ` を add-only 拡張

## Explainability
- `tasks.checkedAt`, `tasks.decisionHash`, `tasks.explain[]`
- `task_events`:
  - `decision(created|updated|status_changed|blocked)`
  - `beforeStatus/afterStatus`
  - `beforeBlockedReason/afterBlockedReason`
  - `taskId/ruleId/scenarioKey/stepKey`
  - `checkedAt/traceId/requestId/actor/source/explainKeys`
- delivery/decision timeline に `taskId/ruleId/decision/checkedAt/blockedReason` を保持する。

## Rollback
1. `ENABLE_TASK_ENGINE_V1=0`
2. `ENABLE_TASK_NUDGE_V1=0`
3. `ENABLE_TASK_EVENTS_V1=0`
4. `ENABLE_JOURNEY_TEMPLATE_V1=0`
5. `step_rules.enabled=false`（template namespaceのみ停止可）
6. `journey_templates.enabled=false`
7. 必要時 PR revert（add-only collectionは参照停止で無害化）
