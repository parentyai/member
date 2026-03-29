# 08 Phase1 Scope Lock

## Included lanes

- `paid_domain`
- `paid_orchestrated`
- `paid_main`
- `paid_casual`
- `free_retrieval`
- `welcome`
- `citypack_feedback_received`
- `citypack_feedback_usage`
- `service_ack`

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
