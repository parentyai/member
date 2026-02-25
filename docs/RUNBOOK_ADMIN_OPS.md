# RUNBOOK_ADMIN_OPS

管理UI（運用OS）で日次運用・事故対応・証跡確定を自走するための runbook。

## Preconditions
- 主チャネル: LINE公式アカウントのみ
- kill switch は「送信副作用の最終停止装置」
- traceId は監査の主キー（Trace Search で追えること）

## /admin/app ナビ表示ポリシー（Phase637）
左ナビの表示は Role に応じて固定される。運用変更で逸脱しないことを優先し、契約テストで維持する。
この節は Phase637 の履歴であり、最新運用は後述の「Phase638–647 更新」を優先する。

| role | 左ナビ表示グループ |
| --- | --- |
| operator | `dashboard`, `notifications`, `users`, `catalog` |
| admin | `dashboard`, `notifications`, `users`, `catalog` |
| developer | `dashboard`, `notifications`, `users`, `catalog`, `developer` |

補足:
- `catalog` 配下に `settings` を主導線として置く（全Roleで表示）。
- `communication` / `operations` は現状非表示（表示拡大は別改善）。
- Topbar は Role スイッチ主体（開発メニュー再露出は回帰扱い）。

## /admin/app ナビ表示ポリシー（Phase638–647 更新）
運用時の既定表示は以下を最新とする。

| role | 左ナビ表示グループ |
| --- | --- |
| operator | `dashboard`, `notifications`, `users`, `catalog` |
| admin | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |
| developer | `dashboard`, `notifications`, `users`, `catalog`, `developer`, `communication`, `operations` |

運用フラグ:
- `ENABLE_ADMIN_NAV_ROLLOUT_V1=1`（既定）で admin/developer へ `communication` / `operations` を表示。
- 緊急停止は `ENABLE_ADMIN_NAV_ROLLOUT_V1=0`。
- build識別の表示停止は `ENABLE_ADMIN_BUILD_META=0`。

## /admin/app ナビ表示ポリシー（Phase648 更新・最新）
導線迷子の再発防止を優先し、Role別にアクセス可能なカテゴリを左ナビへ全表示する。

| role | 左ナビ表示グループ |
| --- | --- |
| operator | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |
| admin | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |
| developer | `dashboard`, `notifications`, `users`, `catalog`, `developer`, `communication`, `operations` |

運用フラグ:
- `ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=1`（既定）で、Role別許可paneに対応するカテゴリを可視化。
- 緊急停止は `ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=0`（旧判定経路へ戻す）。
- build識別の表示停止は `ENABLE_ADMIN_BUILD_META=0`。

補足:
- 同一paneが複数groupにある場合、`data-nav-priority` の高い導線を優先して重複表示を抑制する。
- `notifications` の create/list のような同一group内導線は維持する。

## ローカル診断（Phase651）
ダッシュボードや運用APIが `NOT AVAILABLE` で埋まる場合は、先にローカル診断で環境不備を切り分ける。

### 実行コマンド
1) `npm run admin:preflight`  
2) `curl -sS -H "x-admin-token: <token>" -H "x-actor: local-check" http://127.0.0.1:8080/api/admin/local-preflight`

### 判定
- `ready=true`: 実装/データ条件を確認する
- `ready=false`: 先に認証環境を修復する
  - `GOOGLE_APPLICATION_CREDENTIALS` の無効パス/非ファイルを解消
  - `FIRESTORE_PROJECT_ID` を確認
  - `gcloud auth application-default login` を再実行

### フラグ
- `ENABLE_ADMIN_LOCAL_PREFLIGHT_V1=1`（既定）: UIバナーで原因/影響/操作を表示
- `ENABLE_ADMIN_LOCAL_PREFLIGHT_V1=0`: 診断経路を停止（既存挙動へ復帰）

### nav回帰インシデント手順（追加）
1) `/admin/app?pane=home&role=operator|admin|developer` で3ロールを確認。  
2) 表示グループが上表と一致しない場合、`ENABLE_ADMIN_NAV_ROLLOUT_V1` の実値を確認。  
3) `window.ADMIN_APP_BUILD_META` の commit/branch を確認し、ローカル乖離を除外。  
4) `npm run test:admin-nav-contract` を実行し、失敗契約を先に修復。  
5) 緊急時はフラグ停止または対象PRをrevertし、再度契約テストで復旧確認。  

