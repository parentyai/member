# RUNBOOK_OPS_ASSIST

## Purpose
Ops Assist / Automation を「迷わず回せる一本道」に固定する。

## Steps
1. Ops Console list を確認（READY優先）。
2. detail を確認（readiness / opsState / executionStatus / suggestedTemplateKey）。
3. automation dry-run を実行（影響の確認）。
4. automation execute は config enabled + confirmation を満たす時のみ実行。
5. decision log / timeline / postCheck を確認。
6. 必要なら通知テンプレを選定し送信（自動送信はOFF）。

## Notes
- LLMは助言のみ。判断・実行は人間。
- 推定は UNKNOWN/WARN を返す。
