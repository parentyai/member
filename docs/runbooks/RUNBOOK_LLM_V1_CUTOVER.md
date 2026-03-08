# RUNBOOK: LLM V1 Cutover

1. Deploy with all `ENABLE_V1_*` flags set to false.
2. Enable one flag at a time in stg and run:
   - `node --test tests/phase760/*.test.js`
   - `node tools/replay/v1/run_replay.js`
3. Validate trace and audit events.
4. Promote to prod canary only after stg pass.
