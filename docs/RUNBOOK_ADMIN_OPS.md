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

## Phase671 Addendum（Ops-Only運用 + Realtime Snapshot）
運用者向けの既定導線を `Dashboard / Run / Control` に固定し、snapshot-first で状態を確認する。

### 日次確認
1) `/admin/app?pane=home&role=operator` で Realtime Ops Dashboard を確認  
2) `Feature Catalog Status` で 25機能の `status / lastUpdatedAt / reasonCodes` を確認  
3) `System Health` で `index/drift/retention` の状態を確認  

### 手動再計算（管理者）
1) UI: `Snapshot手動再計算` ボタン  
2) API: `POST /api/admin/ops-system-snapshot/rebuild`  
3) 成功後に `GET /api/admin/ops-system-snapshot` と `GET /api/admin/ops-feature-catalog-status` を再確認  

### internal job（5分 cadence）
- route: `POST /internal/jobs/ops-snapshot-build`
- body 例: `{"targets":["ops_system_snapshot"],"dryRun":false,"scanLimit":3000}`
- token: `x-city-pack-job-token`（internal token guard）
- kill switch ON の場合は停止し、復旧後に再実行する。

### 即時ロールバック
- snapshot更新停止: `ENABLE_OPS_SYSTEM_SNAPSHOT_V1=0`
- realtime画面停止: `ENABLE_OPS_REALTIME_DASHBOARD_V1=0`
- ops-onlyナビ停止: `ENABLE_ADMIN_OPS_ONLY_NAV_V1=0`
- developer導線再表示: `ENABLE_ADMIN_DEVELOPER_SURFACE_V1=1`

## ローカル診断（Phase651）
ダッシュボードや運用APIが `NOT AVAILABLE` で埋まる場合は、先にローカル診断で環境不備を切り分ける。
方針: ローカル診断は `ENABLE_ADMIN_LOCAL_PREFLIGHT_STRICT_SA_V1`（local既定ON）により `GOOGLE_APPLICATION_CREDENTIALS` のローカルSA鍵を必須化する。strict無効時のみ `gcloud auth application-default login` をフォールバックとして扱う。

### 実行コマンド
1) `npm run admin:preflight`  
2) `curl -sS -H "x-admin-token: <token>" -H "x-actor: local-check" http://127.0.0.1:8080/api/admin/local-preflight`
3) （推奨）`export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/member-dev-sa.json"` を設定（鍵ファイルはコミット禁止）
4) `test -r "$GOOGLE_APPLICATION_CREDENTIALS"` で読み取り可否を確認
5) （推奨）`gcloud config get-value project` で project を確認し、`export FIRESTORE_PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"` を設定
6) （DB確認）`gcloud firestore databases list --project <your-project-id>`
7) （Console）`https://console.cloud.google.com/firestore/databases/-default-/data?project=<your-project-id>`

### 判定
- `ready=true`: 実装/データ条件を確認する
- `ready=false`: 先に認証環境を修復する
  - `summary.code=SA_KEY_REQUIRED` は strict SA policy により probe を停止した状態（ADC経路には到達していない）
  - `checks.firestoreProbe.code=FIRESTORE_PROBE_SKIPPED_SA_KEY_REQUIRED` は SA鍵未解消のため read-only probe を未実行
  - `checks.saKeyPath.code=SA_KEY_PATH_UNSET` はローカルSA鍵未設定（推奨設定を適用）
  - `checks.saKeyPath.code=SA_KEY_PATH_PERMISSION_DENIED` は鍵ファイル読取権限不足
  - `GOOGLE_APPLICATION_CREDENTIALS` の無効パス/非ファイルを解消（ローカルSA鍵を優先）
  - `FIRESTORE_PROJECT_ID` を確認
  - `Unable to detect a Project Id` の場合は `FIRESTORE_PROJECT_ID` を明示設定
  - `Database not found` の場合は Console URL の databaseId が `-default-` か確認
  - 上記で解消しない場合のみ `gcloud auth application-default login` を再実行（ADCフォールバック）

