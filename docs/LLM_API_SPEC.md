# LLM_API_SPEC

## Admin (Read-only)

### GET /api/phaseLLM2/ops-explain
- Purpose: Provide an advisory-only explanation of current ops state.
- Auth: admin UI with `x-actor` header (read-only).
- Feature gate: `system_flags.phase0.llmEnabled === true` and `LLM_FEATURE_FLAG === true`. Otherwise fallback is returned.

#### Query
- `lineUserId` (required)

#### Response (200)
```json
{
  "ok": true,
  "lineUserId": "Uxxx",
  "serverTime": "2026-02-16T00:00:00.000Z",
  "explanation": { "schemaId": "OpsExplanation.v1", "generatedAt": "...", "advisoryOnly": true, "facts": [], "interpretations": [] },
  "llmUsed": false,
  "llmStatus": "disabled",
  "llmModel": null,
  "disclaimerVersion": "ops_disclaimer_v1",
  "disclaimer": "提案です。自動実行は行いません。最終判断は運用担当が行ってください。",
  "opsTemplate": {
    "templateVersion": "ops_template_v1",
    "currentState": {},
    "recentDiff": {},
    "missingItems": [],
    "timelineSummary": {},
    "proposal": {}
  },
  "schemaErrors": null,
  "auditId": "audit-xxx"
}
```

#### Errors
- 400: `lineUserId required`
- 500: `error`

#### Notes
- LLM output is advisory-only and validated against OpsExplanation.v1.
- Direct URL output is forbidden in LLM layer (enforced in schema validators for FAQ; OpsExplanation is facts/interpretations only).

### GET /api/phaseLLM3/ops-next-actions
- Purpose: Provide abstract next action candidates (advisory-only).
- Auth: admin UI with `x-actor` header (read-only).
- Feature gate: `system_flags.phase0.llmEnabled === true` and `LLM_FEATURE_FLAG === true`. Otherwise fallback is returned.

#### Query
- `lineUserId` (required)

#### Response (200)
```json
{
  "ok": true,
  "lineUserId": "Uxxx",
  "serverTime": "2026-02-16T00:00:00.000Z",
  "nextActionCandidates": {
    "schemaId": "NextActionCandidates.v1",
    "generatedAt": "...",
    "advisoryOnly": true,
    "candidates": []
  },
  "llmUsed": false,
  "llmStatus": "disabled",
  "llmModel": null,
  "disclaimerVersion": "next_actions_disclaimer_v1",
  "disclaimer": "提案候補です。実行手順の確定は決定論レイヤで行ってください。",
  "nextActionTemplate": {
    "templateVersion": "next_actions_template_v1",
    "currentState": {},
    "missingItems": [],
    "timelineSummary": {},
    "proposal": {}
  },
  "schemaErrors": null,
  "auditId": "audit-xxx"
}
```

#### Errors
- 400: `lineUserId required`
- 500: `error`

### POST /api/phaseLLM4/faq/answer
- Purpose: Provide FAQ answer with link_registry sourceId citations only.
- Auth: admin UI with `x-actor` header (read-only).
- Feature gate: `system_flags.phase0.llmEnabled === true` and `LLM_FEATURE_FLAG === true`.
- Status: compatibility endpoint (`deprecated: true`); internally delegates to KB-only FAQ usecase.

#### Body
```json
{
  "question": "string",
  "locale": "ja",
  "intent": "string (optional)",
  "guideMode": "faq_navigation|question_refine|checklist_guidance",
  "personalization": {
    "locale": "ja",
    "servicePhase": 2
  }
}
```

#### Response (200)
```json
{
  "ok": true,
  "question": "string",
  "serverTime": "2026-02-16T00:00:00.000Z",
  "faqAnswer": {
    "schemaId": "FAQAnswer.v1",
    "generatedAt": "...",
    "advisoryOnly": true,
    "question": "string",
    "answer": "string",
    "citations": []
  },
  "llmUsed": false,
  "llmStatus": "disabled",
  "llmModel": null,
  "disclaimerVersion": "faq_disclaimer_v1",
  "disclaimer": "この回答は公式FAQ（KB）に基づく要約です。個別事情により異なる場合があります。",
  "schemaErrors": null,
  "deprecated": true,
  "replacement": "/api/admin/llm/faq/answer",
  "auditId": "audit-xxx"
}
```

#### Errors
- 400: `question required`
- 422: `llm_disabled` / `kb_no_match` / `low_confidence` / `citations_required` / `direct_url_forbidden` / `warn_link_blocked`
- 500: `error`

## Phase208 Delta

