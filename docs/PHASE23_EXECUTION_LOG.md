UTC: 2026-02-06T16:33:20Z
main SHA: 14c8f8bf4f240bf1e49f97f417599fbcda7a96ec
Action: "Phase23-T03 human decision hint"
Principle: "AIは判断しない。判断材料を固定するだけ。"

UTC: 2026-02-07T04:49:15Z
main SHA: 28683c8e3fff0c17b52b076bdc8863b7f5f4e3ed
Action: "Phase23-T05 Phase22 scheduled exit=1 triage"
Runs (latest failures):
- dryrun: https://github.com/parentyai/member/actions/runs/21773790707
- write: https://github.com/parentyai/member/actions/runs/21755060444
Evidence (dryrun main):
- stdout_head: result=FAIL reasonCode=KPI_NULL stage=kpi_snapshot stderrCapture=empty
- smoke_stdout_head: sentA=0 clickA=0 sentB=0 clickB=0
Classification: CONFIG
Rationale: SERVICE_MODE not set => recordSent disabled; sent/click stayed zero in smoke output
Fix:
- .github/workflows/phase22-scheduled-dryrun.yml (SERVICE_MODE=member)
- .github/workflows/phase22-scheduled-write.yml (SERVICE_MODE=member)
Rerun (branch):
- dryrun: https://github.com/parentyai/member/actions/runs/21774434459
- write: https://github.com/parentyai/member/actions/runs/21774435477
Rerun result: FAIL (ENV)
Evidence (rerun smoke):
- stderrHead: "unauthorized_client" (gcloud auth print-access-token attribute condition)
Rollback: revert this PR


UTC: 2026-02-07T05:56:06Z
main SHA: 1713ff853e299f4652adc45945723822e2930960
Action: "Phase23-T06 Phase22 scheduled PASS evidence (branch run)"
PR: https://github.com/parentyai/member/pull/242
Branch: phase23/t06-fix-phase22-scheduled-exit1
Branch SHA: 5227c96dcfcbfbfaf5aa28a4950831803c413a40
Runs:
- dryrun: https://github.com/parentyai/member/actions/runs/21775248303
- write: https://github.com/parentyai/member/actions/runs/21775248482
Stdout head:
- dryrun_stdout_head: {"utc":"2026-02-07T05:54:05.002Z","inputs":{"trackBaseUrl":"https://member-track-pvxgenwkba-ue.a.run.app","linkRegistryId":"Ls61KJFtn3YtYLpkzf1q","ctaA":"openA","ctaB":"openB","from":"2026-02-06T00:00:00Z","to":"2026-02-07T00:00:00Z","runs":"2"},"kpi":{"utc":"2026-02-07T05:54:16.879Z","ctaA":"openA","ctaB":"openB","sentA":4,"clickA":4,"ctrA":1,"sentB":4,"clickB":4,"ctrB":1,"deltaCTR":0},"gate":{"ok":true,"reasons":[],"params":{"minTotalSent":2,"minPerVariantSent":0,"minTotalClick":0,"minDeltaCtr":0},"kpi":{"utc":"2026-02-07T05:54:16.879Z","ctaA":"openA","ctaB":"openB","sentA":4,"clickA":4,"ctrA":1,"sentB":4,"clickB":4,"ctrB":1,"deltaCTR":0}},"result":"PASS"}
- write_stdout_head: {"utc":"2026-02-07T05:54:01.421Z","inputs":{"trackBaseUrl":"https://member-track-pvxgenwkba-ue.a.run.app","linkRegistryId":"Ls61KJFtn3YtYLpkzf1q","ctaA":"openA","ctaB":"openB","from":"2026-02-06T00:00:00Z","to":"2026-02-07T00:00:00Z","runs":"2"},"kpi":{"utc":"2026-02-07T05:54:13.524Z","ctaA":"openA","ctaB":"openB","sentA":3,"clickA":3,"ctrA":1,"sentB":3,"clickB":3,"ctrB":1,"deltaCTR":0},"gate":{"ok":true,"reasons":[],"params":{"minTotalSent":2,"minPerVariantSent":0,"minTotalClick":0,"minDeltaCtr":0},"kpi":{"utc":"2026-02-07T05:54:13.524Z","ctaA":"openA","ctaB":"openB","sentA":3,"clickA":3,"ctrA":1,"sentB":3,"clickB":3,"ctrB":1,"deltaCTR":0}},"result":"PASS"}
Smoke stdout head:
- dryrun_smoke_stdout_head: {"utc":"2026-02-07T05:54:17.556Z","ctaA":"openA","ctaB":"openB","sentA":4,"clickA":4,"ctrA":1,"sentB":4,"clickB":4,"ctrB":1,"deltaCTR":0}
- write_smoke_stdout_head: {"utc":"2026-02-07T05:54:14.336Z","ctaA":"openA","ctaB":"openB","sentA":4,"clickA":3,"ctrA":0.75,"sentB":3,"clickB":3,"ctrB":1,"deltaCTR":-0.25}
Query log (smoke stderr head):
- dryrun: {"action":"phase22_kpi_query","projectId":"member-485303","collection":"phase18_cta_stats","ctaTextA":"openA","ctaTextB":"openB","fromUtc":"2026-02-06T00:00:00Z","toUtc":"2026-02-07T00:00:00Z","filter
- write: {"action":"phase22_kpi_query","projectId":"member-485303","collection":"phase18_cta_stats","ctaTextA":"openA","ctaTextB":"openB","fromUtc":"2026-02-06T00:00:00Z","toUtc":"2026-02-07T00:00:00Z","filter
Result: PASS (branch run)
Note: PR #242 requires approval to merge before main re-run.
Rollback: revert PR #242

UTC: 2026-02-07T17:18:37Z
main SHA: 695116dd82940f99632e26aed07a6bd5a71ca9a6
Action: "Phase23-T09 CLOSE criteria SSOT"
Principle: "Phase CLOSE is rule-based, not discretionary." phaseResult=NO_MAIN_RUN closeDecision=NO_CLOSE

UTC: 2026-02-07T17:20:28Z
main SHA: 695116dd82940f99632e26aed07a6bd5a71ca9a6
Action: "Phase23-T10 CI fail3 eradication"
Evidence: https://github.com/parentyai/member/actions/runs/21783879563

UTC: 2026-02-07T15:40:18Z
main SHA: 9595c3232b9f7e1ee8ac115dbb102fe0d4c03cc0
Action: "Phase23-T08 Runbook minimal routing inputs SSOT"
Principle: "Runbook routing uses minimal inputs; other keys are diagnostic only."
