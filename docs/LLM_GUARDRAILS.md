# LLM_GUARDRAILS

## Non-Negotiables
- Advisory-only (no write/execute).
- Disabled by default (rules fallback when flag is off).
- Fail-closed on any validation or minimization failure.
- FAQ is KB-only (Firestore `faq_articles` active records only).
- FAQ citations are mandatory; zero citations is blocked.

## Stop Controls
- killSwitch: stops LINE push/reply side effects only.
- LLM feature flag: separate control to disable LLM suggestions.
- LLM effective enablement requires both:
  - `system_flags.phase0.llmEnabled === true`
  - `LLM_FEATURE_FLAG === true`

## Link Control
- Direct URL output is forbidden for LLM responses.
- FAQ/RAG responses return `link_registry` sourceId only.
- WARN link is blocked by validator logic.

## Output Constraints
- All LLM outputs must pass JSON schema validation.
- Action candidates are abstract categories only (no runbook commands).

## Auditability
- Every LLM invocation must be traceable by traceId.
- audit_logs is append-only.
- Log both generated and blocked outcomes with `blockedReason`.
