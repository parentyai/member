# Guardrails Phase6

## Allowed
- docs/ と TODO_*.md の更新（Prepare期間）
- Phase6 の設計文書作成（docs-only）

## Forbidden
- 実装コードの変更（src/, apps/, scripts/, tests/, package.json など）
- 新しい entrypoint の追加（src/index.js 以外で listen しない）
- Phase0〜Phase5 の SSOT/Acceptance/Playbook/Runbook の改変
- 推測でのEvidence記載（不明は UNKNOWN とする）

## Process
- Prepare期間は docs-only PR のみ
- PR = 1 Task ID
- Evidence は事実のみ（PR/コマンド出力/日付）

## Rollback
- docs-only PR は revert のみ
