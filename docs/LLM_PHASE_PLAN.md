# LLM_PHASE_PLAN

## Overview
LLM 統合は Phase1-5 で段階導入し、advisory-only と fail-closed を維持する。

## Dependencies
- Phase1 -> Phase2/3/4 -> Phase5

## Phase1 (Guardrails)
- Close: allow-list / schema validation / feature flag disabled-by-default がテストで固定。

## Phase2 (Ops Explanation)
- Close: OpsExplanation.v1 が API で返り、fallback と audit が動作。

## Phase3 (Next Action Candidates)
- Close: 抽象 action のみ返却、invalid schema/citation で fallback。

## Phase4 (FAQ Answer)
- Close: link_registry sourceId のみを引用、WARN link はブロック。

## Phase5 (Operations)
- Close: Runbook / Phase plan / Test plan が揃い、停止・監査・復旧が手順化されている。
