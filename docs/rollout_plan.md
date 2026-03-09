# V1 Rollout Plan

## Stage gates
1. stg with flags off (baseline)
2. responses adapter canary
3. renderer canary
4. edge guard canary
5. memory/evidence canary
6. replay harness pass
7. quality framework gate pass (`npm run llm:quality:gate`; all slices pass required)
8. slice-first gate pass（critical slice regression = 0）
9. frontier warning review（quality-latency-cost）
10. must-pass fixtures pass (`npm run llm:quality:must-pass`)
11. release policy pass (`npm run llm:quality:release-policy`)
12. strict runtime gate pass (`npm run llm:quality:gate:strict` + `npm run llm:quality:release-policy:strict`)

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
