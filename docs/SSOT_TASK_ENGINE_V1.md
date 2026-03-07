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

## Phase740 Add-only（LinkRegistry 2.0 / Task Micro-Learning / Attention Budget）
- LinkRegistry 2.0（add-only fields on `link_registry`）:
  - `intentTag` (`task|city_pack|vendor|support|payment|null`)
  - `audienceTag` (`family|solo|corporate|null`)
  - `regionScope` (`nationwide|state|city|school_district|null`)
  - `riskLevel` (`safe|warn|blocked|null`)
  - 互換: 未設定は `null` 許容、既存リンクの意味は不変更
- Task Micro-Learning（add-only fields on `task_contents`）:
  - `summaryShort[]`（最大5）
  - `topMistakes[]`（最大3）
  - `contextTips[]`（最大5）
  - 表示順: 概要 → よくある失敗 → あなたの状況の注意 → 既存の理解する/manual/failure
  - 未設定時は read-time fallback（checklist/manual/failure/task context から決定論生成）
- CityPack Modular Subscription（add-only）:
  - `city_packs.modules[]`（`schools|healthcare|driving|housing|utilities`）
  - 新規 collection: `user_city_pack_preferences/{lineUserId}`
    - `modulesSubscribed[]`（空配列は全購読扱い）
  - Journey command/postback:
    - `CityPack案内`
    - `city_pack_module_subscribe`
    - `city_pack_module_unsubscribe`
    - `city_pack_module_status`
- Notification Attention Budget（add-only behavior）:
  - `ENABLE_JOURNEY_ATTENTION_BUDGET_V1` 有効時、1ユーザー1日あたり上限を `JOURNEY_DAILY_ATTENTION_BUDGET_MAX` で制御
  - `user_journey_profiles.timezone` 優先、未設定は `UTC`
  - 選抜は `priorityScore + deadline + dependency` の決定論スコアで `computeDailyTopTasks` を使用
- 送達 SSOT は `notification_deliveries`

## Phase741 Add-only（US Assignment Task OS）
- 既存連鎖は維持:
  - `LINE -> Journey -> TODO -> Task Detail -> Notification -> CityPack -> Vendor -> LinkRegistry`
- Task Template SSOT:
  - 新規 `task_templates` collection は追加しない
  - `step_rules` を template SSOT として利用する
- task category system（add-only）:
  - `step_rules.category`（enum）
  - `IMMIGRATION|HOUSING|BANKING|HEALTHCARE|TRANSPORT|SCHOOL|LIFE_SETUP|COMPANY_ADMIN`
  - 未設定読み取り時 fallback は `LIFE_SETUP`
- DAG / dependency constraints（add-only）:
  - `step_rules.dependsOn[]` は最大 `TASK_DEPENDENCY_MAX`（default 10）
  - cycle 禁止は既存 `evaluateGraph` 契約を利用
  - `computeTaskGraph()` は `evaluateGraph` の統一レスポンスラッパー
- task card model extensions（add-only）:
  - `task_contents.category`
  - `task_contents.dependencies[]`（max 10）
  - `task_contents.checklist[]`（`checklistItems[]` と互換）
  - `task_contents.recommendedVendorLinkIds[]`（max 3）
  - `task_contents.archived`（soft disable 用）
- step rule extensions（add-only）:
  - `step_rules.estimatedTimeMin`, `step_rules.estimatedTimeMax`
  - `step_rules.recommendedVendorLinkIds[]`（max 3）
- Next Task Engine（add-only）:
  - command: `今やる`（互換 alias: `今日の3つ` / `next_tasks`）
  - `computeNextTasks()` が `computeDailyTopTasks()` で決定論 top3 を返す
  - city pack 推奨タスクの `priorityBoost` を加味
  - max 件数は `JOURNEY_NEXT_TASK_MAX`（default 3）
- category / delivery / vendor command（add-only）:
  - `カテゴリ` / `カテゴリ:<CATEGORY>`
  - `通知履歴`
  - `TODO業者:<todoKey>`
  - `相談`
- city pack task seed（add-only）:
  - `city_packs.recommendedTasks[]`:
    - `{ ruleId, module|null, priorityBoost|null }`
  - region 申告成功時に `syncCityPackRecommendedTasks()` を best-effort 実行
  - 既存 task がある場合は上書きしない（add-only seed）
- rich menu entry（add-only）:
  - 入口文言（message action）:
    - `今やる`, `今週の期限`, `地域手続き`, `TODO一覧`, `通知履歴`, `相談`
    - `TODO一覧` は secondary surface、`CityPack案内` は backstage command で維持
  - seed script:
    - `node tools/migrations/rich_menu_task_os_seed.js`（dry-run）
    - `node tools/migrations/rich_menu_task_os_seed.js --apply --enable-policy`（apply）

### UX-Max logical mapping（add-only, non-destructive）
- `Nationwide Pack`:
  - 既存 `city_packs.packClass=nationwide` の論理分類。新エンティティは追加しない。
- `Regional Pack`:
  - 既存 `city_packs.packClass=regional` の論理分類。`regionKey` 一致を優先する。
- `Core Journey`:
  - `journey_templates` + `journey_todo_items` の既存契約を継続利用し、UI上の見せ方のみ更新する。
- `Concierge`:
  - 既存 LLM/Guide 系の fail-closed ガード（lawfulBasis/consent/kill-switch）を前提に、high-stakes 相談導線へ接続する。

### Guided home and notification contract（add-only）
- primary surface:
  - `今やる` / `今週の期限` / `地域手続き` / `相談`
- secondary surface:
  - `TODO一覧`
- reminders:
  - trigger は `due_soon_7d|blocker_resolved|regional_confirmed|family_critical` のみ
  - daily primary cap は `JOURNEY_PRIMARY_NOTIFICATION_DAILY_MAX`（default 1）
  - narrowing toggle は `ENABLE_JOURNEY_NOTIFICATION_NARROWING_V1`
- CTA landing:
  - `TODO詳細:<todoKey>` または `地域手続き` のみ

## Phase748 Add-only（Journey Command Surface: 期限/ブロッカー整合）
- `今週の期限` のユーザー表示は内部語 `due_soon` を露出せず、次の2セクションで返す:
  - `期限（7日以内）`
  - `期限超過`
- 0件時の固定文言:
  - `期限（7日以内）/期限超過の未完了タスクはありません。`
- `今やる` / `カテゴリ` 表示は、`blockedReason` があるタスクに `ブロッカー:<reason>` を add-only 表示する。
- `カテゴリ` 一覧は `カテゴリ別TODO件数` に加えて `ブロック件数` を表示する（例: `IMMIGRATION: 4件（ブロック:1件）`）。
- `相談` コマンドの意味は `案内表示 + 利用イベント記録` であり、コマンド時点ではチケットを作成しない。

## Phase742 Add-only（Canonical NBA Adapter Boundary）
- 目的:
  - `computeNextTasks()` の決定論 authority を維持したまま、運用可視化用の adapter を追加する。
- canonical authority:
  - `computeNextTasks()` を唯一の selector authority とする。
  - `getNextBestAction()` は adapter/read model としてのみ使用し、独立 engine として扱わない。
- non-goal:
  - `phaseLLM3/getNextActionCandidates` を member canonical NBA に昇格しない。
  - LLM に state mutation authority を与えない。
- admin read-only surface（add-only）:
  - `GET /api/admin/os/next-best-action?lineUserId=...`
  - `x-actor` 必須 + `traceId` 解決 + `appendAuditLog` を必須化する。
  - write path は追加しない。
