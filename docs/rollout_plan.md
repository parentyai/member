# V1 Rollout Plan

## Stage gates
1. contract freeze gate pass (`npm run llm:spec-contract:freeze:check`)
2. stg with flags off (baseline)
3. responses adapter contract check (Responses-only runtime; `ENABLE_V1_OPENAI_RESPONSES=true` pinned for visibility)
4. renderer canary
5. edge guard canary
6. memory/evidence canary
7. replay harness pass
8. quality framework gate pass (`npm run llm:quality:gate`; all slices pass required)
9. slice-first gate pass（critical slice regression = 0）
10. frontier warning review（quality-latency-cost）
11. must-pass fixtures pass (`npm run llm:quality:must-pass`)
12. release policy pass (`npm run llm:quality:release-policy`)
13. quality report + failure register/counterexample queue refresh (`npm run llm:quality:report`)
14. strict runtime gate pass (`npm run llm:quality:gate:strict` + `npm run llm:quality:release-policy:strict` with soft-floor 0.80)

## No-Go
- duplicate_event drop anomaly
- direct URL leak
- legacy template hit regression
- contradiction rate increase beyond threshold
- judge disagreement / prompt sensitivity drift exceeds policy
- replay/perturbation critical failure
- contamination high benchmark used for hard gate
- strict mode:
  - `defaultCasualRate > 0.02`
  - `directAnswerMissRate > 0.08`
  - `avgRepeatRiskScore > 0.5`
  - non-hard-gate dimension `score < 0.80`

## Quality Loop v2 staged rollout
1. `design_only`
   - PR-1 / PR-4 / PR-6
   - docs / contract / tooling only
2. `log_only`
   - PR-3 / PR-3.5 / PR-7
   - integration KPI visible, no runtime enforcement
3. `soft_enforcement`
   - FAQ / admin / compat first
4. `hard_enforcement`
   - paid webhook / FAQ canonical / emergency override / journey blocker / high-risk saved FAQ reuse
5. `nogo_gate_mandatory`
   - all critical slices block release
6. `continuous_improvement_loop_active`
   - nightly audit / integration audit / top failure register / PR plan generation

## Quality Loop v2 critical slices
- `emergency_high_risk`
- `saved_faq_high_risk_reuse`
- `journey_blocker_conflict`
- `stale_city_pack_required_source`
- `compat_spike`
- `trace_join_incomplete`
- `direct_url_leakage`
- `official_source_missing_on_high_risk`

## Quality Loop v2 integration gates
- `cityPackGroundingRate >= 0.90`
- `staleSourceBlockRate >= 0.95`（high-risk）
- `emergencyOfficialSourceRate = 1.00`
- `journeyAlignedActionRate >= 0.85`
- `taskBlockerConflictRate <= 0.02`
- `savedFaqReusePassRate >= 0.90`
- `traceJoinCompleteness >= 0.90`
- `adminTraceResolutionTime <= 15m` on stg p50, `<= 30m` on prod p50
