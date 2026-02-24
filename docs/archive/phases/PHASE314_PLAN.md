# PHASE314_PLAN

## 目的
Retention apply を dry-run 照合 + 段階実行（`maxDeletes`/`cursor`）で安全運用可能にする。

## スコープ
- `src/routes/internal/retentionApplyJob.js`
- `docs/SSOT_RETENTION.md`（add-only）
- `docs/RUNBOOK_RETENTION_APPLY.md`（add-only）
- `tests/phase314/*`（新規）

## 受入条件
- `dryRunTraceId` 指定時に dry-run 監査照合を実施。
- `maxDeletes` と `cursor` で段階適用可能。
- `deletable=NO` / `recomputable=false` の削除禁止を維持。