### strict SA policy の緊急退避（ロールバック）
- 既定（推奨）: `ENABLE_ADMIN_LOCAL_PREFLIGHT_STRICT_SA_V1=1`
- 緊急時のみ一時退避: `ENABLE_ADMIN_LOCAL_PREFLIGHT_STRICT_SA_V1=0`
  - 退避後は `npm run admin:preflight` で `ADC_REAUTH_REQUIRED` など既存分類に戻ることを確認する
  - 恒久運用は必ず `ENABLE_ADMIN_LOCAL_PREFLIGHT_STRICT_SA_V1=1` に戻す

### Phase21系の注意（挙動変更なし）
- `node scripts/phase21_verify_day_window.js` は `GOOGLE_APPLICATION_CREDENTIALS` を既定で拒否する契約（`--allow-gac` 未指定時）。
- phase21実行時は次のいずれかで対応する:
  - 一時的に `unset GOOGLE_APPLICATION_CREDENTIALS`
  - `--allow-gac` を明示して実行
- この注意は運用導線の明示であり、phase21ガード契約そのものは変更しない。

### P1-1 ローカルSA鍵の最小権限設計（観測ベース）
観測ソース:
- preflight は Firestore read-only probe として `listCollections` を実行（`tools/admin_local_preflight.js`）。
- phase21 verify（REST fallback）は Firestore REST API の `GET/POST/PATCH` を実行（`scripts/phase21_verify_day_window.js`）。

推奨ロールプロファイル（最小権限）:
1) preflight専用（推奨デフォルト）  
   - `roles/datastore.viewer`  
   - 用途: `npm run admin:preflight` / `/api/admin/local-preflight` の診断
2) phase21検証を伴うローカル検証（限定運用）  
   - `roles/datastore.user`（検証対象projectでのみ付与）
   - 用途: `scripts/phase21_verify_day_window.js` の read/write 検証

運用ルール:
- 開発者の通常作業は 1) を既定とし、2) は必要時のみ一時運用する。
- `roles/editor` / `roles/owner` をローカルSA鍵へ直接付与しない。
- role最適化は audit log で実アクセスを観測し、四半期ごとに見直す。

### P1-2 SA鍵ローテーション手順（Runbook固定）
前提:
- 鍵ファイルは repo 外（例: `$HOME/.secrets/`）で管理し、コミットしない。
- 新旧鍵を並行運用できる時間を確保してから切替する。

1) 新鍵発行（旧鍵はまだ削除しない）  
`gcloud iam service-accounts keys create "$HOME/.secrets/member-dev-sa-<yyyymmdd>.json" --iam-account "<sa-email>" --project "<your-project-id>"`
2) 切替  
`export GOOGLE_APPLICATION_CREDENTIALS="$HOME/.secrets/member-dev-sa-<yyyymmdd>.json"`
3) 動作確認  
`npm run admin:preflight`
4) 旧鍵の keyId 特定  
`gcloud iam service-accounts keys list --iam-account "<sa-email>" --project "<your-project-id>"`
5) 旧鍵失効（削除）  
`gcloud iam service-accounts keys delete "<old-key-id>" --iam-account "<sa-email>" --project "<your-project-id>"`
6) 失効後確認  
`npm run admin:preflight`

失効時復旧フロー:
1) `SA_KEY_PATH_*` / `ADC_REAUTH_REQUIRED` の分類を preflight で確認
2) 誤失効時は新鍵を再発行して `GOOGLE_APPLICATION_CREDENTIALS` を更新
3) 復旧確認後に不要鍵を削除し、監査ログに `actor/traceId/実施時刻` を残す

### P2-1 鍵なし代替（WIF / impersonation）評価
現状観測:
- CI / deploy は WIF/OIDC を既定採用（`google-github-actions/auth@v2` + `workload_identity_provider`）。
- local preflight は `GOOGLE_APPLICATION_CREDENTIALS` と `SA_KEY_PATH_*` を診断軸にしている。
- `phase21_verify_day_window` は `GOOGLE_APPLICATION_CREDENTIALS` を既定拒否し、`--allow-gac` でのみ回避可能。

選択肢評価（2026-02-28 時点）:
1) CI/本番: WIF/OIDC（採用済み・維持）  
   - 採否: 採用継続  
   - 理由: 鍵配布が不要で、現行workflow契約と一致
