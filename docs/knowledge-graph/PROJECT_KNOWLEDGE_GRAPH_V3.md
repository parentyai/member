# PROJECT_KNOWLEDGE_GRAPH_V3

- generatedAt: 2026-03-08T04:34:19.327Z
- source: docs/knowledge-graph/*.md (existing artifacts only) + runtime_probe.json
- firestoreRuntime: OBSERVED_RUNTIME
- firestoreCollectionsObserved: 51
- joinCardinalityExtension: PRESENT
- ownershipExtension: PRESENT

## Coverage
- operationRows: 159
- permissionOperationRows: 477
- uiParameterRows: 58
- failurePropagationRows: 6

## Key Paths
- Notification data path: `User -> JourneyTodoItems -> Tasks -> Notifications -> NotificationDeliveries -> SendRetryQueue -> AuditLogs`
- CityPack vendor path: `CityPacks -> SourceRefs -> SourceEvidence -> Vendors/CityPackBulletins`
- LLM path: `LLM Input Boundaries -> llmClient -> LLM logs -> Notification/FAQ surfaces`
- Evidence reconstruction path: `traceId -> audit_logs + decision_timeline + deliveries`
- UI control path: `UI_PARAMETER_RELATIONS -> API_OPERATION_MAP -> PERMISSION_OPERATION_MAP`

## Artifacts
| Artifact | Purpose | Evidence |
| --- | --- | --- |
| FIRESTORE_RUNTIME_MAP.md | Firestore collection/fields/sample runtime observation | docs/knowledge-graph/FIRESTORE_RUNTIME_MAP.md:1 |
| API_OPERATION_MAP.md | Operation-level API/entity/writeFields mapping | docs/knowledge-graph/API_OPERATION_MAP.md:1 |
| PERMISSION_OPERATION_MAP.md | Role x operation x entity allow matrix | docs/knowledge-graph/PERMISSION_OPERATION_MAP.md:1 |
| UI_PARAMETER_RELATIONS.md | Admin UI parameter-to-entity links | docs/knowledge-graph/UI_PARAMETER_RELATIONS.md:1 |
| ADMIN_UI_DATA_RELATION_MAP.md | Admin-readable relation graph with mermaid | docs/knowledge-graph/ADMIN_UI_DATA_RELATION_MAP.md:1 |
| FAILURE_PROPAGATION_MAP.md | Failure impact propagation by entity | docs/knowledge-graph/FAILURE_PROPAGATION_MAP.md:1 |
| PROJECT_SSOT_HIERARCHY.md | Data ownership extension (Entity/Canonical/Derived/Editable/Owner) | docs/knowledge-graph/PROJECT_SSOT_HIERARCHY.md:1 |
| ENTITY_RELATIONS.md | Join/key/cardinality extension for entity relations | docs/knowledge-graph/ENTITY_RELATIONS.md:1 |
