# PHASE134_PLAN

## Purpose
traceId 1本で「view → submit → execute(試行) → trace bundle」を機械的に追えることを、ローカル/CIで再現可能に固定する。

## Scope In
- `tools/run_trace_smoke.js` を追加（in-memory stub DB で完走）
- `npm run test:trace-smoke` を追加
- 実行結果を `docs/TRACE_SMOKE_EVIDENCE.md` に append-only で追記できる

## Scope Out
- 実運用 Firestore への接続（emulator は将来拡張）
- LINE送信などの副作用（スモークは事実確認のみ）

## Done Definition
- `npm run test:trace-smoke` が exit code 0 で完走
- trace bundle に `audits/decisions/timeline` が揃うことを確認

## Rollback
- revert 実装PR
