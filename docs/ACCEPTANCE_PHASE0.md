# Acceptance Phase0

Linked Task: P0-007, P0-121

## Acceptance Checklist (YES/NO)

Note:
- LINE webhook requires unauthenticated access. Org policy exception must allow `allUsers` for Cloud Run invoker on `member-webhook`.

### A. LINE
- [ ] LINE push send to a specific user works.
- [ ] Webhook receives events and stores LINE userId.
- [ ] Rich menu 4 slots link to mini app/external URLs.
- [ ] First-time welcome message sent exactly once.

### B. Mini App (Minimum)
- [ ] Auto-identification by LINE userId (no ID/pass).
- [ ] Inbox screen shows notifications with read/unread.
- [ ] Checklist screen shows 3-5 items by scenario/step.
- [ ] Each item has exactly one CTA and records click.

### C. Admin
- [ ] Create notification (title/body/CTA/link).
- [ ] Select scenario/step (A or C, 3mo/1mo/week/after1w).
- [ ] Targeting supports all/region/members-only.
- [ ] Preview -> test send -> scheduled or immediate send.
- [ ] History shows delivered/read/click counts.
- [ ] Kill Switch works (admin-only).
- [ ] Audit log records all actions.

### D. Safety
- [ ] Link missing blocks save.
- [ ] Link Registry exists with health check and WARN status.
- [ ] WARN links cannot be linked to notifications (or hard warning).
- [ ] Audit logs are immutable.

### E. Deploy / Access
- [ ] Cloud Run webhook edge (`member-webhook`) is reachable without auth (unauth 200 expected).

## Evidence Log
| Area | Date (YYYY-MM-DD) | Executor | Evidence link | Notes |
| --- | --- | --- | --- | --- |
| A. LINE | 2026-01-27 | arumamihsnob | LINE Console screenshot (2026-01-27) | Webhook verify 200 / Cloud Run log shows `accept` / webhook URL `https://member-webhook-pvxgenwkba-ue.a.run.app` |
| B. Mini App |  |  |  |  |
| C. Admin |  |  |  |  |
| D. Safety |  |  |  |  |
| E. Deploy / Access | 2026-01-27 | arumamihsnob | https://github.com/parentyai/member/actions/runs/21380967358 | member: `https://member-pvxgenwkba-ue.a.run.app` / webhook: `https://member-webhook-pvxgenwkba-ue.a.run.app` / allUsers invoker enabled |

## Phase0 Gate Evidence (2026-01-28, post-PR35)
| Check | Command | Expected | Actual | Evidence / Notes | Status |
| --- | --- | --- | --- | --- | --- |
| A) main SHA | `git rev-parse HEAD` | main最新SHAと一致 | `e227a5016d491a70b8b72322c5088ccc58787118` | https://github.com/parentyai/member/commit/e227a5016d491a70b8b72322c5088ccc58787118 | PASS |
| B) Actions green | `gh run view 21422926331 --json url,conclusion,headSha` | dry-run/deploy が success | `conclusion=success` / headSha一致 | https://github.com/parentyai/member/actions/runs/21422926331 | PASS |
| C) member 非公開 | `curl -i https://member-pvxgenwkba-ue.a.run.app/` + `gcloud run services get-iam-policy member ...` | 403 または allUsers無し | `HTTP/2 403` + allUsers無し | gcloud出力に allUsers 不在 / curl 403 | PASS |
| D) member-webhook 公開 | `gcloud run services get-iam-policy member-webhook ...` | allUsers/roles.run.invoker が存在 | `allUsers` あり | gcloud 出力に allUsers | PASS |
| E) healthz 200 | `curl -i https://member-webhook-pvxgenwkba-ue.a.run.app/healthz/` | 200 + JSON | 200 / `{"ok":true,"env":"stg"}` | curl 出力 | PASS |
| F) Webhook URL 確定 | LINE Console 設定確認 | URL が一致 | 一致 | LINE Console スクショ（2026-01-28） | PASS |
| G) 署名なし拒否 | `curl -i -X POST https://member-webhook-pvxgenwkba-ue.a.run.app/webhook/line -d '{}'` | 401 | 401 unauthorized | curl 出力 | PASS |
| H) Verify 成功 | LINE Console Verify + Cloud Logging | Verify成功 + acceptログ | Verify成功 + acceptログ確認 | LINE Console スクショ（2026-01-28）/ Cloud Logging | PASS |
| I) preflight/test/start | `npm run preflight` / `npm test` / `npm run start` + `curl -i http://localhost:8092/` | all PASS | preflight ok / tests pass / 200 ok (PORT=8092) | ターミナルログ | PASS |
| J) ガードレール逸脱 | `rg -n "listen\\(" src` 等 | 禁止事項に抵触なし | Guardrails を Phase0範囲内実装許可に更新 | docs/GUARDRAILS_PHASE0.md | PASS |
| K) TODO Done 証跡 | TODO_PHASE0.md | Evidence付きで閉じている | Evidence記載あり | TODO_PHASE0.md | PASS |

## Sign-off
- Reviewer: 
- Date: 
- Result: PASS / FAIL
