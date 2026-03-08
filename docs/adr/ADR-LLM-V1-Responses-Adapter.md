# ADR: LLM V1 Responses Adapter

- Status: Accepted
- Decision: OpenAI transport is `POST /v1/responses` when `ENABLE_V1_OPENAI_RESPONSES=true`.
- Rationale: V1 requires structured outputs and tool call item semantics.
- Rollback: set `ENABLE_V1_OPENAI_RESPONSES=false`.
