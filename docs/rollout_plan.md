# V1 Rollout Plan

## Stage gates
1. stg with flags off (baseline)
2. responses adapter canary
3. renderer canary
4. edge guard canary
5. memory/evidence canary
6. replay harness pass
7. quality framework gate pass (`npm run llm:quality:gate`)
8. slice-first gate pass（critical slice regression = 0）
9. frontier warning review（quality-latency-cost）
10. must-pass fixtures pass (`npm run llm:quality:must-pass`)
11. release policy pass (`npm run llm:quality:release-policy`)

## No-Go
- duplicate_event drop anomaly
- direct URL leak
- legacy template hit regression
- contradiction rate increase beyond threshold
- judge disagreement / prompt sensitivity drift exceeds policy
- replay/perturbation critical failure
- contamination high benchmark used for hard gate
