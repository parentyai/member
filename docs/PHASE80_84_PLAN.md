# PHASE80_84_PLAN

## Purpose
Dry-run + confirmToken + signed cursor を固定し、execute の安全性と再現性を高める。

## Scope In
- Phase80: list cursor の signedCursor 追加 + cursor 검証。
- Phase81: dry-run endpoint + audit。
- Phase82: confirmToken による一致保証。
- Phase83: ops_readonly に dry-run→confirm→execute 導線。
- Phase84: docs/runbook。

## Scope Out
- 既存APIの意味変更・削除。
- 自動送信の既定ON化。

## APIs
- `POST /api/phase81/segment-send/dry-run`
- `POST /api/phase68/send/execute` (confirmToken optional)

## Done Definition
- signedCursor 生成/検証が追加される。
- dry-run が無副作用で audit に残る。
- confirmToken が mismatch を拒否する。
- ops_readonly が dry-run→execute の一本道を持つ。
- docs + tests が PASS。

## Rollback
- revert implementation PR
- revert CLOSE docs PR
