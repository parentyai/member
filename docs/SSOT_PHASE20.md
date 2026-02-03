# SSOT Phase20

## 目的
- 反復速度を最大化しつつ、既存ガードレールに整合する実験ループを固定する

## 対象（IN SCOPE）
- 1PR=1仮説の実験運用
- 事実ログの収集と記録
- 失敗時のrevert運用

## 非対象（OUT OF SCOPE）
- 仕様変更
- 判断ロジックの追加
- 既存フェーズの再解釈
- 実装の混在（docs-only / scripts-only / code-only の分離は維持）

## 実験ループ規約
- 1PR=1仮説
- 計測は事実のみ（評価・結論は別PR）
- scripts-only / docs-only / code-only を混ぜない

## ロールバック規約
- 失敗時は当該PRをrevertのみ

