# SSOT_TASK_ENGINE_V1

Task Engine v1 の add-only SSOT。  
通知中心ではなく `Step = Task` を実行主体とする。

## Purpose
- Step定義から Task 実体をルール駆動で生成する。
- Notification を Task 派生（nudge）として従属化する。
- 既存 `journey_todo_items / task_nodes / notifications` 契約を壊さず接続する。

## Scope
- in-scope:
  - `step_rules`（新規）
  - `tasks`（新規）
  - `computeUserTasks`（決定エンジン）
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
5. `journey_todo_items` へ非破壊同期
6. nudge対象のみ `sendNotification` で送信

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

## API Contract (Public Signed)
- `GET /api/tasks?userId=...&ts=...&sig=...`
- `PATCH /api/tasks/{taskId}?userId=...&ts=...&sig=...`
- 署名:
  - HMAC-SHA256
  - payload: `method|pathname|userId|ts|taskId`
  - secret: `TASK_API_SIGNING_SECRET`
  - TTL: `TASK_API_SIGNATURE_TTL_SECONDS`（既定5分）

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
- delivery/decision timeline に `taskId/ruleId/decision/checkedAt/blockedReason` を保持する。

## Rollback
1. `ENABLE_TASK_ENGINE_V1=0`
2. `ENABLE_TASK_NUDGE_V1=0`
3. `step_rules.enabled=false`
4. 必要時 PR revert（`step_rules/tasks` は add-only のため既存復旧不要）
