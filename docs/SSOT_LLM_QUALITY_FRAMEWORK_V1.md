# SSOT_LLM_QUALITY_FRAMEWORK_V1

## 目的
- LLM改善のたびに「品質向上を実測で証明」するための統一基準を固定する。
- overall偏重を禁止し、slice-firstで回帰を検知する。
- hard gate（安全/正確性/プライバシー/行動制御）を merge blocker とする。

## Framework
- version: `v1`
- schema:
  - `schemas/llm_quality_framework.schema.json`
  - `schemas/llm_quality_scorecard.schema.json`
- scorecard command:
  - `npm run llm:quality:baseline`
  - `npm run llm:quality:candidate`
  - `npm run llm:quality:diff`
  - `npm run llm:quality:gate`
  - `npm run llm:quality:must-pass`
  - `npm run llm:quality:release-policy`
  - `npm run llm:quality:report`（`tmp/llm_quality_failure_register.json` と `tmp/llm_quality_counterexample_queue.json` を同時生成）

## 24 Dimension Weights
| key | weight | hardGate |
| --- | --- | --- |
| factuality_grounding | 0.12 | true |
| source_authority_freshness | 0.08 | true |
| procedural_utility | 0.06 | false |
| next_step_clarity | 0.05 | false |
| conversation_continuity | 0.06 | false |
| short_followup_understanding | 0.06 | true |
| clarification_quality | 0.04 | false |
| repetition_loop_avoidance | 0.08 | true |
| direct_answer_first | 0.04 | false |
| japanese_naturalness | 0.04 | false |
| japanese_service_quality | 0.05 | true |
| keigo_distance | 0.02 | false |
| empathy | 0.03 | false |
| cultural_habit_fit | 0.03 | true |
| line_native_fit | 0.04 | true |
| action_policy_compliance | 0.04 | true |
| safety_compliance_privacy | 0.08 | true |
| memory_integrity | 0.03 | true |
| group_chat_privacy | 0.03 | true |
| minority_persona_robustness | 0.03 | true |
| misunderstanding_recovery | 0.02 | false |
| escalation_appropriateness | 0.02 | true |
| operational_reliability | 0.03 | true |
| latency_surface_efficiency | 0.04 | false |

## Slice-first Gate
- slices:
  - paid / free / admin / compat
  - short_followup / domain_continuation / group_chat
  - japanese_service_quality / minority_personas / cultural_slices
- policy:
  - `slice_fail` が1件でも merge block。
  - critical slice（short_followup/domain/group/japanese/minority/cultural）は warning でも block。

## Judge Calibration Board
- human adjudication set: `tools/llm_quality/fixtures/human_adjudication_set.v1.json`（120 cases）
- disagreement report: `tmp/llm_quality_judge_calibration.json`
- multilingual check: `jp` vs `jp_en_terms`
- prompt sensitivity check: `altPromptDecisions`
- reliability policy:
  - disagreementRate > 0.12 -> human review required
  - promptSensitivityDrift > 0.08 -> human review required

## Benchmark Registry / Contamination Guard
- registry: `benchmarks/registry/manifest.v1.json`
- frozen benchmark path: `benchmarks/frozen/v1/*`
- baseline freeze:
  - artifact hash must be pinned in manifest
  - reviewer approval required on version/hash change
- contamination:
  - `high` risk fixture is excluded from hard gate
  - contamination summary: `tmp/llm_quality_contamination_guard.json`

## Replay Arena / Perturbation Harness
- replay: `npm run llm:quality:arena`
- trace fixture: `tools/llm_replay/fixtures/trace_replay_cases.v1.json`
- perturbation fixture: `tools/llm_replay/fixtures/perturbation_cases.v1.json`
- required perturbations:
  - evidence swap
  - stale source
  - contradictory source
  - quote/unsend/redelivery

## Quality-Latency-Cost Frontier
- metrics:
  - quality score
  - latency p50/p95
  - cost per turn
  - ACK SLA violation rate
- gate:
  - quality delta < +2 and latency regression > 25% => warning
  - quality non-improving and cost regression > 20% => block
  - ACK SLA violation rate > 1% => block

## Admin UI
- pane: `LLM > usage summary`
- sections:
  - Quality Scorecard
  - Slice-first Board
  - Judge Calibration Board
  - Benchmark Registry
  - Replay / Perturbation
  - Quality-Latency-Cost Frontier
  - Counterexample Queue

## Merge Gate
- required artifacts:
  - baseline scorecard
  - candidate scorecard
  - diff
  - quality report (`top_10_*` を含む)
- quality failure register (`tmp/llm_quality_failure_register.json`)
- counterexample queue (`tmp/llm_quality_counterexample_queue.json`)
  - benchmark version/hash
  - replay/perturbation report
  - must-pass fixture result
  - release-policy verdict
- hard block:
  - hard gate regression
  - critical slice regression
  - contamination high used for hard gate
  - replay critical failure
  - release-policy fail
- strict runtime signals で `legacyTemplateHitRate/defaultCasualRate/followupQuestionIncludedRate/conciseModeAppliedRate/retrieveNeededRate/avgActionCount/directAnswerAppliedRate/avgRepeatRiskScore` 欠損（`runtime_signal_missing:*`）

## Required Audit Outputs
- `current_quality_risk_map`
- `response_path_inventory`
- `response_generation_entrypoints`
- `line_surface_usage_map`
- `memory_usage_map`
- `routing_failure_map`
- `repetition_loop_risk_map`
- `context_loss_risk_map`
- `citation_and_grounding_risk_map`
- `japanese_service_quality_risk_map`
- `top_10_quality_failures`
- `top_10_loop_cases`
- `top_10_context_loss_cases`
- `top_10_japanese_service_failures`
- `top_10_line_fit_failures`
- register は signal別 materiality filter を適用（`defaultCasualRate > 0.02`、`retrieveNeededRate > 0.25`、`legacyTemplateHitRate > 0.005` など）
- `signal_coverage` を同時出力し、`conversationQuality` 欠損シグナルは failure 集計対象外にする（missing は coverage で追跡）
- `signal_coverage.missingSignalCount > 0` の場合は register に `runtime_signal_gap` を記録し、counterexample queue で運用追跡する

## Rubric Assets
- human eval rubric: `docs/LLM_QUALITY_HUMAN_EVAL_RUBRIC_V1.md`
- auto eval rubric: `docs/LLM_QUALITY_AUTO_EVAL_RUBRIC_V1.md`
- baseline template: `docs/LLM_QUALITY_BASELINE_SCORECARD_TEMPLATE.json`
- post-change template: `docs/LLM_QUALITY_POST_CHANGE_SCORECARD_TEMPLATE.json`

## Rollback
- immediate:
  - remove `llm:quality:gate` from required CI path
- staged:
  - UI quality section hide
  - keep telemetry add-only
- full:
  - revert commit (no existing API break)
