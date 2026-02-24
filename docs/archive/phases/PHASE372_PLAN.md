# PHASE372_PLAN

## 目的
Phase372 の read-path 収束タスクを add-only で実装し、既存互換を維持する。

## スコープ
- Phase372 対象の route/usecase/repo/ui/scripts
- tests/phase372/*
- docs/SSOT_INDEX.md

## 受入条件
- Phase372 の契約テストが PASS する。
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

✔ auditLogsRepo: append writes createdAt (1.275125ms)
✔ auditLogsRepo: append respects provided createdAt (0.905916ms)
✔ recordClickAndRedirect: marks click and returns url (1.319667ms)
✔ recordClickAndRedirect: blocks WARN link (0.446125ms)
✔ killSwitch: default false, set true (1.3655ms)
✔ linkRegistryRepo: setHealth stores WARN state (1.318666ms)
✔ linkRegistryRepo: delete removes link (0.222417ms)
✔ createNotification: stores draft notification (1.346042ms)
✔ createNotification: stores normalized notificationCategory (0.284209ms)
✔ sendNotification: creates deliveries for matching users (2.004375ms)
✔ listNotifications: filters by scenarioKey (0.378875ms)
✔ notificationsRepo: create -> list with filter (1.943625ms)
✔ phase0 smoke (0.740292ms)
✔ testSendNotification: creates delivery after push (7.319042ms)
✔ testSendNotification: blocked when kill switch ON (0.48ms)
✔ usersRepo: create -> get -> update (0.914208ms)
✔ validateSingleCta: accepts single CTA text (0.858792ms)
✔ validateSingleCta: rejects missing CTA text (0.891208ms)
✔ validateSingleCta: rejects multiple CTAs (0.252959ms)
✔ validateLinkRequired: requires linkRegistryId (0.224833ms)
✔ validateLinkRequired: rejects direct URL (0.195916ms)
✔ validateWarnLinkBlock: blocks WARN state (0.201458ms)
✔ validateKillSwitch: blocks when ON (0.324ms)
✔ validateNotificationPayload: passes when all checks ok (1.403125ms)
✔ webhook: valid signature creates user (2.57775ms)
✔ webhook: invalid signature rejected (0.251084ms)
✔ sendWelcomeMessage: sends once and records delivery (1.078292ms)
✔ webhook: welcome send is invoked for new user (0.953792ms)
✔ admin notifications: scenario only targeting (step ignored) (8.097708ms)
✔ admin notifications: linkRegistryId required (0.293917ms)
✔ admin notifications: events best-effort does not block (0.373958ms)
✔ checklistsRepo: create -> get -> list (2.580375ms)
✔ events integration: open requires notificationId (1.273792ms)
✔ events integration: click requires notificationId (0.636833ms)
✔ events integration: complete requires checklistId + itemId (1.145583ms)
✔ eventsRepo: create event (0.998208ms)
✔ eventsRepo: missing required fields throws (0.308ms)
[phase1] checklist skipped: missing step
✔ getChecklistForUser: returns checklists for scenario/step (4.035625ms)
✔ getChecklistForUser: missing step returns empty (1.814625ms)
✔ logEventBestEffort: enforces type constraints (1.011958ms)
✔ phase1 smoke: notify -> delivery -> checklist -> events (8.02025ms)
✔ toggleChecklistItem: upserts and sets completedAt (0.960625ms)
✔ toggleChecklistItem: event failure does not block (0.817125ms)
✔ userChecklistsRepo: upsert -> get -> list (1.342833ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase101: ops assist suggestion includes suggestion/evidence/safety (74.838792ms)
✔ phase102: ops assist input shape is stable (4.662583ms)
✔ phase103: guard blocks invalid suggestion (1.416042ms)
✔ phase103: not ready forces STOP (1.859209ms)
✔ phase104: audit written for ok and block (0.520542ms)
✔ phase105: adopt audit appended (1.305083ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase106: llm disabled by default falls back to rules (25.27325ms)
✔ phase107: docs exist with required headings (1.912834ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U2 cacheHit=false inputHash=537233774f4b2f34de6ccc98996ddc0a704dd593447e713540ebb30150aa64e9 model=ops-assist-rules opsAssistInputHash=de2515a1df72528e84478ec4b8578df7577abf68ac5a24aa8d9724739c30cee3 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U3 cacheHit=false inputHash=70545ed0e9df1da70262da904475327f4e394fff62173bafb85085c3a3802d9b model=ops-assist-rules opsAssistInputHash=b0bb3a28bf10ada05df4241e6146d5a9cd995efb995eb50929d8c585f2f9e6b9 refreshReason=cache_miss
✔ phase108: suggest -> adopt -> submit audit flow (17.819ms)
✔ phase117: resolve automation targets respects config filters (0.903166ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase118: suggestion schema is fixed (3.084125ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase119: audit append on suggestion includes notificationId (23.015583ms)
✔ implementation targets: single fixed entry (0.564958ms)
✔ implementation targets acceptance: fixed single IN target (0.559083ms)
✔ implementation targets acceptance: query does not change result (0.097167ms)
✔ implementation targets api: returns fixed registry (0.535375ms)
✔ ops readonly ui includes implementation targets section (1.152333ms)
✔ phase120: decision log stores source + suggestion snapshot (1.172ms)
✔ phase121: ops notice send flow writes delivery and audit (19.695334ms)
✔ phase122: ops console view includes suggestion and audit id (0.546291ms)
✔ phase123: killSwitch blocks ops assist suggestion (0.696875ms)
✔ phase124: docs exist with required headings (0.928834ms)
[webhook] requestId=bea4deb8-f1b8-43c1-8e3c-6e7605cf7680 accept
[OBS] action=webhook result=ok requestId=bea4deb8-f1b8-43c1-8e3c-6e7605cf7680 lineUserId=U1
✔ phase125: SERVICE_MODE=webhook is webhook-only (+ appends webhook events) (68.799625ms)
✔ phase125: logLineWebhookEvents writes minimal schema (type + ref) (2.153875ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
[OBS] action=click result=ok requestId=unknown deliveryId=auto_1 linkRegistryId=l1
✔ phase126: existing POST /track/click still redirects and records clickAt (49.333792ms)
[OBS] action=click_post_compat result=reject requestId=unknown
✔ phase126: POST /track/click can be disabled via TRACK_POST_CLICK_ENABLED=0 (5.605083ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
✔ phase126: GET /t/{token} records clickAt + stats and redirects (41.801667ms)
✔ phase126: tampered token is rejected and does not write clickAt/stats (44.689625ms)
✔ phase126: expired token is rejected and does not write clickAt/stats (7.282125ms)
✔ phase127: docs exist with reaction definitions (0.735291ms)
✖ phase127: lastReactionAt prefers clickAt over readAt (22.1195ms)
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (1.591792ms)
✔ phase127: lastReactionAt is null when both clickAt/readAt missing (0.867625ms)
✔ phase128: stable ordering is deterministic and follows SSOT sort spec (1.02725ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase129: ops console view appends audit_logs with traceId (9.466583ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase130: NO_ACTION submit appends decision_logs + audit_logs (no execution) (2.036208ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase131: ops console includes add-only display fields (LINE-only reaction + execution message) (17.167709ms)
✔ phase132: kill switch blocks STOP_AND_ESCALATE (no send side effect) (3.844375ms)
✔ phase132: ops_readonly.html sets x-actor header to avoid actor=unknown (0.708334ms)
✔ phase132: execute fills traceId from existing decision audit when payload traceId missing (5.272625ms)
✔ phase133: GET /api/admin/trace returns audits/decisions/timeline for traceId (33.859417ms)
✔ phase134: run_trace_smoke.js completes with zero side effects and outputs trace bundle shape (135.996083ms)
✔ phase134: run_trace_smoke.js exits non-zero on failure (33.844458ms)
✔ phase135: runbook and ssot index exist with required headings (1.64225ms)
✔ phase137: notification reaction summary aggregates deliveries deterministically (2.933208ms)
✔ phase137: ctr is 0 when sent is 0 (0.148833ms)
✔ phase138: read model includes add-only reactionSummary + notificationHealth without breaking existing keys (9.604625ms)
✔ phase138: reactionSummary always exists even when no deliveries (1.282416ms)
✔ phase139: notification health evaluation thresholds are fixed (0.455458ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase140: ops console includes notificationHealthSummary + topUnhealthyNotifications (add-only) (4.577917ms)
✔ phase141: suggests mitigation when health is bad (0.5575ms)
✔ phase141: returns null when no unhealthy notifications (0.082458ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase142: trace bundle includes notification_mitigation.decision audit + decision log snapshot (2.319083ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_3 failure_class=PASS nextAction=NO_ACTION
✔ phase145: audit logs cover view/suggest/decision/execute via single traceId (7.201583ms)
✔ phase150: RUNBOOK_OPS exists with required headings (0.656583ms)
✔ phase158: LAUNCH_CHECKLIST exists with required headings (1.335125ms)
✔ phase153: run_ops_smoke.js completes with guarded execute and trace bundle coverage (94.042375ms)
✔ phase160: checkNotificationCap passes includeLegacyFallback=false to delivery counters (4.154583ms)
✔ phase160: checkNotificationCap defaults includeLegacyFallback=true (0.571125ms)
✔ phase160: checkNotificationCap skips delivery counters during active quietHours (0.489ms)
✔ phase160: checkNotificationCap uses snapshot counter when available (0.542292ms)
✔ phase160: deliveredAt backfill summary + apply (23.799375ms)
✔ phase160: delivery count uses deliveredAt and falls back to legacy sentAt (7.357667ms)
✔ phase160: notification caps normalize accepts extended fields (2.14175ms)
✔ phase160: notification caps block during quiet hours (0.242208ms)
✔ phase160: notification caps block when category is required but missing (0.08175ms)
✔ phase160: notification caps block per user daily before weekly (0.075625ms)
✔ phase160: notification caps normalize defaults to null (0.934833ms)
✔ phase160: notification caps reject invalid values (0.340583ms)
✔ phase160: notification caps block when delivered count reaches cap (0.710958ms)
✔ phase160: notification policy is no-op when servicePhase/preset are unset (0.60575ms)
✔ phase160: notification policy allows phase1 presetA immediate action (0.188209ms)
✔ phase160: notification policy blocks disallowed category (0.0695ms)
✔ phase160: SSOT docs exist for servicePhase and notificationPreset (2.024375ms)
✔ phase160: servicePhase/preset getters return null when unset (1.134083ms)
✔ phase160: servicePhase/preset setters validate and persist (4.98175ms)
✔ phase161: admin pages include x-actor headers (1.847625ms)
✔ phase161: execute is blocked when per-user weekly cap is exceeded (7.229209ms)
✔ phase161: execute failure writes notifications.send.execute audit with ok=false (9.413542ms)
✔ phase161: composer flow draft -> approve -> plan -> execute (no real send) (10.14075ms)
✔ phase161: partial send failure -> rerun executes remaining only (no double-send) (15.004209ms)
✔ phase161: execute is blocked when category is disallowed by servicePhase/preset (5.827167ms)
✔ phase161: docs exist for admin UI OS + data model + runbook (4.251625ms)
✔ redac membership: happy path links and persists hash+last4 (2.156083ms)
✔ redac membership: duplicate (linked to another user) is rejected (1.176458ms)
✔ redac membership: invalid format returns invalid_format (0.209ms)
✔ redac membership: non-command message is noop (0.242583ms)
✔ redac membership: usage guidance when command prefix has no payload (0.170042ms)
✔ redac membership: usage guidance when help keyword is used (0.187125ms)
✔ redac membership: same user can replace their redac id (releases previous id) (0.336209ms)
✔ ops readonly ui includes Redac status display label (1.763791ms)
✔ admin redac unlink: happy path removes link and clears user fields (2.474833ms)
✔ admin redac unlink: not found returns 404 (0.275459ms)
✔ admin redac unlink: invalid format returns 400 (0.68525ms)
✔ phase164: LINE command "会員ID 確認" replies with status (last4 only) (4.730958ms)
✔ phase164: LINE command prefix without payload replies usage guidance (2.061625ms)
✔ phase164: redac line message templates include next action guidance (1.247584ms)
✔ phase170: deploy workflow supports stg/prod environment split (0.85375ms)
✔ phase170: deploy-webhook workflow supports stg/prod environment split (0.279833ms)
✔ phase170: deploy-track workflow supports stg/prod environment split (0.262167ms)
✔ phase171: parseArgs reads env defaults and supports skip flags (0.616916ms)
✔ phase171: parseArgs requires admin token (0.254834ms)
✔ phase171: buildTraceId is stable format (1.391458ms)
✔ phase171: evaluateExitCode treats skip as failure in strict mode (0.118167ms)
✔ phase171: markdown summary includes scenario status and trace (0.149375ms)
✔ phase171: normalizeNotificationCaps and buildActiveQuietHours are add-only safe (0.459333ms)
✔ phase171: resolveOutFile uses default artifacts directory (0.689458ms)
✔ phase173: master ui renders impact preview risk and breakdown labels (0.742042ms)
✔ phase173: master ui includes delivery recovery operation guidance (1.188ms)
✔ phase174: all redac reply templates include explicit next action phrase (1.074125ms)
✔ phase177: redac status route returns sampled consistency summary (61.497083ms)
✔ phase177: master ui includes redac health section and status endpoint call (0.35575ms)
✔ phase178: deploy workflow grants runtime SA secret accessor for member secrets (0.574083ms)
✔ phase178: deploy-webhook workflow grants runtime SA secret accessor for webhook secrets (0.130166ms)
✔ phase178: deploy-track workflow grants runtime SA secret accessor for track token secret (0.107125ms)
✔ phase179: notification routes include structured route_error logging + trace/request in 500 payload (1.140625ms)
✔ phase179: logRouteError emits sanitized structured line (19.426958ms)
✔ phase180: parseArgs accepts route_error options (0.623917ms)
✔ phase180: parseArgs rejects fetch-route-errors without project id (0.251541ms)
✔ phase180: buildRouteErrorLoggingFilter contains route_error prefix and trace id (0.113709ms)
✔ phase180: fetchRouteErrors parses gcloud output lines (0.457208ms)
✔ phase180: markdown summary prints route_error capture status (0.812708ms)
✔ phase181: deploy workflow requires explicit prod confirmation (0.567875ms)
✔ phase181: deploy-webhook workflow requires explicit prod confirmation (0.134ms)
✔ phase181: deploy-track workflow requires explicit prod confirmation (0.099417ms)
✔ phase182: deploy workflow preflight validates required vars and secrets (0.558417ms)
✔ phase182: deploy-webhook workflow preflight validates required vars and secrets (0.136041ms)
✔ phase182: deploy-track workflow preflight validates required vars and secrets (0.1025ms)
✔ phase183: parseArgs enables fetchRouteErrors when fail-on-route-errors is set (1.864625ms)
✔ phase183: parseArgs rejects fail-on-route-errors without project id (0.430333ms)
✔ phase183: strict gate marks PASS as FAIL when route_error is detected (0.133167ms)
✔ phase183: strict gate keeps original reason for already failed scenario (0.070292ms)
✔ phase183: strict gate is no-op when strict mode is disabled (0.062375ms)
✔ phase184: stg notification e2e workflow is defined with required inputs (1.534667ms)
✔ phase184: stg notification e2e workflow runs proxy and strict route error gate (0.1875ms)
✔ phase184: stg notification e2e workflow uploads artifacts (0.112792ms)
✔ phase185: deploy workflow preflight separates missing from permission issues (1.611292ms)
✔ phase185: deploy-webhook workflow preflight separates missing from permission issues (0.563667ms)
✔ phase185: deploy-track workflow preflight separates missing from permission issues (0.396208ms)
✔ phase186: stg e2e workflow preflight separates missing from permission issues (0.797542ms)
✔ phase186: segment query accepts loose lineUserIds format (1.045792ms)
✔ phase187 t01: read-model keys required by monitor/read_model (4.96275ms)
✔ phase188B: waitRule values produce nextWaitDays (5.366209ms)
✔ phase189: targetCountSource derives from plan audit (3.387875ms)
✔ phase190: cap count labels derived from execute audit (6.356291ms)
✔ phase191: SSOT read-model keys close loop to output + UI (3.567375ms)
✔ runPhase2Automation: dryRun does not write reports (4.335041ms)
✔ runPhase2Automation: writes reports when not dryRun (0.686417ms)
[OBS] action=click-write result=ok deliveryId=d1 ctaText=openA linkRegistryId=l1
✔ recordClickAndRedirect: track mode records stats (best-effort) and returns redirect url (2.901792ms)
✔ recordClickAndRedirect: member mode does not record stats unless explicitly enabled (0.251417ms)
✔ phase201: ops/monitor/read_model include status summary panels (0.986333ms)
✔ phase202: composer shows plan target count label (0.63725ms)
✔ phase202: ops segment plan note includes count (0.304458ms)
✔ phase203: ops has list/detail sections (0.69725ms)
✔ phase203: monitor has drilldown detail panel (0.142292ms)
✔ phase203: read-model has drilldown detail panel (0.123041ms)
✔ phase204: weekOverWeek delta is computed from deliveries (8.842667ms)
✔ phase205: plan returns capBlockedCount based on caps (7.445209ms)
✔ phase205: composer shows plan cap blocked count label (0.921ms)
✔ phase206: dry-run stores run record and passes (2.810666ms)
✔ phase206: failure taxonomy mapping (1.845542ms)
✔ phase206: self-send uses sendNotification without status update (5.664959ms)
✔ phase206: GET /api/admin/user-timeline returns deliveries + trace (35.844166ms)
✔ phase207: /admin/app and /admin/ui-dict are protected by admin token (33.670541ms)
✔ phase207: /admin/app returns shell and /admin/ui-dict returns dictionary when token is present (15.662458ms)
✔ phase207: all ui.* keys used in /admin/app exist in ADMIN_UI_DICTIONARY_JA (7.500208ms)
✔ phase209: master ui includes llm config controls (1.960417ms)
✔ phase209: master ui wires llm config endpoints (1.158291ms)
[OBS] action=click-write result=ok deliveryId=auto_4 ctaText=openB linkRegistryId=auto_1
✔ phase21 t06: clickCount increments for openB in day window (1.365459ms)
✔ phase21 t12: accepts --track-base-url and does not emit trackBaseUrl required (45.376292ms)
✔ phase21 t12: missing track base url exits with trackBaseUrl required (40.420041ms)
✔ phase21 t15: missing track base url exits with code 2 (44.163ms)
✔ phase21 t16: verify env does not emit VERIFY_ENV_ERROR after npm ci (13.967708ms)
✔ phase21 t17: GAC set exits with code 2 (37.110791ms)
✔ phase21 t17: allow-gac bypasses guard (9.500959ms)
{"trackBaseUrl":"https://example.com","fromUtc":"2026-02-22T00:00:00.000Z","toUtc":"2026-02-23T00:00:00.000Z","linkRegistryId":"l1"}
✔ phase21 t18: invalid_rapt classified as env error (16.777625ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT=1 (1.604916ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT is not enabled (0.1995ms)
✔ testSendNotification: member mode records sent stats when ENV_NAME=stg even if PHASE18_CTA_EXPERIMENT is not enabled (1.101583ms)
✔ testSendNotification: track mode records sent stats without experiment flag (0.228ms)
✔ ctaStatsRepo: incrementSent writes sentCount field (1.69175ms)
✔ phase210: master ui includes llm faq validation section (0.7455ms)
✔ phase210: master ui wires admin llm faq endpoint (1.70025ms)
✔ phase211: master ui includes llm ops explain / next actions section (0.7215ms)
✔ phase211: master ui wires llm ops endpoints (1.778375ms)
✔ phase212: admin app includes LLM nav and pane controls (1.141584ms)
✔ phase212: admin app wires LLM endpoints from pane actions (0.899917ms)
✔ phase213: admin app includes llm config controls in llm pane (1.099584ms)
✔ phase213: admin app wires llm config endpoints (0.7735ms)
✔ phase214: admin app includes llm audit drilldown button (0.973ms)
✔ phase214: admin app wires llm trace to audit pane search (0.629542ms)
✔ phase215: admin app uses admin llm ops endpoints with legacy fallback (1.148458ms)
✔ phase215: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (62.616708ms)
✔ phase216: master llm ops panel uses admin endpoints first (0.71925ms)
✔ phase216: master llm ops panel keeps legacy fallback endpoints (1.550458ms)
✔ phase217: ops_readonly uses admin llm ops endpoints first (0.819791ms)
✔ phase217: ops_readonly keeps legacy llm ops fallback endpoints (0.311042ms)
✔ phase218: admin_app uses admin LLM endpoints first with legacy fallback (1.149292ms)
✔ phase218: master uses admin LLM endpoints first with legacy fallback (0.502833ms)
✔ phase218: ops_readonly uses admin LLM endpoints first with legacy fallback (0.871083ms)
✔ phase219: phaseLLM4 compat route appends deprecated metadata on blocked response (0.874917ms)
✔ phase219: phaseLLM4 compat route returns 400 on required/invalid parse errors (0.263625ms)
✔ phase22 t01: CTR calculation and delta (1.986125ms)
✔ phase22 t01: zero division yields 0 CTR (0.104791ms)
✔ phase22 t01: JSON structure keys (0.115541ms)
✔ phase22 t02: verify then kpi order with args (1.386542ms)
✔ phase22 t02: exit code mapping to env error (0.10525ms)
✔ phase22 t02: exit code mapping to runtime error (0.062125ms)
✔ phase22 t02: run executes verify then kpi (0.28425ms)
✔ phase22 t03: PASS when totals meet thresholds (0.570959ms)
✔ phase22 t03: FAIL when totalSent insufficient (0.128417ms)
✔ phase22 t03: FAIL when deltaCTR below threshold (0.076917ms)
✔ phase22 t03: PASS when minDeltaCtr is 0 even if deltaCTR negative (0.066459ms)
✔ phase22 t03: FAIL when required key missing (0.082042ms)
✔ phase22 t03: FAIL on JSON parse error (0.085541ms)
✔ phase22 t03: stdin read error yields env error code (0.34275ms)
✔ phase22 t04: PASS when gate exitCode=0 (2.921ms)
✔ phase22 t04: FAIL when gate exitCode=1 (0.141875ms)
✔ phase22 t04: VERIFY_ENV_ERROR when gate exitCode=2 (0.093458ms)
✔ phase22 t04: snapshot throws => FAIL (0.084542ms)
✔ phase22 t04: runner throws => FAIL (0.0765ms)
✔ phase22 t05: upsertSnapshot sets createdAt serverTimestamp (0.73175ms)
✔ phase22 t05: upsertSnapshot uses merge true (0.492875ms)
✔ phase22 t05: no --write keeps exitCode and does not call repo (0.907083ms)
✔ phase22 t05: --write 1 calls repo and keeps exitCode on error (0.244834ms)
✔ phase22 t06: defaults return JSON (0.586708ms)
✔ phase22 t06: repo error yields LIST_ENV_ERROR exitCode=2 (0.164625ms)
✔ phase22 t06: limit and order applied (2.723ms)
✔ phase22 t06: cta filters applied (0.334ms)
✔ phase22 t07: PASS returns exitCode 0 and no record on dry-run (0.896917ms)
✔ phase22 t07: write=1 calls record after pass (0.17475ms)
✔ phase22 t07: FAIL bubbles exitCode 1 (0.701541ms)
✔ phase22 t07: VERIFY_ENV_ERROR bubbles exitCode 2 (0.121208ms)
✔ phase22 t07: runner exception returns exitCode 1 (0.148417ms)
✔ phase22 t08: workflow files exist and include runner (0.888334ms)
(node:97572) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase22/phase22_t10a_workflow_artifact_always.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase22 t10a: dryrun workflow uploads artifacts always (0.544625ms)
✔ phase22 t10a: write workflow uploads artifacts always (0.110916ms)
✔ phase22 t11: FAIL output includes reasonCode (1.327417ms)
✔ phase22 t12: INVALID_ARGS when required args missing (3.372708ms)
✔ phase22 t12: SUBPROCESS_EXIT_NONZERO when kpi+gate present (0.651792ms)
✔ phase22 t12: RUNTIME_ERROR when runAndGate throws (0.137ms)
✔ phase22 t13: dryrun workflow uploads artifacts and writes summary (0.571042ms)
✔ phase22 t13: write workflow uploads artifacts and writes summary (0.1175ms)
✔ phase22 t14: dryrun workflow contains failure_class rules (0.482667ms)
✔ phase22 t14: write workflow contains failure_class rules (0.081833ms)
✔ phase22 t16: invalid_rapt => ENV classification (2.541125ms)
✔ phase22 t16: firebase-admin missing => ENV classification (0.326916ms)
✔ phase22 t16: generic stderr => IMPL classification (0.131875ms)
✔ phase22 t16: empty stderr => UNKNOWN classification (0.158959ms)
✔ phase22 t18: stderr is captured on exitCode!=0 (2.033125ms)
✔ phase22 t18: empty stderr yields zero bytes and capture=empty (0.2965ms)
✔ phase22 t18: spawn error yields SPAWN_ERROR signature (0.135875ms)
✔ phase22 t20: dryrun workflow provides FIRESTORE_PROJECT_ID (0.601958ms)
✔ phase22 t20: write workflow provides FIRESTORE_PROJECT_ID (0.344375ms)
✔ phase22 t22: ok=true payload includes required keys (2.870167ms)
✔ phase22 t22: stderr present yields head and bytes (0.103042ms)
✔ phase22 t22: stderr empty yields (empty) head and 0 bytes (0.070167ms)
✔ phase220: /api/admin/llm/faq/answer is protected by admin token (fail-closed) (67.150958ms)
✔ phase221: /api/admin/llm/config/* require admin token (fail-closed) (65.486292ms)
✔ phase222: /api/admin/llm/config/* require x-actor when admin token is provided (55.553875ms)
✔ phase223: /api/admin/llm/faq/answer does not require x-actor (admin token provided) (52.369917ms)
✔ phase224: admin/master LLM FAQ request uses buildHeaders (x-actor included) (1.116083ms)
✔ phase224: admin/app LLM FAQ request uses buildHeaders (x-actor included) (0.777959ms)
✔ phase225: admin llm faq audit actor uses x-actor header when provided (46.952167ms)
✔ phase226: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (fail-closed) (72.27375ms)
✔ phase227 t01: /api/admin/llm/ops-explain passes x-actor to usecase params (21.0785ms)
✔ phase227 t02: /api/admin/llm/next-actions passes x-actor to usecase params (23.166584ms)
✔ phase227 t03: ops-explain audit actor follows params.actor (no llm) (3.574542ms)
✔ phase227 t04: next-actions audit actor follows params.actor (no llm) (3.325583ms)
✔ phase228: /api/phaseLLM2/ops-explain and /api/phaseLLM3/ops-next-actions require admin token (fail-closed) (49.626917ms)
✔ phase229: faq blocks when high-risk article has no contact source (9.643375ms)
✔ phase229: faq blocks when high-risk citation omits contact source (0.932875ms)
✔ phase229: faq passes when high-risk citation includes contact source (0.345459ms)
✔ phase229: faqArticlesRepo excludes expired validUntil and FAQ-disallowed intents (8.139958ms)
(node:97595) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t01_workflow_oidc_auth.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t01: dryrun workflow includes OIDC auth and setup-gcloud (0.463708ms)
✔ phase23 t01: write workflow includes OIDC auth and setup-gcloud (0.071084ms)
(node:97596) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t02_workflow_summary_keys.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t02: dryrun workflow summary includes required keys (0.459458ms)
✔ phase23 t02: write workflow summary includes required keys (0.089125ms)
(node:97597) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t03_workflow_human_decision_hint.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t03: dryrun workflow includes humanDecisionHint rules (0.435083ms)
✔ phase23 t03: write workflow includes humanDecisionHint rules (0.077083ms)
(node:97598) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t05_workflow_service_mode_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t05: dryrun workflow sets SERVICE_MODE=member (0.809125ms)
✔ phase23 t05: write workflow sets SERVICE_MODE=member (0.132ms)
(node:97599) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t06_workflow_verify_rest_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t06: dryrun workflow sets PHASE21_VERIFY_REST=1 (0.473792ms)
✔ phase23 t06: write workflow sets PHASE21_VERIFY_REST=1 (0.068292ms)
(node:97600) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_minimal_inputs.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: decision table uses minimal routing inputs (0.969083ms)
✔ phase23 t08: required observation keys match decision inputs (0.317166ms)
(node:97601) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_observation_keys_match_workflow.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: observation keys match workflow summary keys (1.065125ms)
(node:97602) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_decision_table_complete.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close decision table exists and has required columns (1.614041ms)
✔ phase23 t09: closeDecision values are CLOSE or NO_CLOSE (0.22575ms)
(node:97603) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_log_matches_runbook.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close declaration includes phaseResult and closeDecision (0.426791ms)
✔ phase230: faq blocks when top score is below minimum confidence (3.731042ms)
✔ phase230: faq blocks when top1/top2 ratio is below threshold (0.473041ms)
✔ phase230: faq allows confident candidates to proceed (0.76525ms)
✔ phase230: faq repo ranking prefers keyword > synonym > tag matches (6.055291ms)
✔ phase231: faq includes disclaimer version in response and audit events (4.695916ms)
✔ phase231: faq blocked response still includes disclaimer and rendered audit (0.508959ms)
✔ phase231: ops explanation and next actions include disclaimer version and rendered audit (3.005958ms)
✔ phase232: /admin/app includes FAQ block UX panel elements (1.138583ms)
✔ phase232: /admin/master includes FAQ block UX panel elements (0.260208ms)
✔ phase232: admin app dictionary has block UX keys (1.243ms)
✔ phase232: faq blocked payload includes category/actions/suggestions for kb_no_match (5.656625ms)
✔ phase232: faq blocked payload provides fallback actions and max-3 suggested FAQs (0.684166ms)
✔ phase233: next action candidates are abstract-only and sanitized to contract keys (3.90975ms)
✔ phase233: ops explanation includes fixed template sections (3.186792ms)
✔ phase234: FAQ blocks with consent_missing when lawfulBasis=consent and consentVerified=false (3.161875ms)
✔ phase234: llm config plan/set supports llmPolicy snapshot and hash verification (37.646041ms)
✔ phase234: ops/next-actions audit payload includes llmPolicy snapshot fields (2.740167ms)
✔ phase235: checklist_guidance mode is allowed and returns answer when guard passes (3.646667ms)
✔ phase235: guide-only mode blocks free-chat mode (3.90775ms)
✔ phase235: personalization beyond allow-list is blocked (2.91825ms)
✔ phase24 t02: appendDecision sets decidedAt and createdAt serverTimestamp (0.846333ms)
✔ phase24 t02: appendDecision does not overwrite previous entries (0.176875ms)
✔ phase24 t02: getLatestDecision returns most recent by decidedAt (0.996041ms)
✔ phase24 t02: invalid decision enum is rejected (0.934917ms)
✔ phase24 t03: memberNumber missing => BLOCK (0.472625ms)
✔ phase24 t03: memberNumber stale => WARN (0.075667ms)
✔ phase24 t03: memberNumber ok => INFO (0.497875ms)
✔ phase24 t03: checklist incomplete => WARN (0.069625ms)
✔ phase24 t04: missing linkRegistryId => BLOCK (0.491792ms)
✔ phase24 t04: invalid ctaText => BLOCK (0.076333ms)
✔ phase24 t04: missing deliveries => WARN (0.067333ms)
✔ phase24 t04: event without delivery => BLOCK (0.061625ms)
✔ phase24 t05: progress without definition => BLOCK (0.614292ms)
✔ phase24 t05: missing required item => BLOCK (0.147792ms)
✔ phase24 t05: completed but incomplete => BLOCK (0.078708ms)
✔ phase24 t05: required satisfied => ok and complete (0.54575ms)
✔ phase24 t06: memberNumber missing => BLOCK (0.68625ms)
✔ phase24 t06: memberNumber invalid format => WARN (0.14425ms)
✔ phase24 t06: duplicate memberNumber => BLOCK (0.121542ms)
✔ phase24 t06: normal => OK (0.349666ms)
✔ phase24 t07: recordOpsNextAction appends decisionLog and upserts opsState (0.690958ms)
✔ phase24 t07: invalid nextAction is rejected (0.250458ms)
✔ phase24 t07: upsert stores updatedAt serverTimestamp (0.803417ms)
✔ phase24 t07: phase23 runbook still contains decision table keys (0.41275ms)
✔ phase24 t08: missing opsState => WARN (0.719083ms)
✔ phase24 t08: missing nextAction => WARN (0.07675ms)
✔ phase24 t08: opsState with nextAction => OK (0.066917ms)
✔ phase24 t08: summary includes opsState when present (3.1395ms)
✔ phase24 t09: missing opsState => WARN missing_ops_state (1.01525ms)
✔ phase24 t09: missing decision log => WARN missing_decision_log (0.094417ms)
✔ phase24 t09: mismatched nextAction => WARN mismatched_next_action (0.086ms)
✔ phase24 t09: matching decision log => OK (0.076292ms)
✔ phase24 t10: all OK => READY (0.833791ms)
✔ phase24 t10: warn missing in opsStateCompleteness => NOT_READY (0.110709ms)
✔ phase241: /admin/ops redirects to /admin/app when authenticated (23.28775ms)
✔ phase241: notification deliveries API supports memberNumber search and vendor fallback (23.073625ms)
✔ phase241: monitor insights returns vendor CTR, AB snapshot, FAQ reference top (23.776209ms)
✔ phase241: admin app removes status summary panels from operational panes (0.782166ms)
✔ phase241: admin app includes monitor user timeline and insights sections (0.348125ms)
✔ phase241: ops safe test flow propagates traceId into monitor pane (0.966875ms)
✔ phase241: all ui.* keys used in /admin/app are present in dictionary (4.598625ms)
✔ phase243: faqArticlesRepo accepts version fallback and excludes invalid schema rows (3.786834ms)
✔ phase244: blocked low_confidence returns kbMeta and policySnapshotVersion (10.0365ms)
✔ phase244: success response includes kbMeta and policySnapshotVersion (0.9055ms)
✔ phase245: FAQ writes llm_disclaimer_rendered with surface=api (8.447333ms)
✔ phase245: Ops explain writes llm_disclaimer_rendered with surface=api (0.752416ms)
✔ phase245: Next actions writes llm_disclaimer_rendered with surface=api (0.679834ms)
✔ phase246: blocked payload always includes safe fallbackActions and suggestedFaqs <= 3 (10.603792ms)
✔ phase246: admin app filters direct URL sourceId in block panel (0.523958ms)
✔ phase247: ops template sections order is fixed (2.243708ms)
✔ phase247: next action internal enum stays uppercase (0.730333ms)
✔ phase247: admin app lowercases next actions for display only (0.579584ms)
✔ phase248: blocked reason taxonomy mapper is shared (0.407042ms)
✔ phase248: FAQ audit stores regulatoryProfile (9.006583ms)
✔ phase248: Ops/NextAction audits include regulatoryProfile (1.200917ms)
✔ phase249: guide-only modes remain allowed (10.064667ms)
✔ phase249: non guide-only mode is blocked (0.3245ms)
✔ phase249: personalization is restricted to locale/servicePhase (0.256083ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d123 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t02: dryRun does not write and returns readiness (1.340208ms)
✔ phase25 t02: dryRun false writes and returns decisionLogId (7.642917ms)
✔ phase25 t02: readiness NOT_READY still returns ok (0.467667ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t03: ops console returns required keys (5.580834ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t04: console recommendedNextAction flows into submit (11.328125ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=invalid nextAction
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=ENV nextAction=RERUN_MAIN reason=invalid nextAction
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t05: READY writes audit snapshot (9.767583ms)
✔ phase25 t05: READY rejects nextAction not in allowedNextActions (0.341791ms)
✔ phase25 t05: NOT_READY allows only STOP_AND_ESCALATE (0.2935ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=PASS nextAction=NO_ACTION reason=invalid consistency
✔ phase25 t06: opsState missing => WARN (0.567375ms)
✔ phase25 t06: decisionLog missing => WARN (0.106125ms)
✔ phase25 t06: opsState source mismatch => FAIL (0.123ms)
✔ phase25 t06: missing audit snapshot => FAIL (0.085167ms)
✔ phase25 t06: submit rejects on consistency FAIL (1.151459ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t07: READY recommended is in allowedNextActions (10.535625ms)
✔ phase25 t07: NOT_READY forces STOP_AND_ESCALATE only (0.370417ms)
✔ phase25 t07: consistency FAIL downgrades readiness to NOT_READY (0.347208ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t08: READY yields closeDecision CLOSE (8.954ms)
✔ phase25 t08: NOT_READY yields closeDecision NO_CLOSE (0.311041ms)
✔ phase25 t08: consistency FAIL yields closeDecision NO_CLOSE (0.247667ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t09: audit includes closeDecision fields (10.526208ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=NO_ACTION reason=closeDecision closed
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=closeDecision: NO_CLOSE
✔ phase25 t10: CLOSE rejects submit (1.450542ms)
✔ phase25 t10: NO_CLOSE rejects non-escalate actions (0.172958ms)
✔ phase250: source audit classifies ok/redirect/http_error/timeout and stores screenshot paths (3.410583ms)
✔ phase250: confirm extends validUntil by 120 days and sets active (2.004166ms)
✔ phase250: retire returns warning when source is still used by city packs (0.584167ms)
✔ phase250: sendNotification blocks when referenced source is expired (1.775417ms)
✔ phase250: canary run stores run summary, evidence and audit logs with traceId (4.734208ms)
✔ phase250: review inbox requires admin token and internal audit route requires job token (100.898166ms)
✔ phase251 t01: parseArgs reads required env and trims service url (1.331292ms)
✔ phase251 t01: parseArgs supports canary mode and ids (0.789833ms)
✔ phase251 t01: parseArgs rejects invalid mode (0.479583ms)
✔ phase251 t01: parseArgs rejects unknown args (0.266667ms)
✔ phase251 t02: invokeCityPackAudit returns ok on 200/ok:true (1.245166ms)
✔ phase251 t02: invokeCityPackAudit returns fail on non-2xx (0.153333ms)
✔ phase251 t02: invokeCityPackAudit falls back on invalid json response (0.12825ms)
✔ phase251 t03: workflow exists and calls runner script (0.904125ms)
✔ phase252: city pack audit runs API requires token and returns summary/status (33.825125ms)
✔ phase252: admin app includes city pack run history panel and controls (1.241208ms)
✔ phase252: index routes include city-pack-source-audit/runs (1.468167ms)
✔ phase253: city pack run detail API requires token and returns run + evidences (27.655ms)
✔ phase253: admin app includes city pack trace button and run detail fetch (1.177042ms)
✔ phase253: index routes include city-pack-source-audit/runs/:runId (0.623416ms)
✔ phase254: admin app includes city pack run detail table and raw drawer (0.813333ms)
✔ phase254: run detail renderer opens evidence and handles missing trace (0.86775ms)
✔ phase254: city pack run detail dictionary keys are defined (2.106792ms)
✔ phase256: city pack run detail API applies evidence limit query (25.952584ms)
✔ phase256: admin app includes run detail limit input and query wiring (1.103125ms)
✔ phase256: dictionary includes city pack run detail limit keys (0.658458ms)
✔ phase26: ops console list includes memberFlags (add-only) (2.046417ms)
✔ phase26 t01: list splits READY/NOT_READY and returns required keys (2.793792ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U2 decisionLogId=d2 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase26 t02: postCheck verifies READY decisions (10.151958ms)
✔ phase26 t02: postCheck verifies NOT_READY decisions (0.350083ms)
✔ phase26 t03: docs exist with required headings (1.481875ms)
✔ phase26 t04: list returns pageInfo placeholder (2.46525ms)
✔ phase26 t04: list returns pageInfo even when empty (0.438291ms)
✔ phase260: region declare creates request and user fields (3.096791ms)
✔ phase260: draft job creates source refs and draft city pack (3.762833ms)
✔ phase260: city-pack-requests routes require admin token (29.173583ms)
✔ phase260: internal city-pack draft job requires token (30.354375ms)
✔ phase260: admin app includes city pack request panel (0.773083ms)
✔ phase261: /admin/app uses decision cards and removes summary header blocks (1.041417ms)
✔ phase261: decision state rules are fixed to READY/ATTENTION/STOP (0.869334ms)
✔ phase261: details auto-open for ATTENTION/STOP (0.39675ms)
✔ phase261: vendor facade list/edit/activate/disable keeps compatibility with link_registry (30.574625ms)
✔ phase261: vendor actions require and persist traceId in audit logs (26.866958ms)
✔ phase261: initial pane contract keeps 3-action decision layout (1.021417ms)
✔ phase262: admin_app defines Alt+0..9 pane shortcuts (contract) (1.046917ms)
✔ phase262: admin.css provides focus-visible and reduced-motion rules (contract) (0.884791ms)
✔ phase263: decision card state classes exist in CSS and JS (contract) (0.914125ms)
✔ phase263: decision reasons are built via shared 2-line formatter (contract) (1.417792ms)
✔ phase264: admin.css provides table scroll + sticky header rules (contract) (0.5365ms)
✔ phase264: vendor table supports arrow key navigation + enter select (contract) (1.137833ms)
✔ phase266: city pack create normalizes targetingRules and slots (1.638167ms)
✔ phase266: city pack structure update route requires admin token and appends audit (31.788625ms)
✔ phase266: draft job creates default targetingRules and slots (2.992458ms)
✔ phase266: admin app includes city pack structure editor controls (0.824625ms)
✔ phase266: admin app wires city pack structure save endpoint (0.492833ms)
✔ phase267: source ref policy fields are normalized and persisted (2.73975ms)
✔ phase267: source policy route requires admin token and writes audit (30.386292ms)
✔ phase267: optional source failures do not block city pack validation (1.505666ms)
✔ phase267: required source failures still block city pack validation (0.235291ms)
✔ phase267: sendNotification uses cityPackFallback when only optional sources are invalid (4.9055ms)
✔ phase267: sendNotification remains fail-closed when required source is invalid (0.502708ms)
✔ phase267: admin app city pack pane has source policy controls (0.821041ms)
✔ phase267: admin app JS posts source policy update endpoint (1.180334ms)
✔ phase268: light/heavy stage updates source confidence and stage fields (3.881459ms)
✔ phase268: review inbox exposes priority/confidence/audit stage and sorts by priority (39.86825ms)
✔ phase268: internal light/heavy city pack audit routes require token and set stage (119.270708ms)
✔ phase268: city pack pane includes priority/confidence/stage columns and run mode options (1.012458ms)
✔ phase268: city pack run action posts stage and mode (1.232333ms)
✔ phase269: city pack structure editor includes basePackId input with dict keys (1.303625ms)
✔ phase269: admin app reads basePackId input and posts it on structure save (0.965542ms)
✔ phase269: city pack structure update validates base pack depth and self reference (1.07925ms)
✔ phase269: cityPacksRepo normalizes basePackId and overrides in structure patch (0.660875ms)
✔ phase27 t01: docs exist with required headings (0.785584ms)
✔ phase27 t02: list sorts READY first then cursorCandidate desc then lineUserId (3.407916ms)
✔ phase27 t02: list stabilizes order by lineUserId when cursorCandidate is null (14.761708ms)
✔ phase27 t03: list guards required keys/types when console result is missing fields (1.445417ms)
✔ phase27 t04: list keeps pagination compatibility keys (nextPageToken + pageInfo) (2.019208ms)
✔ phase27 t04: list returns pagination keys even when items is empty (0.435666ms)
✔ phase270: City Pack Feedback command stores feedback and event (1.583333ms)
✔ phase270: city-pack-feedback routes require admin token (38.724166ms)
✔ phase270: admin app includes feedback inbox and detail panels (0.875875ms)
✔ phase270: admin app loads feedback and posts actions (1.075042ms)
✔ phase271: city-pack-bulletins routes require admin token (36.073458ms)
✔ phase271: bulletin send uses sendNotification + killSwitch guard (0.77275ms)
✔ phase271: update proposal allowlist enforced and apply updates city pack (35.901875ms)
✔ phase271: admin app includes bulletin inbox and detail panels (0.932875ms)
✔ phase271: admin app includes proposal inbox and detail panels (0.983875ms)
✔ phase271: bulletin/proposal dictionary keys exist (4.421125ms)
✔ phase272: composer pane contains type-driven form, live preview, and saved list blocks (0.991958ms)
✔ phase272: non-STEP defaults are fixed to scenario A / week / limit 50 (2.729333ms)
✔ phase272: GET /api/admin/os/notifications/list returns rows under admin guard (53.406042ms)
✔ phase272: GET /api/admin/os/link-registry/:id returns lookup payload and enforces admin token (45.219708ms)
✔ phase272: composer danger actions require confirm and keep trace-aware calls (2.345875ms)
✔ phase272: composer type-driven dictionary keys exist (4.087666ms)
✔ phase272: createNotification stores notificationType and notificationMeta add-only fields (2.041666ms)
✔ phase273: city-pack-metrics route is admin-guarded and persists daily rows (43.90025ms)
✔ phase273: computeCityPackMetrics aggregates by cityPack/slot/sourceRef with unmapped fallback (10.624958ms)
✔ phase273: admin app has city pack metrics panel and loader wiring (1.420625ms)
✔ phase273: city pack metrics dictionary keys exist (2.021625ms)
✔ phase273: index wires /api/admin/city-pack-metrics into city pack admin route set (1.918041ms)
✔ phase274: city pack route supports export + import dry-run/apply with confirm token (0.486667ms)
✔ phase274: template library route exposes list/create/detail/activate/retire (1.020792ms)
✔ phase274: template library repo uses city_pack_template_library collection (0.446625ms)
✔ phase274: index wires city pack import/export + template library endpoints (0.660125ms)
✔ phase274: app.html contains template library and import/export controls in city pack pane (3.835542ms)
✔ phase274: admin_app wires template library load and import/export actions (1.039334ms)
✔ phase274: template library/import-export dictionary keys exist (6.801708ms)
✔ phase28 t01: docs exist with required headings (1.77625ms)
✔ phase28 t02: pagination returns page1/page2 without overlap and stable order (16.367584ms)
✔ phase28 t03: invalid cursor is rejected (3.919958ms)
✔ phase28 t04: READY priority holds across pages (14.88175ms)
✔ phase28 t05: required keys are present on all pages (13.680541ms)
✔ phase29 t01: nextPageToken can be used as cursor (compatible with pageInfo.nextCursor) (18.650209ms)
✔ phase29 t02: signed cursor is returned and can paginate without overlap (optional security) (20.369792ms)
✔ phase29 t03: signed cursor verifies signature and enforce mode rejects unsigned cursor (16.393666ms)
✔ phase30 t01: cursorInfo defaults to UNSIGNED and enforce=false (2.32025ms)
✔ phase30 t02: cursorInfo reflects signing/enforce even when items empty (1.54925ms)
✔ phase304: composer pane keeps type-driven form + live preview + saved list while hiding trace input UI (1.830667ms)
✔ phase304: css enforces no-fold behavior and hides decision summaries (0.609042ms)
✔ phase304: dashboard KPI endpoint is wired and returns six KPI keys contract (0.688167ms)
✔ phase304: saved filter uses AND conditions and preview reflects CTA2 (1.142375ms)
✔ phase306: city_pack_requests persists add-only experience fields (3.235667ms)
✔ phase306: city_pack_feedback supports slot/message/resolution and status extensions (2.644833ms)
✔ phase306: draft job writes slotContents + request experience fields (5.754333ms)
✔ phase306: kill switch blocks city pack admin/internal write operations (34.836458ms)
✔ phase306: city pack pane shows request stage/warning/aging and feedback slot/resolution (2.645875ms)
✔ phase306: city pack feedback actions include triage/resolve handlers (1.964292ms)
✔ phase306: index routes include city-pack-feedback triage/resolve actions (0.627333ms)
✔ phase306: city pack request/feedback dictionary keys exist (2.16025ms)
✔ phase307: legacy duplicate repos are frozen as canonical forwarders (no direct db write) (2.599125ms)
✔ phase307: canonical user query path does not reintroduce scenario-field filtering (0.51575ms)
✔ phase307: ops review flow normalizes drift fields before writing (0.097625ms)
✔ phase307: missing-index fallback points do not exceed audit baseline (4.97475ms)
✔ phase307: newly added structural files do not introduce fallback catches (0.365625ms)
✔ phase307: normalizeOpsStateRecord keeps canonical keys only (1.043625ms)
✔ phase307: opsStateRepo read prefers canonical ops_states then falls back to legacy ops_state (0.655209ms)
✔ phase307: protection matrix resolves expected auth classes (1.339ms)
✔ phase307: index.js routes protection via resolvePathProtection reference (0.338708ms)
✔ phase307: internal retention dry-run route requires only internal token (not admin token) (109.119708ms)
✔ phase307: retention dry-run does not delete docs and appends audit log (43.018416ms)
✔ phase307: normalizeScenarioKey absorbs scenario/scenarioKey drift (0.440208ms)
✔ phase307: usersRepo.listUsers accepts legacy scenario input and queries canonical scenarioKey (0.711667ms)
✖ phase308: top3 analytics hotspots use explicit bounded limits (13.074916ms)
✔ phase308: runtime routes/scripts do not import legacy duplicate repos (1.388375ms)
✔ phase308: missing-index fail mode defaults to true on stg/prod env (0.45275ms)
✔ phase308: every repo fallback branch has indexFallbackPolicy hooks (4.193625ms)
✔ phase308: retention dry-run fails closed on undefined collection policy (81.491167ms)
✔ phase308: retention policy covers all collections from audit lifecycle snapshot (0.837291ms)
✔ phase308: struct drift backfill supports dry-run and apply with audit trace (59.046166ms)
✔ phase309: struct drift backfill supports resumeAfterUserId cursor (13.974875ms)
✔ phase309: admin struct drift routes require admin token and support list/execute (44.8195ms)
✔ phase309: retention apply is env/flag guarded and filters by policy (45.356333ms)
✔ phase309: ops snapshot job builds snapshots and dashboard reads snapshot first (58.807792ms)
✔ phase309: review legacy page exposes LEGACY guidance to /admin/app (0.485208ms)
✔ phase309: admin app includes struct drift panel controls and handlers (0.87525ms)
✔ phase309: trace repos use index-oriented where+orderBy queries (0.543625ms)
✔ phase31 t01: ops_readonly includes ops console list/detail/submit sections (0.846708ms)
✔ phase31 t02: ops_readonly defines ops console fetch/submit helpers (0.831208ms)
✔ phase310: repo_map_ui.json exposes required machine-readable sections (0.453833ms)
✖ phase310: repo-map check mode passes when generated artifact is current (105.375834ms)
✔ phase310: /api/admin/repo-map is admin protected and returns payload for authorized actor (84.148083ms)
✔ phase310: app shell includes developer menu and developer-map pane hooks (1.154375ms)
✔ phase310: developer-map pane keeps no-fold structure (3.020417ms)
✔ phase310: developer labels exist in dictionary and audit workflow checks repo-map drift (1.692709ms)
✔ phase311: repo map exposes three layers and canonical developer statuses (0.506083ms)
✔ phase311: feature completion maps deterministically to developer status (4.736542ms)
✔ phase311: /api/admin/repo-map remains admin-guarded and returns layers (84.953958ms)
✔ phase311: redac/user manuals are rendered without details blocks (0.872ms)
✔ phase311: repo map keeps japanese glossary for internal terms and manual labels (3.342459ms)
✔ phase311: developer matrix render uses scenario-step cells with count and state labels (2.673958ms)
✔ phase311: audit workflow and package scripts enforce repo-map drift checks (0.635709ms)
✔ phase312: snapshot read mode defaults to prefer (0.548167ms)
✔ phase312: snapshot read mode supports require and legacy disabled compatibility (0.127583ms)
✔ phase312: dashboard KPI returns NOT AVAILABLE and no full-scan fallback in require mode (46.118542ms)
✔ phase312: require mode returns NOT AVAILABLE placeholders for summary/state when snapshot is missing (3.591833ms)
✔ phase313: /api/admin/legacy-status is admin guarded and returns legacy route summary (74.227583ms)
✔ phase313: developer map includes LEGACY status controls without removing existing routes (1.347209ms)
✔ phase313: index wires /api/admin/legacy-status route (1.364167ms)
✔ phase314: retention apply rejects unmatched dryRunTraceId and accepts matched trace (37.742208ms)
✔ phase314: retention apply supports maxDeletes/cursor and appends audit payload (53.254541ms)
✖ phase315: cleanup check script passes when generated artifacts are current (122.514583ms)
✔ phase315: unreachable baseline files are frozen with LEGACY marker (1.010834ms)
✔ phase315: legacy aliases carry LEGACY_HEADER and canonical forwarding (0.649417ms)
✔ phase315: INDEX_PLAN covers all fallback source files from audit input (0.497833ms)
✔ phase315: retention addendum and lifecycle cover all retention policy collections (0.571959ms)
✔ phase315: protection matrix keeps admin/internal protection classes (1.022583ms)
✔ phase315: internal job routes keep token guard and killSwitch dependency map is generated (0.512041ms)
✔ phase316: analytics range queries return only bounded rows (3.035666ms)
✔ phase316: dashboard KPI read path uses bounded range queries for events/deliveries (0.53125ms)
✔ phase316: user operational summary sources users from canonical usersRepo listUsers (0.520042ms)
✖ phase317: notification operational summary uses bounded range query with legacy fallback (4.737417ms)
✔ phase317: notification summary ignores events older than notification sendAt in bounded path (5.399708ms)
✔ phase318: analytics users/notifications range queries return only bounded rows (1.559334ms)
✔ phase318: dashboard KPI read path uses bounded range queries for users/notifications with fallback (0.524834ms)
✖ phase319: user operational summary uses range-first events/deliveries with fallback (5.902292ms)
✔ phase319: range-first path ignores out-of-window events when bounded set is non-empty (4.634458ms)
✔ phase32 t01: READY suggestions filtered to allowedNextActions (1.904667ms)
✔ phase32 t02: NOT_READY suggests STOP_AND_ESCALATE only (5.353416ms)
✔ phase32 t03: llm failure yields empty suggestions (5.310834ms)
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (7.487125ms)
✔ phase320: range-first path for user state ignores older events outside user window when bounded set is non-empty (4.619667ms)
✔ phase321: monitor insights uses sentAt range query first with bounded fallback (0.490875ms)
✔ phase321: monitor insights excludes out-of-window delivery when bounded set is non-empty (29.924041ms)
✔ phase322: phase2 automation uses range path when weekly events exist (2.374958ms)
✔ phase322: phase2 automation falls back to listAll events when weekly range is empty (2.255459ms)
✔ phase323: phase5 notifications summary route parses limit/eventsLimit bounds (0.467333ms)
✔ phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary (0.464417ms)
✔ phase324: phase5 users summary route parses limit/analyticsLimit bounds (0.444667ms)
✔ phase324: users filtered usecase forwards limit/analyticsLimit to operational summary (0.450167ms)
✔ phase325: phase5 stale member route parses limit bounds (0.442ms)
✔ phase325: stale member summary respects limit option (0.980084ms)
✔ phase326: phase4 users summary route parses limit/analyticsLimit bounds (0.463875ms)
✔ phase326: user operational summary respects limit option (3.147417ms)
✔ phase327: phase4 notifications route parses limit/eventsLimit bounds (0.451375ms)
✔ phase327: notification operational summary accepts bounded eventsLimit (3.8375ms)
✔ phase328: phase5 state summary route parses analyticsLimit bounds (0.45625ms)
✔ phase328: user state summary accepts analyticsLimit knob (2.54375ms)
✔ phase329: phase4 users summary route parses snapshotMode (0.466917ms)
✔ phase329: phase5 state summary route parses snapshotMode (0.471375ms)
✔ phase329: snapshotMode=require argument returns NOT AVAILABLE semantics when snapshot is missing (1.472ms)
✔ phase33 t01: execute actions return execution snapshots (10.474791ms)
✔ phase33 t02: duplicate execution is blocked (1.331292ms)
✔ phase33 t02: readiness NOT_READY blocks execution (6.544791ms)
✔ phase330: phase4 notifications summary route parses snapshotMode (0.484791ms)
✔ phase330: notification summary returns snapshot data in require mode (2.508584ms)
✔ phase330: notification summary require mode returns empty when snapshot missing (0.487125ms)
✔ phase330: ops snapshot build includes notification_operational_summary item (3.66225ms)
✔ phase331: phase5 notifications summary route parses snapshotMode (0.751ms)
✔ phase331: phase5 notifications filtered usecase forwards snapshotMode (0.594041ms)
✔ phase331: phase5 notifications summary returns empty in snapshot require mode when snapshot missing (1.685042ms)
✔ phase332: phase5 users summary route parses snapshotMode (0.479042ms)
✔ phase332: phase5 users filtered usecase forwards snapshotMode (0.468458ms)
✔ phase333: phase5 users summary returns empty in snapshot require mode when snapshot missing (1.300958ms)
✔ phase334: phase4 summary routes include metadata fields and includeMeta option (0.4615ms)
✔ phase334: user operational summary includeMeta returns not_available metadata in require mode (1.955291ms)
✔ phase334: notification operational summary includeMeta returns not_available metadata in require mode (1.649458ms)
✔ phase335: monitor insights route parses snapshotMode and has require no-fallback branch (0.543709ms)
✔ phase335: monitor insights returns 400 on invalid snapshotMode (0.766208ms)
✔ phase336: index wires /api/admin/retention-runs route (0.664875ms)
✔ phase336: retention-runs returns retention actions only and maps payload fields (1.734792ms)
✔ phase337: phase5 summary routes include metadata fields (0.486125ms)
✔ phase337: users summary includeMeta returns items+meta in require mode (1.39375ms)
✔ phase337: notifications summary includeMeta returns items+meta in require mode (0.37075ms)
✔ phase338: phase5 state route returns metadata fields (0.505291ms)
✔ phase338: phase5 state require mode returns not_available metadata when snapshot missing (1.786416ms)
✔ phase339: analyticsReadRepo defines user-scoped query readers (0.519583ms)
✔ phase339: phase5 state summary uses scoped queries before listAll fallback (0.486417ms)
✔ phase34 t01: suggestion drift is detected (1.6595ms)
✔ phase34 t02: execution drift is detected (1.392667ms)
✔ phase34 t03: policy drift is detected (1.285167ms)
✔ phase34 t04: no drift when suggestion/ops/execution align (1.770791ms)
✔ phase34 t05: phase32 -> phase33 -> phase34 appends decision drift (9.622625ms)
✔ phase340: snapshot freshness helpers resolve minutes and stale judgement (1.273417ms)
✔ phase340: user summary require mode treats stale snapshot as not_available (2.635541ms)
✔ phase341: internal ops snapshot job forwards targets payload (0.493458ms)
✔ phase341: buildOpsSnapshots supports partial targets with backward-compatible default (3.377458ms)
✔ phase342: maintenance pane includes retention runs read-only panel (0.9025ms)
✔ phase342: admin app loads retention runs from admin API (1.137708ms)
✔ phase342: retention runs ui dictionary keys exist (0.819208ms)
✔ phase343: audit inputs manifest contains required metadata and file hashes (0.644125ms)
✔ phase343: package scripts and audit workflow include audit-inputs checks (0.493708ms)
✔ phase344: load risk report keeps required keys (0.467583ms)
✔ phase344: load risk scripts, budgets doc, and workflow check are wired (0.579292ms)
✔ phase345: audit inputs manifest uses real metadata values (0.517ms)
✔ phase346: load risk hotspots include endpoint mapping (0.516416ms)
✔ phase347: phase4 summary routes parse fallbackMode and reject invalid values (0.449ms)
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (3.43ms)
✔ phase348: phase5 ops/state routes parse fallbackMode and forward it (0.582125ms)
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.231917ms)
✔ phase349: ops snapshot repo and route contracts exist (0.475791ms)
✔ phase349: index wires ops snapshot health admin endpoint (0.609375ms)
✔ phase35: notices repo create/get/list/update (1.214208ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase35 t01: console execution status reflects latest execution log (10.837834ms)
✔ phase35 t01: console execution status defaults to UNKNOWN when missing (0.398166ms)
✔ phase35 t02: list includes executionStatus summary (1.929375ms)
✔ phase35 t02: list defaults executionStatus when missing (0.538666ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase35 t03: ops loop updates executionStatus (4.601458ms)
✔ phase350: read path budgets include current baseline ratchet values (0.430167ms)
✔ phase350: load risk budget parser uses last matching budget values (0.469917ms)
✔ phase351: dashboard kpi route parses fallbackMode and rejects invalid value (0.488875ms)
✔ phase351: dashboard kpi compute path blocks listAll fallback when fallbackMode=block (0.492625ms)
✔ phase352: analytics read repo exposes checklist scoped query by scenario+step (0.498375ms)
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.852875ms)
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.495708ms)
✔ phase353: phase4/phase5 routes expose fallback diagnostics fields (0.55325ms)
✔ phase353: summary/state usecases track fallback source diagnostics (0.591ms)
✔ phase354: ops snapshot health route accepts snapshotType filter and forwards to repo (0.489708ms)
✔ phase354: maintenance pane contains snapshot health controls and table (0.834334ms)
✔ phase354: admin app loads snapshot health via admin API (0.950334ms)
✔ phase355: read path budgets include hotspots_count_max in current baseline (0.49075ms)
✔ phase355: load risk script parses and checks hotspots_count_max budget (0.469125ms)
✔ phase356: fallback policy module defines env-driven default and resolver (0.576166ms)
✔ phase356: dashboard/phase4/phase5 routes use fallback policy default on missing query (0.716334ms)
✔ phase357: analytics read repo exposes lineUserIds scoped user_checklists query (0.542875ms)
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (4.759042ms)
✔ phase358: analytics read repo exposes notificationIds scoped events query (0.504042ms)
✖ phase358: notification summary collects notification ids and queries scoped events first (3.552084ms)
✔ phase359: phase2 automation route validates fallbackMode and forwards it (0.428334ms)
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.584792ms)
✔ phase35-39: docs exist with required headings (1.675625ms)
✔ phase36: notice send flow pushes and records delivery/audit (0.60475ms)
✔ phase360: monitor insights route accepts fallbackMode and blocks listAll fallback (0.5095ms)
✔ phase360: monitor insights emits read_path fallback audit action when fallback is used or blocked (0.5065ms)
✔ phase361: read-path routes include fallback audit actions (1.554167ms)
✔ phase362: read path budgets include current baseline section for phase362 (1.053625ms)
✔ phase362: load-risk budget parser uses last baseline entries (0.515584ms)
✔ phase363: load risk hotspots exclude listAll function declarations (0.575ms)
✔ phase363: fallback_risk equals unique fallback file/call surfaces (0.546459ms)
✔ phase364: analytics read repo provides scoped checklist/delivery methods (0.510583ms)
✔ phase364: phase4 users summary uses scoped reads and blocks fallback only on query failure (0.537375ms)
✔ phase365: phase4 notification summary uses global events fallback only after scoped/range query failures (0.47625ms)
✔ phase365: index requirements include scoped checklist/delivery query entries (0.503791ms)
✔ phase366: phase5 state summary uses scoped checklist pairs and fallback only on query failures (1.310625ms)
✔ phase367: phase2 automation prefers scoped reads before listAll fallbacks (0.877917ms)
✔ phase367: phase2 automation route keeps fallbackMode allow|block contract (0.845084ms)
✔ phase368: dashboard KPI responses include unified fallback diagnostics keys (0.481584ms)
✔ phase368: monitor insights response includes source/asOf/freshness and fallback diagnostics (0.54075ms)
✔ phase369: read path fallback summary route exposes grouped and recent rows (0.493ms)
✔ phase369: index routes /api/admin/read-path-fallback-summary (0.61975ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase36-39: full ops flow yields timeline + traceability (5.061167ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
✔ phase36: decision timeline appends DECIDE/POSTCHECK/EXECUTE (4.646208ms)
✔ phase37: notification summary includes decision trace when linked (3.463916ms)
✔ phase38: getOpsAssistContext returns read-only payload (0.740125ms)
✔ phase39: stale console is rejected and logged (1.519917ms)
✔ phase37: mark read and click append audit logs (0.554334ms)
✔ phase370: maintenance pane contains fallback summary controls and table (0.958917ms)
✔ phase370: admin app loads read-path fallback summary via admin API (0.858625ms)
✔ phase371: product readiness route returns GO/NO_GO with blockers and checks (0.487667ms)
✔ phase371: index routes /api/admin/product-readiness (0.614042ms)
✖ phase372: read path budgets include current baseline section for phase372 (3.199542ms)
✔ phase372: launch checklist includes product-readiness API checks (0.479792ms)
✔ phase38: ops dashboard returns dashboard items (1.237667ms)
✔ phase39: suggestion schema and audit are fixed (1.015375ms)
✖ admin summaries: users and notifications (5.859541ms)
✔ getNotificationReadModel: counts delivered/read/click (2.090292ms)
✔ toggle checklist done persists and reflects in GET (2.137625ms)
✔ toggle checklist done false clears in GET (0.332584ms)
✔ getMemberProfile returns memberNumber (0.785458ms)
✔ setMemberNumber writes trimmed value (0.577ms)
✔ setMemberNumber clears when empty (0.171333ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase40-44: full flow returns view + automation skips NO_ACTION execution (8.458ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase40: suggestion has disclaimer and no nextAction field (8.363459ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase41: llm assist suggestion appends timeline entry (3.882792ms)
✔ phase42: ops console view returns read-only payload (0.562583ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
✔ phase43: automation disabled by default (6.390375ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase44: automation guard triggers escalation (6.480708ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=f7b543f51277cbc932562b00fd26e711e71ebba2112fef4e3ffdffd1e0451a77 model=ops-assist-rules opsAssistInputHash=51fcb97feedd69b931804436952625029700aeac1a8ebaaf5a28977f87e3e9d8 refreshReason=cache_miss
✔ phase45: suggestion falls back to allowed action (8.435292ms)
✔ phase45: prompt payload shape is fixed (0.829ms)
✔ phase46: ops assist cache stores latest entry (1.093917ms)
✔ phase46: ops console view includes assist only when requested (0.567667ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase47: automation timeline links decision log (7.518792ms)
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
✔ phase47: dry-run returns guard without writes (1.137875ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase47: execute requires readiness OK (6.863416ms)
✔ phase48: automation config default disabled (0.906542ms)
✔ phase48: automation config list shape fixed (1.573125ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase49: full ops flow stays consistent (9.139459ms)
✔ memberNumber stale: 14 days threshold (1.036416ms)
✔ ops attention flag: memberNumber missing, checklist incomplete, stale (3.142917ms)
✖ phase5 ops filters: date range (3.557417ms)
✔ phase323: notifications summary filter forwards limit/eventsLimit options (1.716292ms)
✔ phase324: users summary filter forwards limit/analyticsLimit options (1.924541ms)
✔ ops filters: no params keeps all items (3.604708ms)
✔ ops filters: needsAttention (1.419375ms)
✔ ops filters: stale (0.415792ms)
✔ ops filters: unreviewed (0.429666ms)
✔ ops filters: reviewAgeDays (0.382792ms)
✔ ops filters: invalid reviewAgeDays returns 400 (0.139042ms)
✔ ops flags: memberNumber stale yes/no (2.833667ms)
✔ ops review: saves lastReviewed fields (1.15925ms)
✔ ops review write: updates user opsReview fields (0.868791ms)
✖ getUserStateSummary: returns read-only state (7.104416ms)
✔ phase50: obs emitted on submit and execute (7.33125ms)
✔ phase50: obs format is key=value and meta_json (1.595583ms)
[OBS] action=ops_assist_suggest result=cache_hit lineUserId=U1 cacheHit=true inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=cache_hit
✔ phase51: cache hit returns cached suggestion without regeneration (8.562459ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=input_changed
✔ phase51: input hash change triggers refresh (8.738834ms)
[OBS] action=ops_batch_run result=dry_run dryRun=true jobKey=refresh_ops_console limit=10
✔ phase52: dry-run does not call writers (0.823ms)
✔ phase52: invalid jobKey is rejected (0.647792ms)
✔ phase53: suggest template mapping (0.421333ms)
✔ phase53: template repo stores and lists templates (1.116875ms)
✔ phase54: docs exist with required headings (0.836458ms)
✔ phase6 member summary: 400 when lineUserId missing (1.134208ms)
✔ phase6 member summary: 404 when user not found (0.629583ms)
✔ phase6 member summary: returns minimal summary (2.419875ms)
✔ phase6 member summary: includes redac status (last4 only) (0.464583ms)
✔ phase60: cursor HMAC roundtrip (0.951041ms)
✔ phase60: missing secret is rejected when unsigned not allowed (0.847084ms)
✔ phase60: tampered cursor is rejected (0.99075ms)
✔ phase61: active template cannot be edited (1.213292ms)
✔ phase61: templates CRUD happy path (1.26ms)
✔ phase61: template rejects invalid notificationCategory (0.697125ms)
✔ phase62: same date is idempotent (0.995583ms)
✔ phase62: generate report persists summary (1.248292ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_dry_run_only
✔ phase63: dry_run_only blocks execute (6.638875ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase63: execute mode allows when guard + recent dry run ok (6.974458ms)
✔ phase64: docs exist with headers (1.235708ms)
✔ phase65: job is idempotent for same date (1.092ms)
✔ phase65: job token required (0.605458ms)
✔ phase66: segment uses lineUserIds override (1.854125ms)
✔ phase66: segment needsAttention filters (1.664833ms)
✔ phase66: segment READY only (1.590959ms)
✔ phase66: segment filters by redacStatus + hasMemberNumber (1.749041ms)
✔ phase67: plan appends audit log (2.110541ms)
✔ phase67: plan does not send (2.301917ms)
✔ phase68: execute is blocked by per-user weekly cap (5.376375ms)
✔ phase68: execute is blocked when category is disallowed by servicePhase/preset (4.351084ms)
✔ phase68: execute appends audit and sends (106.241292ms)
✔ phase68: reject when mode is dry_run_only (1.413083ms)
✔ phase68: reject without matching plan (2.473834ms)
✔ phase69: docs exist with headers (0.915375ms)
✔ phase70: ops_readonly includes segment send and retry queue sections (0.734333ms)
✔ phase71: execute rejects when planHash mismatched (3.110542ms)
✔ phase71: plan returns planHash with stable bucket (2.366541ms)
✔ phase72: testSendNotification with deliveryId is idempotent (second call skips push) (2.410916ms)
✔ phase72: retryQueuedSend passes through deliveryId to sendFn (1.805916ms)
✔ phase72: testSendNotification skips sealed deliveryId without pushing (0.210917ms)
✔ phase72: sendNotification skips sealed delivery and does not push duplicate (1.26025ms)
✔ phase72: enqueue retry queue on send failure (109.322041ms)
✔ phase72: no enqueue when send succeeds (4.585541ms)
✔ phase72: testSendNotification sets sentAt/deliveredAt when missing (8.226917ms)
✔ phase73: retry is blocked by per-user weekly cap (3.692958ms)
✔ phase73: retry is blocked when category is disallowed by servicePhase/preset (3.305875ms)
✔ phase73: retry failure keeps pending with lastError (5.408542ms)
✔ phase73: list retry queue returns pending only (3.067ms)
✔ phase73: retry success marks done (5.750208ms)
✔ phase74: docs exist with required headings (1.543125ms)
✔ phase75: get active template returns latest active version (1.419958ms)
✔ phase75: template version increments per key (1.226208ms)
✔ phase76: execute rejects when templateVersion mismatched (3.562917ms)
✔ phase76: plan returns templateVersion from active template (3.872459ms)
✔ phase77: create segment enforces unique key (1.385375ms)
✔ phase77: list active segments returns active only (1.389083ms)
✔ phase78: ops_readonly includes saved segments dropdown (0.718417ms)
✔ phase79: audit log contains run and plan snapshots (106.952792ms)
✔ phase79: docs exist with required headings (1.193125ms)
✔ phase79: execute returns runId (4.980125ms)
✔ phase80: cursor sign/verify roundtrip (0.829167ms)
✔ phase80: list rejects tampered signed cursor (1.128667ms)
✔ phase81: dry-run appends audit log (4.191584ms)
✔ phase81: dry-run has no side effects (5.366334ms)
✔ phase82: confirm token verifies with matching payload (0.984334ms)
✔ phase82: confirm token rejects mismatch (1.513125ms)
✔ phase83: ops_readonly includes dry-run flow (1.418375ms)
✔ phase84: docs exist with required headings (1.144625ms)
✔ phase85: automation_runs repo create/patch/get (1.087292ms)
✔ phase86: batching updates progress cursor (14.995125ms)
✔ phase86: rate limit applied with sleep (0.477167ms)
✔ phase87: no retry on validation error (0.569459ms)
✔ phase87: retry transient errors (1.874209ms)
✔ phase88: partial failure yields DONE_WITH_ERRORS (15.074458ms)
✔ phase89: aborted run records ops state (17.103083ms)
✔ phase89: breaker aborts on 429 storm (17.990708ms)
✔ phase90: run status route returns run (1.159209ms)
✔ phase91: audit logs appended on start/done/abort (13.419708ms)
✔ phase92: docs exist with required headings (0.48775ms)
✔ phaseLLM1: allow list blocks extra fields (0.558584ms)
✔ phaseLLM1: allow list passes and filters (0.711667ms)
✔ phaseLLM1: feature flag disabled by default (0.451083ms)
✔ phaseLLM1: feature flag enabled values (0.095042ms)
✔ phaseLLM1: feature flag rejects other values (0.08075ms)
✔ phaseLLM1: validate OpsExplanation schema (0.829125ms)
✔ phaseLLM1: validate NextActionCandidates schema (0.135041ms)
✔ phaseLLM1: validate FAQAnswer schema (0.187583ms)
✔ phaseLLM1: schema rejects direct URL in FAQ answer (0.135833ms)
✔ phaseLLM2: ops_readonly renders llm explanation section (0.721375ms)
✔ phaseLLM2: explanation fallback when LLM disabled (3.718291ms)
✔ phaseLLM2: accepts valid LLM explanation when enabled (0.869708ms)
✔ phaseLLM2: invalid LLM output falls back (0.373ms)
✔ phaseLLM3: ops_readonly includes next action candidates section (0.777834ms)
✔ phaseLLM3: fallback when LLM disabled (4.914792ms)
✔ phaseLLM3: accepts valid LLM candidates when enabled (0.787666ms)
✔ phaseLLM3: invalid LLM candidates fallback (0.280833ms)
✔ phaseLLM4: block when LLM disabled (3.201459ms)
✔ phaseLLM4: accepts valid LLM answer with allowed citations (0.986583ms)
✔ phaseLLM4: citations required (0 citations => block) (0.322917ms)
✔ phaseLLM4: WARN link is blocked (0.334167ms)
✔ phaseLLM5: runbook and phase plan docs exist (0.829708ms)
✔ phaseLLM6: allow-list blocks out-of-scope secret field (0.574041ms)
✔ phaseLLM6: restricted category is blocked when not allowed (0.193666ms)
✔ phaseLLM6: audit appends traceId for generated and blocked outcomes (4.23675ms)
✔ phaseLLM6: dual gate blocks when db flag is false (2.722166ms)
✔ phaseLLM6: dual gate blocks when env flag is false (0.326042ms)
✔ phaseLLM6: dual gate allows when db+env are true (0.625583ms)
✔ phaseLLM6: faq blocks when KB has no candidate (2.745042ms)
✔ phaseLLM6: faq blocks when citations are zero (3.696709ms)
✔ phaseLLM6: faq blocks direct URL in answer (3.767ms)
✔ phaseLLM6: faq blocks WARN link (0.635084ms)
✔ phaseLLM6: llmEnabled defaults false and can be persisted (2.084125ms)
✔ phaseLLM6: faqArticlesRepo returns active locale-matched top scored rows (4.2655ms)
✔ phaseLLM6: faq output blocks when citations are missing (0.866208ms)
✔ phaseLLM6: faq output blocks direct URL (0.161792ms)
✔ phaseLLM6: next actions block invalid action (0.197584ms)
✔ phaseLLM6: llm config status/plan/set works with confirm token (45.909583ms)
✔ taxonomy: contact_source_required → CONTACT_SOURCE_REQUIRED (0.586083ms)
✔ taxonomy: kb_schema_invalid → KB_SCHEMA_INVALID (0.23ms)
✔ taxonomy: llm_api_error → LLM_API_ERROR (0.154416ms)
✔ taxonomy: llm_timeout → LLM_API_ERROR (0.143209ms)
✔ taxonomy: adapter_missing → LLM_API_ERROR (0.163791ms)
✔ taxonomy: existing entries still correct (0.206959ms)
✔ taxonomy: unknown reason → UNKNOWN (0.51025ms)
✔ taxonomy: llm_disabled with nullOnDisabled=true → null (0.088791ms)
✔ handleCreate: missing x-actor → 400 (1.109375ms)
✔ handleCreate: invalid article body → 422 with errors (0.714625ms)
✔ handleCreate: valid article → 200 with id (2.149209ms)
✔ handleList: returns articles → 200 (1.520792ms)
✔ handleUpdate: valid patch → 200 with id (0.291541ms)
✔ handleDelete: soft deletes article → 200 with id (0.893375ms)
✔ validateKbArticle: all required fields → valid (0.8605ms)
✔ validateKbArticle: missing status → invalid (0.166625ms)
✔ validateKbArticle: invalid status → invalid (0.068ms)
✔ validateKbArticle: missing riskLevel → invalid (0.074292ms)
✔ validateKbArticle: invalid riskLevel → invalid (1.814083ms)
✔ validateKbArticle: missing both version and versionSemver → invalid (0.124458ms)
✔ validateKbArticle: versionSemver only (no version) → valid (0.077708ms)
✔ validateKbArticle: invalid semver string → invalid (0.060625ms)
✔ validateKbArticle: missing validUntil → invalid (0.082583ms)
✔ validateKbArticle: validUntil null → invalid (0.113083ms)
✔ validateKbArticle: allowedIntents undefined → invalid (0.08375ms)
✔ validateKbArticle: allowedIntents null → invalid (0.05175ms)
✔ validateKbArticle: allowedIntents empty array [] → valid (all intents allowed) (0.055708ms)
✔ validateKbArticle: multiple errors returned (0.051042ms)
✔ search strict: article without riskLevel is rejected by validateKbArticle (0.752708ms)
✔ search strict: article without allowedIntents is rejected by validateKbArticle (0.170083ms)
✔ search strict: normalizeRiskLevel(undefined) → invalid (null), not defaulted to low (0.084125ms)
✔ search strict: allowedIntents=[] is valid (all intents allowed) (0.064208ms)
✔ search strict: allowedIntents with entries is valid (0.074875ms)
✔ llmClient: throws when OPENAI_API_KEY is not set (0.971334ms)
✔ llmClient: throws when OPENAI_API_KEY is missing entirely (0.457625ms)
✔ llmClient: throws llm_api_error on HTTP non-200 response (0.40075ms)
✔ llmClient: throws llm_api_error on empty response content (0.200583ms)
✔ llmClient: throws llm_api_error on non-JSON response content (0.187167ms)
✔ llmClient: returns { answer, model } on successful response (2.065292ms)
✔ llmClient: uses OPENAI_MODEL env var when set (0.501ms)
✔ llmClient: defaults to gpt-4o-mini when OPENAI_MODEL not set (0.304208ms)
✔ llmClient: sends Authorization header with Bearer token (0.337292ms)
✔ llmClient: uses json_object response_format (0.918416ms)
✔ llmClient: exports explainOps method (1.752875ms)
✔ llmClient: exports suggestNextActionCandidates method (0.301708ms)
✔ llmClient.explainOps: throws when OPENAI_API_KEY is not set (0.95275ms)
✔ llmClient.suggestNextActionCandidates: throws when OPENAI_API_KEY is not set (0.887583ms)
✔ llmClient: callOpsExplain returns { answer, model } on success (0.870375ms)
✔ llmClient: callNextActionCandidates returns { answer, model } on success (0.135792ms)
✔ getNextActionCandidates: returns ok:true with fallback when LLM disabled (4.371ms)
✔ getNextActionCandidates: fallback includes up to 3 candidates with abstract actions only (0.252834ms)
✔ getNextActionCandidates: response includes nextActionTemplate (next_actions_template_v1) (0.203042ms)
✔ getNextActionCandidates: uses llmAdapter.suggestNextActionCandidates when LLM enabled (0.549791ms)
✔ getNextActionCandidates: falls back when adapter_missing (0.2655ms)
✔ getNextActionCandidates: LLM output with invalid action is filtered out (0.273167ms)
✔ getNextActionCandidates: includes disclaimer in response (0.1635ms)
✔ getNextActionCandidates: throws when lineUserId is missing (0.544ms)
✔ getOpsExplanation: returns ok:true with fallback when LLM disabled (9.818ms)
✔ getOpsExplanation: response includes opsTemplate (ops_template_v1) (0.387ms)
✔ getOpsExplanation: response includes opsHealthTemplate (ops_health_template_v1) (0.332ms)
✔ getOpsExplanation: uses llmAdapter.explainOps when LLM enabled (0.777542ms)
✔ getOpsExplanation: falls back when adapter_missing (no llmAdapter in deps) (0.412667ms)
✔ getOpsExplanation: falls back on LLM timeout (3.024583ms)
✔ getOpsExplanation: includes disclaimer in response (1.770875ms)
✔ getOpsExplanation: throws when lineUserId is missing (0.281291ms)
✔ consent status: returns guideModeLocked=false when lawfulBasis is not consent (3.790625ms)
✔ consent status: guideModeLocked=true when lawfulBasis=consent and unverified (0.166459ms)
✔ consent status: guideModeLocked=false when lawfulBasis=consent and verified (0.09225ms)
✔ consent verify: sets consentVerified=true when lawfulBasis=consent (0.185958ms)
✔ consent verify: returns 409 when lawfulBasis is not consent (0.090375ms)
✔ consent verify: returns 409 when lawfulBasis is unspecified (0.073ms)
✔ consent verify: audit log is written on success (0.128125ms)
✔ consent verify: audit log is written on failure (wrong lawfulBasis) (0.083584ms)
✔ consent revoke: sets consentVerified=false regardless of lawfulBasis (0.135ms)
✔ consent revoke: guideModeLocked=false when lawfulBasis is not consent (0.832208ms)
✔ consent revoke: audit log is written (0.115625ms)
✔ consent status: returns 400 when x-actor header is missing (0.069709ms)
✔ consent verify: returns 400 when x-actor header is missing (0.059875ms)
✔ ops explain: consent_missing blocks LLM when lawfulBasis=consent and unverified (3.976958ms)
✔ ops explain: LLM available after consent verified (lawfulBasis=consent, consentVerified=true) (0.589042ms)
✔ ops explain: LLM available with legitimate_interest (no consent needed) (0.308333ms)
✔ ops explain: llmStatus=disabled overrides consent when LLM flag is off (0.250542ms)
✔ next actions: consent_missing blocks LLM when lawfulBasis=consent and unverified (0.594667ms)
✔ next actions: LLM available after consent verified (0.342ms)
✔ next actions: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.236792ms)
✔ ops explain: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (1.714667ms)
✔ recordUserLlmConsent: accept returns ok with accepted status (0.849083ms)
✔ recordUserLlmConsent: revoke returns ok with revoked status (0.103541ms)
✔ recordUserLlmConsent: throws when lineUserId missing (0.269458ms)
✔ recordUserLlmConsent: throws when lineUserId is not a string (0.642791ms)
✔ recordUserLlmConsent: audit log written on accept with correct action (0.11175ms)
✔ recordUserLlmConsent: audit log written on revoke with correct action (0.082125ms)
✔ recordUserLlmConsent: uses default LLM_CONSENT_VERSION when consentVersion omitted (0.074ms)
✔ recordUserLlmConsent: accepts custom consentVersion (0.095916ms)
✔ recordUserLlmConsent: default actor is line_user (0.088375ms)
✔ recordUserLlmConsent: audit failure does not throw (best-effort) (0.14925ms)
✔ userConsentsRepo: setUserLlmConsent accept stores accepted status (0.624042ms)
✔ userConsentsRepo: setUserLlmConsent revoke stores revoked status (0.114583ms)
✔ userConsentsRepo: getUserLlmConsent returns null for unknown user (0.102667ms)
✔ userConsentsRepo: getUserLlmConsent returns accepted record (0.101833ms)
✔ userConsentsRepo: getUserLlmConsent normalizes unknown status to pending (0.085125ms)
✔ userConsentsRepo: setUserLlmConsent throws on missing lineUserId (0.28075ms)
✔ userConsentsRepo: setUserLlmConsent uses default version when omitted (0.7685ms)
✔ userConsentsRepo: merge preserves existing fields (0.090334ms)
✔ webhook: "AI同意" command replies with consent confirmation (2.409541ms)
✔ webhook: "LLM同意" command replies with consent confirmation (0.359083ms)
✔ webhook: "AI拒否" command replies with revoke confirmation (0.248625ms)
✔ webhook: "LLM拒否" command replies with revoke confirmation (0.19075ms)
✔ webhook: consent command does not produce membership error reply (0.201667ms)
✔ webhook: unrelated text does not trigger consent handler (1.631166ms)
✔ webhook: consent handler stores consent status in user_consents collection (0.299167ms)
✔ webhook: AI拒否 stores revoked status in user_consents collection (0.181625ms)
✔ security: admin pages avoid unsafe HTML injection primitives (2.166833ms)
✔ security: automation config set requires valid confirmToken and writes audit on mismatch (45.804334ms)
✔ security: system config set requires valid confirmToken and writes audit on mismatch (40.991291ms)
✔ security: system config impactPreview includes cap breakdown fields (35.48675ms)
✔ security: system config plan succeeds when notificationCaps are all null (4.508708ms)
✔ security: system config impactPreview respects deliveryCountLegacyFallback mode (4.469ms)
✔ security: system config impactPreview skips delivery counters during active quietHours (2.385458ms)
✔ security: system config notificationCaps roundtrip and fallback (44.931667ms)
✔ security: cookie-auth state-changing requests require same-origin (CSRF guard) (29.835875ms)
✔ security: delivery backfill execute requires valid confirmToken (45.112958ms)
✔ security: delivery recovery execute requires valid confirmToken and seals delivery (44.518375ms)
✔ security: ops_readonly.html avoids innerHTML for dynamic data (XSS regression) (0.761708ms)
✔ security: /admin/* is protected by ADMIN_OS_TOKEN (cookie login) (26.448417ms)
✔ security: /api/phaseLLM4/faq/answer is protected by admin token (35.783084ms)
✔ security: redac membership id is not stored in plaintext (1.705917ms)
ℹ tests 1053
ℹ suites 0
ℹ pass 1034
ℹ fail 19
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14436.5695

✖ failing tests:

test at tests/phase127/phase127_last_reaction_at.test.js:33:1
✖ phase127: lastReactionAt prefers clickAt over readAt (22.1195ms)
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
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (1.591792ms)
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
✖ phase308: top3 analytics hotspots use explicit bounded limits (13.074916ms)
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
✖ phase310: repo-map check mode passes when generated artifact is current (105.375834ms)
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
✖ phase315: cleanup check script passes when generated artifacts are current (122.514583ms)
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
✖ phase317: notification operational summary uses bounded range query with legacy fallback (4.737417ms)
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
✖ phase319: user operational summary uses range-first events/deliveries with fallback (5.902292ms)
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
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (7.487125ms)
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
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (3.43ms)
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
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.231917ms)
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
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.852875ms)
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
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.495708ms)
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
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (4.759042ms)
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
✖ phase358: notification summary collects notification ids and queries scoped events first (3.552084ms)
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
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.584792ms)
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
✖ phase372: read path budgets include current baseline section for phase372 (3.199542ms)
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

test at tests/phase4/adminOpsSummary.test.js:32:1
✖ admin summaries: users and notifications (5.859541ms)
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
✖ phase5 ops filters: date range (3.557417ms)
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
✖ getUserStateSummary: returns read-only state (7.104416ms)
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
