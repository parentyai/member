# PHASE127_PLAN

## Purpose
LINE-only 前提での「反応（read/open/click）」の運用定義を SSOT として固定し、Ops Console / Summary の表示を click 優先で一貫させる。

## Scope In
- docs に運用定義を明文化（`docs/SSOT_LINE_ONLY_DELTA.md`）
- user summary の `lastReactionAt` を click 優先で算出（`clickAt ?? readAt ?? null`）
- Ops UI 表示に「LINE-only 定義で見ている」旨の文言追加

## Scope Out
- read/open の新しい取得手段追加
- 既存APIキーの意味変更（add-only で対応）
- 自動判断ロジックへの組み込み

## Done Definition
- docs / code / test で定義が一致
- `npm test` PASS

## Rollback
- revert 実装PR

