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
  "intent": "string (optional)"
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
  - `warn_link_blocked`
  - `direct_url_forbidden`
  - `llm_disabled`

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
  "effectiveEnabled": false
}
```

### POST /api/admin/llm/config/plan
- Purpose: llmEnabled 変更の plan 生成（planHash/confirmToken）。
- Body:
```json
{ "llmEnabled": true }
```

### POST /api/admin/llm/config/set
- Purpose: llmEnabled 適用。
- Body:
```json
{
  "llmEnabled": true,
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
