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
7. LINE TODO一覧は Task/legacy を Unified View で正規化（flag制御）
8. nudge対象のみ `sendNotification` で送信

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
- `ENABLE_JOURNEY_UNIFIED_VIEW_V1`
  - `0`: 既存表示（Task優先 -> legacy fallback）
  - `1`: Task/legacy を meaningKey で重複抑止して表示
- `ENABLE_LEGACY_TODO_DERIVE_FROM_TEMPLATES_V1`
  - `0`: legacy TODO を既存ハードコードテンプレで生成
  - `1`: legacy TODO を `journey_templates` 由来で生成（derive mode）
- `ENABLE_LEGACY_TODO_EMIT_DISABLED_V1`
  - `0`: legacy TODO の新規 upsert 有効
  - `1`: legacy TODO の新規 upsert 停止（既存データは保持）
- `TASK_NUDGE_LINK_POLICY`
  - `strict`（default）: linkRegistryId 不足時は suppress
  - `lenient`: link不足時に `task_todo_list` fallback を試行

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
- `audit_logs` action（体験イベント）:
  - `tasks.view.presented`
  - `tasks.view.hidden_duplicate`
  - `tasks.meaning.fallback_used`
  - `tasks.nudge.suppressed`

## Rollback
1. `ENABLE_TASK_ENGINE_V1=0`
2. `ENABLE_TASK_NUDGE_V1=0`
3. `ENABLE_TASK_EVENTS_V1=0`
4. `ENABLE_JOURNEY_TEMPLATE_V1=0`
5. `step_rules.enabled=false`（template namespaceのみ停止可）
6. `journey_templates.enabled=false`
7. 必要時 PR revert（add-only collectionは参照停止で無害化）

## Phase730 Add-only（Task Detail LINE内完結）
- 新規 collection:
  - `task_contents/{taskKey}`（Task詳細本文/チェックリスト/リンク参照）
- `taskKey` 解決規約（固定）:
  - 1位: `tasks.ruleId`
  - 2位: `tasks.taskId` から復元できる `ruleId`
  - 3位: `todoKey` fallback（運用警告付き）
  - “正”の識別子は `step_rules.ruleId`。`task_contents.taskKey` はこの値に合わせる。
- `taskKey` 命名ルール（推奨）:
  - 正規表現: `[a-z0-9][a-z0-9_-]{1,63}`
  - 禁止/非推奨: 空白、大文字、`__`（runtime複合キーを連想）
- LINE導線（add-only）:
  - text command: `TODO詳細:{todoKey}`
  - text command: `TODO詳細続き:{todoKey}:{manual|failure}:{startChunk}`
  - postback action: `todo_detail_section`（`section=manual|failure`）
  - Manual/Failure は LINE内テキスト追加送信（長文分割）
- 安全弁（長文分割）:
  - `TASK_DETAIL_SECTION_CHUNK_LIMIT` を超える場合、続きを自動送信せず continuation command を案内する
  - 送信文面は `【手順マニュアル i/n】` / `【よくある失敗 i/n】` 形式で番号付与する
- Link 解決:
  - `videoLinkId` / `actionLinkId` は `link_registry` 参照
  - link未登録/無効（`enabled=false` or `lastHealth.state=WARN`）は fail-close で非表示
- Feature Flags（add-only）:
  - `ENABLE_TASK_DETAIL_LINE_V1`（default: true）
  - `ENABLE_TASK_CONTENT_ADMIN_EDITOR_V1`（default: true）
  - `ENABLE_TASK_DETAIL_SECTION_SAFETY_VALVE_V1`（default: true）
- Admin OS（既存path add-only）:
  - `POST /api/admin/os/task-rules/plan` action `upsert_task_content`
  - `POST /api/admin/os/task-rules/set` action `upsert_task_content`
  - managed flow action key は既存 `task_rules.set` を再利用（planHash + confirmToken 必須）

## Phase73x Add-only（監査確定改善 A〜F）
- 新規 collection:
  - `task_content_links/{ruleId}`（`task_contents.taskKey` と `step_rules.ruleId` の連結マップ）
- `task_content_links` 解決規約:
  - `status=active` のみ read path で利用する
  - `status=warn` / `sourceTaskKey` 欠落時は fallback（`tasks.ruleId -> taskId.ruleId -> todoKey`）を維持
  - migration は `strict exact + manual map` のみを許可（自動推定は禁止）
- Admin OS action（既存 path add-only）:
  - `POST /api/admin/os/task-rules/plan` action `migrate_task_content_links`
  - `POST /api/admin/os/task-rules/set` action `migrate_task_content_links_apply`
  - apply は `ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1=1` 必須（default: false）
- LINE導線 add-only command:
  - `通知履歴`
  - `CityPack案内`
  - `Vendor案内`
- Link impact map API:
  - `GET /api/admin/os/link-registry-impact`
  - 逆引き領域: `task_contents` / `notifications` / `city_packs` / `vendor_facade`
- Internal audit job:
  - `POST /internal/jobs/task-ux-audit`
  - guard: internal job token + kill switch fail-close
  - target: `ops_system_snapshot` 再構築
- continuation 監査（add-only）:
  - `audit_logs.action=task_detail.section.open`
  - `audit_logs.action=task_detail.section.resume`
  - lineUserId はマスクして記録する
- Feature Flags（add-only）:
  - `ENABLE_TASK_CONTENT_LINK_MIGRATION_V1`（default: true）
  - `ENABLE_TASK_CONTENT_LINK_MIGRATION_APPLY_V1`（default: false）
  - `ENABLE_TASK_UX_AUDIT_KPI_V1`（default: true）
  - `ENABLE_LINK_REGISTRY_IMPACT_MAP_V1`（default: true）
  - `ENABLE_TASK_DETAIL_CONTINUATION_METRICS_V1`（default: true）
  - `ENABLE_TASK_DETAIL_GUIDE_COMMANDS_V1`（default: true）
  - `TASK_UX_AUDIT_OVERLAP_WARN_THRESHOLD_PCT`（default: 95）
  - `TASK_UX_AUDIT_TASKKEY_WARN_THRESHOLD_PCT`（default: 80）
