# 18 Implementation Roadmap

## PR0

- goal:
  - observe only
  - capture current failure instrumentation
  - no behavior change
- changed files class:
  - docs / telemetry scaffolds only
- dependencies:
  - none
- flags:
  - none
- tests:
  - snapshot / instrumentation-only tests
- KPI gate:
  - baseline metrics captured
- rollback:
  - remove additive instrumentation

## PR1

- goal:
  - Link Registry contract scaffold
  - Task OS contract scaffold
  - no-op concierge layer contract
- changed files class:
  - contracts
  - adapter interfaces
  - flags
  - tests
- dependencies:
  - PR0
- flags:
  - `ENABLE_RESOLUTION_CONCIERGE_LAYER_V1=0`
  - `ENABLE_LINK_FIRST_RESPONSE_V1=0`
  - `ENABLE_TASK_OS_RESPONSE_BRIDGE_V1=0`
- tests:
  - contract snapshot
  - no-op parity
- KPI gate:
  - zero behavior delta under disabled flags
- rollback:
  - revert scaffold only

## PR2

- goal:
  - Resolution Concierge Layer skeleton
  - link-first response composition
  - no-op shaping with parity checks
- changed files class:
  - assistant / finalizer / shared response contract layer
- dependencies:
  - PR1
- flags:
  - concierge layer shadow-only
- tests:
  - parity
  - no-new-facts
  - link relevance
- KPI gate:
  - no safety regression
- rollback:
  - disable concierge layer flag

## PR3

- goal:
  - phase1 lane integration
  - paid readiness / finalizer
  - webhook top-level clarify / refuse / fallback / ack
  - welcome
  - citypack feedback
- changed files class:
  - route/usecase adapters
- dependencies:
  - PR2
- flags:
  - per-lane rollout flags
- tests:
  - lane contract snapshots
  - route persona continuity
- KPI gate:
  - answer-first + next-action presence up
- rollback:
  - per-lane flag off

## PR4

- goal:
  - Rich Menu bridge
  - Task OS visibility
  - persistent nav synchronization
- changed files class:
  - task adapter
  - rich menu binding bridge
  - LIFF / MINI App handoff hints
- dependencies:
  - PR3
- flags:
  - `ENABLE_RICH_MENU_CONVERSATION_BRIDGE_V1`
- tests:
  - menu binding snapshot
  - task delta projection
- KPI gate:
  - task visibility and menu utilization improve
- rollback:
  - bridge flag off

## PR5

- goal:
  - shadow self-improvement loop
  - replay harness
  - allowlist-only desktop loop integration contract
  - score capture
- changed files class:
  - eval / shadow harness / audit
- dependencies:
  - PR4
- flags:
  - `ENABLE_CONCIERGE_SHADOW_EVAL_V1`
- tests:
  - replay reproducibility
  - stop switch behavior
- KPI gate:
  - shadow-only, no live user impact
- rollback:
  - shadow flag off

## PR6

- goal:
  - eval harness
  - dashboards
  - guardrails
  - phase2 expansion or halt decision
- changed files class:
  - reports / observability / admin read models if needed
- dependencies:
  - PR5
- flags:
  - canary-only
- tests:
  - regression thresholds
  - abort thresholds
- KPI gate:
  - explicit pass/fail gate for expansion
- rollback:
  - halt rollout and revert per-lane flags

## Roadmap rule

- no phase1 work should unblock shell-only or human/policy-freeze leaves ahead of their own closure topics
- operator / notification adjacent lanes stay out of concierge lane behavior changes except through shared contracts

