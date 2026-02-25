# SSOT_RETENTION

Retention 方針（add-only）。本ドキュメントは削除実行の承認文書ではなく、保持/削除判断の構造定義のみを扱う。

## Policy
- すべての削除系処理は `dry-run` から開始する。
- `audit_logs` は append-only、削除対象外。
- retention は以下の profile で明示する（Balanced）。
  - `event`: `180d`
  - `aggregate`: `90d`
  - `transient`: `30d`
  - `evidence`: `365d`
  - `config`: `INDEFINITE`
- `retention=UNDEFINED_IN_CODE` は運用上の未解消状態として扱い、実行時削除禁止。

## Collection Matrix

| collection | kind | retention_days | deletable | recomputable |
|---|---|---:|---|---|
| audit_logs | evidence | 365d | NO | NO |
| events | event | 180d | CONDITIONAL | YES |
| notification_deliveries | event | 180d | CONDITIONAL | YES |
| notifications | config | INDEFINITE | NO | NO |
| users | config | INDEFINITE | NO | NO |
| link_registry | config | INDEFINITE | NO | NO |
| rich_menu_templates | config | INDEFINITE | NO | NO |
| rich_menu_phase_profiles | config | INDEFINITE | NO | NO |
| rich_menu_assignment_rules | config | INDEFINITE | NO | NO |
| rich_menu_bindings | config | INDEFINITE | NO | NO |
| rich_menu_rollout_runs | evidence | 365d | NO | NO |
| rich_menu_rate_buckets | transient | 30d | CONDITIONAL | YES |
| city_packs | config | INDEFINITE | NO | NO |
| source_refs | config | INDEFINITE | NO | NO |
| source_evidence | config | INDEFINITE | NO | NO |
| city_pack_requests | config | INDEFINITE | NO | NO |
| city_pack_feedback | config | INDEFINITE | NO | NO |
| city_pack_bulletins | config | INDEFINITE | NO | NO |
| city_pack_update_proposals | config | INDEFINITE | NO | NO |
| ops_states | config | INDEFINITE | NO | NO |
| ops_state (legacy) | config | INDEFINITE | NO | NO |
| ops_read_model_snapshots | aggregate | 90d | CONDITIONAL | YES |
| source_audit_runs | transient | 30d | CONDITIONAL | YES |
| system_flags | config | INDEFINITE | NO | NO |

## Dry-run Job Contract
- Endpoint: `POST /internal/jobs/retention-dry-run`
- Guard: internal token required
- Behavior:
  - `dryRun=true` 固定
  - delete 実行なし
  - `audit_logs` に `retention.dry_run.execute` を追記
  - retention policy 未定義コレクションを受け取った場合は `422 retention_policy_undefined` で fail-closed
  - fail-closed時は `audit_logs` に `retention.dry_run.blocked` を追記

## Apply Job Contract (stg only / add-only)
- Endpoint: `POST /internal/jobs/retention-apply`
- Guard:
  - internal token required
  - `RETENTION_APPLY_ENABLED=1` が必須
  - `ENV_NAME in {stg,stage,staging}` のみ実行可
- Behavior:
  - `dryRunTraceId`（任意）指定時は `retention.dry_run.execute` の監査存在を照合
  - `maxDeletes`（任意）で削除件数の上限を制御
  - `cursor`（任意）でコレクション単位の段階実行を許可
  - `deletable=NO` は常に除外
  - `recomputable=true` のみ削除候補
  - policy 未定義コレクションが含まれる場合は `422 retention_policy_undefined`
  - `dryRunTraceId` 不一致時は `422 retention_apply_dry_run_trace_not_found`
  - 実行可能対象が0件の場合は `409 retention_apply_no_eligible_collections`
  - 実行結果を `audit_logs` の `retention.apply.execute|blocked` に追記（`deletedCount`, `sampleDeletedIds`, `traceId` を含む）

## Policy Source (Add-only)
- 実行時ポリシー定義: `src/domain/retention/retentionPolicy.js`
- 監査入力との突合基準: `docs/REPO_AUDIT_INPUTS/data_lifecycle.json`
- coverage: 62 collections（2026-02-25 時点）
