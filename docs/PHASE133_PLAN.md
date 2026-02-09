# PHASE133_PLAN

## Purpose
traceId を1つ指定すれば、関連する audit_logs / decision_logs / decision_timeline を取得できる最短サーフェス（監査人向け）を add-only で提供する。

## Scope In
- GET /api/admin/trace?traceId=... を追加
- /admin/ops に Trace Search UI を追加（表示のみ）

## Scope Out
- 認証設計の刷新
- DBインデックス最適化

## Done Definition
- /api/admin/trace が audits/decisions/timeline を返す（テスト）
- npm test PASS

## Rollback
- revert Phase133 実装PR
