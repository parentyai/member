# PHASE132_PLAN

## Purpose
Kill Switch を実行経路（Phase33 execute）で強制し、送信副作用（特に STOP_AND_ESCALATE）を確実に止める。また traceId を欠損させず view/submit/execute の監査連結を固定する。

## Scope In
- execute で kill switch を参照し、送信副作用をブロック
- execute の traceId を payload→decision audit→生成 の順で必ず補完
- audit_logs に execute の監査イベントを best-effort 追記（add-only）
- /admin/ops が x-actor を送る（actor=unknown 回避）

## Scope Out
- 既存APIレスポンスの意味変更（add-only のみ）
- LLM の実行/自動運用

## Done Definition
- kill switch ON で STOP_AND_ESCALATE が送信しない（テスト）
- execute が traceId を必ず残す（テスト）
- npm test PASS

## Rollback
- revert Phase132 実装PR
