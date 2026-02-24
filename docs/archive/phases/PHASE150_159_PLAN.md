# PHASE150_159_PLAN

## Purpose
運用直前の仕上げとして「迷わず・壊れず・止められる」を固定する。Runbook/Smoke/Checklist を add-only で追加し、CI で毎回 traceId 監査スモーク（副作用ゼロ）を再現可能にする。

## Scope In
- Runbook（STOP判断/trace検索/復旧）を `docs/RUNBOOK_OPS.md` に固定
- Dry-run の Ops Smoke（traceId 生成→view/decision/execute の監査連結）を `tools/run_ops_smoke.js` として追加
- main push 時のみ `npm run test:ops-smoke` を CI に追加（副作用ゼロ）
- Ops UI（表示のみ）に stopReason を追加
- Launch checklist を `docs/LAUNCH_CHECKLIST.md` に追加

## Scope Out
- 新しい自動判断ロジック
- 自動送信/自動実行
- 既存APIレスポンスの意味変更（add-only のみ）

## Done Definition
- `npm test` PASS
- `npm run test:ops-smoke` PASS（副作用ゼロ）
- main CI（member/track）success

## Rollback
- revert Phase150–159 実装PR