2) ローカル: SA鍵ファイル（現行）  
   - 採否: 当面採用  
   - 理由: preflight/UI/Runbook が既にこの診断導線に最適化済み
3) ローカル: 鍵なし（ADC + SA impersonation）  
   - 採否: 今期は未採用（調査継続）  
   - 理由: preflight契約・phase21ガード・運用手順を同時改修する必要があり、1PR範囲を超える

鍵なし方式を採用する条件:
1) preflight に impersonation 前提の診断コードを add-only で追加できること
2) phase21 guard 契約（`--allow-gac`）との整合案を先に確定できること
3) ローカル運用者向けに再現可能な失敗時Runbook（復旧手順固定）を用意できること

### UI復旧フロー（Phase664）
1) `/admin/app` 上部の local preflight バナーで `再診断` を実行  
2) バナーの `復旧コマンド` から必要コマンドを `コマンドコピー`  
3) 実行後に再度 `再診断`  
4) 必要時は `監査ログへ移動` で trace を突合  
5) preflight が復旧したら Dashboard / Alerts などの初期ロードは自動再開される

補足:
- preflight未復旧時は degraded モードになり、Dashboard KPIは `BLOCKED` 表示になる。
- preflight異常時は汎用ガードバナーを重複表示しない。

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

## City Pack Education運用（公立学校 / link-only）
目的: 公立学校の公式リンクを安全運用し、120日監査で期限切れ/差分を管理する。

### 1) 教育リンク登録（Admin UI）
1. `/admin/app?pane=city-pack` の `Education Links` で `regionKey/schoolYear/linkRegistryId` を入力して作成。
2. `link_registry` は `schoolType=public` のみ許可。`private/unknown` は fail-closed。
3. 作成時に `source_refs` / `school_calendar_links` が同時生成される。

### 2) カレンダー監査（Internal Job）
- エンドポイント: `POST /internal/jobs/school-calendar-audit`
- 必須: `x-city-pack-job-token`（`CITY_PACK_JOB_TOKEN`）
- kill switch が ON の場合は `409` で停止（送信副作用なし）。
- 監査結果 `diff_detected` は `city_pack_bulletins` に draft を自動作成（自動送信はしない）。

### 3) Review/通知承認（人間）
1. `Calendar Review` で `validUntil` / `diffSummary` / recommendation を確認。
2. `Approve通知` は draft 作成・承認までを補助し、実送信は既存 `sendNotification` 経路を使う。
3. 送信時は既存 validator（`CTA=1` / direct URL禁止 / WARN block / kill switch）を必ず通す。

### 4) 監査証跡
- `city_pack.education_link.*`
- `city_pack.source_audit.run`
- `city_pack.bulletin.*`

上記 action は `traceId` で `audit_logs` と相互追跡できることを運用完了条件とする。

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

## Phase662 Addendum（Journey DAG運用）

### Journey Graph Catalog（2段階）
1) `GET /api/admin/os/journey-graph/status` で現行設定を取得。  
2) `POST /api/admin/os/journey-graph/plan` で `planHash` / `confirmToken` を取得。  
3) `POST /api/admin/os/journey-graph/set` で適用。  
4) `GET /api/admin/os/journey-graph/history` で変更履歴を確認。  

### Journey Map runtime
- `GET /api/admin/os/journey-graph/runtime?lineUserId=...`  
- `GET /api/admin/os/journey-graph/runtime/history?lineUserId=...`  
- 監査確認:
  - `journey_graph.runtime.view`
  - `journey_graph.runtime.history.view`

### 配信反応v2（互換維持）
- `POST /api/phase37/deliveries/reaction-v2`
- action:
  - `open|save|snooze|none|redeem|response`
- 監査確認:
  - `DELIVERY_REACTION_V2`
  - `events.type=journey_reaction`

### 即時停止フラグ（Phase662）
- `ENABLE_JOURNEY_DAG_CATALOG_V1=0`
- `ENABLE_JOURNEY_DAG_UI_V1=0`
- `ENABLE_JOURNEY_RULE_ENGINE_V1=0`

## Phase664 Addendum（Journey Branching運用）

