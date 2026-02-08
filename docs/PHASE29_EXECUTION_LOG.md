UTC: 2026-02-08T04:07:56Z
main SHA: ca17b0df6742ffdd64743393badaaa963c93b994
Action: "Phase29 START (ops-console list: UI統一 + optional cursor署名)"
Notes:
- Scope IN: A) `nextPageToken` を次回 `cursor` に渡す運用のSSOT化（docs + tests）
- Scope IN: B) optional cursor署名（HMAC）を後方互換で追加（secret未設定時は従来通り）
- Scope OUT: コスト最適化（Firestore read削減）、UI改修、フィルタ追加、署名強制（デフォルト）
Rollback: revert this PR

## Phase29 CLOSE DECLARATION

UTC: 2026-02-08T04:31:34Z
CLOSE=YES
phaseResult=ALL_PASS
closeDecision=CLOSE

EVIDENCE_MAIN_CI=https://github.com/parentyai/member/actions/runs/21792081104
EVIDENCE_MAIN_CI_CONCLUSION=success
MAIN_SHA=b1b5989d276985de13b5b0fd7eeae77165efed04
PR_URL=https://github.com/parentyai/member/pull/275
npm test: pass

CHECKLIST:
- PLAN exists: YES
- Top tasks implemented: YES
- tests added: YES
- npm test PASS: YES
- main CI PASS: YES
- docs append-only: YES

ROLLBACK:
- revert PR #275
