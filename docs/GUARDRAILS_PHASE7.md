# Guardrails Phase7

## Allowed
- docs/ の新規作成・追記（Phase7 PREPAREのみ）
- Phase7 の設計整理（判断項目の列挙）

## Forbidden
- 実装コードの変更（src/, apps/, scripts/, tests/, package.json など）
- 新規API / UI / Data の設計追加
- Phase0-Phase6 の再解釈・修正
- 推測による補完（不明は UNKNOWN）

## Process
- Phase7 PREPARE は docs-only PR のみ
- PR = 1 Task ID
- Evidence は事実のみ（PR/日付/リンク）

## Rollback
- docs-only PR は revert のみ