### reaction branch queue status
1) `/admin/app?pane=monitor` の Journey Rule Editor で `Branch queue status` を開く。  
2) `status` / `lineUserId` を指定して `Queueを更新` を実行する。  
3) `pending` が継続する場合は `nextAttemptAt` と `attempts` を確認する。  
4) 監査確認: `journey_graph.branch_queue.view`

### internal dispatch job（token guard）
1) `POST /internal/jobs/journey-branch-dispatch` を `x-journey-branch-job-token` 付きで実行する。  
2) payload で `dryRun` / `limit` を指定する（既定 `dryRun=false`, `limit=100`）。  
3) 実行後は `journey_branch.dispatch` 監査ログを確認する。  
4) queue item の `status` (`sent|skipped|failed`) と `notification_deliveries.branchDispatchStatus` を突合する。  

### dispatch失敗時の切り分け
1) `status=failed` で queue を絞り、`lastError` を確認する。  
2) `effect.nextTemplateId` 欠損時は `skipped_no_template` が正常動作。  
3) 再試行時刻は `nextAttemptAt`（指数的に最大60分）を参照する。  
4) 継続障害時は `ENABLE_JOURNEY_BRANCH_QUEUE_V1=0` で即時停止する。  

### 即時停止フラグ（Phase664）
- `ENABLE_JOURNEY_BRANCH_QUEUE_V1=0`
- `ENABLE_JOURNEY_RULE_ENGINE_V1=0`
- `journeyPolicy.enabled=false`

## Phase663 Addendum（LINE Rich Menu運用）

### Rich Menu status / preview
1) `/admin/app?pane=monitor` の `Rich Menu Ops（admin）` で `status` を実行。  
2) policy と template/rule/run の一覧を確認する。  
3) `resolve-preview` で対象ユーザーの解決結果（source/templateId/richMenuId）を確認する。  

### Rich Menu plan / set（2段階）
1) action と payload JSON を入力する。  
2) `plan` 実行で `planHash` / `confirmToken` を取得する。  
3) `set` 実行で適用する。  
4) `history` で run evidence を確認する。  

### 最小安全運用（stg）
1) `set_policy` で `enabled=true`, `updateEnabled=true`, `defaultTemplateId`, `fallbackTemplateId` を設定。  
2) `upsert_template` / `upsert_phase_profile` / `upsert_rule` を投入。  
3) `apply` はまず `dryRun=true` で実行し、対象数と block理由を確認。  
4) 問題がなければ限定 `lineUserIds` で `apply(dryRun=false)` を実行。  
5) `audit_logs` で `rich_menu.plan|set|resolve_preview|history.view|status.view` を追跡。  

### rollback / kill switch
- rollback:
  - action=`rollback` + `lineUserIds[]` で `previousTemplateId` へ戻す。  
- Rich Menu専用停止:
  - action=`set_policy`, payload=`{ updateEnabled: false, ... }`  
- 全体停止（最終）:
  - 既存 kill switch を使用する。  

## Journey Param Versioning（Phase665）

### Draft -> Validate -> DryRun -> Apply
1) `GET /api/admin/os/journey-param/status` で activeVersion と runtime pointer を確認。  
2) `POST /api/admin/os/journey-param/plan` で draft を保存し、`planHash` / `confirmToken` を取得。  
3) `POST /api/admin/os/journey-param/validate` を実行し、循環/ガード違反を解消。  
4) `POST /api/admin/os/journey-param/dry-run` で影響件数を確認（`impactedUsers/additionalNotifications/disabledNodes/deadlineBreachForecast`）。  
5) `POST /api/admin/os/journey-param/apply` を `planHash + confirmToken + latestDryRunHash` 付きで実行。  
6) `GET /api/admin/os/journey-param/history` で証跡を確認。  

### Rollback
1) `POST /api/admin/os/journey-param/plan` (`action=rollback_plan`) で rollback 用 token を発行。  
2) `POST /api/admin/os/journey-param/rollback` で `versionId -> rollbackToVersionId` を適用。  
3) `GET /api/admin/os/journey-param/status` で activeVersion 巻き戻しを確認。  

### 即時停止
- `ENABLE_JOURNEY_PARAM_VERSIONING_V1=0`  
- `ENABLE_JOURNEY_PARAM_CANARY_V1=0`  
