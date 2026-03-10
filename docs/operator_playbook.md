# Operator Playbook (V1)

## Quick checks
1. `/healthz`
2. `/api/admin/llm/config/status`
3. Trace sample from `/api/admin/trace`
4. `npm run llm:spec-contract:freeze:check`

## V1 incident triage
- If duplicate replies: disable `ENABLE_V1_CHANNEL_EDGE` and inspect `line_webhook.events.filtered` audit.
- If duplicate replies persist across multi-instance deploys: verify `webhook_edge_state` writes and confirm durable dedupe/order is active.
- If malformed LLM output: disable `ENABLE_V1_SEMANTIC_OBJECT_STRICT`.
- If LLM calls unexpectedly block after cutover: confirm `ENABLE_V1_OPENAI_RESPONSES=true` in runtime env.
- If rendering truncation issue: disable `ENABLE_V1_LINE_RENDERER`.
