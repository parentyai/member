# SSOT_LLM_COUNTERFACTUAL_EVALUATION_V1

目的: P5(UX-4)として、counterfactual観測を「推定可能で再現可能な監査キー」に固定し、
style選択の改善余地を運用で追跡できるようにする。

## 1. 安全境界（不変）
- 意思決定は非LLM、LLMは文章化のみ。
- Mode/Tier/URL/Injection/直URL禁止/fail-closed の契約は不変。
- counterfactual評価は観測用途。安全ガードを上書きしない。

## 2. Counterfactual Eval 定義
`counterfactualEval` は add-only で次を保持する。
- `version` (`v1`)
- `eligible` (bool)
- `selectedArmId`
- `selectedRank`
- `bestArmId`
- `bestScore`
- `selectedScore`
- `scoreGap`
- `minGap` (default `0.12`)
- `opportunityDetected` (bool)

判定ルール(v1):
1. `eligible=true` は `selectedArmId` と `topArms(>=2)` が揃う時のみ。
2. `opportunityDetected=true` は以下を同時に満たす時のみ。
   - `selectedRank > 1`
   - `scoreGap >= minGap`

## 3. 監査/保存契約
- `llm_gate.decision.payloadSummary.counterfactualEval` に保存。
- `llm_action_logs.counterfactualEval` に保存。
- reward finalize は `counterfactualEval` を再計算して `llm_action_logs` に確定保存し、
  バッチ結果に `counterfactualEvaluated` / `counterfactualOpportunityDetected` を含める。

## 4. 運用上の見方
- `opportunityDetected` が高止まりするセグメントは style選択改善対象。
- `wrong_evidence` と併発する場合は安全優先で `llmBanditEnabled=false` を先に検討。

## 5. ロールバック
- 最小: `llmBanditEnabled=false`。
- 観測のみ停止: reward finalize job の実行停止。
- 完全: PR revert（add-only）。