### Effective Feature Gate (all LLM endpoints)
- `system_flags.phase0.llmEnabled === true`
- `LLM_FEATURE_FLAG === true`
- If either is false, endpoints must fail-closed (fallback or BLOCK by endpoint policy).

### POST /api/admin/llm/faq/answer
- Purpose: KB 限定 FAQ 回答（`faq_articles` のみ）。
- Auth: `/api/admin/*` 保護 + `x-actor`。
- Fail-closed: `x-admin-token`（または admin cookie）不一致時は 401 を返す。
- Notes:
  - `x-actor` は推奨（監査の actor 明確化）。未指定の場合も処理は継続し、監査側は `actor=unknown` となる。
- Body:
```json
{
  "question": "string",
  "locale": "ja",
  "intent": "string (optional)"
}
```
- Success (200): FAQAnswer.v1 with citations (`link_registry` sourceId only)
- Block (422):
  - `kb_no_match`
  - `low_confidence`
  - `citations_required`
  - `contact_source_required`
  - `consent_missing`
  - `guide_only_mode_blocked`
  - `personalization_not_allowed`
  - `warn_link_blocked`
  - `direct_url_forbidden`
  - `llm_disabled`
- Block payload (add-only):
```json
{
  "ok": false,
  "blocked": true,
  "httpStatus": 422,
  "blockedReason": "kb_no_match",
  "blockedReasonCategory": "NO_KB_MATCH",
  "fallbackActions": [
    { "actionKey": "open_official_faq", "label": "公式FAQを見る", "sourceId": "lk_xxx" },
    { "actionKey": "open_contact", "label": "問い合わせる", "sourceId": "lk_yyy" }
  ],
  "suggestedFaqs": [
    { "articleId": "faq-1", "title": "会員番号の確認方法" }
  ]
}
```

### GET /api/admin/llm/ops-explain
- Purpose: Ops 状態説明（advisory-only）を admin 名前空間で提供。
- Auth: `/api/admin/*` 保護 + `x-actor`。
- Query:
  - `lineUserId` (required)
- Notes:
  - 既存 `/api/phaseLLM2/ops-explain` と同一 usecase を利用。
  - admin app は本エンドポイントを優先し、404 時のみ旧エンドポイントへフォールバック。

### GET /api/admin/llm/next-actions
- Purpose: 次アクション候補（抽象カテゴリのみ）を admin 名前空間で提供。
- Auth: `/api/admin/*` 保護 + `x-actor`。
- Query:
  - `lineUserId` (required)
- Notes:
  - 既存 `/api/phaseLLM3/ops-next-actions` と同一 usecase を利用。
  - admin app は本エンドポイントを優先し、404 時のみ旧エンドポイントへフォールバック。

### POST /api/phaseLLM4/faq/answer (deprecated compatibility)
- Status: maintained for compatibility.
- Behavior: internally delegates to `/api/admin/llm/faq/answer`.
- Response includes:
  - `deprecated: true`
  - `replacement: "/api/admin/llm/faq/answer"`
  - `traceId` / `requestId` を互換 route から usecase へ転送（監査追跡維持）

### GET /api/admin/llm/config/status
- Purpose: LLM config current value check.
- Fail-closed: `x-admin-token`（または admin cookie）不一致時は 401 を返す。
- Response:
```json
{
  "ok": true,
  "traceId": "string",
  "llmEnabled": false,
  "llmPolicy": {
    "lawfulBasis": "unspecified",
    "consentVerified": false,
    "crossBorder": false
  },
  "effectiveEnabled": false
}
```

### POST /api/admin/llm/config/plan
- Purpose: llmEnabled 変更の plan 生成（planHash/confirmToken）。
- Body:
```json
{
  "llmEnabled": true,
  "llmPolicy": {
    "lawfulBasis": "contract",
    "consentVerified": false,
    "crossBorder": false
  }
}
```

### POST /api/admin/llm/config/set
- Purpose: llmEnabled 適用。
- Body:
```json
{
  "llmEnabled": true,
  "llmPolicy": {
    "lawfulBasis": "contract",
    "consentVerified": false,
    "crossBorder": false
  },
  "planHash": "string",
  "confirmToken": "string"
}
```
- Errors:
  - 400: required fields missing
  - 409: `plan_hash_mismatch` / `confirm_token_mismatch`

## Phase218 Endpoint Priority Contract

- Admin UI (`/admin/app`, `/admin/master`, `/admin/ops`) は以下の順で LLM Ops API を呼び出す。
  1. `/api/admin/llm/ops-explain` / `/api/admin/llm/next-actions`
  2. 404 または接続失敗時のみ `/api/phaseLLM2/ops-explain` / `/api/phaseLLM3/ops-next-actions` へフォールバック
