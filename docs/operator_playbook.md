# Operator Playbook (V1)

## Quick checks
1. `/healthz`
2. `/api/admin/llm/config/status`
3. Trace sample from `/api/admin/trace`
4. `npm run llm:spec-contract:freeze:check`

## V1 incident triage
- If duplicate replies: disable `ENABLE_V1_CHANNEL_EDGE` and inspect `line_webhook.events.filtered` audit.
- If malformed LLM output: disable `ENABLE_V1_SEMANTIC_OBJECT_STRICT`.
- If rendering truncation issue: disable `ENABLE_V1_LINE_RENDERER`.