運用確認（画面）:
1) `/admin/app?pane=home` で role を operator / admin / developer に切替
2) 上表どおりのグループ表示か確認
3) 逸脱時は直近 UI PR を revert し、契約テスト失敗を確認して原因修正

## Daily Ops (ServicePhase1 / 運用OS v1)
推奨順序（迷わないための一本道）。

1) `/admin/ops`
   - Ops Console list → detail
   - risk / lastReactionAt / blockingReasons を確認
2) `/admin/monitor`
   - 通知単位の reactionSummary / health / CTR を確認
3) `/admin/errors`
   - retry queue / link WARN / guard拒否 を確認
4) `/admin/trace-search`（= `/admin/ops` 内 Trace Search）
   - traceId で view → decision → execute が追えるか確認

## Composer Flow (通知作成 → 承認 → 送信)
1) `/admin/composer`
   - draft 作成（title/body/cta/linkRegistryId/target/scenario/step）
   - preview で本文とリンクを確認
   - approve（active化）
   - plan → confirm token を取得
   - execute（confirm token 必須）
2) Monitor で反応/CTR を確認

## Automation Config（Segment Execute Guard）
`/admin/master` の Automation Config で `mode` を運用する。

- `OFF`: execute しない
- `DRY_RUN_ONLY`: dry-run のみ許可
- `EXECUTE`: execute 許可（他のガードは継続）

操作手順:
1) status を確認
2) desired mode で plan
3) set（confirmToken 必須）
4) trace search で `automation_config.plan` / `automation_config.set` を確認

## Notification Caps（送信上限制御）
`/admin/master` の System Config で `notificationCaps` を設定する。

- `perUserWeeklyCap`
  - `null`: 無効
  - `N`（正の整数）: ユーザー単位の過去7日 delivered 件数が `N` 以上でブロック
- `perUserDailyCap`
  - `null`: 無効
  - `N`（正の整数）: ユーザー単位の過去24時間 delivered 件数が `N` 以上でブロック
- `perCategoryWeeklyCap`
  - `null`: 無効
  - `N`（正の整数）: ユーザー+通知カテゴリ単位の過去7日 delivered 件数が `N` 以上でブロック
- `quietHours`（UTC）
  - `null`: 無効
  - `{startHourUtc,endHourUtc}`: 静穏時間中は送信ブロック（例: 22→7）
- `deliveryCountLegacyFallback`
  - `true`（既定）: deliveredAt 欠損の旧deliveryを `sentAt` で補完集計する（互換優先）
  - `false`: cap判定は `deliveredAt` のみで集計する（性能優先）

操作手順:
1) status で現行値を確認
2) desired cap を入力して plan
   - impact preview の確認ポイント:
     - `blockedEvaluations` / `blockedEvaluationRatePercent`: 評価件数ベースのブロック見込み
     - `estimatedBlockedUsers` / `estimatedBlockedUserRatePercent`: ユーザー単位のブロック見込み
     - `topBlockedCapType` / `blockedByReason`: 主要ブロック要因
3) set（confirmToken 必須）
4) trace search で `system_config.plan` / `system_config.set` を確認

運用推奨:
1) 先に `Delivery deliveredAt Backfill` を実行し、`fixableCount=0` まで補完
2) その後 `deliveryCountLegacyFallback=false` に切り替える
3) 問題があれば `true` に戻す（即時ロールバック）

ブロック時の観測:
- Composer: `notifications.send.execute` / `reason=notification_cap_blocked`
- Segment: `segment_send.execute` / `capBlockedCount>0`
- Retry Queue: `retry_queue.execute` / `reason=notification_cap_blocked`
- 詳細理由は `capType` / `capReason`（`PER_USER_DAILY` / `PER_USER_WEEKLY` / `PER_CATEGORY_WEEKLY` / `QUIET_HOURS`）で判定

