# SSOT_NOTIFICATION_PRESETS

本ドキュメントは「通知プリセット（NotificationPreset: A/B/C）」を SSOT の最上位概念として定義する。
ServicePhase が「何ができるか（機能解禁）」の上位であり、Preset は **“出し方/順序/強さ”**のみを規定する。

## Naming / Non-Goals
- NotificationPreset は **運用の強さ**（通知の順序・補助・強調の度合い）を表す。
- Preset は「送信自動化の許可」ではない（自動実行は禁止）。
- 既存の API/データの意味は変更しない（add-only）。

## SSOT Keys (Config)
- Firestore: `system_flags/phase0`
  - `notificationPreset`: string | null（"A" | "B" | "C"）
  - `notificationCaps.perUserWeeklyCap`: number | null（user単位/7日）
  - `notificationCaps.perUserDailyCap`: number | null（user単位/24時間）
  - `notificationCaps.perCategoryWeeklyCap`: number | null（user+category単位/7日）
  - `notificationCaps.quietHours`: `{ startHourUtc, endHourUtc } | null`（UTC静穏時間）

未設定（null）の場合は **現状挙動を維持**し、Preset による出し分けを行わない。

## Global Guardrails (Always On)
Preset に関わらず、以下は常に最優先で守る。

- Kill Switch は送信副作用を確実に止める（送信経路が増えても参照を必須にする）
- traceId は view → suggest → decision → execute/stop を貫通（監査可能性を退行させない）
- 「通知出しすぎない」ガードを最優先（Preset が強くても **グローバル上限を超えない**）

## Notification Categories (SSOT)
Preset/ServicePhase のマトリクスで扱うカテゴリ（既存の通知種別の意味変更はしない）。

- Deadline Required（期限必須）
- Immediate Action（即行動）
- Sequence Guidance（順序案内 / Blocked 補助）
- Targeted Only（該当者限定）
- Completion Confirmation（完了確認）

## Presets

### Preset A (Minimal)
- intent: 期限必須 / 即死回避中心。補助は最小。
- intensity: LOW
- notes:
  - 「確認」導線を優先（断定しない）

### Preset B (Balanced)
- intent: 順序案内 / Blocked 補助を追加。
- intensity: MEDIUM
- notes:
  - 送信量は増やし得るが、グローバル上限を必ず尊重

### Preset C (Drive)
- intent: 該当者限定 / 完了確認も強め。遅延対策も積極。
- intensity: MEDIUM〜HIGH（ただしグローバル上限を超えない）
- notes:
  - 強めに見せるが、実行主体は人間 Ops
