# LLM_API_SPEC

## Admin (Read-only)

### GET /api/phaseLLM2/ops-explain
- Purpose: Provide an advisory-only explanation of current ops state.
- Auth: admin UI with `x-actor` header (read-only).
- Feature gate: `LLM_FEATURE_FLAG` must be true for LLM output. Otherwise fallback is returned.

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
- Feature gate: `LLM_FEATURE_FLAG` must be true for LLM output. Otherwise fallback is returned.

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
- Feature gate: `LLM_FEATURE_FLAG` must be true for LLM output. Otherwise fallback is returned.

#### Body
```json
{
  "question": "string",
  "sourceIds": ["link_registry_id_1", "link_registry_id_2"]
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
  "blockedSourceIds": null,
  "auditId": "audit-xxx"
}
```

#### Errors
- 400: `question required`
- 500: `error`
