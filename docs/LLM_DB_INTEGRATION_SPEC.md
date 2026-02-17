# LLM_DB_INTEGRATION_SPEC

## 目的
- LLM を read-only intelligence layer として運用し、既存の決定論レイヤを壊さずに FAQ / Ops説明 / NextAction 候補を提供する。

## 非目的
- LLM による自動実行・自動判断・Firestore 書き込み起点。
- killSwitch を LLM 停止スイッチへ流用。

## 境界（固定）
- advisory-only: LLM 出力は提案のみ。
- fail-closed: 以下は BLOCK。
  - llmEnabled=false
  - LLM_FEATURE_FLAG=false
  - citations 0 件（FAQ）
  - KB 候補 0 件（FAQ）
  - 直 URL 混入
  - WARN link 混入
  - Allow-list 違反
- 直 URL 禁止。リンクは `linkRegistryId` のみ返却。

## 用途別 I/O

### FAQ（KB 限定）
- Input: `question`, `locale`, `intent`, `kbCandidates[]`
- Output: `FAQAnswer.v1`
- 必須: citations >= 1
- 禁止: KB 外根拠、direct URL

### Ops 説明（READ ONLY）
- Input: ops console snapshot の allow-list view
- Output: `OpsExplanation.v1`
- 必須: advisoryOnly=true

### NextAction 候補（抽象カテゴリ）
- Input: readiness/constraints 等の allow-list view
- Output: `NextActionCandidates.v1`
- action enum: `MONITOR|REVIEW|ESCALATE|DEFER|NO_ACTION`

## 有効化条件（二重ゲート）
- `system_flags.phase0.llmEnabled === true`
- `LLM_FEATURE_FLAG` が truthy
- 上記の両方が true の場合のみ LLM 呼び出し可。

## 監査イベント
- `llm_faq_answer_generated`
- `llm_faq_answer_blocked`
- `llm_ops_explain_generated`
- `llm_ops_explain_blocked`
- `llm_next_actions_generated`
- `llm_next_actions_blocked`

必須監査フィールド:
- `traceId`, `purpose`, `llmEnabled`, `envLlmFeatureFlag`, `schemaId`
- `blockedReason` (BLOCK 時)
- `inputFieldCategoriesUsed` (Public/Internal/Restricted/Secret)
- `inputHash`, `outputHash`

## 互換 API ポリシー
- `POST /api/phaseLLM4/faq/answer` は互換維持（deprecated）。
- 実処理は `POST /api/admin/llm/faq/answer` と同一 usecase に委譲する。
