# SSOT_ADMIN_UI_OS

管理UIを「運用OS」として定義し、**人間Opsが UI だけで自走できる**ことを SSOT として固定する。
UI表示（画面タイトル/見出し/画面名）は `docs/ADMIN_UI_DICTIONARY_JA.md` を唯一のSSOTとする。
本書は運用OSの原則/要件のSSOTであり、UI表示に関する記述は辞書に準拠する。

## Non-Goals
- LLM を実行主体にしない（提案/文面整形のみ）
- 既存 API/データの意味変更はしない（add-only）
- 自動運用を主軸にしない（判断と実行は人間）

## Global Safety Rules (Always On)
- traceId は view → suggest → decision → execute/stop → trace search を貫通（欠損は生成して埋める）
- すべてのUI操作は `x-actor` を送る（actor=unknown を避ける）
- kill switch ON の時は送信副作用を必ず止める（例外なし）
- 危険操作（execute / kill / rollback 相当）は confirm token 必須
- 監査ログ（audit_logs）/ 判断ログ（decision_logs）/ タイムライン（decision_timeline）で後追い再現できる

## UI構造（共通）
すべての管理UIは共通の情報構造を持つ（add-only）。

- 上部カードナビ: 8画面（ops/composer/monitor/errors/master/read-model/review/login）
- 下部パネル3層: 目的文 / 状態サマリー / 操作領域
- 色意味は固定: 赤=要対応、黄=注意、緑=問題なし、灰=未設定/不明
- パンくず: `ページ名 / 対象ID / 詳細`

## /admin/app ナビ可視化ポリシー（Phase637）
`/admin/app` の左ナビは、Roleごとに「表示グループ」を固定する。  
このポリシーは UI 実装（`data-nav-group` / `data-nav-visible`）と契約テストで維持する。
この節は Phase637 時点の履歴であり、最新運用は後述の「Phase638–647 更新」を優先する。

### グループ定義
- `dashboard`
- `notifications`
- `users`
- `catalog`（City Pack / Vendors / Settings）
- `developer`
- `communication`
- `operations`

### Role別可視化マトリクス
| role | 表示グループ |
| --- | --- |
| operator | `dashboard`, `notifications`, `users`, `catalog` |
| admin | `dashboard`, `notifications`, `users`, `catalog` |
| developer | `dashboard`, `notifications`, `users`, `catalog`, `developer` |

### 運用意図（固定）
- `communication` と `operations` は現状非表示を維持する（導線拡大は別Phaseで扱う）。
- `settings` は `catalog` 配下を主導線とする（全Roleで利用可能）。
- Topbar は Role スイッチ主体を維持する（開発導線の再露出を避ける）。

## /admin/app ナビ可視化ポリシー（Phase638–647 更新）
Phase647 時点では、ロールアウト制御を前提に次の可視化を SSOT とする。

### Role別可視化マトリクス（最新）
| role | 表示グループ |
| --- | --- |
| operator | `dashboard`, `notifications`, `users`, `catalog` |
| admin | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |
| developer | `dashboard`, `notifications`, `users`, `catalog`, `developer`, `communication`, `operations` |

### ロールアウト制御（最新）
- `communication` / `operations` は `data-nav-rollout="admin,developer"` で制御する。
- 全体停止は `ENABLE_ADMIN_NAV_ROLLOUT_V1=0` で実施する（operator可視化は増えない）。
- `settings` は `catalog` を主導線とし、`operations` 側は補助導線として残置する。
- build/commit の表示は `window.ADMIN_APP_BUILD_META` で行い、欠損時は `NOT AVAILABLE` を表示する。

## /admin/app ナビ可視化ポリシー（Phase648 更新・最新）
Phase648 では「Role別アクセス可能カテゴリを左ナビに全表示」を優先し、
表示判定を pane 許可ポリシー（`NAV_POLICY` / `DEFAULT_NAV_PANE_POLICY`）基準に寄せる。

### Role別可視化マトリクス（最新）
| role | 表示グループ |
| --- | --- |
| operator | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |
| admin | `dashboard`, `notifications`, `users`, `catalog`, `communication`, `operations` |
| developer | `dashboard`, `notifications`, `users`, `catalog`, `developer`, `communication`, `operations` |

### 判定ルール（最新）
- `ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=1`（既定）時は、Role別許可paneに対応する nav item を表示対象にする。
- グループ表示は「可視 item が1件以上ある group」を優先し、`data-nav-visible` に反映する。
- 同一paneが複数groupにある場合は `data-nav-priority` の高い導線を優先し、重複表示を抑制する（同一group内導線は維持）。
- `ENABLE_ADMIN_NAV_ALL_ACCESSIBLE_V1=0` で Phase638–647 の判定経路へ即時ロールバックできる。

## /admin/app ローカル診断ポリシー（Phase651）
`/admin/app` は `ENABLE_ADMIN_LOCAL_PREFLIGHT_V1`（既定ON）でローカル前提条件診断を有効化する。

