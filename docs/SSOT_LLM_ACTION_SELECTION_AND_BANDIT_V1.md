# SSOT_LLM_ACTION_SELECTION_AND_BANDIT_V1

## Scope
- add-only 仕様。
- 決定は非LLM、LLMはレンダリングのみ。
- 対象: P2(ActionSelector UX-1), P3(ε-greedy bandit)。

## ActionSelector (UX-1)
- 入力: `mode/topic/tier`, `conversation confidence`, `styleDecision`, `journeyPhase`, `riskBucket`。
- arm定義: `styleId x ctaCount`。
- 選択順序:
  1. deterministic scoring
  2. `llmBanditEnabled=true` の場合のみ ε-greedy で上書き
- `chosenAction` 必須キー:
  - `armId`
  - `styleId`
  - `ctaCount`
  - `questionFlag`
  - `lengthBucket`
  - `timingBucket`
  - `selectionSource` (`score|bandit_explore|bandit_exploit`)
  - `score`
  - `scoreBreakdown`

## Bandit (P3)
- `epsilon=0.1`（初期固定）。
- segment: `journeyPhase x tier x riskBucket`。
- state保存先: `llm_bandit_state`。
- stateキー:
  - `segmentKey`
  - `armId`
  - `pulls`
  - `totalReward`
  - `avgReward`
  - `epsilon`
  - `version=v1`

## Action Logs
- collection: `llm_action_logs`。
- 初期保存は `rewardPending=true`。
- 必須監査キー:
  - `traceId/requestId/lineUserId`
  - `contextVersion` (`concierge_ctx_v1`)
  - `featureHash`
  - `segmentKey`
  - `mode/topic/tier`
  - `conversationState/conversationMove`
  - `chosenAction`
  - `selectionSource`
  - `score/scoreBreakdown`
  - `evidenceNeed/evidenceOutcome`
  - `urlCount/citationRanks`
  - `blockedReasons/injectionFindings/postRenderLint`

## Reward Finalization
- internal job: `POST /internal/jobs/llm-action-reward-finalize`
- token: `LLM_ACTION_JOB_TOKEN`
- default window: `48h`
- reward weights (Balanced):
  - `click=+1`
  - `task_complete=+3`
  - `blocked_resolved=+2`
  - `citation_missing=-3`
  - `wrong_evidence=-5`
- `llmBanditEnabled=false` のログは bandit state 更新を実施しない。

## Layer Flags
- `llmWebSearchEnabled` (default true)
- `llmStyleEngineEnabled` (default true)
- `llmBanditEnabled` (default false)
- 既存 `llmEnabled/llmConciergeEnabled` の意味は変更しない。
