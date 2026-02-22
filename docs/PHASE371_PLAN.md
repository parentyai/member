# PHASE371_PLAN

## 目的
Phase371 の read-path 収束タスクを add-only で実装し、既存互換を維持する。

## スコープ
- Phase371 対象の route/usecase/repo/ui/scripts
- tests/phase371/*
- docs/SSOT_INDEX.md

## 受入条件
- Phase371 の契約テストが PASS する。
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

✔ auditLogsRepo: append writes createdAt (2.421ms)
✔ auditLogsRepo: append respects provided createdAt (0.407208ms)
✔ recordClickAndRedirect: marks click and returns url (1.04375ms)
✔ recordClickAndRedirect: blocks WARN link (0.449625ms)
✔ killSwitch: default false, set true (0.773875ms)
✔ linkRegistryRepo: setHealth stores WARN state (1.241667ms)
✔ linkRegistryRepo: delete removes link (0.40875ms)
✔ createNotification: stores draft notification (1.06725ms)
✔ createNotification: stores normalized notificationCategory (1.486625ms)
✔ sendNotification: creates deliveries for matching users (3.457417ms)
✔ listNotifications: filters by scenarioKey (1.53275ms)
✔ notificationsRepo: create -> list with filter (1.158541ms)
✔ phase0 smoke (1.120416ms)
✔ testSendNotification: creates delivery after push (5.692667ms)
✔ testSendNotification: blocked when kill switch ON (0.430459ms)
✔ usersRepo: create -> get -> update (0.830792ms)
✔ validateSingleCta: accepts single CTA text (0.559542ms)
✔ validateSingleCta: rejects missing CTA text (0.248875ms)
✔ validateSingleCta: rejects multiple CTAs (0.0785ms)
✔ validateLinkRequired: requires linkRegistryId (0.07925ms)
✔ validateLinkRequired: rejects direct URL (0.069334ms)
✔ validateWarnLinkBlock: blocks WARN state (0.070166ms)
✔ validateKillSwitch: blocks when ON (0.0985ms)
✔ validateNotificationPayload: passes when all checks ok (2.231375ms)
✔ webhook: valid signature creates user (2.205ms)
✔ webhook: invalid signature rejected (0.308583ms)
✔ sendWelcomeMessage: sends once and records delivery (1.654791ms)
✔ webhook: welcome send is invoked for new user (1.10125ms)
✔ admin notifications: scenario only targeting (step ignored) (3.9555ms)
✔ admin notifications: linkRegistryId required (1.187958ms)
✔ admin notifications: events best-effort does not block (1.168041ms)
✔ checklistsRepo: create -> get -> list (1.195167ms)
✔ events integration: open requires notificationId (0.977167ms)
✔ events integration: click requires notificationId (0.163833ms)
✔ events integration: complete requires checklistId + itemId (1.709041ms)
✔ eventsRepo: create event (1.139083ms)
✔ eventsRepo: missing required fields throws (1.007417ms)
[phase1] checklist skipped: missing step
✔ getChecklistForUser: returns checklists for scenario/step (1.084083ms)
✔ getChecklistForUser: missing step returns empty (0.708167ms)
✔ logEventBestEffort: enforces type constraints (0.870625ms)
✔ phase1 smoke: notify -> delivery -> checklist -> events (6.157292ms)
✔ toggleChecklistItem: upserts and sets completedAt (2.25975ms)
✔ toggleChecklistItem: event failure does not block (0.916667ms)
✔ userChecklistsRepo: upsert -> get -> list (1.264458ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase101: ops assist suggestion includes suggestion/evidence/safety (13.651791ms)
✔ phase102: ops assist input shape is stable (1.023208ms)
✔ phase103: guard blocks invalid suggestion (0.552542ms)
✔ phase103: not ready forces STOP (0.512666ms)
✔ phase104: audit written for ok and block (0.530458ms)
✔ phase105: adopt audit appended (0.524584ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase106: llm disabled by default falls back to rules (14.278833ms)
✔ phase107: docs exist with required headings (0.970125ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U2 cacheHit=false inputHash=537233774f4b2f34de6ccc98996ddc0a704dd593447e713540ebb30150aa64e9 model=ops-assist-rules opsAssistInputHash=de2515a1df72528e84478ec4b8578df7577abf68ac5a24aa8d9724739c30cee3 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U3 cacheHit=false inputHash=70545ed0e9df1da70262da904475327f4e394fff62173bafb85085c3a3802d9b model=ops-assist-rules opsAssistInputHash=b0bb3a28bf10ada05df4241e6146d5a9cd995efb995eb50929d8c585f2f9e6b9 refreshReason=cache_miss
✔ phase108: suggest -> adopt -> submit audit flow (12.546209ms)
✔ phase117: resolve automation targets respects config filters (1.361333ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase118: suggestion schema is fixed (4.636667ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase119: audit append on suggestion includes notificationId (3.01425ms)
✔ implementation targets: single fixed entry (0.540583ms)
✔ implementation targets acceptance: fixed single IN target (0.631541ms)
✔ implementation targets acceptance: query does not change result (0.105042ms)
✔ implementation targets api: returns fixed registry (0.54175ms)
✔ ops readonly ui includes implementation targets section (2.200792ms)
✔ phase120: decision log stores source + suggestion snapshot (1.874333ms)
✔ phase121: ops notice send flow writes delivery and audit (12.527583ms)
✔ phase122: ops console view includes suggestion and audit id (1.651625ms)
✔ phase123: killSwitch blocks ops assist suggestion (0.604209ms)
✔ phase124: docs exist with required headings (0.864625ms)
[webhook] requestId=9617caeb-aa57-4a07-b85e-bb2dcf7cde4d accept
[OBS] action=webhook result=ok requestId=9617caeb-aa57-4a07-b85e-bb2dcf7cde4d lineUserId=U1
✔ phase125: SERVICE_MODE=webhook is webhook-only (+ appends webhook events) (36.836416ms)
✔ phase125: logLineWebhookEvents writes minimal schema (type + ref) (0.94825ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
[OBS] action=click result=ok requestId=unknown deliveryId=auto_1 linkRegistryId=l1
✔ phase126: existing POST /track/click still redirects and records clickAt (50.272042ms)
[OBS] action=click_post_compat result=reject requestId=unknown
✔ phase126: POST /track/click can be disabled via TRACK_POST_CLICK_ENABLED=0 (3.730625ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
✔ phase126: GET /t/{token} records clickAt + stats and redirects (34.039708ms)
✔ phase126: tampered token is rejected and does not write clickAt/stats (30.9775ms)
✔ phase126: expired token is rejected and does not write clickAt/stats (3.603333ms)
✔ phase127: docs exist with reaction definitions (0.532667ms)
✖ phase127: lastReactionAt prefers clickAt over readAt (14.283167ms)
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.644041ms)
✔ phase127: lastReactionAt is null when both clickAt/readAt missing (0.963ms)
✔ phase128: stable ordering is deterministic and follows SSOT sort spec (1.118542ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase129: ops console view appends audit_logs with traceId (6.594166ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase130: NO_ACTION submit appends decision_logs + audit_logs (no execution) (1.922625ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase131: ops console includes add-only display fields (LINE-only reaction + execution message) (13.873792ms)
✔ phase132: kill switch blocks STOP_AND_ESCALATE (no send side effect) (4.436792ms)
✔ phase132: ops_readonly.html sets x-actor header to avoid actor=unknown (0.676625ms)
✔ phase132: execute fills traceId from existing decision audit when payload traceId missing (2.315542ms)
✔ phase133: GET /api/admin/trace returns audits/decisions/timeline for traceId (54.200208ms)
✔ phase134: run_trace_smoke.js completes with zero side effects and outputs trace bundle shape (146.108541ms)
✔ phase134: run_trace_smoke.js exits non-zero on failure (42.105125ms)
✔ phase135: runbook and ssot index exist with required headings (0.985458ms)
✔ phase137: notification reaction summary aggregates deliveries deterministically (2.756167ms)
✔ phase137: ctr is 0 when sent is 0 (0.184375ms)
✔ phase138: read model includes add-only reactionSummary + notificationHealth without breaking existing keys (9.480209ms)
✔ phase138: reactionSummary always exists even when no deliveries (0.397959ms)
✔ phase139: notification health evaluation thresholds are fixed (1.391625ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase140: ops console includes notificationHealthSummary + topUnhealthyNotifications (add-only) (3.735375ms)
✔ phase141: suggests mitigation when health is bad (0.504375ms)
✔ phase141: returns null when no unhealthy notifications (0.081084ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase142: trace bundle includes notification_mitigation.decision audit + decision log snapshot (6.497667ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_3 failure_class=PASS nextAction=NO_ACTION
✔ phase145: audit logs cover view/suggest/decision/execute via single traceId (8.575208ms)
✔ phase150: RUNBOOK_OPS exists with required headings (1.031084ms)
✔ phase158: LAUNCH_CHECKLIST exists with required headings (0.745041ms)
✔ phase153: run_ops_smoke.js completes with guarded execute and trace bundle coverage (105.87575ms)
✔ phase160: checkNotificationCap passes includeLegacyFallback=false to delivery counters (2.184625ms)
✔ phase160: checkNotificationCap defaults includeLegacyFallback=true (0.170542ms)
✔ phase160: checkNotificationCap skips delivery counters during active quietHours (0.150458ms)
✔ phase160: checkNotificationCap uses snapshot counter when available (0.160875ms)
✔ phase160: deliveredAt backfill summary + apply (14.8585ms)
✔ phase160: delivery count uses deliveredAt and falls back to legacy sentAt (5.219417ms)
✔ phase160: notification caps normalize accepts extended fields (1.0895ms)
✔ phase160: notification caps block during quiet hours (0.206875ms)
✔ phase160: notification caps block when category is required but missing (0.075625ms)
✔ phase160: notification caps block per user daily before weekly (0.071209ms)
✔ phase160: notification caps normalize defaults to null (1.238083ms)
✔ phase160: notification caps reject invalid values (0.179166ms)
✔ phase160: notification caps block when delivered count reaches cap (0.20025ms)
✔ phase160: notification policy is no-op when servicePhase/preset are unset (0.880166ms)
✔ phase160: notification policy allows phase1 presetA immediate action (0.166709ms)
✔ phase160: notification policy blocks disallowed category (0.070667ms)
✔ phase160: SSOT docs exist for servicePhase and notificationPreset (2.020667ms)
✔ phase160: servicePhase/preset getters return null when unset (2.580958ms)
✔ phase160: servicePhase/preset setters validate and persist (2.92525ms)
✔ phase161: admin pages include x-actor headers (2.312875ms)
✔ phase161: execute is blocked when per-user weekly cap is exceeded (11.696125ms)
✔ phase161: execute failure writes notifications.send.execute audit with ok=false (6.527834ms)
✔ phase161: composer flow draft -> approve -> plan -> execute (no real send) (5.448958ms)
✔ phase161: partial send failure -> rerun executes remaining only (no double-send) (8.469792ms)
✔ phase161: execute is blocked when category is disallowed by servicePhase/preset (4.600917ms)
✔ phase161: docs exist for admin UI OS + data model + runbook (1.381958ms)
✔ redac membership: happy path links and persists hash+last4 (6.349083ms)
✔ redac membership: duplicate (linked to another user) is rejected (1.542958ms)
✔ redac membership: invalid format returns invalid_format (0.260042ms)
✔ redac membership: non-command message is noop (0.255958ms)
✔ redac membership: usage guidance when command prefix has no payload (0.154334ms)
✔ redac membership: usage guidance when help keyword is used (0.174292ms)
✔ redac membership: same user can replace their redac id (releases previous id) (0.339042ms)
✔ ops readonly ui includes Redac status display label (1.20825ms)
✔ admin redac unlink: happy path removes link and clears user fields (3.298875ms)
✔ admin redac unlink: not found returns 404 (1.6455ms)
✔ admin redac unlink: invalid format returns 400 (0.3925ms)
✔ phase164: LINE command "会員ID 確認" replies with status (last4 only) (3.119625ms)
✔ phase164: LINE command prefix without payload replies usage guidance (3.566542ms)
✔ phase164: redac line message templates include next action guidance (0.494292ms)
✔ phase170: deploy workflow supports stg/prod environment split (1.217334ms)
✔ phase170: deploy-webhook workflow supports stg/prod environment split (0.363042ms)
✔ phase170: deploy-track workflow supports stg/prod environment split (0.236334ms)
✔ phase171: parseArgs reads env defaults and supports skip flags (0.603667ms)
✔ phase171: parseArgs requires admin token (0.800625ms)
✔ phase171: buildTraceId is stable format (1.529167ms)
✔ phase171: evaluateExitCode treats skip as failure in strict mode (0.276042ms)
✔ phase171: markdown summary includes scenario status and trace (0.340292ms)
✔ phase171: normalizeNotificationCaps and buildActiveQuietHours are add-only safe (0.779459ms)
✔ phase171: resolveOutFile uses default artifacts directory (1.223ms)
✔ phase173: master ui renders impact preview risk and breakdown labels (1.574292ms)
✔ phase173: master ui includes delivery recovery operation guidance (2.069875ms)
✔ phase174: all redac reply templates include explicit next action phrase (3.768917ms)
✔ phase177: redac status route returns sampled consistency summary (70.010167ms)
✔ phase177: master ui includes redac health section and status endpoint call (0.407458ms)
✔ phase178: deploy workflow grants runtime SA secret accessor for member secrets (0.757083ms)
✔ phase178: deploy-webhook workflow grants runtime SA secret accessor for webhook secrets (0.154708ms)
✔ phase178: deploy-track workflow grants runtime SA secret accessor for track token secret (0.101959ms)
✔ phase179: notification routes include structured route_error logging + trace/request in 500 payload (1.967917ms)
✔ phase179: logRouteError emits sanitized structured line (10.658ms)
✔ phase180: parseArgs accepts route_error options (0.616417ms)
✔ phase180: parseArgs rejects fetch-route-errors without project id (0.258125ms)
✔ phase180: buildRouteErrorLoggingFilter contains route_error prefix and trace id (0.11575ms)
✔ phase180: fetchRouteErrors parses gcloud output lines (0.440458ms)
✔ phase180: markdown summary prints route_error capture status (0.126666ms)
✔ phase181: deploy workflow requires explicit prod confirmation (0.677417ms)
✔ phase181: deploy-webhook workflow requires explicit prod confirmation (0.533458ms)
✔ phase181: deploy-track workflow requires explicit prod confirmation (0.135334ms)
✔ phase182: deploy workflow preflight validates required vars and secrets (0.582667ms)
✔ phase182: deploy-webhook workflow preflight validates required vars and secrets (0.129959ms)
✔ phase182: deploy-track workflow preflight validates required vars and secrets (0.105292ms)
✔ phase183: parseArgs enables fetchRouteErrors when fail-on-route-errors is set (0.59475ms)
✔ phase183: parseArgs rejects fail-on-route-errors without project id (0.636917ms)
✔ phase183: strict gate marks PASS as FAIL when route_error is detected (0.145125ms)
✔ phase183: strict gate keeps original reason for already failed scenario (0.1445ms)
✔ phase183: strict gate is no-op when strict mode is disabled (0.086834ms)
✔ phase184: stg notification e2e workflow is defined with required inputs (1.966875ms)
✔ phase184: stg notification e2e workflow runs proxy and strict route error gate (0.205208ms)
✔ phase184: stg notification e2e workflow uploads artifacts (0.108209ms)
✔ phase185: deploy workflow preflight separates missing from permission issues (0.784458ms)
✔ phase185: deploy-webhook workflow preflight separates missing from permission issues (0.14725ms)
✔ phase185: deploy-track workflow preflight separates missing from permission issues (0.100792ms)
✔ phase186: stg e2e workflow preflight separates missing from permission issues (0.966292ms)
✔ phase186: segment query accepts loose lineUserIds format (1.109416ms)
✔ phase187 t01: read-model keys required by monitor/read_model (7.768125ms)
✔ phase188B: waitRule values produce nextWaitDays (3.835ms)
✔ phase189: targetCountSource derives from plan audit (3.657292ms)
✔ phase190: cap count labels derived from execute audit (5.373459ms)
✔ phase191: SSOT read-model keys close loop to output + UI (4.736167ms)
✔ runPhase2Automation: dryRun does not write reports (3.338416ms)
✔ runPhase2Automation: writes reports when not dryRun (0.790875ms)
[OBS] action=click-write result=ok deliveryId=d1 ctaText=openA linkRegistryId=l1
✔ recordClickAndRedirect: track mode records stats (best-effort) and returns redirect url (0.920291ms)
✔ recordClickAndRedirect: member mode does not record stats unless explicitly enabled (0.184417ms)
✔ phase201: ops/monitor/read_model include status summary panels (0.936542ms)
✔ phase202: composer shows plan target count label (0.567666ms)
✔ phase202: ops segment plan note includes count (0.288083ms)
✔ phase203: ops has list/detail sections (1.942833ms)
✔ phase203: monitor has drilldown detail panel (0.503167ms)
✔ phase203: read-model has drilldown detail panel (0.463959ms)
✔ phase204: weekOverWeek delta is computed from deliveries (6.589875ms)
✔ phase205: plan returns capBlockedCount based on caps (7.610042ms)
✔ phase205: composer shows plan cap blocked count label (0.296042ms)
✔ phase206: dry-run stores run record and passes (3.797875ms)
✔ phase206: failure taxonomy mapping (0.478791ms)
✔ phase206: self-send uses sendNotification without status update (8.848417ms)
✔ phase206: GET /api/admin/user-timeline returns deliveries + trace (28.727417ms)
✔ phase207: /admin/app and /admin/ui-dict are protected by admin token (45.166625ms)
✔ phase207: /admin/app returns shell and /admin/ui-dict returns dictionary when token is present (9.744292ms)
✔ phase207: all ui.* keys used in /admin/app exist in ADMIN_UI_DICTIONARY_JA (7.201834ms)
✔ phase209: master ui includes llm config controls (0.681625ms)
✔ phase209: master ui wires llm config endpoints (0.835167ms)
[OBS] action=click-write result=ok deliveryId=auto_4 ctaText=openB linkRegistryId=auto_1
✔ phase21 t06: clickCount increments for openB in day window (2.893666ms)
✔ phase21 t12: accepts --track-base-url and does not emit trackBaseUrl required (43.693083ms)
✔ phase21 t12: missing track base url exits with trackBaseUrl required (32.093541ms)
✔ phase21 t15: missing track base url exits with code 2 (38.631375ms)
✔ phase21 t16: verify env does not emit VERIFY_ENV_ERROR after npm ci (10.290875ms)
✔ phase21 t17: GAC set exits with code 2 (38.481625ms)
✔ phase21 t17: allow-gac bypasses guard (4.965083ms)
{"trackBaseUrl":"https://example.com","fromUtc":"2026-02-22T00:00:00.000Z","toUtc":"2026-02-23T00:00:00.000Z","linkRegistryId":"l1"}
✔ phase21 t18: invalid_rapt classified as env error (13.034041ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT=1 (6.247084ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT is not enabled (0.231167ms)
✔ testSendNotification: member mode records sent stats when ENV_NAME=stg even if PHASE18_CTA_EXPERIMENT is not enabled (0.17225ms)
✔ testSendNotification: track mode records sent stats without experiment flag (0.309041ms)
✔ ctaStatsRepo: incrementSent writes sentCount field (1.261375ms)
✔ phase210: master ui includes llm faq validation section (0.715667ms)
✔ phase210: master ui wires admin llm faq endpoint (1.935208ms)
✔ phase211: master ui includes llm ops explain / next actions section (0.703125ms)
✔ phase211: master ui wires llm ops endpoints (0.665458ms)
✔ phase212: admin app includes LLM nav and pane controls (1.140167ms)
✔ phase212: admin app wires LLM endpoints from pane actions (1.361834ms)
✔ phase213: admin app includes llm config controls in llm pane (1.731125ms)
✔ phase213: admin app wires llm config endpoints (1.824042ms)
✔ phase214: admin app includes llm audit drilldown button (0.936708ms)
✔ phase214: admin app wires llm trace to audit pane search (0.577875ms)
✔ phase215: admin app uses admin llm ops endpoints with legacy fallback (2.268375ms)
✔ phase215: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (63.6965ms)
✔ phase216: master llm ops panel uses admin endpoints first (0.721291ms)
✔ phase216: master llm ops panel keeps legacy fallback endpoints (1.023667ms)
✔ phase217: ops_readonly uses admin llm ops endpoints first (0.855417ms)
✔ phase217: ops_readonly keeps legacy llm ops fallback endpoints (0.314667ms)
✔ phase218: admin_app uses admin LLM endpoints first with legacy fallback (2.092667ms)
✔ phase218: master uses admin LLM endpoints first with legacy fallback (0.346666ms)
✔ phase218: ops_readonly uses admin LLM endpoints first with legacy fallback (0.430208ms)
✔ phase219: phaseLLM4 compat route appends deprecated metadata on blocked response (0.902458ms)
✔ phase219: phaseLLM4 compat route returns 400 on required/invalid parse errors (0.271417ms)
✔ phase22 t01: CTR calculation and delta (2.263541ms)
✔ phase22 t01: zero division yields 0 CTR (0.103083ms)
✔ phase22 t01: JSON structure keys (0.115625ms)
✔ phase22 t02: verify then kpi order with args (1.951292ms)
✔ phase22 t02: exit code mapping to env error (0.266083ms)
✔ phase22 t02: exit code mapping to runtime error (0.149875ms)
✔ phase22 t02: run executes verify then kpi (0.845834ms)
✔ phase22 t03: PASS when totals meet thresholds (0.592958ms)
✔ phase22 t03: FAIL when totalSent insufficient (0.125583ms)
✔ phase22 t03: FAIL when deltaCTR below threshold (0.074167ms)
✔ phase22 t03: PASS when minDeltaCtr is 0 even if deltaCTR negative (0.068709ms)
✔ phase22 t03: FAIL when required key missing (0.078417ms)
✔ phase22 t03: FAIL on JSON parse error (0.07825ms)
✔ phase22 t03: stdin read error yields env error code (0.342125ms)
✔ phase22 t04: PASS when gate exitCode=0 (1.517042ms)
✔ phase22 t04: FAIL when gate exitCode=1 (0.122584ms)
✔ phase22 t04: VERIFY_ENV_ERROR when gate exitCode=2 (0.090625ms)
✔ phase22 t04: snapshot throws => FAIL (0.087583ms)
✔ phase22 t04: runner throws => FAIL (0.07725ms)
✔ phase22 t05: upsertSnapshot sets createdAt serverTimestamp (0.742125ms)
✔ phase22 t05: upsertSnapshot uses merge true (0.195167ms)
✔ phase22 t05: no --write keeps exitCode and does not call repo (0.94925ms)
✔ phase22 t05: --write 1 calls repo and keeps exitCode on error (0.238209ms)
✔ phase22 t06: defaults return JSON (0.609375ms)
✔ phase22 t06: repo error yields LIST_ENV_ERROR exitCode=2 (0.159667ms)
✔ phase22 t06: limit and order applied (3.497666ms)
✔ phase22 t06: cta filters applied (0.395833ms)
✔ phase22 t07: PASS returns exitCode 0 and no record on dry-run (0.814583ms)
✔ phase22 t07: write=1 calls record after pass (0.134625ms)
✔ phase22 t07: FAIL bubbles exitCode 1 (0.717208ms)
✔ phase22 t07: VERIFY_ENV_ERROR bubbles exitCode 2 (0.325833ms)
✔ phase22 t07: runner exception returns exitCode 1 (0.490625ms)
✔ phase22 t08: workflow files exist and include runner (1.305625ms)
(node:96435) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase22/phase22_t10a_workflow_artifact_always.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase22 t10a: dryrun workflow uploads artifacts always (0.637792ms)
✔ phase22 t10a: write workflow uploads artifacts always (0.114209ms)
✔ phase22 t11: FAIL output includes reasonCode (1.969833ms)
✔ phase22 t12: INVALID_ARGS when required args missing (2.015083ms)
✔ phase22 t12: SUBPROCESS_EXIT_NONZERO when kpi+gate present (0.691ms)
✔ phase22 t12: RUNTIME_ERROR when runAndGate throws (0.151708ms)
✔ phase22 t13: dryrun workflow uploads artifacts and writes summary (0.555625ms)
✔ phase22 t13: write workflow uploads artifacts and writes summary (0.114833ms)
✔ phase22 t14: dryrun workflow contains failure_class rules (0.459083ms)
✔ phase22 t14: write workflow contains failure_class rules (0.077292ms)
✔ phase22 t16: invalid_rapt => ENV classification (1.416541ms)
✔ phase22 t16: firebase-admin missing => ENV classification (0.156625ms)
✔ phase22 t16: generic stderr => IMPL classification (0.113792ms)
✔ phase22 t16: empty stderr => UNKNOWN classification (0.136917ms)
✔ phase22 t18: stderr is captured on exitCode!=0 (2.297625ms)
✔ phase22 t18: empty stderr yields zero bytes and capture=empty (0.199834ms)
✔ phase22 t18: spawn error yields SPAWN_ERROR signature (0.120333ms)
✔ phase22 t20: dryrun workflow provides FIRESTORE_PROJECT_ID (0.489541ms)
✔ phase22 t20: write workflow provides FIRESTORE_PROJECT_ID (0.075709ms)
✔ phase22 t22: ok=true payload includes required keys (2.272291ms)
✔ phase22 t22: stderr present yields head and bytes (0.101792ms)
✔ phase22 t22: stderr empty yields (empty) head and 0 bytes (0.070084ms)
✔ phase220: /api/admin/llm/faq/answer is protected by admin token (fail-closed) (64.1225ms)
✔ phase221: /api/admin/llm/config/* require admin token (fail-closed) (71.648917ms)
✔ phase222: /api/admin/llm/config/* require x-actor when admin token is provided (47.983291ms)
✔ phase223: /api/admin/llm/faq/answer does not require x-actor (admin token provided) (52.466459ms)
✔ phase224: admin/master LLM FAQ request uses buildHeaders (x-actor included) (1.49825ms)
✔ phase224: admin/app LLM FAQ request uses buildHeaders (x-actor included) (0.570917ms)
✔ phase225: admin llm faq audit actor uses x-actor header when provided (57.159833ms)
✔ phase226: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (fail-closed) (74.767458ms)
✔ phase227 t01: /api/admin/llm/ops-explain passes x-actor to usecase params (23.527667ms)
✔ phase227 t02: /api/admin/llm/next-actions passes x-actor to usecase params (31.970667ms)
✔ phase227 t03: ops-explain audit actor follows params.actor (no llm) (5.3295ms)
✔ phase227 t04: next-actions audit actor follows params.actor (no llm) (3.231166ms)
✔ phase228: /api/phaseLLM2/ops-explain and /api/phaseLLM3/ops-next-actions require admin token (fail-closed) (47.832459ms)
✔ phase229: faq blocks when high-risk article has no contact source (7.376625ms)
✔ phase229: faq blocks when high-risk citation omits contact source (0.950666ms)
✔ phase229: faq passes when high-risk citation includes contact source (0.341084ms)
✔ phase229: faqArticlesRepo excludes expired validUntil and FAQ-disallowed intents (6.540875ms)
(node:96458) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t01_workflow_oidc_auth.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t01: dryrun workflow includes OIDC auth and setup-gcloud (0.470167ms)
✔ phase23 t01: write workflow includes OIDC auth and setup-gcloud (0.070792ms)
(node:96459) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t02_workflow_summary_keys.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t02: dryrun workflow summary includes required keys (0.476042ms)
✔ phase23 t02: write workflow summary includes required keys (0.096375ms)
(node:96460) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t03_workflow_human_decision_hint.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t03: dryrun workflow includes humanDecisionHint rules (1.0695ms)
✔ phase23 t03: write workflow includes humanDecisionHint rules (0.099959ms)
(node:96461) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t05_workflow_service_mode_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t05: dryrun workflow sets SERVICE_MODE=member (0.485792ms)
✔ phase23 t05: write workflow sets SERVICE_MODE=member (0.070333ms)
(node:96462) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t06_workflow_verify_rest_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t06: dryrun workflow sets PHASE21_VERIFY_REST=1 (1.468833ms)
✔ phase23 t06: write workflow sets PHASE21_VERIFY_REST=1 (0.128708ms)
(node:96463) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_minimal_inputs.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: decision table uses minimal routing inputs (1.495291ms)
✔ phase23 t08: required observation keys match decision inputs (0.58325ms)
(node:96464) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_observation_keys_match_workflow.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: observation keys match workflow summary keys (1.278416ms)
(node:96465) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_decision_table_complete.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close decision table exists and has required columns (1.0955ms)
✔ phase23 t09: closeDecision values are CLOSE or NO_CLOSE (0.29025ms)
(node:96466) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_log_matches_runbook.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close declaration includes phaseResult and closeDecision (0.456917ms)
✔ phase230: faq blocks when top score is below minimum confidence (5.512667ms)
✔ phase230: faq blocks when top1/top2 ratio is below threshold (0.385375ms)
✔ phase230: faq allows confident candidates to proceed (0.676542ms)
✔ phase230: faq repo ranking prefers keyword > synonym > tag matches (4.366833ms)
✔ phase231: faq includes disclaimer version in response and audit events (7.626208ms)
✔ phase231: faq blocked response still includes disclaimer and rendered audit (0.979417ms)
✔ phase231: ops explanation and next actions include disclaimer version and rendered audit (4.567417ms)
✔ phase232: /admin/app includes FAQ block UX panel elements (0.840958ms)
✔ phase232: /admin/master includes FAQ block UX panel elements (0.238458ms)
✔ phase232: admin app dictionary has block UX keys (0.816666ms)
✔ phase232: faq blocked payload includes category/actions/suggestions for kb_no_match (4.506ms)
✔ phase232: faq blocked payload provides fallback actions and max-3 suggested FAQs (1.869042ms)
✔ phase233: next action candidates are abstract-only and sanitized to contract keys (3.407834ms)
✔ phase233: ops explanation includes fixed template sections (2.122667ms)
✔ phase234: FAQ blocks with consent_missing when lawfulBasis=consent and consentVerified=false (3.119334ms)
✔ phase234: llm config plan/set supports llmPolicy snapshot and hash verification (37.892209ms)
✔ phase234: ops/next-actions audit payload includes llmPolicy snapshot fields (2.765083ms)
✔ phase235: checklist_guidance mode is allowed and returns answer when guard passes (3.812583ms)
✔ phase235: guide-only mode blocks free-chat mode (3.11225ms)
✔ phase235: personalization beyond allow-list is blocked (3.024583ms)
✔ phase24 t02: appendDecision sets decidedAt and createdAt serverTimestamp (0.897042ms)
✔ phase24 t02: appendDecision does not overwrite previous entries (0.173208ms)
✔ phase24 t02: getLatestDecision returns most recent by decidedAt (0.99575ms)
✔ phase24 t02: invalid decision enum is rejected (0.766292ms)
✔ phase24 t03: memberNumber missing => BLOCK (0.967167ms)
✔ phase24 t03: memberNumber stale => WARN (0.099125ms)
✔ phase24 t03: memberNumber ok => INFO (0.735667ms)
✔ phase24 t03: checklist incomplete => WARN (0.089125ms)
✔ phase24 t04: missing linkRegistryId => BLOCK (0.547833ms)
✔ phase24 t04: invalid ctaText => BLOCK (0.099667ms)
✔ phase24 t04: missing deliveries => WARN (0.1555ms)
✔ phase24 t04: event without delivery => BLOCK (0.071791ms)
✔ phase24 t05: progress without definition => BLOCK (0.498958ms)
✔ phase24 t05: missing required item => BLOCK (0.074125ms)
✔ phase24 t05: completed but incomplete => BLOCK (0.072667ms)
✔ phase24 t05: required satisfied => ok and complete (0.476583ms)
✔ phase24 t06: memberNumber missing => BLOCK (0.615542ms)
✔ phase24 t06: memberNumber invalid format => WARN (0.138292ms)
✔ phase24 t06: duplicate memberNumber => BLOCK (0.114833ms)
✔ phase24 t06: normal => OK (0.334875ms)
✔ phase24 t07: recordOpsNextAction appends decisionLog and upserts opsState (0.6735ms)
✔ phase24 t07: invalid nextAction is rejected (0.259625ms)
✔ phase24 t07: upsert stores updatedAt serverTimestamp (0.691417ms)
✔ phase24 t07: phase23 runbook still contains decision table keys (0.411ms)
✔ phase24 t08: missing opsState => WARN (0.9965ms)
✔ phase24 t08: missing nextAction => WARN (0.162292ms)
✔ phase24 t08: opsState with nextAction => OK (0.12ms)
✔ phase24 t08: summary includes opsState when present (4.352625ms)
✔ phase24 t09: missing opsState => WARN missing_ops_state (0.8905ms)
✔ phase24 t09: missing decision log => WARN missing_decision_log (0.089875ms)
✔ phase24 t09: mismatched nextAction => WARN mismatched_next_action (0.084167ms)
✔ phase24 t09: matching decision log => OK (0.077375ms)
✔ phase24 t10: all OK => READY (0.902292ms)
✔ phase24 t10: warn missing in opsStateCompleteness => NOT_READY (0.112708ms)
✔ phase241: /admin/ops redirects to /admin/app when authenticated (21.684458ms)
✔ phase241: notification deliveries API supports memberNumber search and vendor fallback (22.89075ms)
✔ phase241: monitor insights returns vendor CTR, AB snapshot, FAQ reference top (22.869917ms)
✔ phase241: admin app removes status summary panels from operational panes (0.856417ms)
✔ phase241: admin app includes monitor user timeline and insights sections (0.346167ms)
✔ phase241: ops safe test flow propagates traceId into monitor pane (1.133625ms)
✔ phase241: all ui.* keys used in /admin/app are present in dictionary (3.792208ms)
✔ phase243: faqArticlesRepo accepts version fallback and excludes invalid schema rows (3.594583ms)
✔ phase244: blocked low_confidence returns kbMeta and policySnapshotVersion (9.12275ms)
✔ phase244: success response includes kbMeta and policySnapshotVersion (0.878417ms)
✔ phase245: FAQ writes llm_disclaimer_rendered with surface=api (8.436ms)
✔ phase245: Ops explain writes llm_disclaimer_rendered with surface=api (0.573417ms)
✔ phase245: Next actions writes llm_disclaimer_rendered with surface=api (0.574166ms)
✔ phase246: blocked payload always includes safe fallbackActions and suggestedFaqs <= 3 (8.412583ms)
✔ phase246: admin app filters direct URL sourceId in block panel (0.483708ms)
✔ phase247: ops template sections order is fixed (2.694833ms)
✔ phase247: next action internal enum stays uppercase (0.897542ms)
✔ phase247: admin app lowercases next actions for display only (0.715ms)
✔ phase248: blocked reason taxonomy mapper is shared (0.437208ms)
✔ phase248: FAQ audit stores regulatoryProfile (8.178792ms)
✔ phase248: Ops/NextAction audits include regulatoryProfile (1.109708ms)
✔ phase249: guide-only modes remain allowed (9.0725ms)
✔ phase249: non guide-only mode is blocked (0.44725ms)
✔ phase249: personalization is restricted to locale/servicePhase (0.734291ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d123 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t02: dryRun does not write and returns readiness (1.153875ms)
✔ phase25 t02: dryRun false writes and returns decisionLogId (6.919417ms)
✔ phase25 t02: readiness NOT_READY still returns ok (0.447208ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t03: ops console returns required keys (5.803125ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t04: console recommendedNextAction flows into submit (9.47225ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=invalid nextAction
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=ENV nextAction=RERUN_MAIN reason=invalid nextAction
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t05: READY writes audit snapshot (8.442333ms)
✔ phase25 t05: READY rejects nextAction not in allowedNextActions (0.362792ms)
✔ phase25 t05: NOT_READY allows only STOP_AND_ESCALATE (0.313417ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=PASS nextAction=NO_ACTION reason=invalid consistency
✔ phase25 t06: opsState missing => WARN (0.537375ms)
✔ phase25 t06: decisionLog missing => WARN (0.101791ms)
✔ phase25 t06: opsState source mismatch => FAIL (0.120084ms)
✔ phase25 t06: missing audit snapshot => FAIL (0.084666ms)
✔ phase25 t06: submit rejects on consistency FAIL (1.153083ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t07: READY recommended is in allowedNextActions (10.815875ms)
✔ phase25 t07: NOT_READY forces STOP_AND_ESCALATE only (0.317834ms)
✔ phase25 t07: consistency FAIL downgrades readiness to NOT_READY (0.254166ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t08: READY yields closeDecision CLOSE (8.639834ms)
✔ phase25 t08: NOT_READY yields closeDecision NO_CLOSE (0.505458ms)
✔ phase25 t08: consistency FAIL yields closeDecision NO_CLOSE (0.882083ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t09: audit includes closeDecision fields (9.277917ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=NO_ACTION reason=closeDecision closed
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=closeDecision: NO_CLOSE
✔ phase25 t10: CLOSE rejects submit (1.567292ms)
✔ phase25 t10: NO_CLOSE rejects non-escalate actions (0.191ms)
✔ phase250: source audit classifies ok/redirect/http_error/timeout and stores screenshot paths (3.379ms)
✔ phase250: confirm extends validUntil by 120 days and sets active (2.073333ms)
✔ phase250: retire returns warning when source is still used by city packs (1.201584ms)
✔ phase250: sendNotification blocks when referenced source is expired (1.689375ms)
✔ phase250: canary run stores run summary, evidence and audit logs with traceId (3.207583ms)
✔ phase250: review inbox requires admin token and internal audit route requires job token (94.016083ms)
✔ phase251 t01: parseArgs reads required env and trims service url (0.55675ms)
✔ phase251 t01: parseArgs supports canary mode and ids (0.610125ms)
✔ phase251 t01: parseArgs rejects invalid mode (0.219208ms)
✔ phase251 t01: parseArgs rejects unknown args (0.078416ms)
✔ phase251 t02: invokeCityPackAudit returns ok on 200/ok:true (1.231041ms)
✔ phase251 t02: invokeCityPackAudit returns fail on non-2xx (0.151166ms)
✔ phase251 t02: invokeCityPackAudit falls back on invalid json response (0.125041ms)
✔ phase251 t03: workflow exists and calls runner script (0.75775ms)
✔ phase252: city pack audit runs API requires token and returns summary/status (37.986417ms)
✔ phase252: admin app includes city pack run history panel and controls (1.19275ms)
✔ phase252: index routes include city-pack-source-audit/runs (0.56375ms)
✔ phase253: city pack run detail API requires token and returns run + evidences (31.467ms)
✔ phase253: admin app includes city pack trace button and run detail fetch (1.374ms)
✔ phase253: index routes include city-pack-source-audit/runs/:runId (0.634666ms)
✔ phase254: admin app includes city pack run detail table and raw drawer (0.863834ms)
✔ phase254: run detail renderer opens evidence and handles missing trace (0.937875ms)
✔ phase254: city pack run detail dictionary keys are defined (1.40175ms)
✔ phase256: city pack run detail API applies evidence limit query (31.340125ms)
✔ phase256: admin app includes run detail limit input and query wiring (1.116125ms)
✔ phase256: dictionary includes city pack run detail limit keys (1.35ms)
✔ phase26: ops console list includes memberFlags (add-only) (5.221125ms)
✔ phase26 t01: list splits READY/NOT_READY and returns required keys (2.051667ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U2 decisionLogId=d2 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase26 t02: postCheck verifies READY decisions (9.378416ms)
✔ phase26 t02: postCheck verifies NOT_READY decisions (0.303667ms)
✔ phase26 t03: docs exist with required headings (0.920292ms)
✔ phase26 t04: list returns pageInfo placeholder (2.105417ms)
✔ phase26 t04: list returns pageInfo even when empty (0.526958ms)
✔ phase260: region declare creates request and user fields (2.735583ms)
✔ phase260: draft job creates source refs and draft city pack (4.292459ms)
✔ phase260: city-pack-requests routes require admin token (27.175333ms)
✔ phase260: internal city-pack draft job requires token (30.559417ms)
✔ phase260: admin app includes city pack request panel (0.797416ms)
✔ phase261: /admin/app uses decision cards and removes summary header blocks (0.966084ms)
✔ phase261: decision state rules are fixed to READY/ATTENTION/STOP (0.885458ms)
✔ phase261: details auto-open for ATTENTION/STOP (0.401709ms)
✔ phase261: vendor facade list/edit/activate/disable keeps compatibility with link_registry (32.777792ms)
✔ phase261: vendor actions require and persist traceId in audit logs (29.561333ms)
✔ phase261: initial pane contract keeps 3-action decision layout (1.055917ms)
✔ phase262: admin_app defines Alt+0..9 pane shortcuts (contract) (1.186458ms)
✔ phase262: admin.css provides focus-visible and reduced-motion rules (contract) (1.005708ms)
✔ phase263: decision card state classes exist in CSS and JS (contract) (0.917416ms)
✔ phase263: decision reasons are built via shared 2-line formatter (contract) (2.511167ms)
✔ phase264: admin.css provides table scroll + sticky header rules (contract) (0.602417ms)
✔ phase264: vendor table supports arrow key navigation + enter select (contract) (1.172ms)
✔ phase266: city pack create normalizes targetingRules and slots (4.50675ms)
✔ phase266: city pack structure update route requires admin token and appends audit (25.771125ms)
✔ phase266: draft job creates default targetingRules and slots (3.661208ms)
✔ phase266: admin app includes city pack structure editor controls (0.777542ms)
✔ phase266: admin app wires city pack structure save endpoint (0.478375ms)
✔ phase267: source ref policy fields are normalized and persisted (0.883ms)
✔ phase267: source policy route requires admin token and writes audit (32.327291ms)
✔ phase267: optional source failures do not block city pack validation (2.439833ms)
✔ phase267: required source failures still block city pack validation (0.556458ms)
✔ phase267: sendNotification uses cityPackFallback when only optional sources are invalid (5.041417ms)
✔ phase267: sendNotification remains fail-closed when required source is invalid (0.562917ms)
✔ phase267: admin app city pack pane has source policy controls (0.902958ms)
✔ phase267: admin app JS posts source policy update endpoint (0.494916ms)
✔ phase268: light/heavy stage updates source confidence and stage fields (3.688417ms)
✔ phase268: review inbox exposes priority/confidence/audit stage and sorts by priority (31.48325ms)
✔ phase268: internal light/heavy city pack audit routes require token and set stage (136.134917ms)
✔ phase268: city pack pane includes priority/confidence/stage columns and run mode options (0.978ms)
✔ phase268: city pack run action posts stage and mode (1.191291ms)
✔ phase269: city pack structure editor includes basePackId input with dict keys (0.8235ms)
✔ phase269: admin app reads basePackId input and posts it on structure save (0.957333ms)
✔ phase269: city pack structure update validates base pack depth and self reference (0.514083ms)
✔ phase269: cityPacksRepo normalizes basePackId and overrides in structure patch (0.717709ms)
✔ phase27 t01: docs exist with required headings (0.786292ms)
✔ phase27 t02: list sorts READY first then cursorCandidate desc then lineUserId (3.17375ms)
✔ phase27 t02: list stabilizes order by lineUserId when cursorCandidate is null (9.408ms)
✔ phase27 t03: list guards required keys/types when console result is missing fields (3.664958ms)
✔ phase27 t04: list keeps pagination compatibility keys (nextPageToken + pageInfo) (5.854542ms)
✔ phase27 t04: list returns pagination keys even when items is empty (1.107959ms)
✔ phase270: City Pack Feedback command stores feedback and event (1.570416ms)
✔ phase270: city-pack-feedback routes require admin token (29.031292ms)
✔ phase270: admin app includes feedback inbox and detail panels (0.955625ms)
✔ phase270: admin app loads feedback and posts actions (1.832708ms)
✔ phase271: city-pack-bulletins routes require admin token (28.842958ms)
✔ phase271: bulletin send uses sendNotification + killSwitch guard (0.781791ms)
✔ phase271: update proposal allowlist enforced and apply updates city pack (36.080042ms)
✔ phase271: admin app includes bulletin inbox and detail panels (0.814042ms)
✔ phase271: admin app includes proposal inbox and detail panels (0.88975ms)
✔ phase271: bulletin/proposal dictionary keys exist (2.195625ms)
✔ phase272: composer pane contains type-driven form, live preview, and saved list blocks (0.855292ms)
✔ phase272: non-STEP defaults are fixed to scenario A / week / limit 50 (1.168667ms)
✔ phase272: GET /api/admin/os/notifications/list returns rows under admin guard (56.537792ms)
✔ phase272: GET /api/admin/os/link-registry/:id returns lookup payload and enforces admin token (52.085458ms)
✔ phase272: composer danger actions require confirm and keep trace-aware calls (0.932125ms)
✔ phase272: composer type-driven dictionary keys exist (3.891084ms)
✔ phase272: createNotification stores notificationType and notificationMeta add-only fields (3.276542ms)
✔ phase273: city-pack-metrics route is admin-guarded and persists daily rows (34.513125ms)
✔ phase273: computeCityPackMetrics aggregates by cityPack/slot/sourceRef with unmapped fallback (15.220416ms)
✔ phase273: admin app has city pack metrics panel and loader wiring (1.561334ms)
✔ phase273: city pack metrics dictionary keys exist (3.533125ms)
✔ phase273: index wires /api/admin/city-pack-metrics into city pack admin route set (0.718542ms)
✔ phase274: city pack route supports export + import dry-run/apply with confirm token (0.528625ms)
✔ phase274: template library route exposes list/create/detail/activate/retire (0.807416ms)
✔ phase274: template library repo uses city_pack_template_library collection (0.328583ms)
✔ phase274: index wires city pack import/export + template library endpoints (0.681416ms)
✔ phase274: app.html contains template library and import/export controls in city pack pane (0.852167ms)
✔ phase274: admin_app wires template library load and import/export actions (1.059208ms)
✔ phase274: template library/import-export dictionary keys exist (2.791958ms)
✔ phase28 t01: docs exist with required headings (1.810292ms)
✔ phase28 t02: pagination returns page1/page2 without overlap and stable order (15.343834ms)
✔ phase28 t03: invalid cursor is rejected (1.145792ms)
✔ phase28 t04: READY priority holds across pages (11.315209ms)
✔ phase28 t05: required keys are present on all pages (12.231209ms)
✔ phase29 t01: nextPageToken can be used as cursor (compatible with pageInfo.nextCursor) (12.883459ms)
✔ phase29 t02: signed cursor is returned and can paginate without overlap (optional security) (19.047334ms)
✔ phase29 t03: signed cursor verifies signature and enforce mode rejects unsigned cursor (17.889167ms)
✔ phase30 t01: cursorInfo defaults to UNSIGNED and enforce=false (2.064958ms)
✔ phase30 t02: cursorInfo reflects signing/enforce even when items empty (2.533083ms)
✔ phase304: composer pane keeps type-driven form + live preview + saved list while hiding trace input UI (1.005666ms)
✔ phase304: css enforces no-fold behavior and hides decision summaries (0.523625ms)
✔ phase304: dashboard KPI endpoint is wired and returns six KPI keys contract (0.739583ms)
✔ phase304: saved filter uses AND conditions and preview reflects CTA2 (0.965083ms)
✔ phase306: city_pack_requests persists add-only experience fields (3.652292ms)
✔ phase306: city_pack_feedback supports slot/message/resolution and status extensions (1.035833ms)
✔ phase306: draft job writes slotContents + request experience fields (3.379625ms)
✔ phase306: kill switch blocks city pack admin/internal write operations (36.161083ms)
✔ phase306: city pack pane shows request stage/warning/aging and feedback slot/resolution (0.802875ms)
✔ phase306: city pack feedback actions include triage/resolve handlers (0.640333ms)
✔ phase306: index routes include city-pack-feedback triage/resolve actions (0.621834ms)
✔ phase306: city pack request/feedback dictionary keys exist (3.413417ms)
✔ phase307: legacy duplicate repos are frozen as canonical forwarders (no direct db write) (3.067125ms)
✔ phase307: canonical user query path does not reintroduce scenario-field filtering (0.521292ms)
✔ phase307: ops review flow normalizes drift fields before writing (0.100792ms)
✔ phase307: missing-index fallback points do not exceed audit baseline (4.114625ms)
✔ phase307: newly added structural files do not introduce fallback catches (0.695833ms)
✔ phase307: normalizeOpsStateRecord keeps canonical keys only (3.04075ms)
✔ phase307: opsStateRepo read prefers canonical ops_states then falls back to legacy ops_state (0.724916ms)
✔ phase307: protection matrix resolves expected auth classes (0.853292ms)
✔ phase307: index.js routes protection via resolvePathProtection reference (0.339375ms)
✔ phase307: internal retention dry-run route requires only internal token (not admin token) (106.078834ms)
✔ phase307: retention dry-run does not delete docs and appends audit log (56.142792ms)
✔ phase307: normalizeScenarioKey absorbs scenario/scenarioKey drift (0.438125ms)
✔ phase307: usersRepo.listUsers accepts legacy scenario input and queries canonical scenarioKey (0.695334ms)
✖ phase308: top3 analytics hotspots use explicit bounded limits (3.920209ms)
✔ phase308: runtime routes/scripts do not import legacy duplicate repos (0.65525ms)
✔ phase308: missing-index fail mode defaults to true on stg/prod env (0.440417ms)
✔ phase308: every repo fallback branch has indexFallbackPolicy hooks (5.285333ms)
✔ phase308: retention dry-run fails closed on undefined collection policy (90.410167ms)
✔ phase308: retention policy covers all collections from audit lifecycle snapshot (1.170167ms)
✔ phase308: struct drift backfill supports dry-run and apply with audit trace (48.391417ms)
✔ phase309: struct drift backfill supports resumeAfterUserId cursor (15.074875ms)
✔ phase309: admin struct drift routes require admin token and support list/execute (40.241375ms)
✔ phase309: retention apply is env/flag guarded and filters by policy (51.571958ms)
✔ phase309: ops snapshot job builds snapshots and dashboard reads snapshot first (63.268458ms)
✔ phase309: review legacy page exposes LEGACY guidance to /admin/app (0.471917ms)
✔ phase309: admin app includes struct drift panel controls and handlers (0.819792ms)
✔ phase309: trace repos use index-oriented where+orderBy queries (0.510542ms)
✔ phase31 t01: ops_readonly includes ops console list/detail/submit sections (0.733625ms)
✔ phase31 t02: ops_readonly defines ops console fetch/submit helpers (0.844125ms)
✔ phase310: repo_map_ui.json exposes required machine-readable sections (0.459583ms)
✖ phase310: repo-map check mode passes when generated artifact is current (102.279833ms)
✔ phase310: /api/admin/repo-map is admin protected and returns payload for authorized actor (79.291166ms)
✔ phase310: app shell includes developer menu and developer-map pane hooks (1.3735ms)
✔ phase310: developer-map pane keeps no-fold structure (0.803458ms)
✔ phase310: developer labels exist in dictionary and audit workflow checks repo-map drift (1.244792ms)
✔ phase311: repo map exposes three layers and canonical developer statuses (2.191125ms)
✔ phase311: feature completion maps deterministically to developer status (2.8155ms)
✔ phase311: /api/admin/repo-map remains admin-guarded and returns layers (90.336167ms)
✔ phase311: redac/user manuals are rendered without details blocks (1.011292ms)
✔ phase311: repo map keeps japanese glossary for internal terms and manual labels (4.253334ms)
✔ phase311: developer matrix render uses scenario-step cells with count and state labels (4.080333ms)
✔ phase311: audit workflow and package scripts enforce repo-map drift checks (0.456417ms)
✔ phase312: snapshot read mode defaults to prefer (0.484417ms)
✔ phase312: snapshot read mode supports require and legacy disabled compatibility (0.106417ms)
✔ phase312: dashboard KPI returns NOT AVAILABLE and no full-scan fallback in require mode (48.966125ms)
✔ phase312: require mode returns NOT AVAILABLE placeholders for summary/state when snapshot is missing (1.506625ms)
✔ phase313: /api/admin/legacy-status is admin guarded and returns legacy route summary (66.139041ms)
✔ phase313: developer map includes LEGACY status controls without removing existing routes (2.091208ms)
✔ phase313: index wires /api/admin/legacy-status route (0.774625ms)
✔ phase314: retention apply rejects unmatched dryRunTraceId and accepts matched trace (43.105208ms)
✔ phase314: retention apply supports maxDeletes/cursor and appends audit payload (51.428333ms)
✖ phase315: cleanup check script passes when generated artifacts are current (100.819125ms)
✔ phase315: unreachable baseline files are frozen with LEGACY marker (2.709625ms)
✔ phase315: legacy aliases carry LEGACY_HEADER and canonical forwarding (0.579375ms)
✔ phase315: INDEX_PLAN covers all fallback source files from audit input (1.688333ms)
✔ phase315: retention addendum and lifecycle cover all retention policy collections (0.597ms)
✔ phase315: protection matrix keeps admin/internal protection classes (0.97925ms)
✔ phase315: internal job routes keep token guard and killSwitch dependency map is generated (0.496ms)
✔ phase316: analytics range queries return only bounded rows (1.470458ms)
✔ phase316: dashboard KPI read path uses bounded range queries for events/deliveries (0.530042ms)
✔ phase316: user operational summary sources users from canonical usersRepo listUsers (0.651458ms)
✖ phase317: notification operational summary uses bounded range query with legacy fallback (4.964292ms)
✔ phase317: notification summary ignores events older than notification sendAt in bounded path (7.680708ms)
✔ phase318: analytics users/notifications range queries return only bounded rows (3.050333ms)
✔ phase318: dashboard KPI read path uses bounded range queries for users/notifications with fallback (0.528583ms)
✖ phase319: user operational summary uses range-first events/deliveries with fallback (3.725291ms)
✔ phase319: range-first path ignores out-of-window events when bounded set is non-empty (6.23925ms)
✔ phase32 t01: READY suggestions filtered to allowedNextActions (3.664708ms)
✔ phase32 t02: NOT_READY suggests STOP_AND_ESCALATE only (3.566583ms)
✔ phase32 t03: llm failure yields empty suggestions (3.864875ms)
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (7.206625ms)
✔ phase320: range-first path for user state ignores older events outside user window when bounded set is non-empty (3.623ms)
✔ phase321: monitor insights uses sentAt range query first with bounded fallback (0.654917ms)
✔ phase321: monitor insights excludes out-of-window delivery when bounded set is non-empty (34.714834ms)
✔ phase322: phase2 automation uses range path when weekly events exist (5.872417ms)
✔ phase322: phase2 automation falls back to listAll events when weekly range is empty (3.8645ms)
✔ phase323: phase5 notifications summary route parses limit/eventsLimit bounds (0.760833ms)
✔ phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary (0.515041ms)
✔ phase324: phase5 users summary route parses limit/analyticsLimit bounds (0.591709ms)
✔ phase324: users filtered usecase forwards limit/analyticsLimit to operational summary (0.96975ms)
✔ phase325: phase5 stale member route parses limit bounds (0.567583ms)
✔ phase325: stale member summary respects limit option (1.024917ms)
✔ phase326: phase4 users summary route parses limit/analyticsLimit bounds (0.497125ms)
✔ phase326: user operational summary respects limit option (4.526125ms)
✔ phase327: phase4 notifications route parses limit/eventsLimit bounds (0.80125ms)
✔ phase327: notification operational summary accepts bounded eventsLimit (6.715708ms)
✔ phase328: phase5 state summary route parses analyticsLimit bounds (0.483541ms)
✔ phase328: user state summary accepts analyticsLimit knob (4.23875ms)
✔ phase329: phase4 users summary route parses snapshotMode (0.493125ms)
✔ phase329: phase5 state summary route parses snapshotMode (0.600417ms)
✔ phase329: snapshotMode=require argument returns NOT AVAILABLE semantics when snapshot is missing (1.658583ms)
✔ phase33 t01: execute actions return execution snapshots (16.647542ms)
✔ phase33 t02: duplicate execution is blocked (0.999583ms)
✔ phase33 t02: readiness NOT_READY blocks execution (7.365541ms)
✔ phase330: phase4 notifications summary route parses snapshotMode (0.497792ms)
✔ phase330: notification summary returns snapshot data in require mode (3.329459ms)
✔ phase330: notification summary require mode returns empty when snapshot missing (0.4755ms)
✔ phase330: ops snapshot build includes notification_operational_summary item (3.716291ms)
✔ phase331: phase5 notifications summary route parses snapshotMode (0.786333ms)
✔ phase331: phase5 notifications filtered usecase forwards snapshotMode (1.428334ms)
✔ phase331: phase5 notifications summary returns empty in snapshot require mode when snapshot missing (2.970875ms)
✔ phase332: phase5 users summary route parses snapshotMode (0.549958ms)
✔ phase332: phase5 users filtered usecase forwards snapshotMode (0.522125ms)
✔ phase333: phase5 users summary returns empty in snapshot require mode when snapshot missing (3.28925ms)
✔ phase334: phase4 summary routes include metadata fields and includeMeta option (0.521083ms)
✔ phase334: user operational summary includeMeta returns not_available metadata in require mode (2.834792ms)
✔ phase334: notification operational summary includeMeta returns not_available metadata in require mode (1.6165ms)
✔ phase335: monitor insights route parses snapshotMode and has require no-fallback branch (0.483417ms)
✔ phase335: monitor insights returns 400 on invalid snapshotMode (0.776084ms)
✔ phase336: index wires /api/admin/retention-runs route (0.616459ms)
✔ phase336: retention-runs returns retention actions only and maps payload fields (2.799125ms)
✔ phase337: phase5 summary routes include metadata fields (1.575167ms)
✔ phase337: users summary includeMeta returns items+meta in require mode (1.393792ms)
✔ phase337: notifications summary includeMeta returns items+meta in require mode (0.3875ms)
✔ phase338: phase5 state route returns metadata fields (0.709ms)
✔ phase338: phase5 state require mode returns not_available metadata when snapshot missing (1.243875ms)
✔ phase339: analyticsReadRepo defines user-scoped query readers (0.608833ms)
✔ phase339: phase5 state summary uses scoped queries before listAll fallback (1.557583ms)
✔ phase34 t01: suggestion drift is detected (1.89475ms)
✔ phase34 t02: execution drift is detected (2.657125ms)
✔ phase34 t03: policy drift is detected (1.273042ms)
✔ phase34 t04: no drift when suggestion/ops/execution align (2.897042ms)
✔ phase34 t05: phase32 -> phase33 -> phase34 appends decision drift (8.617292ms)
✔ phase340: snapshot freshness helpers resolve minutes and stale judgement (1.470708ms)
✔ phase340: user summary require mode treats stale snapshot as not_available (2.569541ms)
✔ phase341: internal ops snapshot job forwards targets payload (0.43975ms)
✔ phase341: buildOpsSnapshots supports partial targets with backward-compatible default (2.538375ms)
✔ phase342: maintenance pane includes retention runs read-only panel (1.449667ms)
✔ phase342: admin app loads retention runs from admin API (0.934792ms)
✔ phase342: retention runs ui dictionary keys exist (0.705583ms)
✔ phase343: audit inputs manifest contains required metadata and file hashes (0.826209ms)
✔ phase343: package scripts and audit workflow include audit-inputs checks (0.488666ms)
✔ phase344: load risk report keeps required keys (0.499084ms)
✔ phase344: load risk scripts, budgets doc, and workflow check are wired (0.6445ms)
✔ phase345: audit inputs manifest uses real metadata values (0.49275ms)
✔ phase346: load risk hotspots include endpoint mapping (0.632208ms)
✔ phase347: phase4 summary routes parse fallbackMode and reject invalid values (0.455209ms)
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (3.387833ms)
✔ phase348: phase5 ops/state routes parse fallbackMode and forward it (0.520209ms)
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.955708ms)
✔ phase349: ops snapshot repo and route contracts exist (0.471125ms)
✔ phase349: index wires ops snapshot health admin endpoint (0.630166ms)
✔ phase35: notices repo create/get/list/update (1.353333ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase35 t01: console execution status reflects latest execution log (9.468917ms)
✔ phase35 t01: console execution status defaults to UNKNOWN when missing (0.41575ms)
✔ phase35 t02: list includes executionStatus summary (1.597167ms)
✔ phase35 t02: list defaults executionStatus when missing (0.495125ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase35 t03: ops loop updates executionStatus (4.588542ms)
✔ phase350: read path budgets include current baseline ratchet values (0.466166ms)
✔ phase350: load risk budget parser uses last matching budget values (0.525875ms)
✔ phase351: dashboard kpi route parses fallbackMode and rejects invalid value (0.522833ms)
✔ phase351: dashboard kpi compute path blocks listAll fallback when fallbackMode=block (0.505667ms)
✔ phase352: analytics read repo exposes checklist scoped query by scenario+step (0.636208ms)
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.827ms)
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.848875ms)
✔ phase353: phase4/phase5 routes expose fallback diagnostics fields (0.5025ms)
✔ phase353: summary/state usecases track fallback source diagnostics (0.76ms)
✔ phase354: ops snapshot health route accepts snapshotType filter and forwards to repo (0.625875ms)
✔ phase354: maintenance pane contains snapshot health controls and table (0.797333ms)
✔ phase354: admin app loads snapshot health via admin API (0.900291ms)
✔ phase355: read path budgets include hotspots_count_max in current baseline (0.451167ms)
✔ phase355: load risk script parses and checks hotspots_count_max budget (0.548875ms)
✔ phase356: fallback policy module defines env-driven default and resolver (0.500834ms)
✔ phase356: dashboard/phase4/phase5 routes use fallback policy default on missing query (0.624041ms)
✔ phase357: analytics read repo exposes lineUserIds scoped user_checklists query (0.727ms)
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.855917ms)
✔ phase358: analytics read repo exposes notificationIds scoped events query (0.950625ms)
✖ phase358: notification summary collects notification ids and queries scoped events first (4.226458ms)
✔ phase359: phase2 automation route validates fallbackMode and forwards it (0.551334ms)
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (4.694125ms)
✔ phase35-39: docs exist with required headings (0.914375ms)
✔ phase36: notice send flow pushes and records delivery/audit (0.757666ms)
✔ phase360: monitor insights route accepts fallbackMode and blocks listAll fallback (0.67325ms)
✔ phase360: monitor insights emits read_path fallback audit action when fallback is used or blocked (0.46625ms)
✔ phase361: read-path routes include fallback audit actions (0.594416ms)
✔ phase362: read path budgets include current baseline section for phase362 (0.45525ms)
✔ phase362: load-risk budget parser uses last baseline entries (0.572416ms)
✔ phase363: load risk hotspots exclude listAll function declarations (0.565ms)
✔ phase363: fallback_risk equals unique fallback file/call surfaces (0.512667ms)
✔ phase364: analytics read repo provides scoped checklist/delivery methods (0.489083ms)
✔ phase364: phase4 users summary uses scoped reads and blocks fallback only on query failure (0.581542ms)
✔ phase365: phase4 notification summary uses global events fallback only after scoped/range query failures (0.862375ms)
✔ phase365: index requirements include scoped checklist/delivery query entries (0.557958ms)
✔ phase366: phase5 state summary uses scoped checklist pairs and fallback only on query failures (0.477458ms)
✔ phase367: phase2 automation prefers scoped reads before listAll fallbacks (0.469083ms)
✔ phase367: phase2 automation route keeps fallbackMode allow|block contract (0.637333ms)
✔ phase368: dashboard KPI responses include unified fallback diagnostics keys (0.529459ms)
✔ phase368: monitor insights response includes source/asOf/freshness and fallback diagnostics (0.505125ms)
✔ phase369: read path fallback summary route exposes grouped and recent rows (0.464416ms)
✔ phase369: index routes /api/admin/read-path-fallback-summary (0.677ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase36-39: full ops flow yields timeline + traceability (7.268084ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
✔ phase36: decision timeline appends DECIDE/POSTCHECK/EXECUTE (3.423ms)
✔ phase37: notification summary includes decision trace when linked (3.348917ms)
✔ phase38: getOpsAssistContext returns read-only payload (0.706625ms)
✔ phase39: stale console is rejected and logged (1.538292ms)
✔ phase37: mark read and click append audit logs (0.543167ms)
✔ phase370: maintenance pane contains fallback summary controls and table (0.914917ms)
✔ phase370: admin app loads read-path fallback summary via admin API (0.943416ms)
✔ phase371: product readiness route returns GO/NO_GO with blockers and checks (1.011583ms)
✔ phase371: index routes /api/admin/product-readiness (1.575875ms)
✖ phase372: read path budgets include current baseline section for phase372 (4.313166ms)
✖ phase372: launch checklist includes product-readiness API checks (3.980916ms)
✔ phase38: ops dashboard returns dashboard items (2.064875ms)
✔ phase39: suggestion schema and audit are fixed (1.650958ms)
✖ admin summaries: users and notifications (6.836208ms)
✔ getNotificationReadModel: counts delivered/read/click (2.103292ms)
✔ toggle checklist done persists and reflects in GET (1.793292ms)
✔ toggle checklist done false clears in GET (0.317959ms)
✔ getMemberProfile returns memberNumber (0.782625ms)
✔ setMemberNumber writes trimmed value (0.662833ms)
✔ setMemberNumber clears when empty (0.200125ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase40-44: full flow returns view + automation skips NO_ACTION execution (10.520833ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase40: suggestion has disclaimer and no nextAction field (9.6605ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase41: llm assist suggestion appends timeline entry (3.063459ms)
✔ phase42: ops console view returns read-only payload (0.522708ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
✔ phase43: automation disabled by default (7.829041ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase44: automation guard triggers escalation (7.024334ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=f7b543f51277cbc932562b00fd26e711e71ebba2112fef4e3ffdffd1e0451a77 model=ops-assist-rules opsAssistInputHash=51fcb97feedd69b931804436952625029700aeac1a8ebaaf5a28977f87e3e9d8 refreshReason=cache_miss
✔ phase45: suggestion falls back to allowed action (9.545208ms)
✔ phase45: prompt payload shape is fixed (0.820958ms)
✔ phase46: ops assist cache stores latest entry (1.058541ms)
✔ phase46: ops console view includes assist only when requested (0.617459ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase47: automation timeline links decision log (6.423958ms)
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
✔ phase47: dry-run returns guard without writes (1.024625ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase47: execute requires readiness OK (7.830875ms)
✔ phase48: automation config default disabled (0.966792ms)
✔ phase48: automation config list shape fixed (1.350541ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase49: full ops flow stays consistent (10.064583ms)
✔ memberNumber stale: 14 days threshold (1.14325ms)
✔ ops attention flag: memberNumber missing, checklist incomplete, stale (4.601667ms)
✖ phase5 ops filters: date range (3.732ms)
✔ phase323: notifications summary filter forwards limit/eventsLimit options (0.824625ms)
✔ phase324: users summary filter forwards limit/analyticsLimit options (0.991417ms)
✔ ops filters: no params keeps all items (4.525333ms)
✔ ops filters: needsAttention (1.100833ms)
✔ ops filters: stale (0.476792ms)
✔ ops filters: unreviewed (0.496708ms)
✔ ops filters: reviewAgeDays (0.414208ms)
✔ ops filters: invalid reviewAgeDays returns 400 (0.13975ms)
✔ ops flags: memberNumber stale yes/no (3.073834ms)
✔ ops review: saves lastReviewed fields (1.050083ms)
✔ ops review write: updates user opsReview fields (0.908125ms)
✖ getUserStateSummary: returns read-only state (5.629792ms)
✔ phase50: obs emitted on submit and execute (8.009375ms)
✔ phase50: obs format is key=value and meta_json (1.272958ms)
[OBS] action=ops_assist_suggest result=cache_hit lineUserId=U1 cacheHit=true inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=cache_hit
✔ phase51: cache hit returns cached suggestion without regeneration (9.357042ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=input_changed
✔ phase51: input hash change triggers refresh (9.113666ms)
[OBS] action=ops_batch_run result=dry_run dryRun=true jobKey=refresh_ops_console limit=10
✔ phase52: dry-run does not call writers (0.850958ms)
✔ phase52: invalid jobKey is rejected (0.671875ms)
✔ phase53: suggest template mapping (0.523542ms)
✔ phase53: template repo stores and lists templates (1.076542ms)
✔ phase54: docs exist with required headings (1.313ms)
✔ phase6 member summary: 400 when lineUserId missing (1.642125ms)
✔ phase6 member summary: 404 when user not found (0.521083ms)
✔ phase6 member summary: returns minimal summary (2.129459ms)
✔ phase6 member summary: includes redac status (last4 only) (0.492459ms)
✔ phase60: cursor HMAC roundtrip (0.99425ms)
✔ phase60: missing secret is rejected when unsigned not allowed (1.5365ms)
✔ phase60: tampered cursor is rejected (1.8635ms)
✔ phase61: active template cannot be edited (1.987542ms)
✔ phase61: templates CRUD happy path (1.299292ms)
✔ phase61: template rejects invalid notificationCategory (0.796333ms)
✔ phase62: same date is idempotent (1.405083ms)
✔ phase62: generate report persists summary (1.83ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_dry_run_only
✔ phase63: dry_run_only blocks execute (6.723292ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase63: execute mode allows when guard + recent dry run ok (8.07875ms)
✔ phase64: docs exist with headers (1.661542ms)
✔ phase65: job is idempotent for same date (1.192708ms)
✔ phase65: job token required (0.540792ms)
✔ phase66: segment uses lineUserIds override (1.272334ms)
✔ phase66: segment needsAttention filters (1.862167ms)
✔ phase66: segment READY only (1.308625ms)
✔ phase66: segment filters by redacStatus + hasMemberNumber (1.758125ms)
✔ phase67: plan appends audit log (2.350834ms)
✔ phase67: plan does not send (2.890917ms)
✔ phase68: execute is blocked by per-user weekly cap (5.067458ms)
✔ phase68: execute is blocked when category is disallowed by servicePhase/preset (4.296791ms)
✔ phase68: execute appends audit and sends (105.551667ms)
✔ phase68: reject when mode is dry_run_only (1.410125ms)
✔ phase68: reject without matching plan (3.158125ms)
✔ phase69: docs exist with headers (1.199334ms)
✔ phase70: ops_readonly includes segment send and retry queue sections (0.903291ms)
✔ phase71: execute rejects when planHash mismatched (6.574542ms)
✔ phase71: plan returns planHash with stable bucket (6.083917ms)
✔ phase72: testSendNotification with deliveryId is idempotent (second call skips push) (3.157708ms)
✔ phase72: retryQueuedSend passes through deliveryId to sendFn (1.814709ms)
✔ phase72: testSendNotification skips sealed deliveryId without pushing (0.212875ms)
✔ phase72: sendNotification skips sealed delivery and does not push duplicate (2.312584ms)
✔ phase72: enqueue retry queue on send failure (107.179792ms)
✔ phase72: no enqueue when send succeeds (4.744833ms)
✔ phase72: testSendNotification sets sentAt/deliveredAt when missing (8.302333ms)
✔ phase73: retry is blocked by per-user weekly cap (4.62775ms)
✔ phase73: retry is blocked when category is disallowed by servicePhase/preset (2.917291ms)
✔ phase73: retry failure keeps pending with lastError (4.289459ms)
✔ phase73: list retry queue returns pending only (3.625375ms)
✔ phase73: retry success marks done (4.195834ms)
✔ phase74: docs exist with required headings (0.756292ms)
✔ phase75: get active template returns latest active version (1.276ms)
✔ phase75: template version increments per key (1.024542ms)
✔ phase76: execute rejects when templateVersion mismatched (3.667834ms)
✔ phase76: plan returns templateVersion from active template (3.760708ms)
✔ phase77: create segment enforces unique key (3.386416ms)
✔ phase77: list active segments returns active only (1.693584ms)
✔ phase78: ops_readonly includes saved segments dropdown (0.831042ms)
✔ phase79: audit log contains run and plan snapshots (113.336708ms)
✔ phase79: docs exist with required headings (1.988ms)
✔ phase79: execute returns runId (4.469167ms)
✔ phase80: cursor sign/verify roundtrip (0.877708ms)
✔ phase80: list rejects tampered signed cursor (1.222334ms)
✔ phase81: dry-run appends audit log (4.481375ms)
✔ phase81: dry-run has no side effects (4.937792ms)
✔ phase82: confirm token verifies with matching payload (1.049084ms)
✔ phase82: confirm token rejects mismatch (0.910333ms)
✔ phase83: ops_readonly includes dry-run flow (0.674958ms)
✔ phase84: docs exist with required headings (1.278209ms)
✔ phase85: automation_runs repo create/patch/get (3.683083ms)
✔ phase86: batching updates progress cursor (10.956167ms)
✔ phase86: rate limit applied with sleep (1.131792ms)
✔ phase87: no retry on validation error (0.477958ms)
✔ phase87: retry transient errors (0.569333ms)
✔ phase88: partial failure yields DONE_WITH_ERRORS (20.539791ms)
✔ phase89: aborted run records ops state (11.086333ms)
✔ phase89: breaker aborts on 429 storm (12.498125ms)
✔ phase90: run status route returns run (1.414584ms)
✔ phase91: audit logs appended on start/done/abort (17.510709ms)
✔ phase92: docs exist with required headings (0.477333ms)
✔ phaseLLM1: allow list blocks extra fields (0.572417ms)
✔ phaseLLM1: allow list passes and filters (0.652917ms)
✔ phaseLLM1: feature flag disabled by default (0.949917ms)
✔ phaseLLM1: feature flag enabled values (0.292333ms)
✔ phaseLLM1: feature flag rejects other values (0.206458ms)
✔ phaseLLM1: validate OpsExplanation schema (0.875083ms)
✔ phaseLLM1: validate NextActionCandidates schema (0.154167ms)
✔ phaseLLM1: validate FAQAnswer schema (0.186667ms)
✔ phaseLLM1: schema rejects direct URL in FAQ answer (0.145959ms)
✔ phaseLLM2: ops_readonly renders llm explanation section (2.123041ms)
✔ phaseLLM2: explanation fallback when LLM disabled (4.243292ms)
✔ phaseLLM2: accepts valid LLM explanation when enabled (0.749791ms)
✔ phaseLLM2: invalid LLM output falls back (0.353625ms)
✔ phaseLLM3: ops_readonly includes next action candidates section (0.6795ms)
✔ phaseLLM3: fallback when LLM disabled (3.080542ms)
✔ phaseLLM3: accepts valid LLM candidates when enabled (0.765834ms)
✔ phaseLLM3: invalid LLM candidates fallback (0.30125ms)
✔ phaseLLM4: block when LLM disabled (4.135625ms)
✔ phaseLLM4: accepts valid LLM answer with allowed citations (1.083583ms)
✔ phaseLLM4: citations required (0 citations => block) (0.950166ms)
✔ phaseLLM4: WARN link is blocked (0.744ms)
✔ phaseLLM5: runbook and phase plan docs exist (0.8795ms)
✔ phaseLLM6: allow-list blocks out-of-scope secret field (0.853791ms)
✔ phaseLLM6: restricted category is blocked when not allowed (0.206416ms)
✔ phaseLLM6: audit appends traceId for generated and blocked outcomes (4.853208ms)
✔ phaseLLM6: dual gate blocks when db flag is false (3.028709ms)
✔ phaseLLM6: dual gate blocks when env flag is false (0.339542ms)
✔ phaseLLM6: dual gate allows when db+env are true (0.627667ms)
✔ phaseLLM6: faq blocks when KB has no candidate (2.682083ms)
✔ phaseLLM6: faq blocks when citations are zero (3.595333ms)
✔ phaseLLM6: faq blocks direct URL in answer (3.658542ms)
✔ phaseLLM6: faq blocks WARN link (0.489292ms)
✔ phaseLLM6: llmEnabled defaults false and can be persisted (0.814167ms)
✔ phaseLLM6: faqArticlesRepo returns active locale-matched top scored rows (3.499792ms)
✔ phaseLLM6: faq output blocks when citations are missing (0.654542ms)
✔ phaseLLM6: faq output blocks direct URL (0.137708ms)
✔ phaseLLM6: next actions block invalid action (0.169542ms)
✔ phaseLLM6: llm config status/plan/set works with confirm token (49.321291ms)
✔ taxonomy: contact_source_required → CONTACT_SOURCE_REQUIRED (0.531917ms)
✔ taxonomy: kb_schema_invalid → KB_SCHEMA_INVALID (0.071209ms)
✔ taxonomy: llm_api_error → LLM_API_ERROR (0.056208ms)
✔ taxonomy: llm_timeout → LLM_API_ERROR (0.055166ms)
✔ taxonomy: adapter_missing → LLM_API_ERROR (0.0565ms)
✔ taxonomy: existing entries still correct (0.057542ms)
✔ taxonomy: unknown reason → UNKNOWN (0.065291ms)
✔ taxonomy: llm_disabled with nullOnDisabled=true → null (0.047542ms)
✔ handleCreate: missing x-actor → 400 (0.820625ms)
✔ handleCreate: invalid article body → 422 with errors (0.609667ms)
✔ handleCreate: valid article → 200 with id (1.067458ms)
✔ handleList: returns articles → 200 (1.5325ms)
✔ handleUpdate: valid patch → 200 with id (0.318291ms)
✔ handleDelete: soft deletes article → 200 with id (3.168208ms)
✔ validateKbArticle: all required fields → valid (0.864917ms)
✔ validateKbArticle: missing status → invalid (0.160917ms)
✔ validateKbArticle: invalid status → invalid (0.067917ms)
✔ validateKbArticle: missing riskLevel → invalid (0.07525ms)
✔ validateKbArticle: invalid riskLevel → invalid (0.826084ms)
✔ validateKbArticle: missing both version and versionSemver → invalid (0.254375ms)
✔ validateKbArticle: versionSemver only (no version) → valid (0.158ms)
✔ validateKbArticle: invalid semver string → invalid (0.1455ms)
✔ validateKbArticle: missing validUntil → invalid (0.274125ms)
✔ validateKbArticle: validUntil null → invalid (0.317708ms)
✔ validateKbArticle: allowedIntents undefined → invalid (0.274875ms)
✔ validateKbArticle: allowedIntents null → invalid (0.17175ms)
✔ validateKbArticle: allowedIntents empty array [] → valid (all intents allowed) (0.259791ms)
✔ validateKbArticle: multiple errors returned (0.155208ms)
✔ search strict: article without riskLevel is rejected by validateKbArticle (2.70725ms)
✔ search strict: article without allowedIntents is rejected by validateKbArticle (0.480334ms)
✔ search strict: normalizeRiskLevel(undefined) → invalid (null), not defaulted to low (0.29525ms)
✔ search strict: allowedIntents=[] is valid (all intents allowed) (0.37425ms)
✔ search strict: allowedIntents with entries is valid (0.097875ms)
✔ llmClient: throws when OPENAI_API_KEY is not set (1.115042ms)
✔ llmClient: throws when OPENAI_API_KEY is missing entirely (0.125917ms)
✔ llmClient: throws llm_api_error on HTTP non-200 response (0.16575ms)
✔ llmClient: throws llm_api_error on empty response content (0.136375ms)
✔ llmClient: throws llm_api_error on non-JSON response content (0.133334ms)
✔ llmClient: returns { answer, model } on successful response (2.359ms)
✔ llmClient: uses OPENAI_MODEL env var when set (0.185166ms)
✔ llmClient: defaults to gpt-4o-mini when OPENAI_MODEL not set (0.118292ms)
✔ llmClient: sends Authorization header with Bearer token (0.112166ms)
✔ llmClient: uses json_object response_format (0.177834ms)
✔ llmClient: exports explainOps method (1.122042ms)
✔ llmClient: exports suggestNextActionCandidates method (1.0995ms)
✔ llmClient.explainOps: throws when OPENAI_API_KEY is not set (0.86375ms)
✔ llmClient.suggestNextActionCandidates: throws when OPENAI_API_KEY is not set (0.507584ms)
✔ llmClient: callOpsExplain returns { answer, model } on success (2.198333ms)
✔ llmClient: callNextActionCandidates returns { answer, model } on success (0.415083ms)
✔ getNextActionCandidates: returns ok:true with fallback when LLM disabled (7.201125ms)
✔ getNextActionCandidates: fallback includes up to 3 candidates with abstract actions only (0.31225ms)
✔ getNextActionCandidates: response includes nextActionTemplate (next_actions_template_v1) (0.283958ms)
✔ getNextActionCandidates: uses llmAdapter.suggestNextActionCandidates when LLM enabled (0.593458ms)
✔ getNextActionCandidates: falls back when adapter_missing (0.25325ms)
✔ getNextActionCandidates: LLM output with invalid action is filtered out (0.271542ms)
✔ getNextActionCandidates: includes disclaimer in response (0.162875ms)
✔ getNextActionCandidates: throws when lineUserId is missing (0.271125ms)
✔ getOpsExplanation: returns ok:true with fallback when LLM disabled (5.260625ms)
✔ getOpsExplanation: response includes opsTemplate (ops_template_v1) (0.76525ms)
✔ getOpsExplanation: response includes opsHealthTemplate (ops_health_template_v1) (0.344375ms)
✔ getOpsExplanation: uses llmAdapter.explainOps when LLM enabled (0.654916ms)
✔ getOpsExplanation: falls back when adapter_missing (no llmAdapter in deps) (0.347334ms)
✔ getOpsExplanation: falls back on LLM timeout (8.331ms)
✔ getOpsExplanation: includes disclaimer in response (1.228458ms)
✔ getOpsExplanation: throws when lineUserId is missing (0.300334ms)
✔ consent status: returns guideModeLocked=false when lawfulBasis is not consent (3.588583ms)
✔ consent status: guideModeLocked=true when lawfulBasis=consent and unverified (0.192833ms)
✔ consent status: guideModeLocked=false when lawfulBasis=consent and verified (0.095417ms)
✔ consent verify: sets consentVerified=true when lawfulBasis=consent (0.19975ms)
✔ consent verify: returns 409 when lawfulBasis is not consent (0.101541ms)
✔ consent verify: returns 409 when lawfulBasis is unspecified (0.073375ms)
✔ consent verify: audit log is written on success (0.135167ms)
✔ consent verify: audit log is written on failure (wrong lawfulBasis) (0.085ms)
✔ consent revoke: sets consentVerified=false regardless of lawfulBasis (0.133042ms)
✔ consent revoke: guideModeLocked=false when lawfulBasis is not consent (1.534667ms)
✔ consent revoke: audit log is written (0.431208ms)
✔ consent status: returns 400 when x-actor header is missing (0.345542ms)
✔ consent verify: returns 400 when x-actor header is missing (0.196167ms)
✔ ops explain: consent_missing blocks LLM when lawfulBasis=consent and unverified (5.063ms)
✔ ops explain: LLM available after consent verified (lawfulBasis=consent, consentVerified=true) (0.575916ms)
✔ ops explain: LLM available with legitimate_interest (no consent needed) (0.884541ms)
✔ ops explain: llmStatus=disabled overrides consent when LLM flag is off (1.020541ms)
✔ next actions: consent_missing blocks LLM when lawfulBasis=consent and unverified (1.201291ms)
✔ next actions: LLM available after consent verified (0.418458ms)
✔ next actions: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.257166ms)
✔ ops explain: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.814625ms)
✔ recordUserLlmConsent: accept returns ok with accepted status (2.672459ms)
✔ recordUserLlmConsent: revoke returns ok with revoked status (0.142042ms)
✔ recordUserLlmConsent: throws when lineUserId missing (0.302542ms)
✔ recordUserLlmConsent: throws when lineUserId is not a string (0.561291ms)
✔ recordUserLlmConsent: audit log written on accept with correct action (0.115375ms)
✔ recordUserLlmConsent: audit log written on revoke with correct action (0.090333ms)
✔ recordUserLlmConsent: uses default LLM_CONSENT_VERSION when consentVersion omitted (0.071375ms)
✔ recordUserLlmConsent: accepts custom consentVersion (0.09525ms)
✔ recordUserLlmConsent: default actor is line_user (0.078583ms)
✔ recordUserLlmConsent: audit failure does not throw (best-effort) (0.140292ms)
✔ userConsentsRepo: setUserLlmConsent accept stores accepted status (0.566292ms)
✔ userConsentsRepo: setUserLlmConsent revoke stores revoked status (0.112041ms)
✔ userConsentsRepo: getUserLlmConsent returns null for unknown user (0.102042ms)
✔ userConsentsRepo: getUserLlmConsent returns accepted record (0.106583ms)
✔ userConsentsRepo: getUserLlmConsent normalizes unknown status to pending (0.088458ms)
✔ userConsentsRepo: setUserLlmConsent throws on missing lineUserId (0.281ms)
✔ userConsentsRepo: setUserLlmConsent uses default version when omitted (0.586125ms)
✔ userConsentsRepo: merge preserves existing fields (0.089417ms)
✔ webhook: "AI同意" command replies with consent confirmation (1.563791ms)
✔ webhook: "LLM同意" command replies with consent confirmation (0.225333ms)
✔ webhook: "AI拒否" command replies with revoke confirmation (0.22725ms)
✔ webhook: "LLM拒否" command replies with revoke confirmation (0.190208ms)
✔ webhook: consent command does not produce membership error reply (0.192917ms)
✔ webhook: unrelated text does not trigger consent handler (1.465375ms)
✔ webhook: consent handler stores consent status in user_consents collection (0.345958ms)
✔ webhook: AI拒否 stores revoked status in user_consents collection (0.318166ms)
✔ security: admin pages avoid unsafe HTML injection primitives (1.528458ms)
✔ security: automation config set requires valid confirmToken and writes audit on mismatch (42.158792ms)
✔ security: system config set requires valid confirmToken and writes audit on mismatch (52.645625ms)
✔ security: system config impactPreview includes cap breakdown fields (38.703541ms)
✔ security: system config plan succeeds when notificationCaps are all null (6.576333ms)
✔ security: system config impactPreview respects deliveryCountLegacyFallback mode (5.786833ms)
✔ security: system config impactPreview skips delivery counters during active quietHours (2.415042ms)
✔ security: system config notificationCaps roundtrip and fallback (57.194667ms)
✔ security: cookie-auth state-changing requests require same-origin (CSRF guard) (27.267959ms)
✔ security: delivery backfill execute requires valid confirmToken (38.644542ms)
✔ security: delivery recovery execute requires valid confirmToken and seals delivery (40.243917ms)
✔ security: ops_readonly.html avoids innerHTML for dynamic data (XSS regression) (0.75425ms)
✔ security: /admin/* is protected by ADMIN_OS_TOKEN (cookie login) (24.521916ms)
✔ security: /api/phaseLLM4/faq/answer is protected by admin token (34.329709ms)
✔ security: redac membership id is not stored in plaintext (1.620542ms)
ℹ tests 1053
ℹ suites 0
ℹ pass 1033
ℹ fail 20
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14406.480042

✖ failing tests:

test at tests/phase127/phase127_last_reaction_at.test.js:33:1
✖ phase127: lastReactionAt prefers clickAt over readAt (14.283167ms)
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
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.644041ms)
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
✖ phase308: top3 analytics hotspots use explicit bounded limits (3.920209ms)
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
✖ phase310: repo-map check mode passes when generated artifact is current (102.279833ms)
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
✖ phase315: cleanup check script passes when generated artifacts are current (100.819125ms)
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
✖ phase317: notification operational summary uses bounded range query with legacy fallback (4.964292ms)
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
✖ phase319: user operational summary uses range-first events/deliveries with fallback (3.725291ms)
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
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (7.206625ms)
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
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (3.387833ms)
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
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.955708ms)
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
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.827ms)
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
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.848875ms)
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
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.855917ms)
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
✖ phase358: notification summary collects notification ids and queries scoped events first (4.226458ms)
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
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (4.694125ms)
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
✖ phase372: read path budgets include current baseline section for phase372 (4.313166ms)
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
✖ phase372: launch checklist includes product-readiness API checks (3.980916ms)
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
✖ admin summaries: users and notifications (6.836208ms)
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
✖ phase5 ops filters: date range (3.732ms)
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
✖ getUserStateSummary: returns read-only state (5.629792ms)
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
