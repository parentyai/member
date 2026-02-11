# SSOT_SERVICE_PHASES

本ドキュメントは「開発Phase（PHASExxx）」とは別物として、**サービス提供phase（ServicePhase: 1〜4）**を SSOT の最上位概念として定義する。

## Naming / Non-Goals
- ServicePhase は「プロダクトが提供する機能解禁の段階」を示す（運用/契約/提供範囲の概念）。
- PHASExxx は「開発・実装フェーズ」を示す（リポジトリの変更単位の概念）。
- 本ドキュメントは **実装挙動を即時に変更しない**（add-only の概念追加・整合が目的）。

## SSOT Keys (Config)
ServicePhase は運用設定として保持する（add-only）。

- Firestore: `system_flags/phase0`
  - `servicePhase`: number | null（1〜4）
  - `notificationCaps.perUserWeeklyCap`: number | null（user単位/7日）
  - `notificationCaps.perUserDailyCap`: number | null（user単位/24時間）
  - `notificationCaps.perCategoryWeeklyCap`: number | null（user+category単位/7日）
  - `notificationCaps.quietHours`: `{ startHourUtc, endHourUtc } | null`（UTC静穏時間）

未設定（null）の場合は **現状挙動を維持**し、解禁判定に利用しない。

## ServicePhase Definitions

### ServicePhase 1: リダッククラブ基礎
- scope:
  - member 管理 / benefit 管理
  - 通知（お知らせ / AB / リンク）
- guardrails:
  - **通知頻度抑制が最優先**
  - Kill Switch を常に尊重（送信副作用を止められる）

### ServicePhase 2: リダッククラブ拡張
- scope:
  - 属性/嗜好管理
  - プリセットステップ / City Pack
  - やや強め通知（ただし上限は必ず守る）
- guardrails:
  - 断定不能領域は必ず「確認する」導線（人間判断）
  - 既存の運用安全（traceId / audit）を退行させない

### ServicePhase 3: リダッククラブ活用
- scope:
  - パーソナライズ（通知/情報/提案の出し分け）
- guardrails:
  - 決定論優先
  - LLM は「文面整形/提案」に限定（副作用ゼロ）

### ServicePhase 4: 有料化
- scope:
  - LLM 強化（提案の質向上）
  - 最適化 / その他高付加価値
- guardrails:
  - 課金境界・監査・安全停止を最優先
  - 送信系は Kill Switch を必ず参照

## Admin UI / Operations OS
ServicePhase の運用要件（管理UI成熟度 / 運用OS v1〜v4）は以下で固定する。

- `docs/SSOT_ADMIN_UI_OS.md`
