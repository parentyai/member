# SSOT_RETENTION

Retention 方針（add-only）。本ドキュメントは削除実行の承認文書ではなく、保持/削除判断の構造定義のみを扱う。

## Policy
- すべての削除系処理は `dry-run` から開始する。
- `audit_logs` は append-only、削除対象外。
- retention 未定義のコレクションは `UNDEFINED` と明示し、実行時削除禁止。

## Collection Matrix

| collection | kind | retention_days | deletable | recomputable |
|---|---|---:|---|---|
| audit_logs | evidence | UNDEFINED | NO | NO |
| events | event | UNDEFINED | CONDITIONAL | YES |
| notification_deliveries | event | UNDEFINED | CONDITIONAL | YES |
| notifications | config | UNDEFINED | NO | NO |
| users | config | UNDEFINED | NO | NO |
| link_registry | config | UNDEFINED | NO | NO |
| city_packs | config | UNDEFINED | NO | NO |
| source_refs | config | 120d validity (field-level) | CONDITIONAL | NO |
| source_evidence | evidence | UNDEFINED | NO | NO |
| city_pack_requests | event | UNDEFINED | CONDITIONAL | NO |
| city_pack_feedback | event | UNDEFINED | CONDITIONAL | NO |
| city_pack_bulletins | event | UNDEFINED | CONDITIONAL | YES |
| city_pack_update_proposals | event | UNDEFINED | CONDITIONAL | YES |
| ops_states | config | UNDEFINED | NO | NO |
| ops_state (legacy) | config | UNDEFINED | NO | NO |
| system_flags | config | UNDEFINED | NO | NO |

## Dry-run Job Contract
- Endpoint: `POST /internal/jobs/retention-dry-run`
- Guard: internal token required
- Behavior:
  - `dryRun=true` 固定
  - delete 実行なし
  - `audit_logs` に `retention.dry_run.execute` を追記