- 旧 phaseLLM2/3 ルートは互換維持のため残すが、優先利用はしない。

## Phase243-249 Add-only Delta

### FAQ (`/api/admin/llm/faq/answer`)
- success / blocked 共通で以下を追加:
  - `policySnapshotVersion` (`llm_policy_v1`)
  - `kbMeta`:
    - `matchedCount`
    - `top1Score`
    - `top2Score`
    - `top1Top2Ratio`
- blocked payload の契約:
  - `fallbackActions` は `sourceId` のみ（直URL禁止）
  - `suggestedFaqs` は最大3件

### OpsExplain / NextActions
- response に `policySnapshotVersion` を add-only 追加。
- `NextActionCandidates` は内部 enum（大文字）を維持し、UI 表示のみ小文字化する。

### Audit payloadSummary（LLM系共通）
- `policySnapshotVersion` を add-only 追加。
- `regulatoryProfile` を add-only 追加:
  - `policySnapshotVersion`
  - `lawfulBasis`
  - `consentVerified`
  - `crossBorder`
  - `fieldCategoriesUsed`
  - `blockedReasonCategory`

## Phase716 Add-only Delta（LLM Concierge Safety）

### GET /api/admin/llm/config/status
- response add-only fields:
```json
{
  "llmConciergeEnabled": false,
  "effectiveConciergeEnabled": false
}
```

### POST /api/admin/llm/config/plan
- request add-only field:
```json
{
  "llmEnabled": true,
  "llmConciergeEnabled": true
}
```
- `planHash` は `llmEnabled + llmPolicy + llmConciergeEnabled` の組で決定される。

### POST /api/admin/llm/config/set
- request add-only field:
```json
{
  "llmEnabled": true,
  "llmConciergeEnabled": true,
  "planHash": "string",
  "confirmToken": "string"
}
```

### Webhook assistant audit (action=`llm_gate.decision`)
- payloadSummary add-only fields:
  - `userTier` (`free|paid`)
  - `mode` (`A|B|C|null`)
  - `topic`
  - `citationRanks[]`
  - `urlCount`
  - `urls[]` (`rank/domain/path/allowed/reason/source`)
  - `guardDecisions[]`
  - `blockedReasons[]`
  - `injectionFindings`

### Concierge response rendering rules
- URLは本文末尾脚注 `(source: domain/path)` のみを許可する。
- Mode AはURLを表示しない。
- Mode B/Cのみ、許可ランクかつ上限内で表示する。

## Phase720 Add-only Delta（Paid Assistant Quality）

### Webhook assistant audit (action=`llm_gate.decision`)
- payloadSummary add-only field:
  - `assistantQuality`
    - `intentResolved`
    - `kbTopScore`
    - `evidenceCoverage`
    - `blockedStage`
    - `fallbackReason`

### LLM usage log (collection=`llm_usage_logs`)
- add-only field:
  - `assistantQuality`
    - `intentResolved`
    - `kbTopScore`
    - `evidenceCoverage`
    - `blockedStage`
    - `fallbackReason`

### GET /api/admin/os/llm-usage/summary
- `summary` add-only fields:
  - `assistantQuality`
    - `sampleCount`
    - `avgKbTopScore`
    - `avgEvidenceCoverage`
    - `blockedStages[]`
    - `fallbackReasons[]`
    - `intents[]`
    - `acceptedRateByIntent[]`
  - `gateAuditBaseline`
    - `callsTotal`
    - `blockedCount`
    - `acceptedRate`
    - `blockedReasons[]`
    - `blockedStages[]`
  - `releaseReadiness`
    - `ready`
    - `recommendation` (`promote_to_prod|hold_in_stg`)
    - `blockedBy[]`
    - `thresholds`
      - `minSampleCount`
      - `minAcceptedRate`
      - `maxCitationMissingRate`
      - `maxTemplateViolationRate`
      - `maxFallbackRate`
      - `minEvidenceCoverage`
    - `metrics`
      - `sampleCount`
      - `callsTotal`
      - `acceptedRate`
      - `blockedRate`
      - `citationMissingRate`
      - `templateViolationRate`
      - `fallbackRate`
      - `avgEvidenceCoverage`
    - `checks[]`
      - `key`
      - `operator`
      - `threshold`
      - `actual`
      - `ok`