## Incident Response (事故時)
1) kill switch ON（Operations）
2) traceId を取得（Ops/Composer/Monitor/Error Console）
3) `/api/admin/trace?traceId=...` で audits/decisions/timeline を確認
4) 原因分類（例）
   - kill switch on（意図した停止）
   - guard拒否（confirm token mismatch / plan mismatch）
   - link WARN
   - composer send failure → `notifications.send.execute`（ok=false）audit を確認
   - segment send failure → retry queue
5) Mitigation（人間判断）
   - 再送/停止/テンプレ差し替え/リンク差し替え
6) Rollback
   - 実装PR を revert（必要なら）

## Delivery Recovery（reserved/in-flight 詰まり対応）
対象: `notification_deliveries/{deliveryId}` が `reserved` のまま残り、再実行が skip され続けるケース。

原則:
- 二重送信ゼロを優先するため、既定回復は `seal` のみ（再送しない）。
- `deliveryId` が `delivered=true` の場合は recovery 対象外。

手順:
1) `/admin/master` の「Delivery Recovery（seal）」で `deliveryId` を入力
2) `status` で現状確認（`delivered/sealed/state/lastError`）
3) `plan` 実行（planHash/confirmToken 取得）
4) `execute(seal)` 実行（confirmToken 必須）
5) `status` 再確認で `sealed=true` を確認
6) trace search で `delivery_recovery.plan` / `delivery_recovery.execute` を確認

期待結果:
- `sealed=true` の delivery は以後の送信で skip される
- 監査ログに traceId 付きで回復操作が残る

## Delivery deliveredAt Backfill（運用データ補完）
対象: `notification_deliveries` のうち `delivered=true` だが `deliveredAt` が欠損している旧データ。

原則:
- `sentAt` から `deliveredAt` を補完できる行のみ更新する。
- `sentAt` も欠損している行はスキップ（手動調査対象）。
- 危険操作なので `plan -> confirmToken -> execute` 必須。

手順:
1) `/admin/master` の「Delivery deliveredAt Backfill」で `limit` を指定（既定: 200）
2) `status` で `missingDeliveredAtCount / fixableCount / unfixableCount` を確認
3) `plan` 実行（planHash/confirmToken 取得）
4) `execute(backfill)` 実行（confirmToken 必須）
5) `status` 再確認で `missingDeliveredAtCount` が減っていることを確認
6) trace search で `delivery_backfill.plan` / `delivery_backfill.execute` を確認

期待結果:
- `deliveredAt` 欠損行のうち `sentAt` がある行が補完される
- `deliveredAtBackfilledAt / deliveredAtBackfilledBy` が追記される
- 監査ログに traceId 付きで実行結果が残る

## Evidence (監査証跡)
最低限、以下が traceId から取得できること。

- audits: view / plan / execute / kill switch set
- decisions: submit / execute（該当する場合）
- timeline: DECIDE / EXECUTE（該当する場合）

## Billing / LLM運用（Phase課金）

### Stripe Webhook運用
1) Webhookサービスは `SERVICE_MODE=webhook` で運用し、`/webhook/stripe` を受け付ける。  
2) 異常イベントは `stripe_webhook_dead_letters` を確認する。  
3) 再送時は `stripe_webhook_events/{eventId}` の `status` を確認し、`duplicate` / `stale_ignored` を許容する。  

即時停止:
- `ENABLE_STRIPE_WEBHOOK=0`

### Plan Gate運用
1) `user_subscriptions/{lineUserId}` の `status` を確認する。  
2) `active|trialing` のみ Pro、`past_due|canceled|incomplete|unknown` は Free 扱い。  
3) 不整合時は Free に降格される設計を維持する。  

### LLM Policy運用（2段階）
1) `GET /api/admin/llm/policy/status` で実効状態を確認。  
2) `POST /api/admin/llm/policy/plan` で `planHash` と `confirmToken` を取得。  
3) `POST /api/admin/llm/policy/set` で適用。  
4) `audit_logs` で `llm_policy.plan` / `llm_policy.set` を追跡。  

即時停止:
- `opsConfig/llmPolicy.enabled=false`
- 既存互換停止として `system_flags.phase0.llmEnabled=false`

### Users / Dashboard観測
- Users一覧: `plan` / `subscriptionStatus` / `currentPeriodEnd` / `llmUsage` で絞り込み・ソート。  
- User detail API: `GET /api/admin/os/user-billing-detail?lineUserId=...`。  
- Dashboard KPI: `pro_active_count`, `total_users`, `pro_ratio`, `llm_daily_usage_count`, `llm_avg_per_pro_user`, `llm_block_rate`。  

