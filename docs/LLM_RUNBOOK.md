# LLM_RUNBOOK

## Purpose
LLM 統合機能を advisory-only のまま安全に運用する。

## Stop / Start
1. LLM 機能停止: `LLM_FEATURE_FLAG=false` を設定してデプロイする。
2. LLM 機能再開: `LLM_FEATURE_FLAG=true` を設定してデプロイする。
3. 停止後の確認: API が fallback を返すことを確認する。

## Audit / Trace
- audit_logs に以下の eventType が残ることを確認する。
  - `LLM_EXPLANATION`
  - `LLM_NEXT_ACTION_CANDIDATES`
  - `LLM_FAQ_ANSWER`
- traceId で追跡する場合は `/api/admin/trace?traceId=...` を使用する。

## Failure Modes
- schema mismatch / citation mismatch / allow-list violation => fallback へ退避。
- provider timeout / error => fallback へ退避。

## Notes
- killSwitch は LINE 送信停止用。LLM 停止は `LLM_FEATURE_FLAG`。
- LLM は read-only / advisory-only。Firestore への自動書き込みや運用確定は禁止。