### 診断I/F（additive）
- `GET /api/admin/local-preflight` を追加し、read-only でローカル前提条件を返す。
- `window.ENABLE_ADMIN_LOCAL_PREFLIGHT_V1` を boot script へ注入する。
- UIは `ready=false` の場合、原因/影響/操作をバナー表示する。
- `summary` へ add-only で以下を返す:
  - `category`
  - `recoveryActionCode`
  - `recoveryCommands[]`
  - `primaryCheckKey`
  - `rawHint`
  - `retriable`
- `checks.firestoreProbe.classification` は以下を返す:
  - `FIRESTORE_DATABASE_NOT_FOUND`
  - `FIRESTORE_PROJECT_ID_ERROR`
  - `ADC_REAUTH_REQUIRED`
  - `FIRESTORE_TIMEOUT`
  - `FIRESTORE_NETWORK_ERROR`
  - `FIRESTORE_PERMISSION_ERROR`
  - `FIRESTORE_UNKNOWN`

### 判定対象
- `GOOGLE_APPLICATION_CREDENTIALS` が有効ファイルか
- `FIRESTORE_PROJECT_ID` の設定有無
- Firestore read-only probe（`listCollections`）の成否

### UI復旧導線（Phase664）
- preflight異常時は `admin-local-preflight-banner` を一次表示とし、汎用 `admin-guard-banner` は重複表示しない。
- バナー内で以下を提供する:
  - `再診断`
  - `コマンドコピー`
  - `監査ログへ移動`
  - 診断詳細（checks JSON）
- preflight未復旧時は `degraded` モードで初期Firestore依存ロードを抑止し、Dashboard KPIは `BLOCKED` 表示に統一する。
- preflight復旧時は初期ロードを自動再開する。

### 運用意図
- `NOT AVAILABLE` の原因を「実装未完了」と「環境不備」に分離して提示する。
- 既存API/Firestoreスキーマは変更しない（診断は read-only）。

## ServicePhase と「運用OS成熟度」
ServicePhase（1〜4）は SSOT として保持される（`docs/SSOT_SERVICE_PHASES.md`）。
本ドキュメントでは、ServicePhase を **管理UIで運用自走するための成熟度（運用OS）**として要求定義する。

### ServicePhase 1: 運用OS v1（基礎）
MUST:
- Composer（配信作成）: draft → preview → approve → plan → execute
- Delivery Monitor: notification 単位で deliveries / click / read / CTR / health を可視化
- Error Console: 送信失敗 / link WARN / guard拒否 を一覧化
- Operations: kill switch / dry-run / retry queue を UI から操作
- Trace Search: traceId 入力で audits / decisions / timeline を一括表示
- Master Data（最低限）: templates / link_registry を UI から管理

### ServicePhase 2: 運用OS v2（拡張）
MUST:
- 属性/嗜好/ステッププリセット/City Pack を Master Data として管理
- セグメント配信（属性×ステップ）を UI で作成・検証できる
- NotificationPreset（A/B/C…）を UI で選べる（頻度ガードは必須、上限解除は禁止）

### ServicePhase 3: 運用OS v3（活用）
MUST:
- パーソナライズ結果を決定論で評価し、UI で根拠を表示
- “なぜ今それが出たか”を internal log + traceId で追える

### ServicePhase 4: 運用OS v4（有料化）
MUST:
- LLM は文面/提案の補助のみ。採用/実行は人間。
- 課金境界（機能フラグ/ロール）と監査が一致している

## IA (Information Architecture) — Screens
以下は ServicePhase1 の「運用OS v1」で最低限提供される画面（追加は add-only）。

- `/admin/ops`（運用判断支援（Ops Console / READ ONLY））
- `/admin/composer`（通知作成（Composer / 運用OS））
- `/admin/monitor`（配信結果（Monitor / READ ONLY））
- `/admin/errors`（エラー一覧（Errors / READ ONLY））
- `/admin/master`（設定/回復（Master / 運用OS））
- `/admin/read-model`（通知集計（Read Model / READ ONLY））
- `/admin/review`（運用レビュー記録（Review））
- `/admin/login`（Admin Login）

## Audit Points (Minimum)
画面/操作に対して audit_logs に best-effort で残す（traceId を必須保存）。

- view:
  - `ops_console.view`
  - `read_model.notifications.view`
  - `admin_os.composer.view`
  - `admin_os.monitor.view`
  - `admin_os.errors.view`
  - `admin_os.master.view`
- write / execute:
  - `notifications.create`（draft）
  - `notifications.approve`
  - `notifications.send.plan`
  - `notifications.send.execute`
  - `kill_switch.plan`
  - `kill_switch.set`
  - `template.*` / `link_registry.*`（既存アクションを利用）

## Phase653 Add-only UI Contract
- 折り畳み禁止: `ENABLE_ADMIN_NO_COLLAPSE_V1=1` で `details` は常時 open。  
- 上部常時サマリー非表示: `ENABLE_ADMIN_TOP_SUMMARY_V1=0` を既定とする。  
- Users 画面は Stripe運用導線を持つ。  
  - quick filters (`all/pro_active/free/trialing/past_due/canceled/unknown`)  
  - analyze / export / edit columns  
  - `billingIntegrityState=unknown|conflict` を強調表示  
  - URL query で filter/sort/columns を再現可能にする  
