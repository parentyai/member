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
