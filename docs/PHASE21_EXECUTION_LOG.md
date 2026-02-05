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

UTC: 2026-02-05T03:59:17Z
main SHA: 881f07c90e9642e512c8fd8a247cb4d974e7bd78
Action: "Phase21 T06/T07 implemented (code-only)"
PR: #196 https://github.com/parentyai/member/pull/196
Changed: "package.json | 3 +-, scripts/phase21_verify_day_window.js | 207 +, tests/phase21/phase21_t06_click_b_day_window.test.js | 105 +; 3 files changed, 314 insertions(+), 1 deletion(-)"
Test: "npm test PASS (81 passed)"
Script: "scripts/phase21_verify_day_window.js (exists)"
Test: "tests/phase21/phase21_t06_click_b_day_window.test.js (exists)"

UTC: 2026-02-05T13:02:40Z
main SHA: bf604e3816675edebf12882a7db0dc97e5550b01
Action: "Phase21 verify failed reason extracted"
Command: "node scripts/phase21_verify_day_window.js"
Result: "exitCode=1"
Output: "/tmp/phase21_t11_verify_out.txt"
Reason: "trackBaseUrl required"
Test: "npm test PASS (81 passed, fail 0)"
