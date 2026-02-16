# LLM_THREAT_MODEL

## Threats
1) Prompt injection (user or KB content acting as instructions).
2) Data exfiltration (PII/secret leakage).
3) Action escalation (suggesting runbook or execution commands).
4) Link poisoning (direct URL or WARN link exposure).
5) Schema bypass (unvalidated output used downstream).

## Mitigations
- Allow-list input filtering.
- Advisory-only schemas with abstract actions.
- Direct URL detection and block.
- KillSwitch separation (LLM flag vs send stop).
- Schema validation and fail-closed fallback.

## Residual Risks
- Misleading explanations even when safe.
- Over-reliance by operators.

## Audit Points
- traceId request/response linkage.
- audit_logs append-only record for LLM events.