- Dashboard は `pro_active_count` カードと `Retention/LTV` パネルを表示する。  
- LLM運用は `llm policy` の2段階更新に加え `llm usage summary` を表示する。  

## Phase654 Add-only UI Contract
- ToDo依存グラフは `journey_todo_items` をSSOTとして運用し、`status` 意味は変更しない。  
  追加フィールド: `progressState/graphStatus/dependsOn/blocks/priority/riskLevel/lockReasons/graphEvaluatedAt`
- 派生read modelとして `task_nodes` を追加する。  
  `task_nodes.status` は `not_started|in_progress|done|locked` を使用する。
- Users画面は以下を追加表示する。  
  - `llmUsage` 列  
  - `todoProgressRate` 列
- Dashboardは以下を追加表示する。  
  - `journey_task_completion_rate`（平均タスク完了率）  
  - `journey_dependency_block_rate`（依存ブロック率）
- LLM Policy運用は alias UI を採用する。  
  - `max_tokens` -> `max_output_tokens`  
  - `per_user_limit` -> `per_user_daily_limit`  
  - `rate_limit` -> `global_qps_limit`
- LLM Policy変更履歴 API を追加する。  
  - `GET /api/admin/os/llm-policy/history`

## Phase662 Add-only UI Contract（Journey DAG / LLM Policy拡張）
- Monitor pane に Journey DAG 運用セクションを追加する（既存paneを維持した add-only）。
  - Journey Map（runtime参照）
  - Rule Editor（catalog plan/set）
- Admin OS API（add-only）:
  - `GET /api/admin/os/journey-graph/status`
  - `POST /api/admin/os/journey-graph/plan`
  - `POST /api/admin/os/journey-graph/set`
  - `GET /api/admin/os/journey-graph/history`
  - `GET /api/admin/os/journey-graph/runtime`
  - `GET /api/admin/os/journey-graph/runtime/history`
- 配信反応 API（互換維持の add-only）:
  - `POST /api/phase37/deliveries/reaction-v2`
  - 既存 `mark-read/mark-click` は維持する。
- LLM Policy は以下を add-only で扱う。
  - `forbidden_domains`
  - `disclaimer_templates`
  - `output_constraints`

## Phase663 Add-only UI Contract（LINE Rich Menu運用）
- Rich Menu運用UIは `/admin/app?pane=monitor` に統合する（専用paneは追加しない）。
- monitor に以下を add-only で追加する。
  - template一覧（kind/status/target/richMenuId）
  - policy概要（enabled/updateEnabled/cooldown/maxApplies）
  - resolve-preview（対象ユーザー別）
  - plan/set（二段階確認）
  - history（run evidence）
- Admin OS API（add-only）:
  - `GET /api/admin/os/rich-menu/status`
  - `POST /api/admin/os/rich-menu/plan`
  - `POST /api/admin/os/rich-menu/set`
  - `GET /api/admin/os/rich-menu/history`
  - `POST /api/admin/os/rich-menu/resolve-preview`
- Safety:
  - writeは `planHash + confirmToken` 必須
  - 運用手順は `dry-run -> apply -> verify -> rollback`
  - 緊急停止は `opsConfig/richMenuPolicy.updateEnabled=false`

## Phase664 Add-only UI Contract（Journey Branching運用）
- Rule Editor は JSON編集を残しつつ、運用向けの quick editor を add-only で提供する。
  - Edge ON/OFF（`edge.required`）
  - reaction branch 行編集（`ruleSet.reactionBranches[]`）
  - plan unlock（`planUnlocks.free/pro.maxNextActions`）
- Admin OS API（add-only）:
  - `GET /api/admin/os/journey-graph/branch-queue/status`
- Internal Job API（add-only）:
  - `POST /internal/jobs/journey-branch-dispatch`
  - token guard: `JOURNEY_BRANCH_JOB_TOKEN`（header: `x-journey-branch-job-token` または Bearer）
- Safety:
  - 既存 `mark-read` / `mark-click` は互換維持
  - `reaction-v2` の branch反映は feature flag（`ENABLE_JOURNEY_BRANCH_QUEUE_V1`）で即時停止可能

## Phase665 Add-only UI Contract（Journey Param Versioning）
- monitor pane に Journey Param Console（versioned）を add-only で追加する。
- 強制フロー:
  - `plan(draft)` -> `validate` -> `dry-run` -> `apply`
  - rollback は `plan(action=rollback_plan)` -> `rollback`
- Admin OS API（add-only）:
  - `GET /api/admin/os/journey-param/status`
  - `POST /api/admin/os/journey-param/plan`
  - `POST /api/admin/os/journey-param/validate`
  - `POST /api/admin/os/journey-param/dry-run`
  - `POST /api/admin/os/journey-param/apply`
  - `POST /api/admin/os/journey-param/rollback`
  - `GET /api/admin/os/journey-param/history`
- Apply保護:
  - `planHash + confirmToken + latestDryRunHash` 一致を必須化する。
