# PROJECT_KNOWLEDGE_GRAPH_V2

- generatedAt: 2026-03-08T02:47:49.730Z
- source: docs/knowledge-graph/*.md (existing artifacts only) + runtime_probe.json
- firestoreRuntime: OBSERVED_RUNTIME

## Coverage
- operations: 9292
- ui-parameter-links: 93
- failure-propagation-rows: 6

## Key Paths
- Notification path: `create/approve/send -> notification_deliveries -> retry_queue -> audit_logs`
- CityPack Vendor path: `city_packs -> source_refs -> source_evidence -> city_pack_bulletins`
- LLM path: `llm_input_boundaries -> llmClient -> faq_answer_logs / llm_usage_logs`
- Evidence reconstruction path: `traceId -> audit_logs + decision_timeline + deliveries`

## Artifacts
| Artifact | Purpose | Evidence |
| --- | --- | --- |
| FIRESTORE_RUNTIME_MAP.md | Firestore runtime collection/sample mapping | docs/knowledge-graph/FIRESTORE_RUNTIME_MAP.md:1 |
| API_OPERATION_MAP.md | Operation-level API/entity/field mapping | docs/knowledge-graph/API_OPERATION_MAP.md:1 |
| UI_PARAMETER_RELATIONS.md | Admin UI parameter to entity relationships | docs/knowledge-graph/UI_PARAMETER_RELATIONS.md:1 |
| ADMIN_UI_DATA_RELATION_MAP.md | Admin-readable data relation graph | docs/knowledge-graph/ADMIN_UI_DATA_RELATION_MAP.md:1 |
| FAILURE_PROPAGATION_MAP.md | Failure impact propagation surface | docs/knowledge-graph/FAILURE_PROPAGATION_MAP.md:1 |
