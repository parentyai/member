# 08 Phase1 Scope Lock

## Included lanes

- `welcome`
- `citypack_feedback_received`
- `citypack_feedback_usage`
- `service_ack`

## Contract-only or helper-only in phase1

- paid readiness / finalizer shaping contracts
- webhook top-level fallback / clarify / refuse / ack helper contracts
- free retrieval empty reply helper contracts
- broad paid/free conversational lanes remain literal-preserving in live runtime

## Excluded classes

- unresolved shell leaves
- policy freeze required leaves
- binding / variant unresolved leaves
- `ready_after_binding_contract` family
- `ready_after_variant_keying` family
- operator / adjacent ops
- notification orchestration
- shadow replay to live customer

## Enforcement

`src/domain/llm/concierge/conciergeLayer.js` exposes a fixed `PHASE1_CONCIERGE_LANES` set and returns `null` outside that set.

This scope lock explicitly excludes the ready_after_binding_contract family and the ready_after_variant_keying family from the live concierge lane.
