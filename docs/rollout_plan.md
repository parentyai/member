# V1 Rollout Plan

## Stage gates
1. stg with flags off (baseline)
2. responses adapter canary
3. renderer canary
4. edge guard canary
5. memory/evidence canary
6. replay harness pass

## No-Go
- duplicate_event drop anomaly
- direct URL leak
- legacy template hit regression
- contradiction rate increase beyond threshold
