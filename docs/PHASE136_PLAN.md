# PHASE136_PLAN

## Purpose
trace smoke を「回って当然」にするため、CIで `npm run test:trace-smoke` を必須化する（コード側で落ちる仕組み）。

## Scope In
- GitHub Actions workflow（member）に trace smoke step を add-only で追加

## Scope Out
- リポ設定（required checks の設定変更）
- track workflow の変更（不要）

## Done Definition
- CIの dry-run で `npm run test:trace-smoke` が実行される

## Rollback
- revert 実装PR
