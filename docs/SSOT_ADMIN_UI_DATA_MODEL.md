# SSOT_ADMIN_UI_DATA_MODEL

管理UI（運用OS）が編集/参照するデータモデルを SSOT として固定する（add-only）。

## Entities (Editable)
ServicePhase1（運用OS v1）で UI から扱う編集対象。

- `notifications`（draft → approve → send）
  - `notificationCategory`（SSOTカテゴリ: DEADLINE_REQUIRED / IMMEDIATE_ACTION / SEQUENCE_GUIDANCE / TARGETED_ONLY / COMPLETION_CONFIRMATION）
- `notification_deliveries`（SSOT: 反応/配信の source of truth。UIは参照のみ）
- `notification_templates` / `templates_v`（template management）
- `link_registry`（リンクの登録/health 管理）
- `system_flags/phase0`（kill switch / servicePhase / notificationPreset など）
  - `notificationCaps.perUserWeeklyCap`（number | null）
  - `notificationCaps.perUserDailyCap`（number | null）
  - `notificationCaps.perCategoryWeeklyCap`（number | null）
  - `notificationCaps.quietHours`（object | null, UTC）
  - `deliveryCountLegacyFallback`（boolean, default true）
- `send_retry_queue`（失敗送信の再実行キュー）

## Read Model (View only)
- `notification_read_model`（通知集計の参照専用）
  - `waitRuleType`（TYPE_A / TYPE_B / TYPE_C）
  - `waitRuleConfigured`（boolean）
  - `nextWaitDays`（number | null）
  - `nextWaitDaysSource`（`ssot_value` / `ssot_unset`）

## Draft / Active Rules (SSOT)
- Active（承認済み）の編集は禁止
  - 更新が必要な場合は draft を新規作成 → approve の一本道
- 送信は plan → execute の2段階
  - execute は planHash + confirm token 必須
- kill switch の切替は plan → set の2段階
  - set は confirm token 必須

## Traceability (SSOT)
- UI は `x-actor` を必ず送る
- API は `traceId` を受け取り、欠損時は生成して audit_logs / decision_logs / timeline に保存する
- Trace Search（/api/admin/trace）で traceId 1本から audits / decisions / timeline が再現できる

## NotificationPreset / ServicePhase
ServicePhase は機能解禁の上位概念であり、Preset は “出し方/順序/強さ” を規定する（上限解除は禁止）。
詳細は以下。

- `docs/SSOT_SERVICE_PHASES.md`
- `docs/SSOT_NOTIFICATION_PRESETS.md`
- `docs/SSOT_SERVICE_PHASE_X_PRESET_MATRIX.md`
