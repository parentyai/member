# RUNBOOK_dryrun_execute_flow

## Purpose
Dry-run → confirmToken → execute の安全な一本道を運用で固定する。

## Steps
1. dry-run API を実行し planHash / confirmToken を取得する。
2. confirmToken がある状態で execute を実行する。
3. mismatch の場合は 409 を返すため再度 dry-run を行う。
4. audit_logs の dry_run/execute を確認する。

## Rollback
- 実装PRを revert する。
