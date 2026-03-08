# ADR: LINE Renderer Enforcement

- Status: Accepted
- Decision: Renderer enforces object count and UTF-16 budgets.
- Rationale: V1 channel constraints must be enforced at final rendering layer.
- Rollback: set `ENABLE_V1_LINE_RENDERER=false`.
