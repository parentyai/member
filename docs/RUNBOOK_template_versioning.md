# RUNBOOK_template_versioning

## Purpose
templateKey + version でテンプレを固定し、plan/execute の再現性を確保する。

## Steps
1. `templates_v` に versioned template を作成する（status=active）。
2. plan で templateVersion が返ることを確認する。
3. execute は templateVersion 一致が必須であることを確認する。
4. audit_logs に templateVersion が保存されることを確認する。

## Rollback
- 実装PRを revert する。
