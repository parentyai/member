# SSOT_ADMIN_UI_OS

管理UIを「運用OS」として定義し、**人間Opsが UI だけで自走できる**ことを SSOT として固定する。

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

- `/admin/ops`（Ops Console / Trace Search / Segment Send / Retry Queue / Operations）
- `/admin/composer`（Notification Composer）
- `/admin/monitor`（Delivery Monitor）
- `/admin/errors`（Error Console）
- `/admin/master`（Master Data）

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

