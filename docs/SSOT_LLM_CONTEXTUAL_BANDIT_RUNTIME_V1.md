# SSOT_LLM_CONTEXTUAL_BANDIT_RUNTIME_V1

目的: 既存の ε-greedy bandit に contextual overlay を add-only で導入し、
安全契約を維持したまま「同一文脈で有効だった腕」を優先できる実行契約を定義する。

## 1. 安全境界（固定）
- Mode/Tier/URL/Injection/直URL禁止の契約は不変。
- bandit は会話スタイル選択のみ対象。意思決定規則を上書きしない。
- contextual state が欠損時は既存 global bandit / score にフォールバックする。

## 2. Context Signature
- 署名キー: `contextSignature`。
- 生成は bucketed feature のみを利用し、本文全文を利用しない。
- 形式: `ctxsig_v1_<hash>`。

利用特徴量（抜粋）:
- `journeyPhase`
- `tier`
- `mode/topic`
- `riskBucket`
- `evidenceNeed`
- `intentConfidenceBucket/contextConfidenceBucket`
- `taskLoadBucket`
- `lengthBucket/timingBucket`
- `questionFlag`

## 3. 選択ロジック
1. 候補アームを deterministic score で生成。
2. `contextualStateByArm` がある場合は exploit 推定に優先利用。
3. ない場合は `stateByArm` を利用。
4. どちらもない場合は score フォールバック。

監査ソース値:
- `bandit_contextual_exploit`
- `bandit_contextual_explore`
- 既存: `bandit_exploit|bandit_explore|score`

## 4. Firestore add-only
新規 collection:
- `llm_contextual_bandit_state`

必須キー:
- `segmentKey`
- `contextSignature`
- `armId`
- `pulls`
- `totalReward`
- `avgReward`
- `epsilon`
- `version`
- `updatedAt`

## 5. Reward finalize 更新
- `llm_action_logs` の `contextualBanditEnabled=true` かつ `contextSignature` がある場合のみ、
  `llm_contextual_bandit_state` を更新する。
- 既存 `llm_bandit_state` 更新は従来どおり継続。

## 6. ロールバック
- 最小: `llmBanditEnabled=false`。
- 既存と同様に `llmStyleEngineEnabled=false` / `llmWebSearchEnabled=false` を併用可。
- 完全: PR revert（add-only）。
