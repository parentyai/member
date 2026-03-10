# V1 Rollout Plan

## Stage gates
1. contract freeze gate pass (`npm run llm:spec-contract:freeze:check`)
2. stg with flags off (baseline)
3. responses adapter canary
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
