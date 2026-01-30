# Guardrails Phase5

## Allowed
- Phase4 設計で明示された項目のみ実装
- READ ONLY 集計・表示の追加
- 人間判断の補助のみ（自動判断なし）

## Forbidden
- 自動判断・最適化・推定
- 新仕様の提案
- Phase4 以前の挙動変更
- 書き込み系 API 追加
- 迷った場合の自己判断（必ず STOP）

## Execution Rules
- 1 PR = 1 Task ID（P5-xxx）
- 次タスクは人間の GO が必要
- docs-only / impl-only を混ぜない