- query (add-only, optional):
  - `rolloutMinSampleCount` (int)
  - `rolloutMinAcceptedRate` (0..1)
  - `rolloutMaxCitationMissingRate` (0..1)
  - `rolloutMaxTemplateViolationRate` (0..1)
  - `rolloutMaxFallbackRate` (0..1)
  - `rolloutMinEvidenceCoverage` (0..1)

## Phase724 Add-only Delta（Next Level P2+P3）

### GET /api/admin/llm/config/status
- add-only response fields:
  - `llmWebSearchEnabled` (boolean)
  - `llmStyleEngineEnabled` (boolean)
  - `llmBanditEnabled` (boolean)
  - `effectiveWebSearchEnabled` (boolean)
  - `effectiveStyleEngineEnabled` (boolean)
  - `effectiveBanditEnabled` (boolean)

### POST /api/admin/llm/config/plan
- add-only request fields:
  - `llmWebSearchEnabled` (boolean)
  - `llmStyleEngineEnabled` (boolean)
  - `llmBanditEnabled` (boolean)
- `planHash` は次の組で固定:
  - `llmEnabled + llmConciergeEnabled + llmWebSearchEnabled + llmStyleEngineEnabled + llmBanditEnabled + llmPolicy`

### POST /api/admin/llm/config/set
- add-only request fields:
  - `llmWebSearchEnabled`
  - `llmStyleEngineEnabled`
  - `llmBanditEnabled`

### Internal Job
- `POST /internal/jobs/llm-action-reward-finalize`
  - 認証: `LLM_ACTION_JOB_TOKEN`（header `x-llm-action-job-token` または Bearer）
  - request (add-only):
    - `dryRun` (boolean)
    - `limit` (int)
    - `rewardWindowHours` (int, default 48)
  - response:
    - `processed`
    - `updated`
    - `skipped`
    - `errors`
    - `traceId`

### Webhook assistant audit (action=`llm_gate.decision`)
- payloadSummary add-only fields:
  - `intentConfidence`
  - `contextConfidence`
  - `evidenceNeed` (`none|optional|required`)
  - `evidenceOutcome` (`SUPPORTED|INSUFFICIENT|BLOCKED`)
  - `chosenAction`
    - `styleId`
    - `ctaCount`
    - `lengthBucket`
    - `timingBucket`
    - `questionFlag`
    - `selectionSource`
    - `score`
    - `scoreBreakdown`
  - `contextVersion`
  - `featureHash`
  - `postRenderLint`

## Phase725 Add-only Delta（Next Level P4 readiness）

### Webhook assistant audit (action=`llm_gate.decision`)
- payloadSummary add-only fields:
  - `contextualFeatures`
    - `featureVersion`
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
    - `intentConfidence/contextConfidence`
    - `intentConfidenceBucket/contextConfidenceBucket`
    - `taskLoadBucket/topTaskCount`
    - `blockedTaskPresent/dueSoonTaskPresent`
  - `counterfactualSelectedArmId`
  - `counterfactualSelectedRank`
  - `counterfactualTopArms[]`
    - `rank`
    - `armId`
    - `styleId`
    - `ctaCount`
    - `score`

### `llm_action_logs` add-only fields
- `contextualFeatures`
- `counterfactualSelectedArmId`
- `counterfactualSelectedRank`
- `counterfactualTopArms[]`

## Phase726 Add-only Delta（Contextual bandit runtime）

### Webhook assistant audit (action=`llm_gate.decision`)
- payloadSummary add-only fields:
  - `contextSignature` (`ctxsig_v1_*`)
  - `contextualBanditEnabled` (boolean)

### `llm_action_logs` add-only fields
- `contextSignature`
- `contextualBanditEnabled`

### New Firestore collection
- `llm_contextual_bandit_state`
  - `segmentKey`
  - `contextSignature`
  - `armId`
  - `pulls`
  - `totalReward`
  - `avgReward`
  - `epsilon`
  - `version`
  - `updatedAt`

## Phase727 Add-only Delta（Counterfactual evaluation metrics）

### Webhook assistant audit (action=`llm_gate.decision`)
- payloadSummary add-only fields:
  - `counterfactualEval`
    - `version`
    - `eligible`
    - `selectedArmId`
    - `selectedRank`
    - `bestArmId`
    - `bestScore`
    - `selectedScore`
    - `scoreGap`
    - `minGap`
    - `opportunityDetected`

### `llm_action_logs` add-only fields
- `counterfactualEval`

### Internal Job `POST /internal/jobs/llm-action-reward-finalize`
- response add-only fields:
  - `counterfactualEvaluated`
  - `counterfactualOpportunityDetected`
