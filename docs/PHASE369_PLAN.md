# PHASE369_PLAN

## 目的
Phase369 の read-path 収束タスクを add-only で実装し、既存互換を維持する。

## スコープ
- Phase369 対象の route/usecase/repo/ui/scripts
- tests/phase369/*
- docs/SSOT_INDEX.md

## 受入条件
- Phase369 の契約テストが PASS する。
- 
> member@0.0.0 test:docs
> node tools/verify_docs.js

[docs] OK / 
> member@0.0.0 pretest
> npm run test:docs


> member@0.0.0 test:docs
> node tools/verify_docs.js

[docs] OK

> member@0.0.0 test
> node --test tests/**/*.test.js

✔ auditLogsRepo: append writes createdAt (5.992292ms)
✔ auditLogsRepo: append respects provided createdAt (0.245875ms)
✔ recordClickAndRedirect: marks click and returns url (1.139292ms)
✔ recordClickAndRedirect: blocks WARN link (0.490375ms)
✔ killSwitch: default false, set true (0.740625ms)
✔ linkRegistryRepo: setHealth stores WARN state (1.701125ms)
✔ linkRegistryRepo: delete removes link (1.198125ms)
✔ createNotification: stores draft notification (1.105875ms)
✔ createNotification: stores normalized notificationCategory (0.291833ms)
✔ sendNotification: creates deliveries for matching users (2.421542ms)
✔ listNotifications: filters by scenarioKey (0.402333ms)
✔ notificationsRepo: create -> list with filter (1.252416ms)
✔ phase0 smoke (0.430666ms)
✔ testSendNotification: creates delivery after push (8.475584ms)
✔ testSendNotification: blocked when kill switch ON (2.930709ms)
✔ usersRepo: create -> get -> update (0.799625ms)
✔ validateSingleCta: accepts single CTA text (0.528ms)
✔ validateSingleCta: rejects missing CTA text (0.244542ms)
✔ validateSingleCta: rejects multiple CTAs (0.079833ms)
✔ validateLinkRequired: requires linkRegistryId (0.08075ms)
✔ validateLinkRequired: rejects direct URL (0.070375ms)
✔ validateWarnLinkBlock: blocks WARN state (0.070209ms)
✔ validateKillSwitch: blocks when ON (0.087792ms)
✔ validateNotificationPayload: passes when all checks ok (0.605209ms)
✔ webhook: valid signature creates user (1.541292ms)
✔ webhook: invalid signature rejected (0.206167ms)
✔ sendWelcomeMessage: sends once and records delivery (1.05175ms)
✔ webhook: welcome send is invoked for new user (2.07375ms)
✔ admin notifications: scenario only targeting (step ignored) (2.848208ms)
✔ admin notifications: linkRegistryId required (0.300625ms)
✔ admin notifications: events best-effort does not block (0.364375ms)
✔ checklistsRepo: create -> get -> list (1.181917ms)
✔ events integration: open requires notificationId (5.116792ms)
✔ events integration: click requires notificationId (0.576125ms)
✔ events integration: complete requires checklistId + itemId (2.540084ms)
✔ eventsRepo: create event (1.02825ms)
✔ eventsRepo: missing required fields throws (0.329375ms)
[phase1] checklist skipped: missing step
✔ getChecklistForUser: returns checklists for scenario/step (1.087208ms)
✔ getChecklistForUser: missing step returns empty (0.600584ms)
✔ logEventBestEffort: enforces type constraints (1.200458ms)
✔ phase1 smoke: notify -> delivery -> checklist -> events (6.234084ms)
✔ toggleChecklistItem: upserts and sets completedAt (1.679625ms)
✔ toggleChecklistItem: event failure does not block (1.626875ms)
✔ userChecklistsRepo: upsert -> get -> list (1.898125ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase101: ops assist suggestion includes suggestion/evidence/safety (18.352625ms)
✔ phase102: ops assist input shape is stable (1.061875ms)
✔ phase103: guard blocks invalid suggestion (1.303417ms)
✔ phase103: not ready forces STOP (0.449958ms)
✔ phase104: audit written for ok and block (0.529583ms)
✔ phase105: adopt audit appended (1.992292ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase106: llm disabled by default falls back to rules (11.447375ms)
✔ phase107: docs exist with required headings (1.110416ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U2 cacheHit=false inputHash=537233774f4b2f34de6ccc98996ddc0a704dd593447e713540ebb30150aa64e9 model=ops-assist-rules opsAssistInputHash=de2515a1df72528e84478ec4b8578df7577abf68ac5a24aa8d9724739c30cee3 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U3 cacheHit=false inputHash=70545ed0e9df1da70262da904475327f4e394fff62173bafb85085c3a3802d9b model=ops-assist-rules opsAssistInputHash=b0bb3a28bf10ada05df4241e6146d5a9cd995efb995eb50929d8c585f2f9e6b9 refreshReason=cache_miss
✔ phase108: suggest -> adopt -> submit audit flow (17.381208ms)
✔ phase117: resolve automation targets respects config filters (1.521791ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase118: suggestion schema is fixed (4.179584ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase119: audit append on suggestion includes notificationId (9.173709ms)
✔ implementation targets: single fixed entry (0.417125ms)
✔ implementation targets acceptance: fixed single IN target (0.839625ms)
✔ implementation targets acceptance: query does not change result (0.104083ms)
✔ implementation targets api: returns fixed registry (1.654292ms)
✔ ops readonly ui includes implementation targets section (0.682084ms)
✔ phase120: decision log stores source + suggestion snapshot (1.868708ms)
✔ phase121: ops notice send flow writes delivery and audit (39.228541ms)
✔ phase122: ops console view includes suggestion and audit id (0.542958ms)
✔ phase123: killSwitch blocks ops assist suggestion (0.6325ms)
✔ phase124: docs exist with required headings (0.877167ms)
[webhook] requestId=7ddfb281-4f0f-4789-b945-ffe90bfeef47 accept
[OBS] action=webhook result=ok requestId=7ddfb281-4f0f-4789-b945-ffe90bfeef47 lineUserId=U1
✔ phase125: SERVICE_MODE=webhook is webhook-only (+ appends webhook events) (43.036209ms)
✔ phase125: logLineWebhookEvents writes minimal schema (type + ref) (0.702708ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
[OBS] action=click result=ok requestId=unknown deliveryId=auto_1 linkRegistryId=l1
✔ phase126: existing POST /track/click still redirects and records clickAt (33.039625ms)
[OBS] action=click_post_compat result=reject requestId=unknown
✔ phase126: POST /track/click can be disabled via TRACK_POST_CLICK_ENABLED=0 (7.424667ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
✔ phase126: GET /t/{token} records clickAt + stats and redirects (43.065166ms)
✔ phase126: tampered token is rejected and does not write clickAt/stats (32.676625ms)
✔ phase126: expired token is rejected and does not write clickAt/stats (4.33175ms)
✔ phase127: docs exist with reaction definitions (0.713417ms)
✖ phase127: lastReactionAt prefers clickAt over readAt (18.488708ms)
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.846459ms)
✔ phase127: lastReactionAt is null when both clickAt/readAt missing (0.350041ms)
✔ phase128: stable ordering is deterministic and follows SSOT sort spec (1.145333ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase129: ops console view appends audit_logs with traceId (11.869584ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase130: NO_ACTION submit appends decision_logs + audit_logs (no execution) (2.014167ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase131: ops console includes add-only display fields (LINE-only reaction + execution message) (14.606334ms)
✔ phase132: kill switch blocks STOP_AND_ESCALATE (no send side effect) (4.755625ms)
✔ phase132: ops_readonly.html sets x-actor header to avoid actor=unknown (0.698541ms)
✔ phase132: execute fills traceId from existing decision audit when payload traceId missing (4.108542ms)
✔ phase133: GET /api/admin/trace returns audits/decisions/timeline for traceId (31.621583ms)
✔ phase134: run_trace_smoke.js completes with zero side effects and outputs trace bundle shape (128.515ms)
✔ phase134: run_trace_smoke.js exits non-zero on failure (33.073083ms)
✔ phase135: runbook and ssot index exist with required headings (1.143875ms)
✔ phase137: notification reaction summary aggregates deliveries deterministically (3.0105ms)
✔ phase137: ctr is 0 when sent is 0 (0.130291ms)
✔ phase138: read model includes add-only reactionSummary + notificationHealth without breaking existing keys (7.155958ms)
✔ phase138: reactionSummary always exists even when no deliveries (0.375209ms)
✔ phase139: notification health evaluation thresholds are fixed (0.502542ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase140: ops console includes notificationHealthSummary + topUnhealthyNotifications (add-only) (4.324875ms)
✔ phase141: suggests mitigation when health is bad (0.507375ms)
✔ phase141: returns null when no unhealthy notifications (0.078708ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase142: trace bundle includes notification_mitigation.decision audit + decision log snapshot (4.239959ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_3 failure_class=PASS nextAction=NO_ACTION
✔ phase145: audit logs cover view/suggest/decision/execute via single traceId (10.77325ms)
✔ phase150: RUNBOOK_OPS exists with required headings (0.720417ms)
✔ phase158: LAUNCH_CHECKLIST exists with required headings (0.4515ms)
✔ phase153: run_ops_smoke.js completes with guarded execute and trace bundle coverage (113.829833ms)
✔ phase160: checkNotificationCap passes includeLegacyFallback=false to delivery counters (2.27225ms)
✔ phase160: checkNotificationCap defaults includeLegacyFallback=true (0.198375ms)
✔ phase160: checkNotificationCap skips delivery counters during active quietHours (0.135458ms)
✔ phase160: checkNotificationCap uses snapshot counter when available (0.152583ms)
✔ phase160: deliveredAt backfill summary + apply (10.251917ms)
✔ phase160: delivery count uses deliveredAt and falls back to legacy sentAt (7.379584ms)
✔ phase160: notification caps normalize accepts extended fields (0.975708ms)
✔ phase160: notification caps block during quiet hours (0.189083ms)
✔ phase160: notification caps block when category is required but missing (0.077375ms)
✔ phase160: notification caps block per user daily before weekly (0.073375ms)
✔ phase160: notification caps normalize defaults to null (2.198875ms)
✔ phase160: notification caps reject invalid values (0.231583ms)
✔ phase160: notification caps block when delivered count reaches cap (0.218833ms)
✔ phase160: notification policy is no-op when servicePhase/preset are unset (0.540833ms)
✔ phase160: notification policy allows phase1 presetA immediate action (0.897042ms)
✔ phase160: notification policy blocks disallowed category (0.118833ms)
✔ phase160: SSOT docs exist for servicePhase and notificationPreset (2.071ms)
✔ phase160: servicePhase/preset getters return null when unset (1.083125ms)
✔ phase160: servicePhase/preset setters validate and persist (1.255084ms)
✔ phase161: admin pages include x-actor headers (2.098125ms)
✔ phase161: execute is blocked when per-user weekly cap is exceeded (11.551208ms)
✔ phase161: execute failure writes notifications.send.execute audit with ok=false (12.242958ms)
✔ phase161: composer flow draft -> approve -> plan -> execute (no real send) (11.882ms)
✔ phase161: partial send failure -> rerun executes remaining only (no double-send) (16.780709ms)
✔ phase161: execute is blocked when category is disallowed by servicePhase/preset (8.788959ms)
✔ phase161: docs exist for admin UI OS + data model + runbook (2.042458ms)
✔ redac membership: happy path links and persists hash+last4 (2.680208ms)
✔ redac membership: duplicate (linked to another user) is rejected (1.292875ms)
✔ redac membership: invalid format returns invalid_format (0.222959ms)
✔ redac membership: non-command message is noop (0.264958ms)
✔ redac membership: usage guidance when command prefix has no payload (0.185125ms)
✔ redac membership: usage guidance when help keyword is used (0.945208ms)
✔ redac membership: same user can replace their redac id (releases previous id) (0.553583ms)
✔ ops readonly ui includes Redac status display label (1.344792ms)
✔ admin redac unlink: happy path removes link and clears user fields (3.559417ms)
✔ admin redac unlink: not found returns 404 (1.884333ms)
✔ admin redac unlink: invalid format returns 400 (0.309042ms)
✔ phase164: LINE command "会員ID 確認" replies with status (last4 only) (4.102667ms)
✔ phase164: LINE command prefix without payload replies usage guidance (2.104959ms)
✔ phase164: redac line message templates include next action guidance (0.455916ms)
✔ phase170: deploy workflow supports stg/prod environment split (1.899167ms)
✔ phase170: deploy-webhook workflow supports stg/prod environment split (0.162459ms)
✔ phase170: deploy-track workflow supports stg/prod environment split (0.106917ms)
✔ phase171: parseArgs reads env defaults and supports skip flags (1.071917ms)
✔ phase171: parseArgs requires admin token (0.283375ms)
✔ phase171: buildTraceId is stable format (0.840458ms)
✔ phase171: evaluateExitCode treats skip as failure in strict mode (0.103542ms)
✔ phase171: markdown summary includes scenario status and trace (0.134584ms)
✔ phase171: normalizeNotificationCaps and buildActiveQuietHours are add-only safe (0.435625ms)
✔ phase171: resolveOutFile uses default artifacts directory (1.348167ms)
✔ phase173: master ui renders impact preview risk and breakdown labels (0.86025ms)
✔ phase173: master ui includes delivery recovery operation guidance (1.133042ms)
✔ phase174: all redac reply templates include explicit next action phrase (0.470625ms)
✔ phase177: redac status route returns sampled consistency summary (52.1155ms)
✔ phase177: master ui includes redac health section and status endpoint call (0.415334ms)
✔ phase178: deploy workflow grants runtime SA secret accessor for member secrets (0.661292ms)
✔ phase178: deploy-webhook workflow grants runtime SA secret accessor for webhook secrets (0.212291ms)
✔ phase178: deploy-track workflow grants runtime SA secret accessor for track token secret (0.1335ms)
✔ phase179: notification routes include structured route_error logging + trace/request in 500 payload (0.738625ms)
✔ phase179: logRouteError emits sanitized structured line (14.434125ms)
✔ phase180: parseArgs accepts route_error options (0.667959ms)
✔ phase180: parseArgs rejects fetch-route-errors without project id (0.266ms)
✔ phase180: buildRouteErrorLoggingFilter contains route_error prefix and trace id (0.120166ms)
✔ phase180: fetchRouteErrors parses gcloud output lines (0.661209ms)
✔ phase180: markdown summary prints route_error capture status (0.432958ms)
✔ phase181: deploy workflow requires explicit prod confirmation (0.549292ms)
✔ phase181: deploy-webhook workflow requires explicit prod confirmation (0.115916ms)
✔ phase181: deploy-track workflow requires explicit prod confirmation (0.098209ms)
✔ phase182: deploy workflow preflight validates required vars and secrets (0.604083ms)
✔ phase182: deploy-webhook workflow preflight validates required vars and secrets (0.132583ms)
✔ phase182: deploy-track workflow preflight validates required vars and secrets (0.105ms)
✔ phase183: parseArgs enables fetchRouteErrors when fail-on-route-errors is set (0.619709ms)
✔ phase183: parseArgs rejects fail-on-route-errors without project id (0.274083ms)
✔ phase183: strict gate marks PASS as FAIL when route_error is detected (0.095833ms)
✔ phase183: strict gate keeps original reason for already failed scenario (0.063834ms)
✔ phase183: strict gate is no-op when strict mode is disabled (0.058875ms)
✔ phase184: stg notification e2e workflow is defined with required inputs (1.93425ms)
✔ phase184: stg notification e2e workflow runs proxy and strict route error gate (0.450042ms)
✔ phase184: stg notification e2e workflow uploads artifacts (0.373291ms)
✔ phase185: deploy workflow preflight separates missing from permission issues (0.563041ms)
✔ phase185: deploy-webhook workflow preflight separates missing from permission issues (0.12125ms)
✔ phase185: deploy-track workflow preflight separates missing from permission issues (0.095625ms)
✔ phase186: stg e2e workflow preflight separates missing from permission issues (0.686583ms)
✔ phase186: segment query accepts loose lineUserIds format (1.242041ms)
✔ phase187 t01: read-model keys required by monitor/read_model (6.029208ms)
✔ phase188B: waitRule values produce nextWaitDays (3.174333ms)
✔ phase189: targetCountSource derives from plan audit (10.73725ms)
✔ phase190: cap count labels derived from execute audit (4.867875ms)
✔ phase191: SSOT read-model keys close loop to output + UI (3.960417ms)
✔ runPhase2Automation: dryRun does not write reports (2.494958ms)
✔ runPhase2Automation: writes reports when not dryRun (0.60375ms)
[OBS] action=click-write result=ok deliveryId=d1 ctaText=openA linkRegistryId=l1
✔ recordClickAndRedirect: track mode records stats (best-effort) and returns redirect url (1.179833ms)
✔ recordClickAndRedirect: member mode does not record stats unless explicitly enabled (0.239292ms)
✔ phase201: ops/monitor/read_model include status summary panels (0.96975ms)
✔ phase202: composer shows plan target count label (0.645542ms)
✔ phase202: ops segment plan note includes count (0.301875ms)
✔ phase203: ops has list/detail sections (0.993292ms)
✔ phase203: monitor has drilldown detail panel (0.175833ms)
✔ phase203: read-model has drilldown detail panel (0.111792ms)
✔ phase204: weekOverWeek delta is computed from deliveries (6.264291ms)
✔ phase205: plan returns capBlockedCount based on caps (8.568083ms)
✔ phase205: composer shows plan cap blocked count label (1.411167ms)
✔ phase206: dry-run stores run record and passes (2.884292ms)
✔ phase206: failure taxonomy mapping (0.47ms)
✔ phase206: self-send uses sendNotification without status update (8.981458ms)
✔ phase206: GET /api/admin/user-timeline returns deliveries + trace (40.664125ms)
✔ phase207: /admin/app and /admin/ui-dict are protected by admin token (35.66025ms)
✔ phase207: /admin/app returns shell and /admin/ui-dict returns dictionary when token is present (15.004167ms)
✔ phase207: all ui.* keys used in /admin/app exist in ADMIN_UI_DICTIONARY_JA (6.710917ms)
✔ phase209: master ui includes llm config controls (0.670333ms)
✔ phase209: master ui wires llm config endpoints (0.778875ms)
[OBS] action=click-write result=ok deliveryId=auto_4 ctaText=openB linkRegistryId=auto_1
✔ phase21 t06: clickCount increments for openB in day window (1.669541ms)
✔ phase21 t12: accepts --track-base-url and does not emit trackBaseUrl required (43.792291ms)
✔ phase21 t12: missing track base url exits with trackBaseUrl required (44.765541ms)
✔ phase21 t15: missing track base url exits with code 2 (39.441167ms)
✔ phase21 t16: verify env does not emit VERIFY_ENV_ERROR after npm ci (12.200709ms)
✔ phase21 t17: GAC set exits with code 2 (35.96075ms)
✔ phase21 t17: allow-gac bypasses guard (6.742167ms)
{"trackBaseUrl":"https://example.com","fromUtc":"2026-02-22T00:00:00.000Z","toUtc":"2026-02-23T00:00:00.000Z","linkRegistryId":"l1"}
✔ phase21 t18: invalid_rapt classified as env error (8.02125ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT=1 (3.688417ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT is not enabled (2.436292ms)
✔ testSendNotification: member mode records sent stats when ENV_NAME=stg even if PHASE18_CTA_EXPERIMENT is not enabled (0.642458ms)
✔ testSendNotification: track mode records sent stats without experiment flag (0.22125ms)
✔ ctaStatsRepo: incrementSent writes sentCount field (0.406834ms)
✔ phase210: master ui includes llm faq validation section (0.868708ms)
✔ phase210: master ui wires admin llm faq endpoint (1.418375ms)
✔ phase211: master ui includes llm ops explain / next actions section (0.705333ms)
✔ phase211: master ui wires llm ops endpoints (0.877708ms)
✔ phase212: admin app includes LLM nav and pane controls (1.148042ms)
✔ phase212: admin app wires LLM endpoints from pane actions (0.935917ms)
✔ phase213: admin app includes llm config controls in llm pane (1.599417ms)
✔ phase213: admin app wires llm config endpoints (0.815791ms)
✔ phase214: admin app includes llm audit drilldown button (1.173ms)
✔ phase214: admin app wires llm trace to audit pane search (0.601ms)
✔ phase215: admin app uses admin llm ops endpoints with legacy fallback (3.7045ms)
✔ phase215: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (69.678584ms)
✔ phase216: master llm ops panel uses admin endpoints first (0.808084ms)
✔ phase216: master llm ops panel keeps legacy fallback endpoints (1.296083ms)
✔ phase217: ops_readonly uses admin llm ops endpoints first (0.7525ms)
✔ phase217: ops_readonly keeps legacy llm ops fallback endpoints (0.311458ms)
✔ phase218: admin_app uses admin LLM endpoints first with legacy fallback (1.265334ms)
✔ phase218: master uses admin LLM endpoints first with legacy fallback (0.293041ms)
✔ phase218: ops_readonly uses admin LLM endpoints first with legacy fallback (0.305292ms)
✔ phase219: phaseLLM4 compat route appends deprecated metadata on blocked response (1.478584ms)
✔ phase219: phaseLLM4 compat route returns 400 on required/invalid parse errors (0.450917ms)
✔ phase22 t01: CTR calculation and delta (2.410042ms)
✔ phase22 t01: zero division yields 0 CTR (0.426084ms)
✔ phase22 t01: JSON structure keys (0.342458ms)
✔ phase22 t02: verify then kpi order with args (0.616625ms)
✔ phase22 t02: exit code mapping to env error (0.07375ms)
✔ phase22 t02: exit code mapping to runtime error (0.057208ms)
✔ phase22 t02: run executes verify then kpi (0.264208ms)
✔ phase22 t03: PASS when totals meet thresholds (0.516834ms)
✔ phase22 t03: FAIL when totalSent insufficient (0.108542ms)
✔ phase22 t03: FAIL when deltaCTR below threshold (0.078666ms)
✔ phase22 t03: PASS when minDeltaCtr is 0 even if deltaCTR negative (0.126333ms)
✔ phase22 t03: FAIL when required key missing (0.153125ms)
✔ phase22 t03: FAIL on JSON parse error (0.164708ms)
✔ phase22 t03: stdin read error yields env error code (0.501625ms)
✔ phase22 t04: PASS when gate exitCode=0 (3.046709ms)
✔ phase22 t04: FAIL when gate exitCode=1 (0.140667ms)
✔ phase22 t04: VERIFY_ENV_ERROR when gate exitCode=2 (0.08875ms)
✔ phase22 t04: snapshot throws => FAIL (0.086125ms)
✔ phase22 t04: runner throws => FAIL (0.07625ms)
✔ phase22 t05: upsertSnapshot sets createdAt serverTimestamp (0.852208ms)
✔ phase22 t05: upsertSnapshot uses merge true (0.21925ms)
✔ phase22 t05: no --write keeps exitCode and does not call repo (0.950708ms)
✔ phase22 t05: --write 1 calls repo and keeps exitCode on error (0.272917ms)
✔ phase22 t06: defaults return JSON (0.575333ms)
✔ phase22 t06: repo error yields LIST_ENV_ERROR exitCode=2 (0.156541ms)
✔ phase22 t06: limit and order applied (1.226333ms)
✔ phase22 t06: cta filters applied (0.301458ms)
✔ phase22 t07: PASS returns exitCode 0 and no record on dry-run (0.809833ms)
✔ phase22 t07: write=1 calls record after pass (0.136125ms)
✔ phase22 t07: FAIL bubbles exitCode 1 (0.626834ms)
✔ phase22 t07: VERIFY_ENV_ERROR bubbles exitCode 2 (0.110334ms)
✔ phase22 t07: runner exception returns exitCode 1 (0.153875ms)
✔ phase22 t08: workflow files exist and include runner (0.668959ms)
(node:94542) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase22/phase22_t10a_workflow_artifact_always.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase22 t10a: dryrun workflow uploads artifacts always (0.558417ms)
✔ phase22 t10a: write workflow uploads artifacts always (0.112458ms)
✔ phase22 t11: FAIL output includes reasonCode (1.536292ms)
✔ phase22 t12: INVALID_ARGS when required args missing (3.166167ms)
✔ phase22 t12: SUBPROCESS_EXIT_NONZERO when kpi+gate present (1.050583ms)
✔ phase22 t12: RUNTIME_ERROR when runAndGate throws (0.147541ms)
✔ phase22 t13: dryrun workflow uploads artifacts and writes summary (1.903958ms)
✔ phase22 t13: write workflow uploads artifacts and writes summary (0.576667ms)
✔ phase22 t14: dryrun workflow contains failure_class rules (0.462625ms)
✔ phase22 t14: write workflow contains failure_class rules (0.084375ms)
✔ phase22 t16: invalid_rapt => ENV classification (1.463167ms)
✔ phase22 t16: firebase-admin missing => ENV classification (0.157125ms)
✔ phase22 t16: generic stderr => IMPL classification (0.1125ms)
✔ phase22 t16: empty stderr => UNKNOWN classification (0.131125ms)
✔ phase22 t18: stderr is captured on exitCode!=0 (2.53675ms)
✔ phase22 t18: empty stderr yields zero bytes and capture=empty (0.174958ms)
✔ phase22 t18: spawn error yields SPAWN_ERROR signature (0.12025ms)
✔ phase22 t20: dryrun workflow provides FIRESTORE_PROJECT_ID (0.479833ms)
✔ phase22 t20: write workflow provides FIRESTORE_PROJECT_ID (0.071ms)
✔ phase22 t22: ok=true payload includes required keys (1.925167ms)
✔ phase22 t22: stderr present yields head and bytes (0.109541ms)
✔ phase22 t22: stderr empty yields (empty) head and 0 bytes (0.070916ms)
✔ phase220: /api/admin/llm/faq/answer is protected by admin token (fail-closed) (70.876125ms)
✔ phase221: /api/admin/llm/config/* require admin token (fail-closed) (63.179458ms)
✔ phase222: /api/admin/llm/config/* require x-actor when admin token is provided (55.712042ms)
✔ phase223: /api/admin/llm/faq/answer does not require x-actor (admin token provided) (67.612292ms)
✔ phase224: admin/master LLM FAQ request uses buildHeaders (x-actor included) (0.617667ms)
✔ phase224: admin/app LLM FAQ request uses buildHeaders (x-actor included) (0.486333ms)
✔ phase225: admin llm faq audit actor uses x-actor header when provided (70.155916ms)
✔ phase226: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (fail-closed) (60.656583ms)
✔ phase227 t01: /api/admin/llm/ops-explain passes x-actor to usecase params (17.812791ms)
✔ phase227 t02: /api/admin/llm/next-actions passes x-actor to usecase params (15.840166ms)
✔ phase227 t03: ops-explain audit actor follows params.actor (no llm) (3.810791ms)
✔ phase227 t04: next-actions audit actor follows params.actor (no llm) (3.721542ms)
✔ phase228: /api/phaseLLM2/ops-explain and /api/phaseLLM3/ops-next-actions require admin token (fail-closed) (50.303625ms)
✔ phase229: faq blocks when high-risk article has no contact source (8.577667ms)
✔ phase229: faq blocks when high-risk citation omits contact source (0.874208ms)
✔ phase229: faq passes when high-risk citation includes contact source (0.331083ms)
✔ phase229: faqArticlesRepo excludes expired validUntil and FAQ-disallowed intents (6.413209ms)
(node:94565) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t01_workflow_oidc_auth.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t01: dryrun workflow includes OIDC auth and setup-gcloud (0.629334ms)
✔ phase23 t01: write workflow includes OIDC auth and setup-gcloud (0.08875ms)
(node:94566) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t02_workflow_summary_keys.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t02: dryrun workflow summary includes required keys (0.5065ms)
✔ phase23 t02: write workflow summary includes required keys (0.332334ms)
(node:94567) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t03_workflow_human_decision_hint.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t03: dryrun workflow includes humanDecisionHint rules (0.456875ms)
✔ phase23 t03: write workflow includes humanDecisionHint rules (0.080083ms)
(node:94568) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t05_workflow_service_mode_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t05: dryrun workflow sets SERVICE_MODE=member (0.503667ms)
✔ phase23 t05: write workflow sets SERVICE_MODE=member (0.071333ms)
(node:94569) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t06_workflow_verify_rest_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t06: dryrun workflow sets PHASE21_VERIFY_REST=1 (0.503792ms)
✔ phase23 t06: write workflow sets PHASE21_VERIFY_REST=1 (0.075167ms)
(node:94570) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_minimal_inputs.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: decision table uses minimal routing inputs (2.079542ms)
✔ phase23 t08: required observation keys match decision inputs (0.384042ms)
(node:94571) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_observation_keys_match_workflow.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: observation keys match workflow summary keys (0.991709ms)
(node:94572) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_decision_table_complete.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close decision table exists and has required columns (0.868ms)
✔ phase23 t09: closeDecision values are CLOSE or NO_CLOSE (0.211834ms)
(node:94573) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_log_matches_runbook.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close declaration includes phaseResult and closeDecision (0.447875ms)
✔ phase230: faq blocks when top score is below minimum confidence (6.098792ms)
✔ phase230: faq blocks when top1/top2 ratio is below threshold (0.378625ms)
✔ phase230: faq allows confident candidates to proceed (0.687917ms)
✔ phase230: faq repo ranking prefers keyword > synonym > tag matches (4.759791ms)
✔ phase231: faq includes disclaimer version in response and audit events (6.370583ms)
✔ phase231: faq blocked response still includes disclaimer and rendered audit (0.48275ms)
✔ phase231: ops explanation and next actions include disclaimer version and rendered audit (4.968708ms)
✔ phase232: /admin/app includes FAQ block UX panel elements (0.962792ms)
✔ phase232: /admin/master includes FAQ block UX panel elements (0.224125ms)
✔ phase232: admin app dictionary has block UX keys (1.859083ms)
✔ phase232: faq blocked payload includes category/actions/suggestions for kb_no_match (5.30425ms)
✔ phase232: faq blocked payload provides fallback actions and max-3 suggested FAQs (0.660083ms)
✔ phase233: next action candidates are abstract-only and sanitized to contract keys (2.925792ms)
✔ phase233: ops explanation includes fixed template sections (2.122917ms)
✔ phase234: FAQ blocks with consent_missing when lawfulBasis=consent and consentVerified=false (3.838208ms)
✔ phase234: llm config plan/set supports llmPolicy snapshot and hash verification (37.411667ms)
✔ phase234: ops/next-actions audit payload includes llmPolicy snapshot fields (2.621166ms)
✔ phase235: checklist_guidance mode is allowed and returns answer when guard passes (3.642833ms)
✔ phase235: guide-only mode blocks free-chat mode (3.69025ms)
✔ phase235: personalization beyond allow-list is blocked (2.8555ms)
✔ phase24 t02: appendDecision sets decidedAt and createdAt serverTimestamp (0.831959ms)
✔ phase24 t02: appendDecision does not overwrite previous entries (0.174167ms)
✔ phase24 t02: getLatestDecision returns most recent by decidedAt (0.906542ms)
✔ phase24 t02: invalid decision enum is rejected (0.717542ms)
✔ phase24 t03: memberNumber missing => BLOCK (0.479291ms)
✔ phase24 t03: memberNumber stale => WARN (0.072542ms)
✔ phase24 t03: memberNumber ok => INFO (0.494166ms)
✔ phase24 t03: checklist incomplete => WARN (0.067958ms)
✔ phase24 t04: missing linkRegistryId => BLOCK (1.080792ms)
✔ phase24 t04: invalid ctaText => BLOCK (0.135166ms)
✔ phase24 t04: missing deliveries => WARN (0.07375ms)
✔ phase24 t04: event without delivery => BLOCK (0.065417ms)
✔ phase24 t05: progress without definition => BLOCK (0.513625ms)
✔ phase24 t05: missing required item => BLOCK (0.079375ms)
✔ phase24 t05: completed but incomplete => BLOCK (0.070125ms)
✔ phase24 t05: required satisfied => ok and complete (0.506208ms)
✔ phase24 t06: memberNumber missing => BLOCK (0.636917ms)
✔ phase24 t06: memberNumber invalid format => WARN (0.138958ms)
✔ phase24 t06: duplicate memberNumber => BLOCK (0.1145ms)
✔ phase24 t06: normal => OK (0.326792ms)
✔ phase24 t07: recordOpsNextAction appends decisionLog and upserts opsState (0.681333ms)
✔ phase24 t07: invalid nextAction is rejected (0.261042ms)
✔ phase24 t07: upsert stores updatedAt serverTimestamp (0.708083ms)
✔ phase24 t07: phase23 runbook still contains decision table keys (0.417125ms)
✔ phase24 t08: missing opsState => WARN (0.683125ms)
✔ phase24 t08: missing nextAction => WARN (0.190334ms)
✔ phase24 t08: opsState with nextAction => OK (0.177375ms)
✔ phase24 t08: summary includes opsState when present (2.986792ms)
✔ phase24 t09: missing opsState => WARN missing_ops_state (0.833333ms)
✔ phase24 t09: missing decision log => WARN missing_decision_log (0.091125ms)
✔ phase24 t09: mismatched nextAction => WARN mismatched_next_action (0.089292ms)
✔ phase24 t09: matching decision log => OK (0.078084ms)
✔ phase24 t10: all OK => READY (0.914208ms)
✔ phase24 t10: warn missing in opsStateCompleteness => NOT_READY (0.113292ms)
✔ phase241: /admin/ops redirects to /admin/app when authenticated (23.350708ms)
✔ phase241: notification deliveries API supports memberNumber search and vendor fallback (23.409333ms)
✔ phase241: monitor insights returns vendor CTR, AB snapshot, FAQ reference top (23.936ms)
✔ phase241: admin app removes status summary panels from operational panes (0.802708ms)
✔ phase241: admin app includes monitor user timeline and insights sections (0.365541ms)
✔ phase241: ops safe test flow propagates traceId into monitor pane (0.920958ms)
✔ phase241: all ui.* keys used in /admin/app are present in dictionary (3.698875ms)
✔ phase243: faqArticlesRepo accepts version fallback and excludes invalid schema rows (3.831875ms)
✔ phase244: blocked low_confidence returns kbMeta and policySnapshotVersion (9.388125ms)
✔ phase244: success response includes kbMeta and policySnapshotVersion (0.90275ms)
✔ phase245: FAQ writes llm_disclaimer_rendered with surface=api (8.991666ms)
✔ phase245: Ops explain writes llm_disclaimer_rendered with surface=api (0.600834ms)
✔ phase245: Next actions writes llm_disclaimer_rendered with surface=api (0.590125ms)
✔ phase246: blocked payload always includes safe fallbackActions and suggestedFaqs <= 3 (8.651167ms)
✔ phase246: admin app filters direct URL sourceId in block panel (0.499625ms)
✔ phase247: ops template sections order is fixed (2.207416ms)
✔ phase247: next action internal enum stays uppercase (0.704041ms)
✔ phase247: admin app lowercases next actions for display only (0.567166ms)
✔ phase248: blocked reason taxonomy mapper is shared (0.39975ms)
✔ phase248: FAQ audit stores regulatoryProfile (9.447875ms)
✔ phase248: Ops/NextAction audits include regulatoryProfile (1.110541ms)
✔ phase249: guide-only modes remain allowed (9.291458ms)
✔ phase249: non guide-only mode is blocked (0.319625ms)
✔ phase249: personalization is restricted to locale/servicePhase (0.236917ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d123 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t02: dryRun does not write and returns readiness (1.134792ms)
✔ phase25 t02: dryRun false writes and returns decisionLogId (6.956541ms)
✔ phase25 t02: readiness NOT_READY still returns ok (0.419916ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t03: ops console returns required keys (4.747375ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t04: console recommendedNextAction flows into submit (9.225458ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=invalid nextAction
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=ENV nextAction=RERUN_MAIN reason=invalid nextAction
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t05: READY writes audit snapshot (7.714583ms)
✔ phase25 t05: READY rejects nextAction not in allowedNextActions (0.346041ms)
✔ phase25 t05: NOT_READY allows only STOP_AND_ESCALATE (0.308541ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=PASS nextAction=NO_ACTION reason=invalid consistency
✔ phase25 t06: opsState missing => WARN (0.584458ms)
✔ phase25 t06: decisionLog missing => WARN (0.107916ms)
✔ phase25 t06: opsState source mismatch => FAIL (0.12075ms)
✔ phase25 t06: missing audit snapshot => FAIL (0.084917ms)
✔ phase25 t06: submit rejects on consistency FAIL (1.307667ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t07: READY recommended is in allowedNextActions (13.588084ms)
✔ phase25 t07: NOT_READY forces STOP_AND_ESCALATE only (0.338083ms)
✔ phase25 t07: consistency FAIL downgrades readiness to NOT_READY (0.259833ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t08: READY yields closeDecision CLOSE (12.173625ms)
✔ phase25 t08: NOT_READY yields closeDecision NO_CLOSE (0.320375ms)
✔ phase25 t08: consistency FAIL yields closeDecision NO_CLOSE (0.262541ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t09: audit includes closeDecision fields (9.638ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=NO_ACTION reason=closeDecision closed
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=closeDecision: NO_CLOSE
✔ phase25 t10: CLOSE rejects submit (1.712708ms)
✔ phase25 t10: NO_CLOSE rejects non-escalate actions (0.189375ms)
✔ phase250: source audit classifies ok/redirect/http_error/timeout and stores screenshot paths (2.972542ms)
✔ phase250: confirm extends validUntil by 120 days and sets active (1.646583ms)
✔ phase250: retire returns warning when source is still used by city packs (0.564375ms)
✔ phase250: sendNotification blocks when referenced source is expired (1.879917ms)
✔ phase250: canary run stores run summary, evidence and audit logs with traceId (4.141792ms)
✔ phase250: review inbox requires admin token and internal audit route requires job token (88.685958ms)
✔ phase251 t01: parseArgs reads required env and trims service url (0.57825ms)
✔ phase251 t01: parseArgs supports canary mode and ids (0.631375ms)
✔ phase251 t01: parseArgs rejects invalid mode (0.219417ms)
✔ phase251 t01: parseArgs rejects unknown args (0.073542ms)
✔ phase251 t02: invokeCityPackAudit returns ok on 200/ok:true (1.126458ms)
✔ phase251 t02: invokeCityPackAudit returns fail on non-2xx (0.135125ms)
✔ phase251 t02: invokeCityPackAudit falls back on invalid json response (0.122125ms)
✔ phase251 t03: workflow exists and calls runner script (0.840334ms)
✔ phase252: city pack audit runs API requires token and returns summary/status (36.788542ms)
✔ phase252: admin app includes city pack run history panel and controls (1.211375ms)
✔ phase252: index routes include city-pack-source-audit/runs (1.386458ms)
✔ phase253: city pack run detail API requires token and returns run + evidences (27.934792ms)
✔ phase253: admin app includes city pack trace button and run detail fetch (1.10525ms)
✔ phase253: index routes include city-pack-source-audit/runs/:runId (1.334833ms)
✔ phase254: admin app includes city pack run detail table and raw drawer (0.784666ms)
✔ phase254: run detail renderer opens evidence and handles missing trace (0.901458ms)
✔ phase254: city pack run detail dictionary keys are defined (0.739542ms)
✔ phase256: city pack run detail API applies evidence limit query (26.581667ms)
✔ phase256: admin app includes run detail limit input and query wiring (1.165292ms)
✔ phase256: dictionary includes city pack run detail limit keys (0.720958ms)
✔ phase26: ops console list includes memberFlags (add-only) (1.768833ms)
✔ phase26 t01: list splits READY/NOT_READY and returns required keys (1.705917ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U2 decisionLogId=d2 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase26 t02: postCheck verifies READY decisions (8.001125ms)
✔ phase26 t02: postCheck verifies NOT_READY decisions (0.341542ms)
✔ phase26 t03: docs exist with required headings (0.891708ms)
✔ phase26 t04: list returns pageInfo placeholder (1.950916ms)
✔ phase26 t04: list returns pageInfo even when empty (0.433208ms)
✔ phase260: region declare creates request and user fields (3.613833ms)
✔ phase260: draft job creates source refs and draft city pack (4.25925ms)
✔ phase260: city-pack-requests routes require admin token (28.922041ms)
✔ phase260: internal city-pack draft job requires token (32.373916ms)
✔ phase260: admin app includes city pack request panel (0.939542ms)
✔ phase261: /admin/app uses decision cards and removes summary header blocks (1.04975ms)
✔ phase261: decision state rules are fixed to READY/ATTENTION/STOP (1.6245ms)
✔ phase261: details auto-open for ATTENTION/STOP (0.619666ms)
✔ phase261: vendor facade list/edit/activate/disable keeps compatibility with link_registry (35.211208ms)
✔ phase261: vendor actions require and persist traceId in audit logs (47.290417ms)
✔ phase261: initial pane contract keeps 3-action decision layout (1.133708ms)
✔ phase262: admin_app defines Alt+0..9 pane shortcuts (contract) (1.345834ms)
✔ phase262: admin.css provides focus-visible and reduced-motion rules (contract) (1.019125ms)
✔ phase263: decision card state classes exist in CSS and JS (contract) (0.983541ms)
✔ phase263: decision reasons are built via shared 2-line formatter (contract) (1.488625ms)
✔ phase264: admin.css provides table scroll + sticky header rules (contract) (0.632875ms)
✔ phase264: vendor table supports arrow key navigation + enter select (contract) (1.080458ms)
✔ phase266: city pack create normalizes targetingRules and slots (1.446708ms)
✔ phase266: city pack structure update route requires admin token and appends audit (33.613125ms)
✔ phase266: draft job creates default targetingRules and slots (6.094583ms)
✔ phase266: admin app includes city pack structure editor controls (1.101625ms)
✔ phase266: admin app wires city pack structure save endpoint (1.462958ms)
✔ phase267: source ref policy fields are normalized and persisted (0.852542ms)
✔ phase267: source policy route requires admin token and writes audit (38.484917ms)
✔ phase267: optional source failures do not block city pack validation (1.106625ms)
✔ phase267: required source failures still block city pack validation (0.2795ms)
✔ phase267: sendNotification uses cityPackFallback when only optional sources are invalid (3.76775ms)
✔ phase267: sendNotification remains fail-closed when required source is invalid (0.551292ms)
✔ phase267: admin app city pack pane has source policy controls (0.931292ms)
✔ phase267: admin app JS posts source policy update endpoint (1.743666ms)
✔ phase268: light/heavy stage updates source confidence and stage fields (6.937166ms)
✔ phase268: review inbox exposes priority/confidence/audit stage and sorts by priority (33.928666ms)
✔ phase268: internal light/heavy city pack audit routes require token and set stage (132.65075ms)
✔ phase268: city pack pane includes priority/confidence/stage columns and run mode options (1.23625ms)
✔ phase268: city pack run action posts stage and mode (1.468167ms)
✔ phase269: city pack structure editor includes basePackId input with dict keys (0.801417ms)
✔ phase269: admin app reads basePackId input and posts it on structure save (4.1885ms)
✔ phase269: city pack structure update validates base pack depth and self reference (0.50675ms)
✔ phase269: cityPacksRepo normalizes basePackId and overrides in structure patch (1.280167ms)
✔ phase27 t01: docs exist with required headings (0.753583ms)
✔ phase27 t02: list sorts READY first then cursorCandidate desc then lineUserId (2.952042ms)
✔ phase27 t02: list stabilizes order by lineUserId when cursorCandidate is null (12.675334ms)
✔ phase27 t03: list guards required keys/types when console result is missing fields (6.784125ms)
✔ phase27 t04: list keeps pagination compatibility keys (nextPageToken + pageInfo) (1.716709ms)
✔ phase27 t04: list returns pagination keys even when items is empty (0.457542ms)
✔ phase270: City Pack Feedback command stores feedback and event (1.601792ms)
✔ phase270: city-pack-feedback routes require admin token (40.231708ms)
✔ phase270: admin app includes feedback inbox and detail panels (0.878083ms)
✔ phase270: admin app loads feedback and posts actions (0.966959ms)
✔ phase271: city-pack-bulletins routes require admin token (37.594709ms)
✔ phase271: bulletin send uses sendNotification + killSwitch guard (0.796875ms)
✔ phase271: update proposal allowlist enforced and apply updates city pack (86.151042ms)
✔ phase271: admin app includes bulletin inbox and detail panels (2.262625ms)
✔ phase271: admin app includes proposal inbox and detail panels (0.93925ms)
✔ phase271: bulletin/proposal dictionary keys exist (3.089ms)
✔ phase272: composer pane contains type-driven form, live preview, and saved list blocks (0.888916ms)
✔ phase272: non-STEP defaults are fixed to scenario A / week / limit 50 (1.567542ms)
✔ phase272: GET /api/admin/os/notifications/list returns rows under admin guard (73.449875ms)
✔ phase272: GET /api/admin/os/link-registry/:id returns lookup payload and enforces admin token (69.399458ms)
✔ phase272: composer danger actions require confirm and keep trace-aware calls (3.20075ms)
✔ phase272: composer type-driven dictionary keys exist (3.555167ms)
✔ phase272: createNotification stores notificationType and notificationMeta add-only fields (1.997875ms)
✔ phase273: city-pack-metrics route is admin-guarded and persists daily rows (43.4115ms)
✔ phase273: computeCityPackMetrics aggregates by cityPack/slot/sourceRef with unmapped fallback (13.839708ms)
✔ phase273: admin app has city pack metrics panel and loader wiring (1.365125ms)
✔ phase273: city pack metrics dictionary keys exist (3.415708ms)
✔ phase273: index wires /api/admin/city-pack-metrics into city pack admin route set (1.36475ms)
✔ phase274: city pack route supports export + import dry-run/apply with confirm token (1.299041ms)
✔ phase274: template library route exposes list/create/detail/activate/retire (1.3435ms)
✔ phase274: template library repo uses city_pack_template_library collection (0.361375ms)
✔ phase274: index wires city pack import/export + template library endpoints (2.4685ms)
✔ phase274: app.html contains template library and import/export controls in city pack pane (0.942833ms)
✔ phase274: admin_app wires template library load and import/export actions (1.031291ms)
✔ phase274: template library/import-export dictionary keys exist (3.466167ms)
✔ phase28 t01: docs exist with required headings (0.983958ms)
✔ phase28 t02: pagination returns page1/page2 without overlap and stable order (15.852709ms)
✔ phase28 t03: invalid cursor is rejected (1.052583ms)
✔ phase28 t04: READY priority holds across pages (17.147875ms)
✔ phase28 t05: required keys are present on all pages (24.952334ms)
✔ phase29 t01: nextPageToken can be used as cursor (compatible with pageInfo.nextCursor) (11.64975ms)
✔ phase29 t02: signed cursor is returned and can paginate without overlap (optional security) (11.32625ms)
✔ phase29 t03: signed cursor verifies signature and enforce mode rejects unsigned cursor (21.022542ms)
✔ phase30 t01: cursorInfo defaults to UNSIGNED and enforce=false (2.673958ms)
✔ phase30 t02: cursorInfo reflects signing/enforce even when items empty (2.265458ms)
✔ phase304: composer pane keeps type-driven form + live preview + saved list while hiding trace input UI (3.287209ms)
✔ phase304: css enforces no-fold behavior and hides decision summaries (0.585041ms)
✔ phase304: dashboard KPI endpoint is wired and returns six KPI keys contract (0.691083ms)
✔ phase304: saved filter uses AND conditions and preview reflects CTA2 (2.317542ms)
✔ phase306: city_pack_requests persists add-only experience fields (5.530458ms)
✔ phase306: city_pack_feedback supports slot/message/resolution and status extensions (0.944083ms)
✔ phase306: draft job writes slotContents + request experience fields (3.399625ms)
✔ phase306: kill switch blocks city pack admin/internal write operations (34.26475ms)
✔ phase306: city pack pane shows request stage/warning/aging and feedback slot/resolution (0.780958ms)
✔ phase306: city pack feedback actions include triage/resolve handlers (0.604208ms)
✔ phase306: index routes include city-pack-feedback triage/resolve actions (0.624167ms)
✔ phase306: city pack request/feedback dictionary keys exist (3.180916ms)
✔ phase307: legacy duplicate repos are frozen as canonical forwarders (no direct db write) (3.695917ms)
✔ phase307: canonical user query path does not reintroduce scenario-field filtering (0.543834ms)
✔ phase307: ops review flow normalizes drift fields before writing (0.332375ms)
✔ phase307: missing-index fallback points do not exceed audit baseline (3.554166ms)
✔ phase307: newly added structural files do not introduce fallback catches (0.570958ms)
✔ phase307: normalizeOpsStateRecord keeps canonical keys only (0.899084ms)
✔ phase307: opsStateRepo read prefers canonical ops_states then falls back to legacy ops_state (0.599791ms)
✔ phase307: protection matrix resolves expected auth classes (1.51225ms)
✔ phase307: index.js routes protection via resolvePathProtection reference (1.013208ms)
✔ phase307: internal retention dry-run route requires only internal token (not admin token) (141.956416ms)
✔ phase307: retention dry-run does not delete docs and appends audit log (38.49375ms)
✔ phase307: normalizeScenarioKey absorbs scenario/scenarioKey drift (0.494083ms)
✔ phase307: usersRepo.listUsers accepts legacy scenario input and queries canonical scenarioKey (0.755792ms)
✖ phase308: top3 analytics hotspots use explicit bounded limits (5.602666ms)
✔ phase308: runtime routes/scripts do not import legacy duplicate repos (0.626875ms)
✔ phase308: missing-index fail mode defaults to true on stg/prod env (0.445875ms)
✔ phase308: every repo fallback branch has indexFallbackPolicy hooks (3.669625ms)
✔ phase308: retention dry-run fails closed on undefined collection policy (96.646375ms)
✔ phase308: retention policy covers all collections from audit lifecycle snapshot (0.554583ms)
✔ phase308: struct drift backfill supports dry-run and apply with audit trace (68.076292ms)
✔ phase309: struct drift backfill supports resumeAfterUserId cursor (14.709334ms)
✔ phase309: admin struct drift routes require admin token and support list/execute (47.913375ms)
✔ phase309: retention apply is env/flag guarded and filters by policy (54.040333ms)
✔ phase309: ops snapshot job builds snapshots and dashboard reads snapshot first (60.918958ms)
✔ phase309: review legacy page exposes LEGACY guidance to /admin/app (1.726792ms)
✔ phase309: admin app includes struct drift panel controls and handlers (1.965167ms)
✔ phase309: trace repos use index-oriented where+orderBy queries (0.956541ms)
✔ phase31 t01: ops_readonly includes ops console list/detail/submit sections (0.693875ms)
✔ phase31 t02: ops_readonly defines ops console fetch/submit helpers (0.893083ms)
✔ phase310: repo_map_ui.json exposes required machine-readable sections (0.584666ms)
✖ phase310: repo-map check mode passes when generated artifact is current (99.610417ms)
✔ phase310: /api/admin/repo-map is admin protected and returns payload for authorized actor (83.354083ms)
✔ phase310: app shell includes developer menu and developer-map pane hooks (1.205542ms)
✔ phase310: developer-map pane keeps no-fold structure (1.076083ms)
✔ phase310: developer labels exist in dictionary and audit workflow checks repo-map drift (3.317625ms)
✔ phase311: repo map exposes three layers and canonical developer statuses (1.282209ms)
✔ phase311: feature completion maps deterministically to developer status (4.386334ms)
✔ phase311: /api/admin/repo-map remains admin-guarded and returns layers (82.803167ms)
✔ phase311: redac/user manuals are rendered without details blocks (0.83875ms)
✔ phase311: repo map keeps japanese glossary for internal terms and manual labels (4.557167ms)
✔ phase311: developer matrix render uses scenario-step cells with count and state labels (2.828083ms)
✔ phase311: audit workflow and package scripts enforce repo-map drift checks (1.670208ms)
✔ phase312: snapshot read mode defaults to prefer (0.5255ms)
✔ phase312: snapshot read mode supports require and legacy disabled compatibility (0.117042ms)
✔ phase312: dashboard KPI returns NOT AVAILABLE and no full-scan fallback in require mode (51.96575ms)
✔ phase312: require mode returns NOT AVAILABLE placeholders for summary/state when snapshot is missing (1.783833ms)
✔ phase313: /api/admin/legacy-status is admin guarded and returns legacy route summary (74.77025ms)
✔ phase313: developer map includes LEGACY status controls without removing existing routes (2.725958ms)
✔ phase313: index wires /api/admin/legacy-status route (1.238792ms)
✔ phase314: retention apply rejects unmatched dryRunTraceId and accepts matched trace (43.041917ms)
✔ phase314: retention apply supports maxDeletes/cursor and appends audit payload (49.964791ms)
✖ phase315: cleanup check script passes when generated artifacts are current (128.122833ms)
✔ phase315: unreachable baseline files are frozen with LEGACY marker (2.366709ms)
✔ phase315: legacy aliases carry LEGACY_HEADER and canonical forwarding (0.554125ms)
✔ phase315: INDEX_PLAN covers all fallback source files from audit input (0.465291ms)
✔ phase315: retention addendum and lifecycle cover all retention policy collections (0.965458ms)
✔ phase315: protection matrix keeps admin/internal protection classes (0.991625ms)
✔ phase315: internal job routes keep token guard and killSwitch dependency map is generated (0.489625ms)
✔ phase316: analytics range queries return only bounded rows (2.224375ms)
✔ phase316: dashboard KPI read path uses bounded range queries for events/deliveries (0.532875ms)
✔ phase316: user operational summary sources users from canonical usersRepo listUsers (0.627208ms)
✖ phase317: notification operational summary uses bounded range query with legacy fallback (8.537042ms)
✔ phase317: notification summary ignores events older than notification sendAt in bounded path (7.149209ms)
✔ phase318: analytics users/notifications range queries return only bounded rows (2.665916ms)
✔ phase318: dashboard KPI read path uses bounded range queries for users/notifications with fallback (0.466959ms)
✖ phase319: user operational summary uses range-first events/deliveries with fallback (5.824792ms)
✔ phase319: range-first path ignores out-of-window events when bounded set is non-empty (4.838708ms)
✔ phase32 t01: READY suggestions filtered to allowedNextActions (4.81075ms)
✔ phase32 t02: NOT_READY suggests STOP_AND_ESCALATE only (1.9675ms)
✔ phase32 t03: llm failure yields empty suggestions (8.07475ms)
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (9.631ms)
✔ phase320: range-first path for user state ignores older events outside user window when bounded set is non-empty (3.945875ms)
✔ phase321: monitor insights uses sentAt range query first with bounded fallback (0.493ms)
✔ phase321: monitor insights excludes out-of-window delivery when bounded set is non-empty (26.923791ms)
✔ phase322: phase2 automation uses range path when weekly events exist (2.259417ms)
✔ phase322: phase2 automation falls back to listAll events when weekly range is empty (2.353ms)
✔ phase323: phase5 notifications summary route parses limit/eventsLimit bounds (0.577958ms)
✔ phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary (0.436ms)
✔ phase324: phase5 users summary route parses limit/analyticsLimit bounds (0.466958ms)
✔ phase324: users filtered usecase forwards limit/analyticsLimit to operational summary (0.430708ms)
✔ phase325: phase5 stale member route parses limit bounds (0.460125ms)
✔ phase325: stale member summary respects limit option (0.959459ms)
✔ phase326: phase4 users summary route parses limit/analyticsLimit bounds (0.455375ms)
✔ phase326: user operational summary respects limit option (3.80525ms)
✔ phase327: phase4 notifications route parses limit/eventsLimit bounds (0.458833ms)
✔ phase327: notification operational summary accepts bounded eventsLimit (3.116625ms)
✔ phase328: phase5 state summary route parses analyticsLimit bounds (0.447459ms)
✔ phase328: user state summary accepts analyticsLimit knob (2.812959ms)
✔ phase329: phase4 users summary route parses snapshotMode (0.444875ms)
✔ phase329: phase5 state summary route parses snapshotMode (1.039417ms)
✔ phase329: snapshotMode=require argument returns NOT AVAILABLE semantics when snapshot is missing (1.421125ms)
✔ phase33 t01: execute actions return execution snapshots (11.5565ms)
✔ phase33 t02: duplicate execution is blocked (0.912625ms)
✔ phase33 t02: readiness NOT_READY blocks execution (7.468209ms)
✔ phase330: phase4 notifications summary route parses snapshotMode (0.460083ms)
✔ phase330: notification summary returns snapshot data in require mode (2.154875ms)
✔ phase330: notification summary require mode returns empty when snapshot missing (0.484708ms)
✔ phase330: ops snapshot build includes notification_operational_summary item (7.15425ms)
✔ phase331: phase5 notifications summary route parses snapshotMode (0.554333ms)
✔ phase331: phase5 notifications filtered usecase forwards snapshotMode (0.496334ms)
✔ phase331: phase5 notifications summary returns empty in snapshot require mode when snapshot missing (1.62675ms)
✔ phase332: phase5 users summary route parses snapshotMode (0.459916ms)
✔ phase332: phase5 users filtered usecase forwards snapshotMode (0.446542ms)
✔ phase333: phase5 users summary returns empty in snapshot require mode when snapshot missing (1.815375ms)
✔ phase334: phase4 summary routes include metadata fields and includeMeta option (0.480959ms)
✔ phase334: user operational summary includeMeta returns not_available metadata in require mode (1.558208ms)
✔ phase334: notification operational summary includeMeta returns not_available metadata in require mode (1.333333ms)
✔ phase335: monitor insights route parses snapshotMode and has require no-fallback branch (0.497791ms)
✔ phase335: monitor insights returns 400 on invalid snapshotMode (0.749375ms)
✔ phase336: index wires /api/admin/retention-runs route (0.647459ms)
✔ phase336: retention-runs returns retention actions only and maps payload fields (1.729959ms)
✔ phase337: phase5 summary routes include metadata fields (0.486875ms)
✔ phase337: users summary includeMeta returns items+meta in require mode (1.367333ms)
✔ phase337: notifications summary includeMeta returns items+meta in require mode (0.39925ms)
✔ phase338: phase5 state route returns metadata fields (1.009ms)
✔ phase338: phase5 state require mode returns not_available metadata when snapshot missing (1.035625ms)
✔ phase339: analyticsReadRepo defines user-scoped query readers (0.476833ms)
✔ phase339: phase5 state summary uses scoped queries before listAll fallback (0.589042ms)
✔ phase34 t01: suggestion drift is detected (2.193292ms)
✔ phase34 t02: execution drift is detected (1.417292ms)
✔ phase34 t03: policy drift is detected (1.19575ms)
✔ phase34 t04: no drift when suggestion/ops/execution align (1.664042ms)
✔ phase34 t05: phase32 -> phase33 -> phase34 appends decision drift (9.812708ms)
✔ phase340: snapshot freshness helpers resolve minutes and stale judgement (1.379666ms)
✔ phase340: user summary require mode treats stale snapshot as not_available (3.803792ms)
✔ phase341: internal ops snapshot job forwards targets payload (0.509041ms)
✔ phase341: buildOpsSnapshots supports partial targets with backward-compatible default (3.69525ms)
✔ phase342: maintenance pane includes retention runs read-only panel (0.878ms)
✔ phase342: admin app loads retention runs from admin API (0.9775ms)
✔ phase342: retention runs ui dictionary keys exist (0.720959ms)
✔ phase343: audit inputs manifest contains required metadata and file hashes (0.82925ms)
✔ phase343: package scripts and audit workflow include audit-inputs checks (0.524666ms)
✔ phase344: load risk report keeps required keys (0.527792ms)
✔ phase344: load risk scripts, budgets doc, and workflow check are wired (0.840458ms)
✔ phase345: audit inputs manifest uses real metadata values (0.540459ms)
✔ phase346: load risk hotspots include endpoint mapping (0.936333ms)
✔ phase347: phase4 summary routes parse fallbackMode and reject invalid values (0.562625ms)
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (5.312834ms)
✔ phase348: phase5 ops/state routes parse fallbackMode and forward it (0.493417ms)
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (4.558667ms)
✔ phase349: ops snapshot repo and route contracts exist (0.485ms)
✔ phase349: index wires ops snapshot health admin endpoint (0.680708ms)
✔ phase35: notices repo create/get/list/update (1.167708ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase35 t01: console execution status reflects latest execution log (9.872708ms)
✔ phase35 t01: console execution status defaults to UNKNOWN when missing (0.285958ms)
✔ phase35 t02: list includes executionStatus summary (1.585125ms)
✔ phase35 t02: list defaults executionStatus when missing (0.4595ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase35 t03: ops loop updates executionStatus (4.7545ms)
✔ phase350: read path budgets include current baseline ratchet values (0.486667ms)
✔ phase350: load risk budget parser uses last matching budget values (0.486375ms)
✔ phase351: dashboard kpi route parses fallbackMode and rejects invalid value (0.726333ms)
✔ phase351: dashboard kpi compute path blocks listAll fallback when fallbackMode=block (0.484167ms)
✔ phase352: analytics read repo exposes checklist scoped query by scenario+step (0.448875ms)
✖ phase352: phase4 user operational summary prefers checklist scoped read path (4.271ms)
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.456625ms)
✔ phase353: phase4/phase5 routes expose fallback diagnostics fields (0.517792ms)
✔ phase353: summary/state usecases track fallback source diagnostics (0.577417ms)
✔ phase354: ops snapshot health route accepts snapshotType filter and forwards to repo (0.501667ms)
✔ phase354: maintenance pane contains snapshot health controls and table (0.911083ms)
✔ phase354: admin app loads snapshot health via admin API (0.9215ms)
✔ phase355: read path budgets include hotspots_count_max in current baseline (0.44625ms)
✔ phase355: load risk script parses and checks hotspots_count_max budget (0.449083ms)
✔ phase356: fallback policy module defines env-driven default and resolver (0.524916ms)
✔ phase356: dashboard/phase4/phase5 routes use fallback policy default on missing query (0.697208ms)
✔ phase357: analytics read repo exposes lineUserIds scoped user_checklists query (0.554167ms)
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.264ms)
✔ phase358: analytics read repo exposes notificationIds scoped events query (0.900542ms)
✖ phase358: notification summary collects notification ids and queries scoped events first (3.981125ms)
✔ phase359: phase2 automation route validates fallbackMode and forwards it (0.458334ms)
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.262459ms)
✔ phase35-39: docs exist with required headings (1.431125ms)
✔ phase36: notice send flow pushes and records delivery/audit (0.571625ms)
✔ phase360: monitor insights route accepts fallbackMode and blocks listAll fallback (0.4605ms)
✔ phase360: monitor insights emits read_path fallback audit action when fallback is used or blocked (0.435459ms)
✔ phase361: read-path routes include fallback audit actions (1.017458ms)
✔ phase362: read path budgets include current baseline section for phase362 (0.702041ms)
✔ phase362: load-risk budget parser uses last baseline entries (0.536833ms)
✔ phase363: load risk hotspots exclude listAll function declarations (0.544709ms)
✔ phase363: fallback_risk equals unique fallback file/call surfaces (0.492542ms)
✔ phase364: analytics read repo provides scoped checklist/delivery methods (0.467792ms)
✔ phase364: phase4 users summary uses scoped reads and blocks fallback only on query failure (0.519583ms)
✔ phase365: phase4 notification summary uses global events fallback only after scoped/range query failures (0.4665ms)
✔ phase365: index requirements include scoped checklist/delivery query entries (0.45175ms)
✔ phase366: phase5 state summary uses scoped checklist pairs and fallback only on query failures (0.641417ms)
✔ phase367: phase2 automation prefers scoped reads before listAll fallbacks (0.565875ms)
✔ phase367: phase2 automation route keeps fallbackMode allow|block contract (0.6045ms)
✔ phase368: dashboard KPI responses include unified fallback diagnostics keys (0.484708ms)
✔ phase368: monitor insights response includes source/asOf/freshness and fallback diagnostics (0.488583ms)
✔ phase369: read path fallback summary route exposes grouped and recent rows (0.463167ms)
✔ phase369: index routes /api/admin/read-path-fallback-summary (0.632125ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase36-39: full ops flow yields timeline + traceability (5.273834ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
✔ phase36: decision timeline appends DECIDE/POSTCHECK/EXECUTE (3.959ms)
✔ phase37: notification summary includes decision trace when linked (3.136875ms)
✔ phase38: getOpsAssistContext returns read-only payload (0.696ms)
✔ phase39: stale console is rejected and logged (1.516167ms)
✔ phase37: mark read and click append audit logs (0.496917ms)
✔ phase370: maintenance pane contains fallback summary controls and table (0.91225ms)
✔ phase370: admin app loads read-path fallback summary via admin API (1.177792ms)
✔ phase371: product readiness route returns GO/NO_GO with blockers and checks (0.659375ms)
✔ phase371: index routes /api/admin/product-readiness (0.592417ms)
✖ phase372: read path budgets include current baseline section for phase372 (3.409417ms)
✖ phase372: launch checklist includes product-readiness API checks (3.579667ms)
✔ phase38: ops dashboard returns dashboard items (1.127625ms)
✔ phase39: suggestion schema and audit are fixed (1.189625ms)
✖ admin summaries: users and notifications (6.722625ms)
✔ getNotificationReadModel: counts delivered/read/click (2.02475ms)
✔ toggle checklist done persists and reflects in GET (1.642834ms)
✔ toggle checklist done false clears in GET (0.321166ms)
✔ getMemberProfile returns memberNumber (0.726542ms)
✔ setMemberNumber writes trimmed value (0.614959ms)
✔ setMemberNumber clears when empty (0.180542ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase40-44: full flow returns view + automation skips NO_ACTION execution (8.487708ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase40: suggestion has disclaimer and no nextAction field (10.575333ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase41: llm assist suggestion appends timeline entry (3.196042ms)
✔ phase42: ops console view returns read-only payload (0.524042ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
✔ phase43: automation disabled by default (7.623ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase44: automation guard triggers escalation (7.972875ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=f7b543f51277cbc932562b00fd26e711e71ebba2112fef4e3ffdffd1e0451a77 model=ops-assist-rules opsAssistInputHash=51fcb97feedd69b931804436952625029700aeac1a8ebaaf5a28977f87e3e9d8 refreshReason=cache_miss
✔ phase45: suggestion falls back to allowed action (10.552583ms)
✔ phase45: prompt payload shape is fixed (0.865791ms)
✔ phase46: ops assist cache stores latest entry (1.116167ms)
✔ phase46: ops console view includes assist only when requested (0.592209ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase47: automation timeline links decision log (6.6395ms)
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
✔ phase47: dry-run returns guard without writes (1.111917ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase47: execute requires readiness OK (7.182541ms)
✔ phase48: automation config default disabled (0.907958ms)
✔ phase48: automation config list shape fixed (1.400333ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase49: full ops flow stays consistent (9.173542ms)
✔ memberNumber stale: 14 days threshold (1.005584ms)
✔ ops attention flag: memberNumber missing, checklist incomplete, stale (3.405375ms)
✖ phase5 ops filters: date range (3.44775ms)
✔ phase323: notifications summary filter forwards limit/eventsLimit options (0.787333ms)
✔ phase324: users summary filter forwards limit/analyticsLimit options (0.973459ms)
✔ ops filters: no params keeps all items (5.238417ms)
✔ ops filters: needsAttention (1.008583ms)
✔ ops filters: stale (0.427834ms)
✔ ops filters: unreviewed (0.443833ms)
✔ ops filters: reviewAgeDays (0.407792ms)
✔ ops filters: invalid reviewAgeDays returns 400 (0.150292ms)
✔ ops flags: memberNumber stale yes/no (3.058375ms)
✔ ops review: saves lastReviewed fields (1.001584ms)
✔ ops review write: updates user opsReview fields (0.865292ms)
✖ getUserStateSummary: returns read-only state (7.316167ms)
✔ phase50: obs emitted on submit and execute (7.47725ms)
✔ phase50: obs format is key=value and meta_json (0.499333ms)
[OBS] action=ops_assist_suggest result=cache_hit lineUserId=U1 cacheHit=true inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=cache_hit
✔ phase51: cache hit returns cached suggestion without regeneration (8.979208ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=input_changed
✔ phase51: input hash change triggers refresh (10.733167ms)
[OBS] action=ops_batch_run result=dry_run dryRun=true jobKey=refresh_ops_console limit=10
✔ phase52: dry-run does not call writers (0.966ms)
✔ phase52: invalid jobKey is rejected (0.668125ms)
✔ phase53: suggest template mapping (0.796583ms)
✔ phase53: template repo stores and lists templates (1.164208ms)
✔ phase54: docs exist with required headings (0.812708ms)
✔ phase6 member summary: 400 when lineUserId missing (0.715792ms)
✔ phase6 member summary: 404 when user not found (0.316042ms)
✔ phase6 member summary: returns minimal summary (1.939959ms)
✔ phase6 member summary: includes redac status (last4 only) (0.448667ms)
✔ phase60: cursor HMAC roundtrip (0.844333ms)
✔ phase60: missing secret is rejected when unsigned not allowed (0.736458ms)
✔ phase60: tampered cursor is rejected (0.943333ms)
✔ phase61: active template cannot be edited (1.141459ms)
✔ phase61: templates CRUD happy path (2.283208ms)
✔ phase61: template rejects invalid notificationCategory (1.20875ms)
✔ phase62: same date is idempotent (0.921417ms)
✔ phase62: generate report persists summary (1.296792ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_dry_run_only
✔ phase63: dry_run_only blocks execute (6.519416ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase63: execute mode allows when guard + recent dry run ok (7.48925ms)
✔ phase64: docs exist with headers (1.241125ms)
✔ phase65: job is idempotent for same date (1.067583ms)
✔ phase65: job token required (0.481208ms)
✔ phase66: segment uses lineUserIds override (1.348333ms)
✔ phase66: segment needsAttention filters (1.557541ms)
✔ phase66: segment READY only (1.647375ms)
✔ phase66: segment filters by redacStatus + hasMemberNumber (3.217791ms)
✔ phase67: plan appends audit log (2.345625ms)
✔ phase67: plan does not send (2.063167ms)
✔ phase68: execute is blocked by per-user weekly cap (4.606417ms)
✔ phase68: execute is blocked when category is disallowed by servicePhase/preset (5.062083ms)
✔ phase68: execute appends audit and sends (106.730125ms)
✔ phase68: reject when mode is dry_run_only (1.722084ms)
✔ phase68: reject without matching plan (2.48475ms)
✔ phase69: docs exist with headers (0.908125ms)
✔ phase70: ops_readonly includes segment send and retry queue sections (0.926083ms)
✔ phase71: execute rejects when planHash mismatched (3.138541ms)
✔ phase71: plan returns planHash with stable bucket (2.387208ms)
✔ phase72: testSendNotification with deliveryId is idempotent (second call skips push) (2.347042ms)
✔ phase72: retryQueuedSend passes through deliveryId to sendFn (1.796292ms)
✔ phase72: testSendNotification skips sealed deliveryId without pushing (0.201292ms)
✔ phase72: sendNotification skips sealed delivery and does not push duplicate (1.2445ms)
✔ phase72: enqueue retry queue on send failure (109.163417ms)
✔ phase72: no enqueue when send succeeds (4.873334ms)
✔ phase72: testSendNotification sets sentAt/deliveredAt when missing (8.331208ms)
✔ phase73: retry is blocked by per-user weekly cap (4.066166ms)
✔ phase73: retry is blocked when category is disallowed by servicePhase/preset (4.151584ms)
✔ phase73: retry failure keeps pending with lastError (5.625709ms)
✔ phase73: list retry queue returns pending only (2.664833ms)
✔ phase73: retry success marks done (4.962916ms)
✔ phase74: docs exist with required headings (2.55625ms)
✔ phase75: get active template returns latest active version (1.233209ms)
✔ phase75: template version increments per key (1.12975ms)
✔ phase76: execute rejects when templateVersion mismatched (4.284458ms)
✔ phase76: plan returns templateVersion from active template (4.301792ms)
✔ phase77: create segment enforces unique key (1.447ms)
✔ phase77: list active segments returns active only (1.662833ms)
✔ phase78: ops_readonly includes saved segments dropdown (0.689792ms)
✔ phase79: audit log contains run and plan snapshots (109.635709ms)
✔ phase79: docs exist with required headings (1.384417ms)
✔ phase79: execute returns runId (9.2965ms)
✔ phase80: cursor sign/verify roundtrip (0.899958ms)
✔ phase80: list rejects tampered signed cursor (1.189458ms)
✔ phase81: dry-run appends audit log (4.314292ms)
✔ phase81: dry-run has no side effects (4.003958ms)
✔ phase82: confirm token verifies with matching payload (0.882209ms)
✔ phase82: confirm token rejects mismatch (0.899166ms)
✔ phase83: ops_readonly includes dry-run flow (0.745916ms)
✔ phase84: docs exist with required headings (1.729459ms)
✔ phase85: automation_runs repo create/patch/get (1.159ms)
✔ phase86: batching updates progress cursor (14.589917ms)
✔ phase86: rate limit applied with sleep (0.461208ms)
✔ phase87: no retry on validation error (0.461375ms)
✔ phase87: retry transient errors (0.511791ms)
✔ phase88: partial failure yields DONE_WITH_ERRORS (9.676875ms)
✔ phase89: aborted run records ops state (15.14675ms)
✔ phase89: breaker aborts on 429 storm (14.942292ms)
✔ phase90: run status route returns run (1.109792ms)
✔ phase91: audit logs appended on start/done/abort (10.6185ms)
✔ phase92: docs exist with required headings (1.353333ms)
✔ phaseLLM1: allow list blocks extra fields (0.603208ms)
✔ phaseLLM1: allow list passes and filters (0.71125ms)
✔ phaseLLM1: feature flag disabled by default (0.451708ms)
✔ phaseLLM1: feature flag enabled values (0.090167ms)
✔ phaseLLM1: feature flag rejects other values (0.074375ms)
✔ phaseLLM1: validate OpsExplanation schema (0.772459ms)
✔ phaseLLM1: validate NextActionCandidates schema (0.131625ms)
✔ phaseLLM1: validate FAQAnswer schema (0.171584ms)
✔ phaseLLM1: schema rejects direct URL in FAQ answer (0.141167ms)
✔ phaseLLM2: ops_readonly renders llm explanation section (0.6415ms)
✔ phaseLLM2: explanation fallback when LLM disabled (6.835958ms)
✔ phaseLLM2: accepts valid LLM explanation when enabled (0.788208ms)
✔ phaseLLM2: invalid LLM output falls back (0.838458ms)
✔ phaseLLM3: ops_readonly includes next action candidates section (0.649666ms)
✔ phaseLLM3: fallback when LLM disabled (2.837375ms)
✔ phaseLLM3: accepts valid LLM candidates when enabled (0.659708ms)
✔ phaseLLM3: invalid LLM candidates fallback (0.263542ms)
✔ phaseLLM4: block when LLM disabled (3.965042ms)
✔ phaseLLM4: accepts valid LLM answer with allowed citations (0.979083ms)
✔ phaseLLM4: citations required (0 citations => block) (0.32475ms)
✔ phaseLLM4: WARN link is blocked (0.33875ms)
✔ phaseLLM5: runbook and phase plan docs exist (1.630792ms)
✔ phaseLLM6: allow-list blocks out-of-scope secret field (0.609042ms)
✔ phaseLLM6: restricted category is blocked when not allowed (0.231042ms)
✔ phaseLLM6: audit appends traceId for generated and blocked outcomes (3.988458ms)
✔ phaseLLM6: dual gate blocks when db flag is false (3.427584ms)
✔ phaseLLM6: dual gate blocks when env flag is false (0.422459ms)
✔ phaseLLM6: dual gate allows when db+env are true (0.705708ms)
✔ phaseLLM6: faq blocks when KB has no candidate (3.021958ms)
✔ phaseLLM6: faq blocks when citations are zero (3.858292ms)
✔ phaseLLM6: faq blocks direct URL in answer (6.999375ms)
✔ phaseLLM6: faq blocks WARN link (0.491208ms)
✔ phaseLLM6: llmEnabled defaults false and can be persisted (3.034333ms)
✔ phaseLLM6: faqArticlesRepo returns active locale-matched top scored rows (18.234375ms)
✔ phaseLLM6: faq output blocks when citations are missing (0.674792ms)
✔ phaseLLM6: faq output blocks direct URL (0.136208ms)
✔ phaseLLM6: next actions block invalid action (0.165417ms)
✔ phaseLLM6: llm config status/plan/set works with confirm token (56.575459ms)
✔ taxonomy: contact_source_required → CONTACT_SOURCE_REQUIRED (0.471ms)
✔ taxonomy: kb_schema_invalid → KB_SCHEMA_INVALID (0.07325ms)
✔ taxonomy: llm_api_error → LLM_API_ERROR (0.056583ms)
✔ taxonomy: llm_timeout → LLM_API_ERROR (0.051ms)
✔ taxonomy: adapter_missing → LLM_API_ERROR (0.053083ms)
✔ taxonomy: existing entries still correct (0.05625ms)
✔ taxonomy: unknown reason → UNKNOWN (0.057792ms)
✔ taxonomy: llm_disabled with nullOnDisabled=true → null (0.048542ms)
✔ handleCreate: missing x-actor → 400 (0.939667ms)
✔ handleCreate: invalid article body → 422 with errors (0.815167ms)
✔ handleCreate: valid article → 200 with id (1.262417ms)
✔ handleList: returns articles → 200 (1.694292ms)
✔ handleUpdate: valid patch → 200 with id (0.323959ms)
✔ handleDelete: soft deletes article → 200 with id (0.94575ms)
✔ validateKbArticle: all required fields → valid (1.433625ms)
✔ validateKbArticle: missing status → invalid (0.843417ms)
✔ validateKbArticle: invalid status → invalid (0.107875ms)
✔ validateKbArticle: missing riskLevel → invalid (0.091542ms)
✔ validateKbArticle: invalid riskLevel → invalid (0.643125ms)
✔ validateKbArticle: missing both version and versionSemver → invalid (0.087375ms)
✔ validateKbArticle: versionSemver only (no version) → valid (0.057583ms)
✔ validateKbArticle: invalid semver string → invalid (0.053875ms)
✔ validateKbArticle: missing validUntil → invalid (0.07975ms)
✔ validateKbArticle: validUntil null → invalid (0.111792ms)
✔ validateKbArticle: allowedIntents undefined → invalid (0.078416ms)
✔ validateKbArticle: allowedIntents null → invalid (0.050125ms)
✔ validateKbArticle: allowedIntents empty array [] → valid (all intents allowed) (0.055166ms)
✔ validateKbArticle: multiple errors returned (0.049625ms)
✔ search strict: article without riskLevel is rejected by validateKbArticle (0.820958ms)
✔ search strict: article without allowedIntents is rejected by validateKbArticle (0.137584ms)
✔ search strict: normalizeRiskLevel(undefined) → invalid (null), not defaulted to low (0.08125ms)
✔ search strict: allowedIntents=[] is valid (all intents allowed) (0.061833ms)
✔ search strict: allowedIntents with entries is valid (0.072375ms)
✔ llmClient: throws when OPENAI_API_KEY is not set (1.183542ms)
✔ llmClient: throws when OPENAI_API_KEY is missing entirely (0.184958ms)
✔ llmClient: throws llm_api_error on HTTP non-200 response (0.180166ms)
✔ llmClient: throws llm_api_error on empty response content (0.140583ms)
✔ llmClient: throws llm_api_error on non-JSON response content (0.140167ms)
✔ llmClient: returns { answer, model } on successful response (1.412291ms)
✔ llmClient: uses OPENAI_MODEL env var when set (0.193792ms)
✔ llmClient: defaults to gpt-4o-mini when OPENAI_MODEL not set (0.115167ms)
✔ llmClient: sends Authorization header with Bearer token (0.11225ms)
✔ llmClient: uses json_object response_format (0.822833ms)
✔ llmClient: exports explainOps method (1.357041ms)
✔ llmClient: exports suggestNextActionCandidates method (0.2225ms)
✔ llmClient.explainOps: throws when OPENAI_API_KEY is not set (0.68625ms)
✔ llmClient.suggestNextActionCandidates: throws when OPENAI_API_KEY is not set (0.181417ms)
✔ llmClient: callOpsExplain returns { answer, model } on success (1.524458ms)
✔ llmClient: callNextActionCandidates returns { answer, model } on success (0.497458ms)
✔ getNextActionCandidates: returns ok:true with fallback when LLM disabled (4.971209ms)
✔ getNextActionCandidates: fallback includes up to 3 candidates with abstract actions only (0.249416ms)
✔ getNextActionCandidates: response includes nextActionTemplate (next_actions_template_v1) (0.191916ms)
✔ getNextActionCandidates: uses llmAdapter.suggestNextActionCandidates when LLM enabled (0.517959ms)
✔ getNextActionCandidates: falls back when adapter_missing (0.237084ms)
✔ getNextActionCandidates: LLM output with invalid action is filtered out (0.249042ms)
✔ getNextActionCandidates: includes disclaimer in response (0.158875ms)
✔ getNextActionCandidates: throws when lineUserId is missing (0.262375ms)
✔ getOpsExplanation: returns ok:true with fallback when LLM disabled (12.414916ms)
✔ getOpsExplanation: response includes opsTemplate (ops_template_v1) (1.599625ms)
✔ getOpsExplanation: response includes opsHealthTemplate (ops_health_template_v1) (1.586959ms)
✔ getOpsExplanation: uses llmAdapter.explainOps when LLM enabled (0.710333ms)
✔ getOpsExplanation: falls back when adapter_missing (no llmAdapter in deps) (0.351916ms)
✔ getOpsExplanation: falls back on LLM timeout (5.578208ms)
✔ getOpsExplanation: includes disclaimer in response (0.317375ms)
✔ getOpsExplanation: throws when lineUserId is missing (0.323667ms)
✔ consent status: returns guideModeLocked=false when lawfulBasis is not consent (4.16225ms)
✔ consent status: guideModeLocked=true when lawfulBasis=consent and unverified (0.37725ms)
✔ consent status: guideModeLocked=false when lawfulBasis=consent and verified (0.309083ms)
✔ consent verify: sets consentVerified=true when lawfulBasis=consent (0.5525ms)
✔ consent verify: returns 409 when lawfulBasis is not consent (0.552667ms)
✔ consent verify: returns 409 when lawfulBasis is unspecified (0.199875ms)
✔ consent verify: audit log is written on success (0.1735ms)
✔ consent verify: audit log is written on failure (wrong lawfulBasis) (0.101083ms)
✔ consent revoke: sets consentVerified=false regardless of lawfulBasis (0.1545ms)
✔ consent revoke: guideModeLocked=false when lawfulBasis is not consent (2.226167ms)
✔ consent revoke: audit log is written (0.382792ms)
✔ consent status: returns 400 when x-actor header is missing (0.116417ms)
✔ consent verify: returns 400 when x-actor header is missing (0.073916ms)
✔ ops explain: consent_missing blocks LLM when lawfulBasis=consent and unverified (9.754583ms)
✔ ops explain: LLM available after consent verified (lawfulBasis=consent, consentVerified=true) (0.646584ms)
✔ ops explain: LLM available with legitimate_interest (no consent needed) (0.32ms)
✔ ops explain: llmStatus=disabled overrides consent when LLM flag is off (0.261209ms)
✔ next actions: consent_missing blocks LLM when lawfulBasis=consent and unverified (0.621042ms)
✔ next actions: LLM available after consent verified (0.331708ms)
✔ next actions: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.225667ms)
✔ ops explain: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.25925ms)
✔ recordUserLlmConsent: accept returns ok with accepted status (2.008209ms)
✔ recordUserLlmConsent: revoke returns ok with revoked status (0.112459ms)
✔ recordUserLlmConsent: throws when lineUserId missing (0.285333ms)
✔ recordUserLlmConsent: throws when lineUserId is not a string (1.007584ms)
✔ recordUserLlmConsent: audit log written on accept with correct action (0.152084ms)
✔ recordUserLlmConsent: audit log written on revoke with correct action (0.082041ms)
✔ recordUserLlmConsent: uses default LLM_CONSENT_VERSION when consentVersion omitted (0.088334ms)
✔ recordUserLlmConsent: accepts custom consentVersion (0.101375ms)
✔ recordUserLlmConsent: default actor is line_user (0.081084ms)
✔ recordUserLlmConsent: audit failure does not throw (best-effort) (0.149834ms)
✔ userConsentsRepo: setUserLlmConsent accept stores accepted status (1.097875ms)
✔ userConsentsRepo: setUserLlmConsent revoke stores revoked status (0.2405ms)
✔ userConsentsRepo: getUserLlmConsent returns null for unknown user (0.248667ms)
✔ userConsentsRepo: getUserLlmConsent returns accepted record (0.123666ms)
✔ userConsentsRepo: getUserLlmConsent normalizes unknown status to pending (0.0985ms)
✔ userConsentsRepo: setUserLlmConsent throws on missing lineUserId (0.317292ms)
✔ userConsentsRepo: setUserLlmConsent uses default version when omitted (0.070792ms)
✔ userConsentsRepo: merge preserves existing fields (0.165042ms)
✔ webhook: "AI同意" command replies with consent confirmation (1.534958ms)
✔ webhook: "LLM同意" command replies with consent confirmation (0.211625ms)
✔ webhook: "AI拒否" command replies with revoke confirmation (0.214667ms)
✔ webhook: "LLM拒否" command replies with revoke confirmation (0.162875ms)
✔ webhook: consent command does not produce membership error reply (0.182417ms)
✔ webhook: unrelated text does not trigger consent handler (0.759166ms)
✔ webhook: consent handler stores consent status in user_consents collection (0.201333ms)
✔ webhook: AI拒否 stores revoked status in user_consents collection (0.242209ms)
✔ security: admin pages avoid unsafe HTML injection primitives (3.764541ms)
✔ security: automation config set requires valid confirmToken and writes audit on mismatch (48.554791ms)
✔ security: system config set requires valid confirmToken and writes audit on mismatch (52.394042ms)
✔ security: system config impactPreview includes cap breakdown fields (46.470416ms)
✔ security: system config plan succeeds when notificationCaps are all null (4.576959ms)
✔ security: system config impactPreview respects deliveryCountLegacyFallback mode (4.381083ms)
✔ security: system config impactPreview skips delivery counters during active quietHours (4.729666ms)
✔ security: system config notificationCaps roundtrip and fallback (55.543417ms)
✔ security: cookie-auth state-changing requests require same-origin (CSRF guard) (27.672ms)
✔ security: delivery backfill execute requires valid confirmToken (40.796916ms)
✔ security: delivery recovery execute requires valid confirmToken and seals delivery (39.291334ms)
✔ security: ops_readonly.html avoids innerHTML for dynamic data (XSS regression) (0.869042ms)
✔ security: /admin/* is protected by ADMIN_OS_TOKEN (cookie login) (28.2275ms)
✔ security: /api/phaseLLM4/faq/answer is protected by admin token (34.579917ms)
✔ security: redac membership id is not stored in plaintext (2.048917ms)
ℹ tests 1053
ℹ suites 0
ℹ pass 1033
ℹ fail 20
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14522.591792

✖ failing tests:

test at tests/phase127/phase127_last_reaction_at.test.js:33:1
✖ phase127: lastReactionAt prefers clickAt over readAt (18.488708ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + null
  - '2026-01-03T00:00:00.000Z'
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase127/phase127_last_reaction_at.test.js:42:10)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:358:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: null,
    expected: '2026-01-03T00:00:00.000Z',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase127/phase127_last_reaction_at.test.js:45:1
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.846459ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  + actual - expected
  
  + null
  - '2026-01-04T00:00:00.000Z'
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase127/phase127_last_reaction_at.test.js:53:10)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async Test.processPendingSubtests (node:internal/test_runner/test:788:7) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: null,
    expected: '2026-01-04T00:00:00.000Z',
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase308/phase308_hotspot_bounded_query_contract.test.js:7:1
✖ phase308: top3 analytics hotspots use explicit bounded limits (5.602666ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(userSummary.includes('listNotificationDeliveriesBySentAtRange({'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase308/phase308_hotspot_bounded_query_contract.test.js:20:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase310/phase310_t02_repo_map_check_mode_contract.test.js:7:1
✖ phase310: repo-map check mode passes when generated artifact is current (99.610417ms)
  AssertionError [ERR_ASSERTION]: stdout=
  stderr=repo map drift detected. run: npm run repo-map:generate
  
  
  1 !== 0
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase310/phase310_t02_repo_map_check_mode_contract.test.js:12:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 1,
    expected: 0,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase315/phase315_t01_cleanup_check_script_contract.test.js:7:1
✖ phase315: cleanup check script passes when generated artifacts are current (128.122833ms)
  AssertionError [ERR_ASSERTION]: cleanup drift detected. run: npm run cleanup:generate
   - docs/CLEANUP_PLAN.md
   - docs/CLEANUP_DIFF_SUMMARY.md
   - docs/STRUCTURAL_RISK_BEFORE_AFTER.md
   - docs/INDEX_PLAN.md
   - docs/FULL_SCAN_BOUNDING_PLAN.md
   - docs/KILLSWITCH_DEPENDENCY_MAP.md
  
  
  1 !== 0
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase315/phase315_t01_cleanup_check_script_contract.test.js:12:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: 1,
    expected: 0,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase317/phase317_t01_notification_summary_bounded_contract.test.js:7:1
✖ phase317: notification operational summary uses bounded range query with legacy fallback (8.537042ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('if (!events.length) {'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase317/phase317_t01_notification_summary_bounded_contract.test.js:10:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase319/phase319_t01_user_operational_summary_bounded_contract.test.js:7:1
✖ phase319: user operational summary uses range-first events/deliveries with fallback (5.824792ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('listNotificationDeliveriesBySentAtRange({'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase319/phase319_t01_user_operational_summary_bounded_contract.test.js:11:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase320/phase320_t01_user_state_summary_bounded_contract.test.js:7:1
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (9.631ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('if (events.length === 0) {'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase320/phase320_t01_user_state_summary_bounded_contract.test.js:14:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase347/phase347_t02_phase4_usecase_fallback_block_guard_contract.test.js:8:1
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (5.312834ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(userSrc.includes('if (events.length === 0 && !fallbackBlocked) {'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase347/phase347_t02_phase4_usecase_fallback_block_guard_contract.test.js:15:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase348/phase348_t02_phase5_state_fallback_block_guard_contract.test.js:8:1
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (4.558667ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('if (events.length === 0 && !fallbackBlocked) {'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase348/phase348_t02_phase5_state_fallback_block_guard_contract.test.js:12:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase352/phase352_t02_phase4_checklist_scoped_usecase_contract.test.js:8:1
✖ phase352: phase4 user operational summary prefers checklist scoped read path (4.271ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('listChecklistsByScenarioAndStep'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase352/phase352_t02_phase4_checklist_scoped_usecase_contract.test.js:11:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase352/phase352_t03_phase5_state_checklist_scoped_usecase_contract.test.js:8:1
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.456625ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('listChecklistsByScenarioAndStep'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase352/phase352_t03_phase5_state_checklist_scoped_usecase_contract.test.js:11:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase357/phase357_t02_phase4_user_summary_scoped_user_checklists_contract.test.js:8:1
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.264ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('if (userChecklistsResult.failed || userChecklists.length === 0) {'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase357/phase357_t02_phase4_user_summary_scoped_user_checklists_contract.test.js:14:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase358/phase358_t02_notification_summary_scoped_events_contract.test.js:8:1
✖ phase358: notification summary collects notification ids and queries scoped events first (3.981125ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes('events = await listEventsByCreatedAtRange({'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase358/phase358_t02_notification_summary_scoped_events_contract.test.js:14:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase359/phase359_t02_phase2_usecase_fallback_mode_block_contract.test.js:8:1
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.262459ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(src.includes("summary.readPath.fallbackSources = ['listAllUsers', 'listAllChecklists', 'listAllUserChecklists'];"))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase359/phase359_t02_phase2_usecase_fallback_mode_block_contract.test.js:15:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase372/phase372_t01_read_path_budget_phase372_baseline_contract.test.js:8:1
✖ phase372: read path budgets include current baseline section for phase372 (3.409417ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(text.includes('current_baseline_phase372'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase372/phase372_t01_read_path_budget_phase372_baseline_contract.test.js:10:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase372/phase372_t02_launch_checklist_product_readiness_contract.test.js:8:1
✖ phase372: launch checklist includes product-readiness API checks (3.579667ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(text.includes('/api/admin/product-readiness'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase372/phase372_t02_launch_checklist_product_readiness_contract.test.js:10:10)
      at Test.runInAsyncScope (node:async_hooks:214:14)
      at Test.run (node:internal/test_runner/test:1106:25)
      at Test.start (node:internal/test_runner/test:1003:17)
      at startSubtestAfterBootstrap (node:internal/test_runner/harness:358:17) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: false,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase4/adminOpsSummary.test.js:32:1
✖ admin summaries: users and notifications (6.722625ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(user1.lastActionAt && user1.lastActionAt.startsWith('2026-01-02'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase4/adminOpsSummary.test.js:76:10)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:358:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: null,
    expected: true,
    operator: '==',
    diff: 'simple'
  }

test at tests/phase5/opsFilter.test.js:30:1
✖ phase5 ops filters: date range (3.44775ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  
  0 !== 1
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase5/opsFilter.test.js:49:10)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:358:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: 0,
    expected: 1,
    operator: 'strictEqual',
    diff: 'simple'
  }

test at tests/phase5/stateSummary.test.js:30:1
✖ getUserStateSummary: returns read-only state (7.316167ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
  
    assert.ok(result.lastActionAt && result.lastActionAt.startsWith('2026-01-02'))
  
      at TestContext.<anonymous> (/Users/parentyai.com/Projects/Member/tests/phase5/stateSummary.test.js:99:10)
      at async Test.run (node:internal/test_runner/test:1113:7)
      at async startSubtestAfterBootstrap (node:internal/test_runner/harness:358:3) {
    generatedMessage: true,
    code: 'ERR_ASSERTION',
    actual: null,
    expected: true,
    operator: '==',
    diff: 'simple'
  } が通る。
- 既存 API 契約と Firestore schema を変更しない。
