# Member LLM V1 Architecture

## Boundaries
- channel_edge (`src/v1/channel_edge/line/*`)
- conversation_core (`src/v1/conversation_core/*`)
- culture_habit_engine (`src/v1/culture_habit_engine/*`)
- line_surface_policy (`src/v1/line_surface_policy/*`)
- line_renderer (`src/v1/line_renderer/*`)
- memory_fabric (`src/v1/memory_fabric/*`)
- policy_graph (`src/v1/policy_graph/*`)
- evidence_ledger (`src/v1/evidence_ledger/*`)
- retrieval_and_verification (`src/v1/retrieval_and_verification/*`)
- openai_adapter (`src/v1/openai_adapter/*`)
- action_gateway (`src/v1/action_gateway/*`)
- human_handoff (`src/v1/human_handoff/*`)
- audit_eval_update (`src/v1/audit_eval_update/*`)

## Runtime direction
`channel_edge -> conversation_core -> policy/retrieval/action -> surface_policy -> line_renderer -> delivery/audit`

## Cutover
- legacy routes stay API-compatible.
- V1 behavior is controlled by `ENABLE_V1_*` flags.
