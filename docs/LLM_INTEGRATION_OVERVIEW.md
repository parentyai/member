# LLM_INTEGRATION_OVERVIEW

Purpose: Define the LLM integration boundary as a **read-only intelligence layer**. The LLM never triggers Firestore writes, sends, or ops decisions.

## Boundary (Hard Rules)
- LLM is advisory-only (no direct execution).
- Decision layer remains deterministic.
- Fail-closed on any uncertainty (flag off, schema mismatch, or disallowed data).

## Responsibility Split
- Decision layer: readiness, caps, killSwitch, execution, and persistence.
- LLM layer: summary/explanation/candidate generation only.

## Stop Controls
- killSwitch: stops LINE push/reply side effects (existing behavior).
- LLM feature flag: stops LLM suggestions (separate control).

## Evidence
- Advisory-only is already SSOT (see `docs/SSOT_ADMIN_UI_OS.md`, `docs/SECURITY_MODEL_JA.md`).
- Disabled by default is fixed by tests (see `tests/phase106/phase106_llm_disabled_default_fallback.test.js`).
