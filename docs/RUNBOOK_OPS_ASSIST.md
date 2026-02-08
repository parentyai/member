# RUNBOOK_OPS_ASSIST

## Purpose
Ops Assist の提案を「読む→採用→submit→監査」まで一貫して運用する。

## Steps
1. Ops Console detail を開き、suggestion/evidence/safety を確認する
2. Safety が BLOCK の場合は採用せず、手動で判断する
3. 問題なければ「Use Suggestion」で nextAction をセットする
4. submit を実行し、decisionLogId を確認する
5. 採用監査（LLM_SUGGESTION_ADOPTED）が残っていることを確認する

## Notes
- LLM は disabled by default（rule-based fallback）
- 自動実行は禁止（提案は人間が採用する）
