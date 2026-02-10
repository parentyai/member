# PHASE160_PLAN

## Purpose
ServicePhase（サービス提供phase: 1〜4）と NotificationPreset（A/B/C）を SSOT の最上位概念として定義し、既存仕様/実装/運用を壊さず（意味変更禁止・add-only）に整合させる。

## Scope In (add-only)
- SSOT docs を追加
  - `docs/SSOT_SERVICE_PHASES.md`
  - `docs/SSOT_NOTIFICATION_PRESETS.md`
  - `docs/SSOT_SERVICE_PHASE_X_PRESET_MATRIX.md`
  - `docs/SSOT_INDEX.md` に導線追記（append-only）
- Config の保持（Firestore add-only）
  - `system_flags/phase0` に `servicePhase` / `notificationPreset` を保持できる形を追加
- Usecase/UI の最小フック（現状挙動維持）
  - `/api/phase25/ops/console` に `servicePhase` / `notificationPreset` を add-only で返す（best-effort）
  - `apps/admin/ops_readonly.html` に表示追加（表示のみ）
- テスト追加
  - docs 存在 + 必須文字列
  - config 未設定時に現状挙動（null）であること

## Scope Out
- 既存 API/レスポンスの意味変更
- 通知頻度上限/ガードの仕様変更（Preset で上限を解除しない）
- 自動送信/自動実行/LLM 実行主体化

## Done Definition
- `npm test` PASS
- SSOT docs 3ファイル + SSOT_INDEX 導線追記が main に存在
- config 未設定でも既存挙動が維持される（テスト）

## Rollback
- revert Phase160 実装PR

