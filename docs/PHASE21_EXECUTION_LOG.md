# Phase21 Execution Log

UTC: 2026-02-05T01:56:01Z
main SHA: 522c59cefe476d8a602c9180e89c0cd1f9c19e2b
Action: "Phase21 scope fixed (docs-only)"
PR: #189 https://github.com/parentyai/member/pull/189
Diff: "docs/PHASE21_SCOPE.md only"
Test: "npm test PASS (75/75, fail 0)"

UTC: 2026-02-05T01:59:34Z
main SHA: af1293897bd1d6571f22f5c4702922364ab41cb7
Action: "Phase21 START declared (docs-only)"
DeclaredBy: "nobu"
Basis: "PHASE21_SCOPE.md fixed + scope-facts merged"
NonGoals: "no implementation / no decision / no behavior change"
Test: "npm test PASS (75/75, fail 0)"

UTC: 2026-02-05T04:05:44Z
main SHA: 881f07c90e9642e512c8fd8a247cb4d974e7bd78
Action: "Phase21 CLOSE verification run"
Command: "GOOGLE_APPLICATION_CREDENTIALS= FIRESTORE_PROJECT_ID=member-485303 ENV_NAME=stg node scripts/phase21_verify_day_window.js --trackBaseUrl=\"https://member-track-pvxgenwkba-ue.a.run.app\" --linkRegistryId=\"Ls61KJFtn3YtYLpkzf1q\""
Result: "exitCode=1"
Output: "/tmp/phase21_t10_verify.txt"
Test: "npm test PASS (81 passed, fail 0)"
Decision: "Phase21 CLOSE = NO"
Reason: "criteria not satisfied"

UTC: 2026-02-05T13:46:34Z
main SHA: 3a0d45a00b37dd5b156cb109cdcb94e3dbc47505
PR: #200
Action: "Phase21 CLOSE verification run (T13)"
Command: "node scripts/phase21_verify_day_window.js --track-base-url \"https://member-track-pvxgenwkba-ue.a.run.app\" --linkRegistryId \"Ls61KJFtn3YtYLpkzf1q\""
Result: "FAIL (exitCode=1)"
Output: "/tmp/phase21_t13_verify.txt"

UTC: 2026-02-05T13:51:07Z
main SHA: 5a213513cf0d19d003cf108cab3e558a73e35180
Action: "Phase21 verify rerun (T14) for failure evidence"
Command: "node scripts/phase21_verify_day_window.js --track-base-url \"https://member-track-pvxgenwkba-ue.a.run.app\" --linkRegistryId \"Ls61KJFtn3YtYLpkzf1q\" > /tmp/phase21_t14_verify_stdout.txt 2> /tmp/phase21_t14_verify_stderr.txt"
Result: "exitCode=1"
Output: "stdout=/tmp/phase21_t14_verify_stdout.txt stderr=/tmp/phase21_t14_verify_stderr.txt exit=/tmp/phase21_t14_exit_code.txt"
stdout (head):
{"trackBaseUrl":"https://member-track-pvxgenwkba-ue.a.run.app","fromUtc":"2026-02-05T00:00:00.000Z","toUtc":"2026-02-06T00:00:00.000Z","linkRegistryId":"Ls61KJFtn3YtYLpkzf1q"}
stderr (head):
Cannot find module 'firebase-admin'
Require stack:
- /Users/parentyai.com/Projects/Member/src/infra/firestore.js
- /Users/parentyai.com/Projects/Member/src/repos/firestore/notificationsRepo.js
- /Users/parentyai.com/Projects/Member/scripts/phase21_verify_day_window.js
