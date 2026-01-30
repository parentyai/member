# SSOT Phase5 (v0.1)

## Purpose
- Phase4 で固定された設計を、忠実・最小・非拡張で実装する
- 人間運用を壊さず、運用補助を増やす

## Scope (ALLOWLIST)
- Phase4 で明示的に実装許可された項目のみ
- 既存データの集計・表示（READ ONLY）
- UI へのデータ反映（READ ONLY / WRITE 明示ありの場合のみ）

## Non-Goals
- 新仕様の提案
- 自動判断・最適化・推定
- 既存フェーズの挙動変更
- 書き込み系 API 追加

## Implementation Order (Fixed)
1. P5-001: Phase5 Bootstrap（SSOT / Acceptance / TODO / Guard）
2. P5-101: 状態の可視化（READ ONLY、既存データのみ）
3. P5-102: Ops 向け READ ONLY 拡張（フィルタ・期間指定、閲覧のみ）
4. P5-103: 人間判断トリガ（表示 or ログのみ、通知なし）
5. P5-104: 運用確認用メタ情報（人間操作のみ、手動更新）

## Guardrails (Phase5)
- 自動化・最適化・AI 判断は禁止
- Phase4 以前の挙動変更は禁止
- 書き込み系 API の追加は禁止
- 迷ったら STOP → 報告

## Human Decision Gate
- 次タスクに進む前に、人間の GO を得る
- 1 PR = 1 Task ID（P5-xxx）
