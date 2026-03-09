# LLM Quality Repo Audit v1

## Spec Invariants
- V1 quality constraints are authoritative: [Member_LLM_Integrated_Spec_V1.md](/Volumes/Arumamihs/Member_LLM_Integrated_Spec_V1.md:300)
- Parent contract invariants are authoritative: [member_us_assignment_llm_contract_pack.yaml](/Volumes/Arumamihs/member_us_assignment_llm_contract_pack.yaml:11)

## current_quality_risk_map
- high:
  - `short_followup_understanding` failure risk in paid path loops: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:1902)
  - repetition/default-casual reset risk in paid fallback branching: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:2062)
  - authority/freshness degradation risk when retrieval dominates: [src/usecases/assistant/generatePaidAssistantReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/generatePaidAssistantReply.js:767)
- medium:
  - admin/compat quality visibility may mask path variance: [src/routes/admin/osLlmUsageSummary.js](/Volumes/Arumamihs/Member/src/routes/admin/osLlmUsageSummary.js:711)
  - UI operators need slice-first interpretation discipline: [apps/admin/assets/admin_app.js](/Volumes/Arumamihs/Member/apps/admin/assets/admin_app.js:17007)
- low:
  - scorecard schema stability: [schemas/llm_quality_scorecard.schema.json](/Volumes/Arumamihs/Member/schemas/llm_quality_scorecard.schema.json:1)

## response_path_inventory
- webhook paid orchestrator path: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:1554)
- webhook paid assistant direct generation path: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:1494)
- webhook free retrieval fallback: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:1771)
- paid domain concierge backend: [src/usecases/assistant/generatePaidDomainConciergeReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/generatePaidDomainConciergeReply.js:252)
- concierge composition backend: [src/usecases/assistant/concierge/composeConciergeReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/concierge/composeConciergeReply.js:306)
- paid assistant backend: [src/usecases/assistant/generatePaidAssistantReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/generatePaidAssistantReply.js:767)
- free retrieval backend: [src/usecases/assistant/generateFreeRetrievalReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/generateFreeRetrievalReply.js:104)

## response_generation_entrypoints
- `handleAssistantMessage`: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:1902)
- `generatePaidAssistantReply`: [src/usecases/assistant/generatePaidAssistantReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/generatePaidAssistantReply.js:767)
- `generatePaidDomainConciergeReply`: [src/usecases/assistant/generatePaidDomainConciergeReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/generatePaidDomainConciergeReply.js:252)
- `generateFreeRetrievalReply`: [src/usecases/assistant/generateFreeRetrievalReply.js](/Volumes/Arumamihs/Member/src/usecases/assistant/generateFreeRetrievalReply.js:104)

## line_surface_usage_map
- quality framework UI sections and rendering path:
  - HTML anchors: [apps/admin/app.html](/Volumes/Arumamihs/Member/apps/admin/app.html:4389)
  - renderer: [apps/admin/assets/admin_app.js](/Volumes/Arumamihs/Member/apps/admin/assets/admin_app.js:17007)

## memory_usage_map
- conversation quality logs (event-level): [src/repos/firestore/llmActionLogsRepo.js](/Volumes/Arumamihs/Member/src/repos/firestore/llmActionLogsRepo.js:315)
- FAQ quality logs: [src/repos/firestore/llmQualityLogsRepo.js](/Volumes/Arumamihs/Member/src/repos/firestore/llmQualityLogsRepo.js:76)
- memory rules reference (spec): [Member_LLM_Integrated_Spec_V1.md](/Volumes/Arumamihs/Member_LLM_Integrated_Spec_V1.md:551)

## routing_failure_map
- paid branch fallback pressure points:
  - budget/availability/snapshot/failure branch fan-out: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:1947)
  - late casual fallback branch: [src/routes/webhookLine.js](/Volumes/Arumamihs/Member/src/routes/webhookLine.js:2521)

## repetition_loop_risk_map
- default-casual router reason observed and tracked: [src/routes/admin/osLlmUsageSummary.js](/Volumes/Arumamihs/Member/src/routes/admin/osLlmUsageSummary.js:557)
- repetition prevention telemetry fields: [src/repos/firestore/llmActionLogsRepo.js](/Volumes/Arumamihs/Member/src/repos/firestore/llmActionLogsRepo.js:363)

## context_loss_risk_map
- follow-up intent and router reason aggregation:
  - `followupIntents`: [src/routes/admin/osLlmUsageSummary.js](/Volumes/Arumamihs/Member/src/routes/admin/osLlmUsageSummary.js:543)
  - `routerReasons`: [src/routes/admin/osLlmUsageSummary.js](/Volumes/Arumamihs/Member/src/routes/admin/osLlmUsageSummary.js:544)

## citation_and_grounding_risk_map
- source authority/freshness scores recorded: [src/repos/firestore/llmActionLogsRepo.js](/Volumes/Arumamihs/Member/src/repos/firestore/llmActionLogsRepo.js:347)
- contradiction and unsupported claims recorded: [src/repos/firestore/llmActionLogsRepo.js](/Volumes/Arumamihs/Member/src/repos/firestore/llmActionLogsRepo.js:355)

## japanese_service_quality_risk_map
- concise/follow-up/pitfall style quality signals:
  - aggregation: [src/routes/admin/osLlmUsageSummary.js](/Volumes/Arumamihs/Member/src/routes/admin/osLlmUsageSummary.js:519)
  - quality projection to dimension scores: [src/routes/admin/osLlmUsageSummary.js](/Volumes/Arumamihs/Member/src/routes/admin/osLlmUsageSummary.js:752)

## baseline_scorecard_template
- JSON template: [docs/LLM_QUALITY_BASELINE_SCORECARD_TEMPLATE.json](/Volumes/Arumamihs/Member/docs/LLM_QUALITY_BASELINE_SCORECARD_TEMPLATE.json:1)

## post_change_scorecard_template
- JSON template: [docs/LLM_QUALITY_POST_CHANGE_SCORECARD_TEMPLATE.json](/Volumes/Arumamihs/Member/docs/LLM_QUALITY_POST_CHANGE_SCORECARD_TEMPLATE.json:1)

## top_10_outputs
- generator: [tools/llm_quality/build_quality_report.js](/Volumes/Arumamihs/Member/tools/llm_quality/build_quality_report.js:1)
- outputs:
  - `top_10_quality_failures`
  - `top_10_loop_cases`
  - `top_10_context_loss_cases`
  - `top_10_japanese_service_failures`
  - `top_10_line_fit_failures`

## big_5_refactor_plan
1. Paid response path simplification to reduce loop-prone branch tree.
2. Short follow-up continuity engine hardening across paid/free/admin/compat slices.
3. Authority/freshness + contradiction final decision unification.
4. Japanese service/cultural quality planner and evaluator split (deterministic + judge).
5. Runtime scorecard extraction from production traces + replay arena expansion.
