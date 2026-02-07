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

UTC: 2026-02-07T06:27:40Z
main SHA: f8dc0f7d72682c7bfe222ba810a1578aac3ac272
Action: "Phase23-T06 WIF attribute condition check + main auth evidence"
Root cause:
- attribute.ref mismatch (condition requires refs/heads/main; failure run headBranch=phase23/t05-fix-phase22-scheduled-exit1)
- unauthorized_client in /tmp/phase23_t06_evidence/run_21774435477_auth.log
Evidence:
- provider_describe: /tmp/phase23_t06_evidence/provider_20260207T062341Z.yaml
- provider_post: /tmp/phase23_t06_evidence/provider_post_20260207T062704Z.yaml
- sa_policy: /tmp/phase23_t06_evidence/sa_policy_20260207T062403Z.yaml
- failed_run (rerun/dispatch): https://github.com/parentyai/member/actions/runs/21774435477
Fix:
- attributeCondition (unchanged): assertion.repository=='parentyai/member' && assertion.ref=='refs/heads/main'
- run workflows on main for schedule/workflow_dispatch/rerun
Auth success (main):
- dryrun: https://github.com/parentyai/member/actions/runs/21775653534
  auth_log: /tmp/phase23_t06_evidence/run_21775653534_auth.log
- write: https://github.com/parentyai/member/actions/runs/21775654429
  auth_log: /tmp/phase23_t06_evidence/run_21775654429_auth.log
Rollback:
- gcloud iam workload-identity-pools providers update-oidc github-provider     --workload-identity-pool=github-pool     --location=global     --project=member-485303     --attribute-condition="assertion.repository=='parentyai/member' && assertion.ref=='refs/heads/main'"
- backup: /tmp/phase23_t06_evidence/provider_20260207T062341Z.yaml
Auth success (schedule main):
- dryrun: https://github.com/parentyai/member/actions/runs/21773790707
  auth_log: /tmp/phase23_t06_evidence/run_21773790707_auth_success.log

UTC: 2026-02-07T14:34:16Z
main SHA: f8dc0f7d72682c7bfe222ba810a1578aac3ac272
Action: "Phase23-T06 CLOSE evidence finalization"
Evidence URLs:
- workflow_dispatch dryrun: https://github.com/parentyai/member/actions/runs/21775653534
- workflow_dispatch write: https://github.com/parentyai/member/actions/runs/21775654429
- schedule dryrun: https://github.com/parentyai/member/actions/runs/21773790707
Evidence files:
- provider_describe: /tmp/phase23_t06_evidence/provider_20260207T062341Z.yaml
- sa_policy: /tmp/phase23_t06_evidence/sa_policy_20260207T062403Z.yaml
Decision Note:
- branch rerun unauthorized_client is expected under condition: assertion.repository=='parentyai/member' && assertion.ref=='refs/heads/main'
Rollback: revert this PR
