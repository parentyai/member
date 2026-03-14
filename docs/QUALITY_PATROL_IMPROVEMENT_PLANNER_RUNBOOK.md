# Quality Patrol Improvement Planner Runbook

## Scope
- planner entrypoint: `src/domain/qualityPatrol/planImprovements.js`
- plan builder: `src/domain/qualityPatrol/planning/buildImprovementPlan.js`
- read-only usecase wrapper: `src/usecases/qualityPatrol/planQualityImprovements.js`

## Inputs
- PR-6 root cause reports
- ranked `causeCandidates[]`
- `analysisStatus`, `observationBlockers`, and `sourceCollections`

## Core rules
- planner is deterministic only; no LLM planner or autonomous implementation is used in PR-7.
- proposals start from causes, not symptoms. Detection issues and root-cause reports remain separate inputs.
- observation gaps win over aggressive runtime fixes. If `observation_gap` or similar causes rank first, the planner returns observation-first proposals and marks planning as `blocked` or `insufficient_evidence`.
- runtime fixes are suggestions only. PR-7 does not write the backlog, change runtime behavior, or merge anything automatically.
- low-confidence causes increase `preconditions` and `blockedBy`; they do not justify stronger proposals by themselves.

## Proposal families
- observation-first: `observation_only`, `sample_collection`, `transcript_coverage_repair`, `no_action_until_evidence`, `blocked_by_observation_gap`
- runtime/system: `knowledge_fix`, `readiness_fix`, `template_fix`, `continuity_fix`, `specificity_fix`, `retrieval_fix`, `runtime_fix`

## Output contract
- `planVersion = quality_patrol_improvement_plan_v1`
- `recommendedPr[]` must include `proposalKey`, `proposalType`, `priority`, `title`, `objective`, `whyNow`, `whyNotOthers`
- each proposal must include `targetFiles`, `expectedImpact`, `riskLevel`, `rollbackPlan`, `preconditions`, `blockedBy`, and `confidence`
- `planningStatus` remains `planned`, `blocked`, or `insufficient_evidence`

## Non-goals in PR-7
- no registry or backlog write
- no query route or admin UI
- no scheduler or runtime caller wiring
- no runtime fix implementation

## Future integration
- PR-8 query and PR-10 scheduler can read `recommendedPr[]` directly.
- backlog persistence, if needed later, should consume this plan output rather than inventing a new contract.
- query serialization may shorten or hide internal planner rationale for human audience, but it must not rewrite proposal priorities or planning status.