### Users Stripe運用導線（Phase653 add-only）
1) Users画面の quick filter を使う（`All / Pro(active) / Free / Trialing / Past_due / Canceled / Unknown`）。  
2) `Analyze` で `proActiveRatio/unknownRatio` を確認する。  
3) `Export CSV` は PII マスク済み（`lineUserIdMasked/memberNumberMasked`）を出力する。  
4) `Unknown/Conflict` を優先対応し、`/api/admin/trace?traceId=...` で証跡確認する。  

API:
- `GET /api/admin/os/users-summary/analyze`
- `GET /api/admin/os/users-summary/export`
- `GET /api/admin/os/llm-usage/summary`
- `GET /api/admin/os/llm-usage/export`（CSV / userIdマスク済み）

### Journey KPI運用（Retention/LTV）
1) `GET /api/admin/os/journey-kpi` で最新KPIを取得する。  
2) 日次バッチは `POST /internal/jobs/journey-kpi-build` を実行する（internal token必須）。  
3) Dashboard の `Retention / LTV` パネルで `7/30/60/90`、`NextAction実行率`、`Pro conversion` を確認する。  
4) 定期実行は workflow で運用する。  
   - `.github/workflows/journey-kpi-build.yml` -> `/internal/jobs/journey-kpi-build`  
   - `.github/workflows/user-context-snapshot-build.yml` -> `/internal/jobs/user-context-snapshot-build`  
5) `llm_usage` エクスポートは `x-actor` 必須、CSVは `userIdMasked` のみ利用する。  

即時停止:
- `ENABLE_JOURNEY_KPI=0`
- `ENABLE_USER_CONTEXT_SNAPSHOT=0`

## Phase654 追加運用（ToDo依存グラフ / Snapshot v2 / Policy履歴）

### ToDo依存グラフ運用
1) ToDoの書き込みSSOTは `journey_todo_items` を継続利用する。  
2) `status` の意味は維持し、依存状態は追加fieldで確認する。  
   - `progressState`, `graphStatus`, `dependsOn`, `blocks`, `priority`, `riskLevel`, `lockReasons`, `graphEvaluatedAt`  
3) 派生read model `task_nodes` は UI/集計専用とし、再計算結果を参照する。  
4) `TODO一覧` でロック理由と `TOP3` が表示されることを運用確認する。  

### Snapshot v2 再圧縮ジョブ
1) route: `POST /internal/jobs/user-context-snapshot-recompress`  
2) header: `x-city-pack-job-token`（internal token）  
3) body:
   - 単一: `{ "lineUserId": "U..." }`
   - 複数: `{ "lineUserIds": ["U1","U2"] }`
   - 全件: `{ "limit": 100 }`
4) 監査確認（`audit_logs`）:
   - `snapshot_recompressed`
   - `snapshot_trimmed`
   - 障害時 `snapshot_build_fallback`

### Users / Dashboard 追加観測
1) Users一覧は `llmUsage` / `todoProgressRate` 列を確認する。  
2) Analyzeで `avgTaskCompletionRate` / `avgDependencyBlockRate` を確認する。  
3) Dashboardカードで以下を監視する。  
   - `journey_task_completion_rate`  
   - `journey_dependency_block_rate`

### LLM Policy 履歴運用
1) `GET /api/admin/os/llm-policy/history` で最新変更履歴を確認する。  
2) 保存時の alias は canonical に変換される前提で運用する。  
   - `max_tokens -> max_output_tokens`
   - `per_user_limit -> per_user_daily_limit`
   - `rate_limit -> global_qps_limit`

### 即時停止フラグ（Phase654）
- `ENABLE_TASK_GRAPH_V1=0`（依存グラフ要約停止）
- `ENABLE_TASK_GRAPH_UI_V1=0`（UI表示停止）
- `ENABLE_CONTEXT_SNAPSHOT_V2=0`（再圧縮経路停止）
- `ENABLE_PRO_PREDICTIVE_ACTIONS_V1=0`（Proの依存補足停止）
