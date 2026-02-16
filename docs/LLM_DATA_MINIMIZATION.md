# LLM_DATA_MINIMIZATION

## Principle
- Allow-list only: only explicitly approved fields can be sent to LLM.
- Deny-list is an exception and only for audit validation.

## Data Classes (from DATA_MAP)
- OK (aggregate or state labels): readiness status, counts, health summaries.
- Conditional: hashed identifiers (lineUserId hash), last4, traceId (if required for audit).
- NG: plaintext IDs, secrets, tokens, direct URLs.

## Handling Rules
- Mask or hash identifiers before any LLM payload.
- Drop any field not listed in the allow-list.
- Block when disallowed fields are detected (fail-closed).
