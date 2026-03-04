# SSOT_LLM_CONTEXTUAL_SIGNAL_AND_COUNTERFACTUAL_V1

目的: LLMコンシェルジュの行動選択を将来の contextual bandit に拡張するため、
現行の安全契約を維持したまま「説明可能な特徴量」と「反実仮想スナップショット」を add-only で監査保存する。

## 1. 安全境界（固定）
- 決定主体は非LLM（policy/rule/guard）。
- LLMは文章化のみ。
- URL表示契約（`(source: domain/path)`）を変更しない。
- 直URL禁止・Mode/Tier制約・fail-closed・注入耐性を変更しない。

## 2. 追加監査キー（add-only）
`llm_gate.decision.payloadSummary` と `llm_action_logs` に次を追加する。

### 2.1 `contextualFeatures`
- `featureVersion` (`bandit_ctx_v1`)
- `journeyPhase`
- `tier`
- `mode`
- `topic`
- `riskBucket`
- `evidenceNeed`
- `styleId`
- `ctaCount`
- `lengthBucket`
- `timingBucket`
- `questionFlag`
- `intentConfidence`, `contextConfidence`
- `intentConfidenceBucket`, `contextConfidenceBucket`
- `taskLoadBucket`
- `topTaskCount`
- `blockedTaskPresent`, `dueSoonTaskPresent`

### 2.2 counterfactual snapshot
- `counterfactualSelectedArmId`
- `counterfactualSelectedRank`
- `counterfactualTopArms[]`
  - `rank`
  - `armId`
  - `styleId`
  - `ctaCount`
  - `score`

## 3. 運用ルール
- 反実仮想は「監査/評価用」であり、ユーザー返信を上書きしない。
- `counterfactualTopArms` は最大3（保存上限は5まで許容）とする。
- `contextualFeatures` は粗いバケット値のみを保存し、本文全文は保存しない。

## 4. 監査質問（運用者向け）
1. なぜこの行動（style/cta）になったか。  
   - `chosenAction` と `contextualFeatures` を確認。
2. ほかの手札ならどうなったか。  
   - `counterfactualTopArms` と `counterfactualSelectedRank` を確認。
3. 安全境界は守られたか。  
   - `mode/topic/urlCount/citationRanks/injectionFindings/postRenderLint` を確認。

## 5. ロールバック
- 最小: `llmBanditEnabled=false`（選択を deterministic score に固定）。
- 部分: `llmStyleEngineEnabled=false`, `llmWebSearchEnabled=false`。
- 全体: `llmConciergeEnabled=false`。
- 完全巻き戻し: 本差分PRを `revert`（add-only）。
