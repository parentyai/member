# ADR: LLM V1 Responses Adapter

- Status: Accepted
- Decision: OpenAI transport is runtime-mandatory `POST /v1/responses`.
- Rationale: V1 requires structured outputs and tool call item semantics.
- Rollback: revert the responses-only runtime cutover commit/PR.
