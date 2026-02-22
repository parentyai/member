# PHASE366_PLAN

## 目的
Phase366 の read-path 収束タスクを add-only で実装し、既存互換を維持する。

## スコープ
- Phase366 対象の route/usecase/repo/ui/scripts
- tests/phase366/*
- docs/SSOT_INDEX.md

## 受入条件
- Phase366 の契約テストが PASS する。
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

✔ auditLogsRepo: append writes createdAt (1.044792ms)
✔ auditLogsRepo: append respects provided createdAt (0.195084ms)
✔ recordClickAndRedirect: marks click and returns url (1.073459ms)
✔ recordClickAndRedirect: blocks WARN link (0.459334ms)
✔ killSwitch: default false, set true (0.754292ms)
✔ linkRegistryRepo: setHealth stores WARN state (1.602083ms)
✔ linkRegistryRepo: delete removes link (0.534958ms)
✔ createNotification: stores draft notification (1.181417ms)
✔ createNotification: stores normalized notificationCategory (0.36525ms)
✔ sendNotification: creates deliveries for matching users (4.539875ms)
✔ listNotifications: filters by scenarioKey (0.78875ms)
✔ notificationsRepo: create -> list with filter (1.214875ms)
✔ phase0 smoke (0.431583ms)
✔ testSendNotification: creates delivery after push (5.620291ms)
✔ testSendNotification: blocked when kill switch ON (0.829666ms)
✔ usersRepo: create -> get -> update (1.543ms)
✔ validateSingleCta: accepts single CTA text (0.658542ms)
✔ validateSingleCta: rejects missing CTA text (0.842292ms)
✔ validateSingleCta: rejects multiple CTAs (0.296209ms)
✔ validateLinkRequired: requires linkRegistryId (0.245791ms)
✔ validateLinkRequired: rejects direct URL (0.201875ms)
✔ validateWarnLinkBlock: blocks WARN state (0.254666ms)
✔ validateKillSwitch: blocks when ON (0.456417ms)
✔ validateNotificationPayload: passes when all checks ok (1.803625ms)
✔ webhook: valid signature creates user (2.404125ms)
✔ webhook: invalid signature rejected (0.208916ms)
✔ sendWelcomeMessage: sends once and records delivery (1.057166ms)
✔ webhook: welcome send is invoked for new user (4.107792ms)
✔ admin notifications: scenario only targeting (step ignored) (4.4575ms)
✔ admin notifications: linkRegistryId required (0.940208ms)
✔ admin notifications: events best-effort does not block (0.503708ms)
✔ checklistsRepo: create -> get -> list (1.231333ms)
✔ events integration: open requires notificationId (0.992667ms)
✔ events integration: click requires notificationId (0.18875ms)
✔ events integration: complete requires checklistId + itemId (0.602084ms)
✔ eventsRepo: create event (3.276583ms)
✔ eventsRepo: missing required fields throws (0.344667ms)
[phase1] checklist skipped: missing step
✔ getChecklistForUser: returns checklists for scenario/step (1.089292ms)
✔ getChecklistForUser: missing step returns empty (0.591334ms)
✔ logEventBestEffort: enforces type constraints (0.928583ms)
✔ phase1 smoke: notify -> delivery -> checklist -> events (5.453584ms)
✔ toggleChecklistItem: upserts and sets completedAt (0.953625ms)
✔ toggleChecklistItem: event failure does not block (0.871042ms)
✔ userChecklistsRepo: upsert -> get -> list (1.245583ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase101: ops assist suggestion includes suggestion/evidence/safety (25.512ms)
✔ phase102: ops assist input shape is stable (1.426667ms)
✔ phase103: guard blocks invalid suggestion (0.490709ms)
✔ phase103: not ready forces STOP (0.534542ms)
✔ phase104: audit written for ok and block (1.227667ms)
✔ phase105: adopt audit appended (0.4985ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase106: llm disabled by default falls back to rules (16.835167ms)
✔ phase107: docs exist with required headings (1.082084ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U2 cacheHit=false inputHash=537233774f4b2f34de6ccc98996ddc0a704dd593447e713540ebb30150aa64e9 model=ops-assist-rules opsAssistInputHash=de2515a1df72528e84478ec4b8578df7577abf68ac5a24aa8d9724739c30cee3 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U3 cacheHit=false inputHash=70545ed0e9df1da70262da904475327f4e394fff62173bafb85085c3a3802d9b model=ops-assist-rules opsAssistInputHash=b0bb3a28bf10ada05df4241e6146d5a9cd995efb995eb50929d8c585f2f9e6b9 refreshReason=cache_miss
✔ phase108: suggest -> adopt -> submit audit flow (16.865542ms)
✔ phase117: resolve automation targets respects config filters (0.870334ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase118: suggestion schema is fixed (6.773583ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase119: audit append on suggestion includes notificationId (2.8345ms)
✔ implementation targets: single fixed entry (0.407375ms)
✔ implementation targets acceptance: fixed single IN target (0.540542ms)
✔ implementation targets acceptance: query does not change result (0.109125ms)
✔ implementation targets api: returns fixed registry (0.508125ms)
✔ ops readonly ui includes implementation targets section (0.728ms)
✔ phase120: decision log stores source + suggestion snapshot (1.206792ms)
✔ phase121: ops notice send flow writes delivery and audit (9.207125ms)
✔ phase122: ops console view includes suggestion and audit id (0.550708ms)
✔ phase123: killSwitch blocks ops assist suggestion (0.660333ms)
✔ phase124: docs exist with required headings (0.86575ms)
[webhook] requestId=0efd5841-e032-48bc-8d4a-53fb9db4df8b accept
[OBS] action=webhook result=ok requestId=0efd5841-e032-48bc-8d4a-53fb9db4df8b lineUserId=U1
✔ phase125: SERVICE_MODE=webhook is webhook-only (+ appends webhook events) (36.262166ms)
✔ phase125: logLineWebhookEvents writes minimal schema (type + ref) (0.581666ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
[OBS] action=click result=ok requestId=unknown deliveryId=auto_1 linkRegistryId=l1
✔ phase126: existing POST /track/click still redirects and records clickAt (37.746208ms)
[OBS] action=click_post_compat result=reject requestId=unknown
✔ phase126: POST /track/click can be disabled via TRACK_POST_CLICK_ENABLED=0 (6.304583ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
✔ phase126: GET /t/{token} records clickAt + stats and redirects (39.851458ms)
✔ phase126: tampered token is rejected and does not write clickAt/stats (39.907333ms)
✔ phase126: expired token is rejected and does not write clickAt/stats (6.991792ms)
✔ phase127: docs exist with reaction definitions (0.768667ms)
✖ phase127: lastReactionAt prefers clickAt over readAt (19.868208ms)
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (1.755375ms)
✔ phase127: lastReactionAt is null when both clickAt/readAt missing (0.835083ms)
✔ phase128: stable ordering is deterministic and follows SSOT sort spec (1.01925ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase129: ops console view appends audit_logs with traceId (8.85575ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase130: NO_ACTION submit appends decision_logs + audit_logs (no execution) (6.224959ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase131: ops console includes add-only display fields (LINE-only reaction + execution message) (17.125375ms)
✔ phase132: kill switch blocks STOP_AND_ESCALATE (no send side effect) (2.997292ms)
✔ phase132: ops_readonly.html sets x-actor header to avoid actor=unknown (0.821125ms)
✔ phase132: execute fills traceId from existing decision audit when payload traceId missing (4.596375ms)
✔ phase133: GET /api/admin/trace returns audits/decisions/timeline for traceId (38.285083ms)
✔ phase134: run_trace_smoke.js completes with zero side effects and outputs trace bundle shape (125.583541ms)
✔ phase134: run_trace_smoke.js exits non-zero on failure (37.763542ms)
✔ phase135: runbook and ssot index exist with required headings (1.307458ms)
✔ phase137: notification reaction summary aggregates deliveries deterministically (3.445334ms)
✔ phase137: ctr is 0 when sent is 0 (0.396667ms)
✔ phase138: read model includes add-only reactionSummary + notificationHealth without breaking existing keys (5.935ms)
✔ phase138: reactionSummary always exists even when no deliveries (0.439458ms)
✔ phase139: notification health evaluation thresholds are fixed (0.439ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase140: ops console includes notificationHealthSummary + topUnhealthyNotifications (add-only) (3.368875ms)
✔ phase141: suggests mitigation when health is bad (0.7785ms)
✔ phase141: returns null when no unhealthy notifications (2.304ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase142: trace bundle includes notification_mitigation.decision audit + decision log snapshot (3.4005ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_3 failure_class=PASS nextAction=NO_ACTION
✔ phase145: audit logs cover view/suggest/decision/execute via single traceId (6.087916ms)
✔ phase150: RUNBOOK_OPS exists with required headings (0.748875ms)
✔ phase158: LAUNCH_CHECKLIST exists with required headings (0.870458ms)
✔ phase153: run_ops_smoke.js completes with guarded execute and trace bundle coverage (97.279417ms)
✔ phase160: checkNotificationCap passes includeLegacyFallback=false to delivery counters (2.099291ms)
✔ phase160: checkNotificationCap defaults includeLegacyFallback=true (0.144167ms)
✔ phase160: checkNotificationCap skips delivery counters during active quietHours (0.126458ms)
✔ phase160: checkNotificationCap uses snapshot counter when available (0.496375ms)
✔ phase160: deliveredAt backfill summary + apply (15.8605ms)
✔ phase160: delivery count uses deliveredAt and falls back to legacy sentAt (4.365125ms)
✔ phase160: notification caps normalize accepts extended fields (2.453666ms)
✔ phase160: notification caps block during quiet hours (0.237416ms)
✔ phase160: notification caps block when category is required but missing (0.083459ms)
✔ phase160: notification caps block per user daily before weekly (0.072833ms)
✔ phase160: notification caps normalize defaults to null (1.006666ms)
✔ phase160: notification caps reject invalid values (0.1705ms)
✔ phase160: notification caps block when delivered count reaches cap (0.200708ms)
✔ phase160: notification policy is no-op when servicePhase/preset are unset (1.621917ms)
✔ phase160: notification policy allows phase1 presetA immediate action (0.216083ms)
✔ phase160: notification policy blocks disallowed category (0.073833ms)
✔ phase160: SSOT docs exist for servicePhase and notificationPreset (1.168084ms)
✔ phase160: servicePhase/preset getters return null when unset (4.952917ms)
✔ phase160: servicePhase/preset setters validate and persist (1.304625ms)
✔ phase161: admin pages include x-actor headers (1.439375ms)
✔ phase161: execute is blocked when per-user weekly cap is exceeded (5.696458ms)
✔ phase161: execute failure writes notifications.send.execute audit with ok=false (9.086125ms)
✔ phase161: composer flow draft -> approve -> plan -> execute (no real send) (5.916834ms)
✔ phase161: partial send failure -> rerun executes remaining only (no double-send) (6.86575ms)
✔ phase161: execute is blocked when category is disallowed by servicePhase/preset (5.185041ms)
✔ phase161: docs exist for admin UI OS + data model + runbook (1.533166ms)
✔ redac membership: happy path links and persists hash+last4 (2.020875ms)
✔ redac membership: duplicate (linked to another user) is rejected (1.1255ms)
✔ redac membership: invalid format returns invalid_format (0.273542ms)
✔ redac membership: non-command message is noop (0.2525ms)
✔ redac membership: usage guidance when command prefix has no payload (0.17825ms)
✔ redac membership: usage guidance when help keyword is used (0.191792ms)
✔ redac membership: same user can replace their redac id (releases previous id) (0.352916ms)
✔ ops readonly ui includes Redac status display label (0.727417ms)
✔ admin redac unlink: happy path removes link and clears user fields (2.519125ms)
✔ admin redac unlink: not found returns 404 (0.279917ms)
✔ admin redac unlink: invalid format returns 400 (2.698542ms)
✔ phase164: LINE command "会員ID 確認" replies with status (last4 only) (4.359875ms)
✔ phase164: LINE command prefix without payload replies usage guidance (2.14625ms)
✔ phase164: redac line message templates include next action guidance (1.25ms)
✔ phase170: deploy workflow supports stg/prod environment split (0.782ms)
✔ phase170: deploy-webhook workflow supports stg/prod environment split (0.4155ms)
✔ phase170: deploy-track workflow supports stg/prod environment split (0.251375ms)
✔ phase171: parseArgs reads env defaults and supports skip flags (0.65ms)
✔ phase171: parseArgs requires admin token (0.258791ms)
✔ phase171: buildTraceId is stable format (1.490291ms)
✔ phase171: evaluateExitCode treats skip as failure in strict mode (0.430708ms)
✔ phase171: markdown summary includes scenario status and trace (0.471667ms)
✔ phase171: normalizeNotificationCaps and buildActiveQuietHours are add-only safe (0.514459ms)
✔ phase171: resolveOutFile uses default artifacts directory (0.724833ms)
✔ phase173: master ui renders impact preview risk and breakdown labels (0.725042ms)
✔ phase173: master ui includes delivery recovery operation guidance (0.9725ms)
✔ phase174: all redac reply templates include explicit next action phrase (0.597167ms)
✔ phase177: redac status route returns sampled consistency summary (53.151833ms)
✔ phase177: master ui includes redac health section and status endpoint call (0.440458ms)
✔ phase178: deploy workflow grants runtime SA secret accessor for member secrets (0.627875ms)
✔ phase178: deploy-webhook workflow grants runtime SA secret accessor for webhook secrets (0.131458ms)
✔ phase178: deploy-track workflow grants runtime SA secret accessor for track token secret (0.108459ms)
✔ phase179: notification routes include structured route_error logging + trace/request in 500 payload (2.472291ms)
✔ phase179: logRouteError emits sanitized structured line (12.917375ms)
✔ phase180: parseArgs accepts route_error options (0.613834ms)
✔ phase180: parseArgs rejects fetch-route-errors without project id (0.772791ms)
✔ phase180: buildRouteErrorLoggingFilter contains route_error prefix and trace id (0.357292ms)
✔ phase180: fetchRouteErrors parses gcloud output lines (1.316125ms)
✔ phase180: markdown summary prints route_error capture status (0.163458ms)
✔ phase181: deploy workflow requires explicit prod confirmation (0.618958ms)
✔ phase181: deploy-webhook workflow requires explicit prod confirmation (0.163ms)
✔ phase181: deploy-track workflow requires explicit prod confirmation (0.109125ms)
✔ phase182: deploy workflow preflight validates required vars and secrets (1.835583ms)
✔ phase182: deploy-webhook workflow preflight validates required vars and secrets (0.444ms)
✔ phase182: deploy-track workflow preflight validates required vars and secrets (0.30325ms)
✔ phase183: parseArgs enables fetchRouteErrors when fail-on-route-errors is set (0.59425ms)
✔ phase183: parseArgs rejects fail-on-route-errors without project id (0.2555ms)
✔ phase183: strict gate marks PASS as FAIL when route_error is detected (0.091792ms)
✔ phase183: strict gate keeps original reason for already failed scenario (0.062375ms)
✔ phase183: strict gate is no-op when strict mode is disabled (0.060167ms)
✔ phase184: stg notification e2e workflow is defined with required inputs (0.842042ms)
✔ phase184: stg notification e2e workflow runs proxy and strict route error gate (0.15975ms)
✔ phase184: stg notification e2e workflow uploads artifacts (0.101833ms)
✔ phase185: deploy workflow preflight separates missing from permission issues (0.557333ms)
✔ phase185: deploy-webhook workflow preflight separates missing from permission issues (0.112708ms)
✔ phase185: deploy-track workflow preflight separates missing from permission issues (0.093209ms)
✔ phase186: stg e2e workflow preflight separates missing from permission issues (1.745958ms)
✔ phase186: segment query accepts loose lineUserIds format (1.016833ms)
✔ phase187 t01: read-model keys required by monitor/read_model (4.265083ms)
✔ phase188B: waitRule values produce nextWaitDays (3.469ms)
✔ phase189: targetCountSource derives from plan audit (4.067875ms)
✔ phase190: cap count labels derived from execute audit (2.559916ms)
✔ phase191: SSOT read-model keys close loop to output + UI (4.863083ms)
✔ runPhase2Automation: dryRun does not write reports (8.228458ms)
✔ runPhase2Automation: writes reports when not dryRun (0.751292ms)
[OBS] action=click-write result=ok deliveryId=d1 ctaText=openA linkRegistryId=l1
✔ recordClickAndRedirect: track mode records stats (best-effort) and returns redirect url (0.902625ms)
✔ recordClickAndRedirect: member mode does not record stats unless explicitly enabled (0.185958ms)
✔ phase201: ops/monitor/read_model include status summary panels (0.822125ms)
✔ phase202: composer shows plan target count label (0.523542ms)
✔ phase202: ops segment plan note includes count (0.281625ms)
✔ phase203: ops has list/detail sections (1.887875ms)
✔ phase203: monitor has drilldown detail panel (0.199875ms)
✔ phase203: read-model has drilldown detail panel (0.1135ms)
✔ phase204: weekOverWeek delta is computed from deliveries (3.828208ms)
✔ phase205: plan returns capBlockedCount based on caps (7.109958ms)
✔ phase205: composer shows plan cap blocked count label (0.238541ms)
✔ phase206: dry-run stores run record and passes (3.806333ms)
✔ phase206: failure taxonomy mapping (0.489375ms)
✔ phase206: self-send uses sendNotification without status update (5.988125ms)
✔ phase206: GET /api/admin/user-timeline returns deliveries + trace (39.771916ms)
✔ phase207: /admin/app and /admin/ui-dict are protected by admin token (29.784833ms)
✔ phase207: /admin/app returns shell and /admin/ui-dict returns dictionary when token is present (12.167167ms)
✔ phase207: all ui.* keys used in /admin/app exist in ADMIN_UI_DICTIONARY_JA (7.88325ms)
✔ phase209: master ui includes llm config controls (2.172791ms)
✔ phase209: master ui wires llm config endpoints (1.147167ms)
[OBS] action=click-write result=ok deliveryId=auto_4 ctaText=openB linkRegistryId=auto_1
✔ phase21 t06: clickCount increments for openB in day window (4.846792ms)
✔ phase21 t12: accepts --track-base-url and does not emit trackBaseUrl required (42.528667ms)
✔ phase21 t12: missing track base url exits with trackBaseUrl required (40.774ms)
✔ phase21 t15: missing track base url exits with code 2 (45.096042ms)
✔ phase21 t16: verify env does not emit VERIFY_ENV_ERROR after npm ci (10.304125ms)
✔ phase21 t17: GAC set exits with code 2 (39.100667ms)
✔ phase21 t17: allow-gac bypasses guard (8.116833ms)
{"trackBaseUrl":"https://example.com","fromUtc":"2026-02-22T00:00:00.000Z","toUtc":"2026-02-23T00:00:00.000Z","linkRegistryId":"l1"}
✔ phase21 t18: invalid_rapt classified as env error (12.759791ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT=1 (5.666666ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT is not enabled (0.303792ms)
✔ testSendNotification: member mode records sent stats when ENV_NAME=stg even if PHASE18_CTA_EXPERIMENT is not enabled (0.195875ms)
✔ testSendNotification: track mode records sent stats without experiment flag (0.1655ms)
✔ ctaStatsRepo: incrementSent writes sentCount field (0.393916ms)
✔ phase210: master ui includes llm faq validation section (0.754167ms)
✔ phase210: master ui wires admin llm faq endpoint (1.225792ms)
✔ phase211: master ui includes llm ops explain / next actions section (0.675417ms)
✔ phase211: master ui wires llm ops endpoints (0.741709ms)
✔ phase212: admin app includes LLM nav and pane controls (1.052125ms)
✔ phase212: admin app wires LLM endpoints from pane actions (0.841208ms)
✔ phase213: admin app includes llm config controls in llm pane (1.042042ms)
✔ phase213: admin app wires llm config endpoints (0.721375ms)
✔ phase214: admin app includes llm audit drilldown button (0.952209ms)
✔ phase214: admin app wires llm trace to audit pane search (0.688541ms)
✔ phase215: admin app uses admin llm ops endpoints with legacy fallback (1.302917ms)
✔ phase215: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (64.0015ms)
✔ phase216: master llm ops panel uses admin endpoints first (0.779583ms)
✔ phase216: master llm ops panel keeps legacy fallback endpoints (0.717125ms)
✔ phase217: ops_readonly uses admin llm ops endpoints first (1.026209ms)
✔ phase217: ops_readonly keeps legacy llm ops fallback endpoints (1.059167ms)
✔ phase218: admin_app uses admin LLM endpoints first with legacy fallback (2.554833ms)
✔ phase218: master uses admin LLM endpoints first with legacy fallback (0.839542ms)
✔ phase218: ops_readonly uses admin LLM endpoints first with legacy fallback (0.508375ms)
✔ phase219: phaseLLM4 compat route appends deprecated metadata on blocked response (1.595ms)
✔ phase219: phaseLLM4 compat route returns 400 on required/invalid parse errors (0.286333ms)
✔ phase22 t01: CTR calculation and delta (2.017583ms)
✔ phase22 t01: zero division yields 0 CTR (0.107208ms)
✔ phase22 t01: JSON structure keys (0.119041ms)
✔ phase22 t02: verify then kpi order with args (1.080917ms)
✔ phase22 t02: exit code mapping to env error (0.093958ms)
✔ phase22 t02: exit code mapping to runtime error (0.064625ms)
✔ phase22 t02: run executes verify then kpi (1.034667ms)
✔ phase22 t03: PASS when totals meet thresholds (0.54775ms)
✔ phase22 t03: FAIL when totalSent insufficient (0.157083ms)
✔ phase22 t03: FAIL when deltaCTR below threshold (0.075833ms)
✔ phase22 t03: PASS when minDeltaCtr is 0 even if deltaCTR negative (0.066958ms)
✔ phase22 t03: FAIL when required key missing (0.085875ms)
✔ phase22 t03: FAIL on JSON parse error (0.0815ms)
✔ phase22 t03: stdin read error yields env error code (0.323791ms)
✔ phase22 t04: PASS when gate exitCode=0 (1.475625ms)
✔ phase22 t04: FAIL when gate exitCode=1 (0.125417ms)
✔ phase22 t04: VERIFY_ENV_ERROR when gate exitCode=2 (0.09225ms)
✔ phase22 t04: snapshot throws => FAIL (0.086791ms)
✔ phase22 t04: runner throws => FAIL (0.081875ms)
✔ phase22 t05: upsertSnapshot sets createdAt serverTimestamp (0.785958ms)
✔ phase22 t05: upsertSnapshot uses merge true (0.181208ms)
✔ phase22 t05: no --write keeps exitCode and does not call repo (3.344458ms)
✔ phase22 t05: --write 1 calls repo and keeps exitCode on error (0.805916ms)
✔ phase22 t06: defaults return JSON (0.592667ms)
✔ phase22 t06: repo error yields LIST_ENV_ERROR exitCode=2 (0.17025ms)
✔ phase22 t06: limit and order applied (1.370375ms)
✔ phase22 t06: cta filters applied (0.298625ms)
✔ phase22 t07: PASS returns exitCode 0 and no record on dry-run (0.86825ms)
✔ phase22 t07: write=1 calls record after pass (0.2ms)
✔ phase22 t07: FAIL bubbles exitCode 1 (0.715458ms)
✔ phase22 t07: VERIFY_ENV_ERROR bubbles exitCode 2 (0.111792ms)
✔ phase22 t07: runner exception returns exitCode 1 (0.153625ms)
✔ phase22 t08: workflow files exist and include runner (0.850083ms)
(node:91998) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase22/phase22_t10a_workflow_artifact_always.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase22 t10a: dryrun workflow uploads artifacts always (0.530958ms)
✔ phase22 t10a: write workflow uploads artifacts always (0.108958ms)
✔ phase22 t11: FAIL output includes reasonCode (8.75225ms)
✔ phase22 t12: INVALID_ARGS when required args missing (3.990334ms)
✔ phase22 t12: SUBPROCESS_EXIT_NONZERO when kpi+gate present (1.286334ms)
✔ phase22 t12: RUNTIME_ERROR when runAndGate throws (0.154541ms)
✔ phase22 t13: dryrun workflow uploads artifacts and writes summary (0.567292ms)
✔ phase22 t13: write workflow uploads artifacts and writes summary (0.165458ms)
✔ phase22 t14: dryrun workflow contains failure_class rules (0.476625ms)
✔ phase22 t14: write workflow contains failure_class rules (0.080459ms)
✔ phase22 t16: invalid_rapt => ENV classification (1.354875ms)
✔ phase22 t16: firebase-admin missing => ENV classification (0.145125ms)
✔ phase22 t16: generic stderr => IMPL classification (0.110125ms)
✔ phase22 t16: empty stderr => UNKNOWN classification (0.1325ms)
✔ phase22 t18: stderr is captured on exitCode!=0 (2.803083ms)
✔ phase22 t18: empty stderr yields zero bytes and capture=empty (0.814541ms)
✔ phase22 t18: spawn error yields SPAWN_ERROR signature (0.633583ms)
✔ phase22 t20: dryrun workflow provides FIRESTORE_PROJECT_ID (0.5275ms)
✔ phase22 t20: write workflow provides FIRESTORE_PROJECT_ID (0.080084ms)
✔ phase22 t22: ok=true payload includes required keys (2.853375ms)
✔ phase22 t22: stderr present yields head and bytes (0.146583ms)
✔ phase22 t22: stderr empty yields (empty) head and 0 bytes (0.0735ms)
✔ phase220: /api/admin/llm/faq/answer is protected by admin token (fail-closed) (126.015708ms)
✔ phase221: /api/admin/llm/config/* require admin token (fail-closed) (79.057834ms)
✔ phase222: /api/admin/llm/config/* require x-actor when admin token is provided (65.792667ms)
✔ phase223: /api/admin/llm/faq/answer does not require x-actor (admin token provided) (75.59375ms)
✔ phase224: admin/master LLM FAQ request uses buildHeaders (x-actor included) (2.025666ms)
✔ phase224: admin/app LLM FAQ request uses buildHeaders (x-actor included) (1.1575ms)
✔ phase225: admin llm faq audit actor uses x-actor header when provided (71.778917ms)
✔ phase226: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (fail-closed) (82.807333ms)
✔ phase227 t01: /api/admin/llm/ops-explain passes x-actor to usecase params (16.154583ms)
✔ phase227 t02: /api/admin/llm/next-actions passes x-actor to usecase params (30.536417ms)
✔ phase227 t03: ops-explain audit actor follows params.actor (no llm) (2.70975ms)
✔ phase227 t04: next-actions audit actor follows params.actor (no llm) (5.477292ms)
✔ phase228: /api/phaseLLM2/ops-explain and /api/phaseLLM3/ops-next-actions require admin token (fail-closed) (68.83775ms)
✔ phase229: faq blocks when high-risk article has no contact source (5.162709ms)
✔ phase229: faq blocks when high-risk citation omits contact source (1.050666ms)
✔ phase229: faq passes when high-risk citation includes contact source (0.466125ms)
✔ phase229: faqArticlesRepo excludes expired validUntil and FAQ-disallowed intents (7.93625ms)
(node:92021) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t01_workflow_oidc_auth.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t01: dryrun workflow includes OIDC auth and setup-gcloud (0.453375ms)
✔ phase23 t01: write workflow includes OIDC auth and setup-gcloud (0.258167ms)
(node:92022) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t02_workflow_summary_keys.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t02: dryrun workflow summary includes required keys (0.875458ms)
✔ phase23 t02: write workflow summary includes required keys (0.119416ms)
(node:92023) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t03_workflow_human_decision_hint.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t03: dryrun workflow includes humanDecisionHint rules (0.463083ms)
✔ phase23 t03: write workflow includes humanDecisionHint rules (0.083125ms)
(node:92024) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t05_workflow_service_mode_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t05: dryrun workflow sets SERVICE_MODE=member (0.497542ms)
✔ phase23 t05: write workflow sets SERVICE_MODE=member (0.072167ms)
(node:92025) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t06_workflow_verify_rest_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t06: dryrun workflow sets PHASE21_VERIFY_REST=1 (0.462209ms)
✔ phase23 t06: write workflow sets PHASE21_VERIFY_REST=1 (0.069209ms)
(node:92026) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_minimal_inputs.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: decision table uses minimal routing inputs (0.853375ms)
✔ phase23 t08: required observation keys match decision inputs (0.282125ms)
(node:92027) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_observation_keys_match_workflow.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: observation keys match workflow summary keys (3.190917ms)
(node:92028) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_decision_table_complete.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close decision table exists and has required columns (0.897667ms)
✔ phase23 t09: closeDecision values are CLOSE or NO_CLOSE (0.222584ms)
(node:92029) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_log_matches_runbook.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close declaration includes phaseResult and closeDecision (0.420666ms)
✔ phase230: faq blocks when top score is below minimum confidence (6.186375ms)
✔ phase230: faq blocks when top1/top2 ratio is below threshold (0.418833ms)
✔ phase230: faq allows confident candidates to proceed (0.738542ms)
✔ phase230: faq repo ranking prefers keyword > synonym > tag matches (6.619375ms)
✔ phase231: faq includes disclaimer version in response and audit events (5.891417ms)
✔ phase231: faq blocked response still includes disclaimer and rendered audit (0.558042ms)
✔ phase231: ops explanation and next actions include disclaimer version and rendered audit (4.008459ms)
✔ phase232: /admin/app includes FAQ block UX panel elements (0.833916ms)
✔ phase232: /admin/master includes FAQ block UX panel elements (0.205458ms)
✔ phase232: admin app dictionary has block UX keys (0.986833ms)
✔ phase232: faq blocked payload includes category/actions/suggestions for kb_no_match (4.066417ms)
✔ phase232: faq blocked payload provides fallback actions and max-3 suggested FAQs (0.639041ms)
✔ phase233: next action candidates are abstract-only and sanitized to contract keys (3.66975ms)
✔ phase233: ops explanation includes fixed template sections (2.076792ms)
✔ phase234: FAQ blocks with consent_missing when lawfulBasis=consent and consentVerified=false (3.409667ms)
✔ phase234: llm config plan/set supports llmPolicy snapshot and hash verification (40.884583ms)
✔ phase234: ops/next-actions audit payload includes llmPolicy snapshot fields (3.473417ms)
✔ phase235: checklist_guidance mode is allowed and returns answer when guard passes (5.379292ms)
✔ phase235: guide-only mode blocks free-chat mode (2.883667ms)
✔ phase235: personalization beyond allow-list is blocked (3.438291ms)
✔ phase24 t02: appendDecision sets decidedAt and createdAt serverTimestamp (0.991416ms)
✔ phase24 t02: appendDecision does not overwrite previous entries (0.183042ms)
✔ phase24 t02: getLatestDecision returns most recent by decidedAt (0.991292ms)
✔ phase24 t02: invalid decision enum is rejected (0.894875ms)
✔ phase24 t03: memberNumber missing => BLOCK (0.497458ms)
✔ phase24 t03: memberNumber stale => WARN (0.074458ms)
✔ phase24 t03: memberNumber ok => INFO (0.496916ms)
✔ phase24 t03: checklist incomplete => WARN (0.068416ms)
✔ phase24 t04: missing linkRegistryId => BLOCK (0.47875ms)
✔ phase24 t04: invalid ctaText => BLOCK (0.07325ms)
✔ phase24 t04: missing deliveries => WARN (0.066958ms)
✔ phase24 t04: event without delivery => BLOCK (0.060625ms)
✔ phase24 t05: progress without definition => BLOCK (0.503583ms)
✔ phase24 t05: missing required item => BLOCK (0.074084ms)
✔ phase24 t05: completed but incomplete => BLOCK (0.069875ms)
✔ phase24 t05: required satisfied => ok and complete (0.480042ms)
✔ phase24 t06: memberNumber missing => BLOCK (0.618ms)
✔ phase24 t06: memberNumber invalid format => WARN (0.13525ms)
✔ phase24 t06: duplicate memberNumber => BLOCK (0.115875ms)
✔ phase24 t06: normal => OK (0.332917ms)
✔ phase24 t07: recordOpsNextAction appends decisionLog and upserts opsState (0.691167ms)
✔ phase24 t07: invalid nextAction is rejected (0.257083ms)
✔ phase24 t07: upsert stores updatedAt serverTimestamp (0.705041ms)
✔ phase24 t07: phase23 runbook still contains decision table keys (0.46175ms)
✔ phase24 t08: missing opsState => WARN (0.68025ms)
✔ phase24 t08: missing nextAction => WARN (0.073041ms)
✔ phase24 t08: opsState with nextAction => OK (0.062333ms)
✔ phase24 t08: summary includes opsState when present (3.074875ms)
✔ phase24 t09: missing opsState => WARN missing_ops_state (0.862ms)
✔ phase24 t09: missing decision log => WARN missing_decision_log (0.093292ms)
✔ phase24 t09: mismatched nextAction => WARN mismatched_next_action (0.083916ms)
✔ phase24 t09: matching decision log => OK (0.077041ms)
✔ phase24 t10: all OK => READY (1.016625ms)
✔ phase24 t10: warn missing in opsStateCompleteness => NOT_READY (0.123542ms)
✔ phase241: /admin/ops redirects to /admin/app when authenticated (22.79525ms)
✔ phase241: notification deliveries API supports memberNumber search and vendor fallback (23.711209ms)
✔ phase241: monitor insights returns vendor CTR, AB snapshot, FAQ reference top (25.31225ms)
✔ phase241: admin app removes status summary panels from operational panes (0.812125ms)
✔ phase241: admin app includes monitor user timeline and insights sections (0.339708ms)
✔ phase241: ops safe test flow propagates traceId into monitor pane (0.929833ms)
✔ phase241: all ui.* keys used in /admin/app are present in dictionary (3.902583ms)
✔ phase243: faqArticlesRepo accepts version fallback and excludes invalid schema rows (3.649791ms)
✔ phase244: blocked low_confidence returns kbMeta and policySnapshotVersion (9.528375ms)
✔ phase244: success response includes kbMeta and policySnapshotVersion (0.889417ms)
✔ phase245: FAQ writes llm_disclaimer_rendered with surface=api (9.288125ms)
✔ phase245: Ops explain writes llm_disclaimer_rendered with surface=api (0.613792ms)
✔ phase245: Next actions writes llm_disclaimer_rendered with surface=api (0.585167ms)
✔ phase246: blocked payload always includes safe fallbackActions and suggestedFaqs <= 3 (9.455041ms)
✔ phase246: admin app filters direct URL sourceId in block panel (0.525041ms)
✔ phase247: ops template sections order is fixed (2.289042ms)
✔ phase247: next action internal enum stays uppercase (0.720458ms)
✔ phase247: admin app lowercases next actions for display only (0.555625ms)
✔ phase248: blocked reason taxonomy mapper is shared (0.3995ms)
✔ phase248: FAQ audit stores regulatoryProfile (9.501083ms)
✔ phase248: Ops/NextAction audits include regulatoryProfile (1.117791ms)
✔ phase249: guide-only modes remain allowed (9.994042ms)
✔ phase249: non guide-only mode is blocked (0.3235ms)
✔ phase249: personalization is restricted to locale/servicePhase (0.235458ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d123 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t02: dryRun does not write and returns readiness (1.2255ms)
✔ phase25 t02: dryRun false writes and returns decisionLogId (7.11375ms)
✔ phase25 t02: readiness NOT_READY still returns ok (0.446166ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t03: ops console returns required keys (4.097084ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t04: console recommendedNextAction flows into submit (10.629542ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=invalid nextAction
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=ENV nextAction=RERUN_MAIN reason=invalid nextAction
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t05: READY writes audit snapshot (10.161583ms)
✔ phase25 t05: READY rejects nextAction not in allowedNextActions (0.38175ms)
✔ phase25 t05: NOT_READY allows only STOP_AND_ESCALATE (0.329958ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=PASS nextAction=NO_ACTION reason=invalid consistency
✔ phase25 t06: opsState missing => WARN (1.492875ms)
✔ phase25 t06: decisionLog missing => WARN (0.158167ms)
✔ phase25 t06: opsState source mismatch => FAIL (0.134625ms)
✔ phase25 t06: missing audit snapshot => FAIL (0.090541ms)
✔ phase25 t06: submit rejects on consistency FAIL (1.29575ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t07: READY recommended is in allowedNextActions (8.354917ms)
✔ phase25 t07: NOT_READY forces STOP_AND_ESCALATE only (1.298333ms)
✔ phase25 t07: consistency FAIL downgrades readiness to NOT_READY (0.713625ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t08: READY yields closeDecision CLOSE (11.168875ms)
✔ phase25 t08: NOT_READY yields closeDecision NO_CLOSE (0.320333ms)
✔ phase25 t08: consistency FAIL yields closeDecision NO_CLOSE (0.262292ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t09: audit includes closeDecision fields (8.247416ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=NO_ACTION reason=closeDecision closed
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=closeDecision: NO_CLOSE
✔ phase25 t10: CLOSE rejects submit (1.480833ms)
✔ phase25 t10: NO_CLOSE rejects non-escalate actions (0.18225ms)
✔ phase250: source audit classifies ok/redirect/http_error/timeout and stores screenshot paths (3.37875ms)
✔ phase250: confirm extends validUntil by 120 days and sets active (1.234542ms)
✔ phase250: retire returns warning when source is still used by city packs (0.661667ms)
✔ phase250: sendNotification blocks when referenced source is expired (1.833417ms)
✔ phase250: canary run stores run summary, evidence and audit logs with traceId (5.75825ms)
✔ phase250: review inbox requires admin token and internal audit route requires job token (139.5235ms)
✔ phase251 t01: parseArgs reads required env and trims service url (0.595333ms)
✔ phase251 t01: parseArgs supports canary mode and ids (0.661792ms)
✔ phase251 t01: parseArgs rejects invalid mode (0.239292ms)
✔ phase251 t01: parseArgs rejects unknown args (0.086416ms)
✔ phase251 t02: invokeCityPackAudit returns ok on 200/ok:true (1.35225ms)
✔ phase251 t02: invokeCityPackAudit returns fail on non-2xx (0.172709ms)
✔ phase251 t02: invokeCityPackAudit falls back on invalid json response (0.129542ms)
✔ phase251 t03: workflow exists and calls runner script (0.913041ms)
✔ phase252: city pack audit runs API requires token and returns summary/status (35.435375ms)
✔ phase252: admin app includes city pack run history panel and controls (1.276875ms)
✔ phase252: index routes include city-pack-source-audit/runs (0.624084ms)
✔ phase253: city pack run detail API requires token and returns run + evidences (30.147333ms)
✔ phase253: admin app includes city pack trace button and run detail fetch (1.486583ms)
✔ phase253: index routes include city-pack-source-audit/runs/:runId (0.969792ms)
✔ phase254: admin app includes city pack run detail table and raw drawer (0.849167ms)
✔ phase254: run detail renderer opens evidence and handles missing trace (0.954084ms)
✔ phase254: city pack run detail dictionary keys are defined (0.776708ms)
✔ phase256: city pack run detail API applies evidence limit query (28.039209ms)
✔ phase256: admin app includes run detail limit input and query wiring (1.125ms)
✔ phase256: dictionary includes city pack run detail limit keys (0.725ms)
✔ phase26: ops console list includes memberFlags (add-only) (3.25875ms)
✔ phase26 t01: list splits READY/NOT_READY and returns required keys (2.685125ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U2 decisionLogId=d2 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase26 t02: postCheck verifies READY decisions (8.050292ms)
✔ phase26 t02: postCheck verifies NOT_READY decisions (0.363625ms)
✔ phase26 t03: docs exist with required headings (0.922083ms)
✔ phase26 t04: list returns pageInfo placeholder (2.231ms)
✔ phase26 t04: list returns pageInfo even when empty (0.439958ms)
✔ phase260: region declare creates request and user fields (2.799959ms)
✔ phase260: draft job creates source refs and draft city pack (4.374542ms)
✔ phase260: city-pack-requests routes require admin token (30.868ms)
✔ phase260: internal city-pack draft job requires token (30.28725ms)
✔ phase260: admin app includes city pack request panel (0.824458ms)
✔ phase261: /admin/app uses decision cards and removes summary header blocks (1.02225ms)
✔ phase261: decision state rules are fixed to READY/ATTENTION/STOP (0.904667ms)
✔ phase261: details auto-open for ATTENTION/STOP (0.448ms)
✔ phase261: vendor facade list/edit/activate/disable keeps compatibility with link_registry (35.57375ms)
✔ phase261: vendor actions require and persist traceId in audit logs (29.969ms)
✔ phase261: initial pane contract keeps 3-action decision layout (1.892ms)
✔ phase262: admin_app defines Alt+0..9 pane shortcuts (contract) (1.790542ms)
✔ phase262: admin.css provides focus-visible and reduced-motion rules (contract) (1.000458ms)
✔ phase263: decision card state classes exist in CSS and JS (contract) (0.961625ms)
✔ phase263: decision reasons are built via shared 2-line formatter (contract) (1.4085ms)
✔ phase264: admin.css provides table scroll + sticky header rules (contract) (0.8285ms)
✔ phase264: vendor table supports arrow key navigation + enter select (contract) (1.045666ms)
✔ phase266: city pack create normalizes targetingRules and slots (1.328875ms)
✔ phase266: city pack structure update route requires admin token and appends audit (29.357ms)
✔ phase266: draft job creates default targetingRules and slots (3.103917ms)
✔ phase266: admin app includes city pack structure editor controls (1.388542ms)
✔ phase266: admin app wires city pack structure save endpoint (0.598333ms)
✔ phase267: source ref policy fields are normalized and persisted (0.883125ms)
✔ phase267: source policy route requires admin token and writes audit (33.134292ms)
✔ phase267: optional source failures do not block city pack validation (0.987ms)
✔ phase267: required source failures still block city pack validation (0.185125ms)
✔ phase267: sendNotification uses cityPackFallback when only optional sources are invalid (6.83175ms)
✔ phase267: sendNotification remains fail-closed when required source is invalid (1.619459ms)
✔ phase267: admin app city pack pane has source policy controls (0.956834ms)
✔ phase267: admin app JS posts source policy update endpoint (0.624708ms)
✔ phase268: light/heavy stage updates source confidence and stage fields (2.654708ms)
✔ phase268: review inbox exposes priority/confidence/audit stage and sorts by priority (32.647208ms)
✔ phase268: internal light/heavy city pack audit routes require token and set stage (135.812041ms)
✔ phase268: city pack pane includes priority/confidence/stage columns and run mode options (0.942208ms)
✔ phase268: city pack run action posts stage and mode (1.233625ms)
✔ phase269: city pack structure editor includes basePackId input with dict keys (0.848ms)
✔ phase269: admin app reads basePackId input and posts it on structure save (0.965667ms)
✔ phase269: city pack structure update validates base pack depth and self reference (0.535083ms)
✔ phase269: cityPacksRepo normalizes basePackId and overrides in structure patch (0.579916ms)
✔ phase27 t01: docs exist with required headings (0.9005ms)
✔ phase27 t02: list sorts READY first then cursorCandidate desc then lineUserId (4.124541ms)
✔ phase27 t02: list stabilizes order by lineUserId when cursorCandidate is null (11.648041ms)
✔ phase27 t03: list guards required keys/types when console result is missing fields (1.503042ms)
✔ phase27 t04: list keeps pagination compatibility keys (nextPageToken + pageInfo) (1.725708ms)
✔ phase27 t04: list returns pagination keys even when items is empty (0.475042ms)
✔ phase270: City Pack Feedback command stores feedback and event (1.518ms)
✔ phase270: city-pack-feedback routes require admin token (40.681709ms)
✔ phase270: admin app includes feedback inbox and detail panels (0.822292ms)
✔ phase270: admin app loads feedback and posts actions (0.904709ms)
✔ phase271: city-pack-bulletins routes require admin token (54.147583ms)
✔ phase271: bulletin send uses sendNotification + killSwitch guard (0.717458ms)
✔ phase271: update proposal allowlist enforced and apply updates city pack (31.422209ms)
✔ phase271: admin app includes bulletin inbox and detail panels (0.799ms)
✔ phase271: admin app includes proposal inbox and detail panels (1.277459ms)
✔ phase271: bulletin/proposal dictionary keys exist (3.991ms)
✔ phase272: composer pane contains type-driven form, live preview, and saved list blocks (2.505334ms)
✔ phase272: non-STEP defaults are fixed to scenario A / week / limit 50 (5.721333ms)
✔ phase272: GET /api/admin/os/notifications/list returns rows under admin guard (44.712375ms)
✔ phase272: GET /api/admin/os/link-registry/:id returns lookup payload and enforces admin token (57.277209ms)
✔ phase272: composer danger actions require confirm and keep trace-aware calls (1.0765ms)
✔ phase272: composer type-driven dictionary keys exist (2.261834ms)
✔ phase272: createNotification stores notificationType and notificationMeta add-only fields (3.794833ms)
✔ phase273: city-pack-metrics route is admin-guarded and persists daily rows (33.417ms)
✔ phase273: computeCityPackMetrics aggregates by cityPack/slot/sourceRef with unmapped fallback (14.128042ms)
✔ phase273: admin app has city pack metrics panel and loader wiring (1.275958ms)
✔ phase273: city pack metrics dictionary keys exist (2.089625ms)
✔ phase273: index wires /api/admin/city-pack-metrics into city pack admin route set (0.690833ms)
✔ phase274: city pack route supports export + import dry-run/apply with confirm token (0.510375ms)
✔ phase274: template library route exposes list/create/detail/activate/retire (0.850667ms)
✔ phase274: template library repo uses city_pack_template_library collection (0.29875ms)
✔ phase274: index wires city pack import/export + template library endpoints (1.315417ms)
✔ phase274: app.html contains template library and import/export controls in city pack pane (0.868833ms)
✔ phase274: admin_app wires template library load and import/export actions (1.013584ms)
✔ phase274: template library/import-export dictionary keys exist (3.937625ms)
✔ phase28 t01: docs exist with required headings (1.929375ms)
✔ phase28 t02: pagination returns page1/page2 without overlap and stable order (22.173083ms)
✔ phase28 t03: invalid cursor is rejected (1.181333ms)
✔ phase28 t04: READY priority holds across pages (9.533ms)
✔ phase28 t05: required keys are present on all pages (15.376917ms)
✔ phase29 t01: nextPageToken can be used as cursor (compatible with pageInfo.nextCursor) (18.465541ms)
✔ phase29 t02: signed cursor is returned and can paginate without overlap (optional security) (17.103333ms)
✔ phase29 t03: signed cursor verifies signature and enforce mode rejects unsigned cursor (12.873834ms)
✔ phase30 t01: cursorInfo defaults to UNSIGNED and enforce=false (1.690084ms)
✔ phase30 t02: cursorInfo reflects signing/enforce even when items empty (1.57325ms)
✔ phase304: composer pane keeps type-driven form + live preview + saved list while hiding trace input UI (0.876167ms)
✔ phase304: css enforces no-fold behavior and hides decision summaries (0.58675ms)
✔ phase304: dashboard KPI endpoint is wired and returns six KPI keys contract (0.731333ms)
✔ phase304: saved filter uses AND conditions and preview reflects CTA2 (0.999917ms)
✔ phase306: city_pack_requests persists add-only experience fields (5.574208ms)
✔ phase306: city_pack_feedback supports slot/message/resolution and status extensions (1.091041ms)
✔ phase306: draft job writes slotContents + request experience fields (5.823375ms)
✔ phase306: kill switch blocks city pack admin/internal write operations (39.7135ms)
✔ phase306: city pack pane shows request stage/warning/aging and feedback slot/resolution (1.994416ms)
✔ phase306: city pack feedback actions include triage/resolve handlers (0.698208ms)
✔ phase306: index routes include city-pack-feedback triage/resolve actions (0.622958ms)
✔ phase306: city pack request/feedback dictionary keys exist (3.585583ms)
✔ phase307: legacy duplicate repos are frozen as canonical forwarders (no direct db write) (1.979917ms)
✔ phase307: canonical user query path does not reintroduce scenario-field filtering (0.611709ms)
✔ phase307: ops review flow normalizes drift fields before writing (0.445666ms)
✔ phase307: missing-index fallback points do not exceed audit baseline (5.273ms)
✔ phase307: newly added structural files do not introduce fallback catches (1.791916ms)
✔ phase307: normalizeOpsStateRecord keeps canonical keys only (1.862459ms)
✔ phase307: opsStateRepo read prefers canonical ops_states then falls back to legacy ops_state (2.342542ms)
✔ phase307: protection matrix resolves expected auth classes (0.827583ms)
✔ phase307: index.js routes protection via resolvePathProtection reference (0.313875ms)
✔ phase307: internal retention dry-run route requires only internal token (not admin token) (112.556875ms)
✔ phase307: retention dry-run does not delete docs and appends audit log (40.179375ms)
✔ phase307: normalizeScenarioKey absorbs scenario/scenarioKey drift (0.504875ms)
✔ phase307: usersRepo.listUsers accepts legacy scenario input and queries canonical scenarioKey (0.734458ms)
✖ phase308: top3 analytics hotspots use explicit bounded limits (10.166167ms)
✔ phase308: runtime routes/scripts do not import legacy duplicate repos (1.289083ms)
✔ phase308: missing-index fail mode defaults to true on stg/prod env (0.459375ms)
✔ phase308: every repo fallback branch has indexFallbackPolicy hooks (3.789709ms)
✔ phase308: retention dry-run fails closed on undefined collection policy (98.534292ms)
✔ phase308: retention policy covers all collections from audit lifecycle snapshot (1.3265ms)
✔ phase308: struct drift backfill supports dry-run and apply with audit trace (64.388917ms)
✔ phase309: struct drift backfill supports resumeAfterUserId cursor (14.873958ms)
✔ phase309: admin struct drift routes require admin token and support list/execute (49.145542ms)
✔ phase309: retention apply is env/flag guarded and filters by policy (67.475125ms)
✔ phase309: ops snapshot job builds snapshots and dashboard reads snapshot first (55.487125ms)
✔ phase309: review legacy page exposes LEGACY guidance to /admin/app (2.10075ms)
✔ phase309: admin app includes struct drift panel controls and handlers (0.975958ms)
✔ phase309: trace repos use index-oriented where+orderBy queries (1.761292ms)
✔ phase31 t01: ops_readonly includes ops console list/detail/submit sections (1.178ms)
✔ phase31 t02: ops_readonly defines ops console fetch/submit helpers (0.867708ms)
✔ phase310: repo_map_ui.json exposes required machine-readable sections (0.909875ms)
✖ phase310: repo-map check mode passes when generated artifact is current (106.781041ms)
✔ phase310: /api/admin/repo-map is admin protected and returns payload for authorized actor (92.711542ms)
✔ phase310: app shell includes developer menu and developer-map pane hooks (1.164667ms)
✔ phase310: developer-map pane keeps no-fold structure (1.029542ms)
✔ phase310: developer labels exist in dictionary and audit workflow checks repo-map drift (1.665084ms)
✔ phase311: repo map exposes three layers and canonical developer statuses (0.48225ms)
✔ phase311: feature completion maps deterministically to developer status (4.3845ms)
✔ phase311: /api/admin/repo-map remains admin-guarded and returns layers (92.501417ms)
✔ phase311: redac/user manuals are rendered without details blocks (1.662125ms)
✔ phase311: repo map keeps japanese glossary for internal terms and manual labels (3.144917ms)
✔ phase311: developer matrix render uses scenario-step cells with count and state labels (3.589583ms)
✔ phase311: audit workflow and package scripts enforce repo-map drift checks (0.516458ms)
✔ phase312: snapshot read mode defaults to prefer (0.487583ms)
✔ phase312: snapshot read mode supports require and legacy disabled compatibility (0.1125ms)
✔ phase312: dashboard KPI returns NOT AVAILABLE and no full-scan fallback in require mode (51.481209ms)
✔ phase312: require mode returns NOT AVAILABLE placeholders for summary/state when snapshot is missing (1.53525ms)
✔ phase313: /api/admin/legacy-status is admin guarded and returns legacy route summary (86.366041ms)
✔ phase313: developer map includes LEGACY status controls without removing existing routes (1.202541ms)
✔ phase313: index wires /api/admin/legacy-status route (2.085083ms)
✔ phase314: retention apply rejects unmatched dryRunTraceId and accepts matched trace (46.780458ms)
✔ phase314: retention apply supports maxDeletes/cursor and appends audit payload (59.480041ms)
✖ phase315: cleanup check script passes when generated artifacts are current (115.367875ms)
✔ phase315: unreachable baseline files are frozen with LEGACY marker (2.847416ms)
✔ phase315: legacy aliases carry LEGACY_HEADER and canonical forwarding (1.375ms)
✔ phase315: INDEX_PLAN covers all fallback source files from audit input (0.484417ms)
✔ phase315: retention addendum and lifecycle cover all retention policy collections (0.618583ms)
✔ phase315: protection matrix keeps admin/internal protection classes (1.127625ms)
✔ phase315: internal job routes keep token guard and killSwitch dependency map is generated (0.561583ms)
✔ phase316: analytics range queries return only bounded rows (1.956ms)
✔ phase316: dashboard KPI read path uses bounded range queries for events/deliveries (0.47575ms)
✔ phase316: user operational summary sources users from canonical usersRepo listUsers (1.311333ms)
✖ phase317: notification operational summary uses bounded range query with legacy fallback (6.383541ms)
✔ phase317: notification summary ignores events older than notification sendAt in bounded path (6.216583ms)
✔ phase318: analytics users/notifications range queries return only bounded rows (1.412208ms)
✔ phase318: dashboard KPI read path uses bounded range queries for users/notifications with fallback (1.6065ms)
✖ phase319: user operational summary uses range-first events/deliveries with fallback (4.136875ms)
✔ phase319: range-first path ignores out-of-window events when bounded set is non-empty (4.700166ms)
✔ phase32 t01: READY suggestions filtered to allowedNextActions (3.70575ms)
✔ phase32 t02: NOT_READY suggests STOP_AND_ESCALATE only (3.491375ms)
✔ phase32 t03: llm failure yields empty suggestions (2.1005ms)
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (4.767417ms)
✔ phase320: range-first path for user state ignores older events outside user window when bounded set is non-empty (3.304083ms)
✔ phase321: monitor insights uses sentAt range query first with bounded fallback (0.444042ms)
✔ phase321: monitor insights excludes out-of-window delivery when bounded set is non-empty (26.776708ms)
✔ phase322: phase2 automation uses range path when weekly events exist (2.566416ms)
✔ phase322: phase2 automation falls back to listAll events when weekly range is empty (2.289542ms)
✔ phase323: phase5 notifications summary route parses limit/eventsLimit bounds (0.516542ms)
✔ phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary (0.465917ms)
✔ phase324: phase5 users summary route parses limit/analyticsLimit bounds (0.472125ms)
✔ phase324: users filtered usecase forwards limit/analyticsLimit to operational summary (0.466416ms)
✔ phase325: phase5 stale member route parses limit bounds (0.512042ms)
✔ phase325: stale member summary respects limit option (0.962542ms)
✔ phase326: phase4 users summary route parses limit/analyticsLimit bounds (0.537666ms)
✔ phase326: user operational summary respects limit option (3.282625ms)
✔ phase327: phase4 notifications route parses limit/eventsLimit bounds (0.645083ms)
✔ phase327: notification operational summary accepts bounded eventsLimit (5.405416ms)
✔ phase328: phase5 state summary route parses analyticsLimit bounds (1.07375ms)
✔ phase328: user state summary accepts analyticsLimit knob (4.110958ms)
✔ phase329: phase4 users summary route parses snapshotMode (0.498709ms)
✔ phase329: phase5 state summary route parses snapshotMode (0.524542ms)
✔ phase329: snapshotMode=require argument returns NOT AVAILABLE semantics when snapshot is missing (1.431708ms)
✔ phase33 t01: execute actions return execution snapshots (7.848583ms)
✔ phase33 t02: duplicate execution is blocked (0.893083ms)
✔ phase33 t02: readiness NOT_READY blocks execution (6.205291ms)
✔ phase330: phase4 notifications summary route parses snapshotMode (0.44775ms)
✔ phase330: notification summary returns snapshot data in require mode (2.752167ms)
✔ phase330: notification summary require mode returns empty when snapshot missing (0.723958ms)
✔ phase330: ops snapshot build includes notification_operational_summary item (3.759084ms)
✔ phase331: phase5 notifications summary route parses snapshotMode (0.465292ms)
✔ phase331: phase5 notifications filtered usecase forwards snapshotMode (0.460625ms)
✔ phase331: phase5 notifications summary returns empty in snapshot require mode when snapshot missing (3.077375ms)
✔ phase332: phase5 users summary route parses snapshotMode (0.486167ms)
✔ phase332: phase5 users filtered usecase forwards snapshotMode (0.460167ms)
✔ phase333: phase5 users summary returns empty in snapshot require mode when snapshot missing (2.228625ms)
✔ phase334: phase4 summary routes include metadata fields and includeMeta option (0.495666ms)
✔ phase334: user operational summary includeMeta returns not_available metadata in require mode (1.413792ms)
✔ phase334: notification operational summary includeMeta returns not_available metadata in require mode (1.559708ms)
✔ phase335: monitor insights route parses snapshotMode and has require no-fallback branch (0.492833ms)
✔ phase335: monitor insights returns 400 on invalid snapshotMode (0.753833ms)
✔ phase336: index wires /api/admin/retention-runs route (0.72275ms)
✔ phase336: retention-runs returns retention actions only and maps payload fields (1.730459ms)
✔ phase337: phase5 summary routes include metadata fields (0.453375ms)
✔ phase337: users summary includeMeta returns items+meta in require mode (1.44ms)
✔ phase337: notifications summary includeMeta returns items+meta in require mode (0.378083ms)
✔ phase338: phase5 state route returns metadata fields (0.487625ms)
✔ phase338: phase5 state require mode returns not_available metadata when snapshot missing (1.076375ms)
✔ phase339: analyticsReadRepo defines user-scoped query readers (0.461917ms)
✔ phase339: phase5 state summary uses scoped queries before listAll fallback (0.498375ms)
✔ phase34 t01: suggestion drift is detected (3.091208ms)
✔ phase34 t02: execution drift is detected (1.951083ms)
✔ phase34 t03: policy drift is detected (1.423208ms)
✔ phase34 t04: no drift when suggestion/ops/execution align (1.709042ms)
✔ phase34 t05: phase32 -> phase33 -> phase34 appends decision drift (9.08675ms)
✔ phase340: snapshot freshness helpers resolve minutes and stale judgement (2.38325ms)
✔ phase340: user summary require mode treats stale snapshot as not_available (4.036875ms)
✔ phase341: internal ops snapshot job forwards targets payload (0.526541ms)
✔ phase341: buildOpsSnapshots supports partial targets with backward-compatible default (2.745042ms)
✔ phase342: maintenance pane includes retention runs read-only panel (1.046ms)
✔ phase342: admin app loads retention runs from admin API (1.417458ms)
✔ phase342: retention runs ui dictionary keys exist (0.699416ms)
✔ phase343: audit inputs manifest contains required metadata and file hashes (0.798958ms)
✔ phase343: package scripts and audit workflow include audit-inputs checks (0.488083ms)
✔ phase344: load risk report keeps required keys (0.515625ms)
✔ phase344: load risk scripts, budgets doc, and workflow check are wired (0.676166ms)
✔ phase345: audit inputs manifest uses real metadata values (0.513417ms)
✔ phase346: load risk hotspots include endpoint mapping (0.663542ms)
✔ phase347: phase4 summary routes parse fallbackMode and reject invalid values (0.488125ms)
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (4.256917ms)
✔ phase348: phase5 ops/state routes parse fallbackMode and forward it (0.49225ms)
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.907834ms)
✔ phase349: ops snapshot repo and route contracts exist (0.484208ms)
✔ phase349: index wires ops snapshot health admin endpoint (0.624541ms)
✔ phase35: notices repo create/get/list/update (1.208167ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase35 t01: console execution status reflects latest execution log (9.448917ms)
✔ phase35 t01: console execution status defaults to UNKNOWN when missing (0.297916ms)
✔ phase35 t02: list includes executionStatus summary (1.646459ms)
✔ phase35 t02: list defaults executionStatus when missing (0.472542ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase35 t03: ops loop updates executionStatus (4.886541ms)
✔ phase350: read path budgets include current baseline ratchet values (0.528042ms)
✔ phase350: load risk budget parser uses last matching budget values (0.729542ms)
✔ phase351: dashboard kpi route parses fallbackMode and rejects invalid value (0.527792ms)
✔ phase351: dashboard kpi compute path blocks listAll fallback when fallbackMode=block (0.543166ms)
✔ phase352: analytics read repo exposes checklist scoped query by scenario+step (0.638333ms)
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.926625ms)
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.372667ms)
✔ phase353: phase4/phase5 routes expose fallback diagnostics fields (0.495042ms)
✔ phase353: summary/state usecases track fallback source diagnostics (0.579583ms)
✔ phase354: ops snapshot health route accepts snapshotType filter and forwards to repo (0.476417ms)
✔ phase354: maintenance pane contains snapshot health controls and table (0.80725ms)
✔ phase354: admin app loads snapshot health via admin API (0.949166ms)
✔ phase355: read path budgets include hotspots_count_max in current baseline (0.434834ms)
✔ phase355: load risk script parses and checks hotspots_count_max budget (0.434166ms)
✔ phase356: fallback policy module defines env-driven default and resolver (0.652667ms)
✔ phase356: dashboard/phase4/phase5 routes use fallback policy default on missing query (0.601708ms)
✔ phase357: analytics read repo exposes lineUserIds scoped user_checklists query (0.462125ms)
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.59425ms)
✔ phase358: analytics read repo exposes notificationIds scoped events query (0.501ms)
✖ phase358: notification summary collects notification ids and queries scoped events first (3.357083ms)
✔ phase359: phase2 automation route validates fallbackMode and forwards it (0.443541ms)
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.384916ms)
✔ phase35-39: docs exist with required headings (1.460166ms)
✔ phase36: notice send flow pushes and records delivery/audit (0.58075ms)
✔ phase360: monitor insights route accepts fallbackMode and blocks listAll fallback (0.477125ms)
✔ phase360: monitor insights emits read_path fallback audit action when fallback is used or blocked (0.446458ms)
✔ phase361: read-path routes include fallback audit actions (0.688875ms)
✔ phase362: read path budgets include current baseline section for phase362 (0.502625ms)
✔ phase362: load-risk budget parser uses last baseline entries (0.478041ms)
✔ phase363: load risk hotspots exclude listAll function declarations (0.540292ms)
✔ phase363: fallback_risk equals unique fallback file/call surfaces (0.509791ms)
✔ phase364: analytics read repo provides scoped checklist/delivery methods (0.649416ms)
✔ phase364: phase4 users summary uses scoped reads and blocks fallback only on query failure (0.442834ms)
✔ phase365: phase4 notification summary uses global events fallback only after scoped/range query failures (0.477083ms)
✔ phase365: index requirements include scoped checklist/delivery query entries (0.6505ms)
✔ phase366: phase5 state summary uses scoped checklist pairs and fallback only on query failures (0.732792ms)
✔ phase367: phase2 automation prefers scoped reads before listAll fallbacks (0.548542ms)
✔ phase367: phase2 automation route keeps fallbackMode allow|block contract (0.4635ms)
✔ phase368: dashboard KPI responses include unified fallback diagnostics keys (0.477417ms)
✔ phase368: monitor insights response includes source/asOf/freshness and fallback diagnostics (0.491666ms)
✔ phase369: read path fallback summary route exposes grouped and recent rows (0.465959ms)
✔ phase369: index routes /api/admin/read-path-fallback-summary (0.639667ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase36-39: full ops flow yields timeline + traceability (4.72425ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
✔ phase36: decision timeline appends DECIDE/POSTCHECK/EXECUTE (3.195458ms)
✔ phase37: notification summary includes decision trace when linked (3.770291ms)
✔ phase38: getOpsAssistContext returns read-only payload (0.717ms)
✔ phase39: stale console is rejected and logged (1.52875ms)
✔ phase37: mark read and click append audit logs (0.49575ms)
✔ phase370: maintenance pane contains fallback summary controls and table (0.924ms)
✔ phase370: admin app loads read-path fallback summary via admin API (1.007083ms)
✔ phase371: product readiness route returns GO/NO_GO with blockers and checks (0.520833ms)
✔ phase371: index routes /api/admin/product-readiness (0.64025ms)
✖ phase372: read path budgets include current baseline section for phase372 (4.871ms)
✖ phase372: launch checklist includes product-readiness API checks (3.531583ms)
✔ phase38: ops dashboard returns dashboard items (1.204916ms)
✔ phase39: suggestion schema and audit are fixed (1.416292ms)
✖ admin summaries: users and notifications (6.783458ms)
✔ getNotificationReadModel: counts delivered/read/click (1.964209ms)
✔ toggle checklist done persists and reflects in GET (1.552208ms)
✔ toggle checklist done false clears in GET (0.29725ms)
✔ getMemberProfile returns memberNumber (0.753166ms)
✔ setMemberNumber writes trimmed value (0.639ms)
✔ setMemberNumber clears when empty (0.19ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase40-44: full flow returns view + automation skips NO_ACTION execution (9.614125ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase40: suggestion has disclaimer and no nextAction field (10.564125ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase41: llm assist suggestion appends timeline entry (3.325208ms)
✔ phase42: ops console view returns read-only payload (0.527833ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
✔ phase43: automation disabled by default (6.468458ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase44: automation guard triggers escalation (9.366792ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=f7b543f51277cbc932562b00fd26e711e71ebba2112fef4e3ffdffd1e0451a77 model=ops-assist-rules opsAssistInputHash=51fcb97feedd69b931804436952625029700aeac1a8ebaaf5a28977f87e3e9d8 refreshReason=cache_miss
✔ phase45: suggestion falls back to allowed action (9.000667ms)
✔ phase45: prompt payload shape is fixed (0.872125ms)
✔ phase46: ops assist cache stores latest entry (1.262542ms)
✔ phase46: ops console view includes assist only when requested (0.546416ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase47: automation timeline links decision log (9.017959ms)
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
✔ phase47: dry-run returns guard without writes (1.268792ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase47: execute requires readiness OK (7.951291ms)
✔ phase48: automation config default disabled (0.872791ms)
✔ phase48: automation config list shape fixed (2.310042ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase49: full ops flow stays consistent (10.448917ms)
✔ memberNumber stale: 14 days threshold (1.019542ms)
✔ ops attention flag: memberNumber missing, checklist incomplete, stale (6.45ms)
✖ phase5 ops filters: date range (3.874167ms)
✔ phase323: notifications summary filter forwards limit/eventsLimit options (0.873167ms)
✔ phase324: users summary filter forwards limit/analyticsLimit options (2.2725ms)
✔ ops filters: no params keeps all items (4.322292ms)
✔ ops filters: needsAttention (0.951416ms)
✔ ops filters: stale (0.403083ms)
✔ ops filters: unreviewed (0.435958ms)
✔ ops filters: reviewAgeDays (0.392917ms)
✔ ops filters: invalid reviewAgeDays returns 400 (0.142334ms)
✔ ops flags: memberNumber stale yes/no (2.851875ms)
✔ ops review: saves lastReviewed fields (1.012333ms)
✔ ops review write: updates user opsReview fields (0.9455ms)
✖ getUserStateSummary: returns read-only state (6.475375ms)
✔ phase50: obs emitted on submit and execute (7.07475ms)
✔ phase50: obs format is key=value and meta_json (1.171333ms)
[OBS] action=ops_assist_suggest result=cache_hit lineUserId=U1 cacheHit=true inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=cache_hit
✔ phase51: cache hit returns cached suggestion without regeneration (9.535833ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=input_changed
✔ phase51: input hash change triggers refresh (8.855208ms)
[OBS] action=ops_batch_run result=dry_run dryRun=true jobKey=refresh_ops_console limit=10
✔ phase52: dry-run does not call writers (0.811125ms)
✔ phase52: invalid jobKey is rejected (0.649375ms)
✔ phase53: suggest template mapping (0.524083ms)
✔ phase53: template repo stores and lists templates (1.128417ms)
✔ phase54: docs exist with required headings (0.8985ms)
✔ phase6 member summary: 400 when lineUserId missing (1.367916ms)
✔ phase6 member summary: 404 when user not found (0.53375ms)
✔ phase6 member summary: returns minimal summary (2.09375ms)
✔ phase6 member summary: includes redac status (last4 only) (0.42925ms)
✔ phase60: cursor HMAC roundtrip (0.927792ms)
✔ phase60: missing secret is rejected when unsigned not allowed (0.874542ms)
✔ phase60: tampered cursor is rejected (0.917375ms)
✔ phase61: active template cannot be edited (1.974791ms)
✔ phase61: templates CRUD happy path (2.1255ms)
✔ phase61: template rejects invalid notificationCategory (1.178667ms)
✔ phase62: same date is idempotent (0.945458ms)
✔ phase62: generate report persists summary (1.204208ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_dry_run_only
✔ phase63: dry_run_only blocks execute (6.30775ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase63: execute mode allows when guard + recent dry run ok (7.542625ms)
✔ phase64: docs exist with headers (1.446584ms)
✔ phase65: job is idempotent for same date (1.1865ms)
✔ phase65: job token required (0.476792ms)
✔ phase66: segment uses lineUserIds override (1.665709ms)
✔ phase66: segment needsAttention filters (1.405041ms)
✔ phase66: segment READY only (1.3475ms)
✔ phase66: segment filters by redacStatus + hasMemberNumber (1.744333ms)
✔ phase67: plan appends audit log (2.466292ms)
✔ phase67: plan does not send (2.448584ms)
✔ phase68: execute is blocked by per-user weekly cap (5.378875ms)
✔ phase68: execute is blocked when category is disallowed by servicePhase/preset (3.914208ms)
✔ phase68: execute appends audit and sends (106.644416ms)
✔ phase68: reject when mode is dry_run_only (1.441083ms)
✔ phase68: reject without matching plan (2.557125ms)
✔ phase69: docs exist with headers (1.041ms)
✔ phase70: ops_readonly includes segment send and retry queue sections (0.86825ms)
✔ phase71: execute rejects when planHash mismatched (2.989083ms)
✔ phase71: plan returns planHash with stable bucket (2.539833ms)
✔ phase72: testSendNotification with deliveryId is idempotent (second call skips push) (2.2345ms)
✔ phase72: retryQueuedSend passes through deliveryId to sendFn (1.828458ms)
✔ phase72: testSendNotification skips sealed deliveryId without pushing (0.216541ms)
✔ phase72: sendNotification skips sealed delivery and does not push duplicate (0.946ms)
✔ phase72: enqueue retry queue on send failure (107.055125ms)
✔ phase72: no enqueue when send succeeds (3.973084ms)
✔ phase72: testSendNotification sets sentAt/deliveredAt when missing (9.483208ms)
✔ phase73: retry is blocked by per-user weekly cap (3.818917ms)
✔ phase73: retry is blocked when category is disallowed by servicePhase/preset (5.162125ms)
✔ phase73: retry failure keeps pending with lastError (4.042958ms)
✔ phase73: list retry queue returns pending only (3.81625ms)
✔ phase73: retry success marks done (3.599584ms)
✔ phase74: docs exist with required headings (1.144416ms)
✔ phase75: get active template returns latest active version (1.178167ms)
✔ phase75: template version increments per key (1.023292ms)
✔ phase76: execute rejects when templateVersion mismatched (5.078542ms)
✔ phase76: plan returns templateVersion from active template (2.50275ms)
✔ phase77: create segment enforces unique key (1.333459ms)
✔ phase77: list active segments returns active only (1.257875ms)
✔ phase78: ops_readonly includes saved segments dropdown (1.423333ms)
✔ phase79: audit log contains run and plan snapshots (111.96025ms)
✔ phase79: docs exist with required headings (1.259042ms)
✔ phase79: execute returns runId (7.009417ms)
✔ phase80: cursor sign/verify roundtrip (2.397125ms)
✔ phase80: list rejects tampered signed cursor (1.195417ms)
✔ phase81: dry-run appends audit log (3.679917ms)
✔ phase81: dry-run has no side effects (7.47925ms)
✔ phase82: confirm token verifies with matching payload (0.905584ms)
✔ phase82: confirm token rejects mismatch (1.120083ms)
✔ phase83: ops_readonly includes dry-run flow (0.720666ms)
✔ phase84: docs exist with required headings (1.227083ms)
✔ phase85: automation_runs repo create/patch/get (1.031416ms)
✔ phase86: batching updates progress cursor (11.23025ms)
✔ phase86: rate limit applied with sleep (0.481875ms)
✔ phase87: no retry on validation error (0.617208ms)
✔ phase87: retry transient errors (0.470042ms)
✔ phase88: partial failure yields DONE_WITH_ERRORS (16.720792ms)
✔ phase89: aborted run records ops state (17.786875ms)
✔ phase89: breaker aborts on 429 storm (13.88575ms)
✔ phase90: run status route returns run (1.096583ms)
✔ phase91: audit logs appended on start/done/abort (15.851709ms)
✔ phase92: docs exist with required headings (0.511458ms)
✔ phaseLLM1: allow list blocks extra fields (0.613458ms)
✔ phaseLLM1: allow list passes and filters (0.689708ms)
✔ phaseLLM1: feature flag disabled by default (0.485459ms)
✔ phaseLLM1: feature flag enabled values (0.093792ms)
✔ phaseLLM1: feature flag rejects other values (0.077167ms)
✔ phaseLLM1: validate OpsExplanation schema (0.760208ms)
✔ phaseLLM1: validate NextActionCandidates schema (0.134708ms)
✔ phaseLLM1: validate FAQAnswer schema (0.167333ms)
✔ phaseLLM1: schema rejects direct URL in FAQ answer (0.1315ms)
✔ phaseLLM2: ops_readonly renders llm explanation section (0.728959ms)
✔ phaseLLM2: explanation fallback when LLM disabled (2.983084ms)
✔ phaseLLM2: accepts valid LLM explanation when enabled (0.703334ms)
✔ phaseLLM2: invalid LLM output falls back (1.182042ms)
✔ phaseLLM3: ops_readonly includes next action candidates section (0.697667ms)
✔ phaseLLM3: fallback when LLM disabled (3.209667ms)
✔ phaseLLM3: accepts valid LLM candidates when enabled (1.862625ms)
✔ phaseLLM3: invalid LLM candidates fallback (0.361833ms)
✔ phaseLLM4: block when LLM disabled (3.389459ms)
✔ phaseLLM4: accepts valid LLM answer with allowed citations (1.08575ms)
✔ phaseLLM4: citations required (0 citations => block) (0.3385ms)
✔ phaseLLM4: WARN link is blocked (0.323084ms)
✔ phaseLLM5: runbook and phase plan docs exist (1.246416ms)
✔ phaseLLM6: allow-list blocks out-of-scope secret field (0.572916ms)
✔ phaseLLM6: restricted category is blocked when not allowed (0.201ms)
✔ phaseLLM6: audit appends traceId for generated and blocked outcomes (5.226042ms)
✔ phaseLLM6: dual gate blocks when db flag is false (3.695584ms)
✔ phaseLLM6: dual gate blocks when env flag is false (0.455584ms)
✔ phaseLLM6: dual gate allows when db+env are true (0.6785ms)
✔ phaseLLM6: faq blocks when KB has no candidate (2.909334ms)
✔ phaseLLM6: faq blocks when citations are zero (3.282208ms)
✔ phaseLLM6: faq blocks direct URL in answer (3.263375ms)
✔ phaseLLM6: faq blocks WARN link (0.488916ms)
✔ phaseLLM6: llmEnabled defaults false and can be persisted (1.017542ms)
✔ phaseLLM6: faqArticlesRepo returns active locale-matched top scored rows (3.762042ms)
✔ phaseLLM6: faq output blocks when citations are missing (1.622375ms)
✔ phaseLLM6: faq output blocks direct URL (0.342291ms)
✔ phaseLLM6: next actions block invalid action (0.2645ms)
✔ phaseLLM6: llm config status/plan/set works with confirm token (41.91675ms)
✔ taxonomy: contact_source_required → CONTACT_SOURCE_REQUIRED (0.460584ms)
✔ taxonomy: kb_schema_invalid → KB_SCHEMA_INVALID (0.069208ms)
✔ taxonomy: llm_api_error → LLM_API_ERROR (0.053916ms)
✔ taxonomy: llm_timeout → LLM_API_ERROR (0.049833ms)
✔ taxonomy: adapter_missing → LLM_API_ERROR (0.053333ms)
✔ taxonomy: existing entries still correct (0.059459ms)
✔ taxonomy: unknown reason → UNKNOWN (0.062292ms)
✔ taxonomy: llm_disabled with nullOnDisabled=true → null (0.047667ms)
✔ handleCreate: missing x-actor → 400 (0.864ms)
✔ handleCreate: invalid article body → 422 with errors (0.600792ms)
✔ handleCreate: valid article → 200 with id (1.630208ms)
✔ handleList: returns articles → 200 (4.976917ms)
✔ handleUpdate: valid patch → 200 with id (0.345916ms)
✔ handleDelete: soft deletes article → 200 with id (0.976834ms)
✔ validateKbArticle: all required fields → valid (0.89625ms)
✔ validateKbArticle: missing status → invalid (0.16975ms)
✔ validateKbArticle: invalid status → invalid (0.068208ms)
✔ validateKbArticle: missing riskLevel → invalid (0.072333ms)
✔ validateKbArticle: invalid riskLevel → invalid (0.530417ms)
✔ validateKbArticle: missing both version and versionSemver → invalid (0.089792ms)
✔ validateKbArticle: versionSemver only (no version) → valid (0.053875ms)
✔ validateKbArticle: invalid semver string → invalid (0.051542ms)
✔ validateKbArticle: missing validUntil → invalid (0.075833ms)
✔ validateKbArticle: validUntil null → invalid (0.106ms)
✔ validateKbArticle: allowedIntents undefined → invalid (0.078459ms)
✔ validateKbArticle: allowedIntents null → invalid (0.050084ms)
✔ validateKbArticle: allowedIntents empty array [] → valid (all intents allowed) (0.058291ms)
✔ validateKbArticle: multiple errors returned (0.04975ms)
✔ search strict: article without riskLevel is rejected by validateKbArticle (0.773542ms)
✔ search strict: article without allowedIntents is rejected by validateKbArticle (0.132ms)
✔ search strict: normalizeRiskLevel(undefined) → invalid (null), not defaulted to low (0.079959ms)
✔ search strict: allowedIntents=[] is valid (all intents allowed) (0.063417ms)
✔ search strict: allowedIntents with entries is valid (0.077458ms)
✔ llmClient: throws when OPENAI_API_KEY is not set (1.440709ms)
✔ llmClient: throws when OPENAI_API_KEY is missing entirely (0.187333ms)
✔ llmClient: throws llm_api_error on HTTP non-200 response (0.175792ms)
✔ llmClient: throws llm_api_error on empty response content (0.146709ms)
✔ llmClient: throws llm_api_error on non-JSON response content (0.1505ms)
✔ llmClient: returns { answer, model } on successful response (1.579291ms)
✔ llmClient: uses OPENAI_MODEL env var when set (0.4555ms)
✔ llmClient: defaults to gpt-4o-mini when OPENAI_MODEL not set (0.331833ms)
✔ llmClient: sends Authorization header with Bearer token (0.33675ms)
✔ llmClient: uses json_object response_format (0.522084ms)
✔ llmClient: exports explainOps method (0.443292ms)
✔ llmClient: exports suggestNextActionCandidates method (0.063791ms)
✔ llmClient.explainOps: throws when OPENAI_API_KEY is not set (0.362916ms)
✔ llmClient.suggestNextActionCandidates: throws when OPENAI_API_KEY is not set (0.112041ms)
✔ llmClient: callOpsExplain returns { answer, model } on success (0.811709ms)
✔ llmClient: callNextActionCandidates returns { answer, model } on success (0.120334ms)
✔ getNextActionCandidates: returns ok:true with fallback when LLM disabled (6.835833ms)
✔ getNextActionCandidates: fallback includes up to 3 candidates with abstract actions only (0.454ms)
✔ getNextActionCandidates: response includes nextActionTemplate (next_actions_template_v1) (0.738459ms)
✔ getNextActionCandidates: uses llmAdapter.suggestNextActionCandidates when LLM enabled (2.681875ms)
✔ getNextActionCandidates: falls back when adapter_missing (0.843625ms)
✔ getNextActionCandidates: LLM output with invalid action is filtered out (0.33425ms)
✔ getNextActionCandidates: includes disclaimer in response (0.200458ms)
✔ getNextActionCandidates: throws when lineUserId is missing (0.306583ms)
✔ getOpsExplanation: returns ok:true with fallback when LLM disabled (5.867042ms)
✔ getOpsExplanation: response includes opsTemplate (ops_template_v1) (0.778792ms)
✔ getOpsExplanation: response includes opsHealthTemplate (ops_health_template_v1) (0.810209ms)
✔ getOpsExplanation: uses llmAdapter.explainOps when LLM enabled (2.7675ms)
✔ getOpsExplanation: falls back when adapter_missing (no llmAdapter in deps) (0.399167ms)
✔ getOpsExplanation: falls back on LLM timeout (3.256917ms)
✔ getOpsExplanation: includes disclaimer in response (2.240041ms)
✔ getOpsExplanation: throws when lineUserId is missing (0.826625ms)
✔ consent status: returns guideModeLocked=false when lawfulBasis is not consent (6.71475ms)
✔ consent status: guideModeLocked=true when lawfulBasis=consent and unverified (0.146167ms)
✔ consent status: guideModeLocked=false when lawfulBasis=consent and verified (0.094084ms)
✔ consent verify: sets consentVerified=true when lawfulBasis=consent (0.268583ms)
✔ consent verify: returns 409 when lawfulBasis is not consent (0.097292ms)
✔ consent verify: returns 409 when lawfulBasis is unspecified (0.073209ms)
✔ consent verify: audit log is written on success (0.133667ms)
✔ consent verify: audit log is written on failure (wrong lawfulBasis) (0.089042ms)
✔ consent revoke: sets consentVerified=false regardless of lawfulBasis (0.136542ms)
✔ consent revoke: guideModeLocked=false when lawfulBasis is not consent (0.799917ms)
✔ consent revoke: audit log is written (0.114375ms)
✔ consent status: returns 400 when x-actor header is missing (0.067875ms)
✔ consent verify: returns 400 when x-actor header is missing (0.062ms)
✔ ops explain: consent_missing blocks LLM when lawfulBasis=consent and unverified (6.753208ms)
✔ ops explain: LLM available after consent verified (lawfulBasis=consent, consentVerified=true) (0.535542ms)
✔ ops explain: LLM available with legitimate_interest (no consent needed) (0.300667ms)
✔ ops explain: llmStatus=disabled overrides consent when LLM flag is off (0.233791ms)
✔ next actions: consent_missing blocks LLM when lawfulBasis=consent and unverified (0.605625ms)
✔ next actions: LLM available after consent verified (0.356917ms)
✔ next actions: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.222208ms)
✔ ops explain: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.273708ms)
✔ recordUserLlmConsent: accept returns ok with accepted status (0.872375ms)
✔ recordUserLlmConsent: revoke returns ok with revoked status (0.097833ms)
✔ recordUserLlmConsent: throws when lineUserId missing (0.270125ms)
✔ recordUserLlmConsent: throws when lineUserId is not a string (2.016875ms)
✔ recordUserLlmConsent: audit log written on accept with correct action (0.34775ms)
✔ recordUserLlmConsent: audit log written on revoke with correct action (0.621042ms)
✔ recordUserLlmConsent: uses default LLM_CONSENT_VERSION when consentVersion omitted (0.270583ms)
✔ recordUserLlmConsent: accepts custom consentVersion (0.545167ms)
✔ recordUserLlmConsent: default actor is line_user (0.295417ms)
✔ recordUserLlmConsent: audit failure does not throw (best-effort) (0.18525ms)
✔ userConsentsRepo: setUserLlmConsent accept stores accepted status (0.57175ms)
✔ userConsentsRepo: setUserLlmConsent revoke stores revoked status (0.108125ms)
✔ userConsentsRepo: getUserLlmConsent returns null for unknown user (0.099791ms)
✔ userConsentsRepo: getUserLlmConsent returns accepted record (0.106167ms)
✔ userConsentsRepo: getUserLlmConsent normalizes unknown status to pending (0.084333ms)
✔ userConsentsRepo: setUserLlmConsent throws on missing lineUserId (0.270583ms)
✔ userConsentsRepo: setUserLlmConsent uses default version when omitted (0.069875ms)
✔ userConsentsRepo: merge preserves existing fields (0.35375ms)
✔ webhook: "AI同意" command replies with consent confirmation (1.631042ms)
✔ webhook: "LLM同意" command replies with consent confirmation (0.343542ms)
✔ webhook: "AI拒否" command replies with revoke confirmation (0.429ms)
✔ webhook: "LLM拒否" command replies with revoke confirmation (0.2205ms)
✔ webhook: consent command does not produce membership error reply (0.21275ms)
✔ webhook: unrelated text does not trigger consent handler (0.864917ms)
✔ webhook: consent handler stores consent status in user_consents collection (0.238625ms)
✔ webhook: AI拒否 stores revoked status in user_consents collection (0.169625ms)
✔ security: admin pages avoid unsafe HTML injection primitives (1.702209ms)
✔ security: automation config set requires valid confirmToken and writes audit on mismatch (39.590375ms)
✔ security: system config set requires valid confirmToken and writes audit on mismatch (39.168541ms)
✔ security: system config impactPreview includes cap breakdown fields (35.391ms)
✔ security: system config plan succeeds when notificationCaps are all null (5.023167ms)
✔ security: system config impactPreview respects deliveryCountLegacyFallback mode (2.792708ms)
✔ security: system config impactPreview skips delivery counters during active quietHours (2.094625ms)
✔ security: system config notificationCaps roundtrip and fallback (40.465542ms)
✔ security: cookie-auth state-changing requests require same-origin (CSRF guard) (27.85325ms)
✔ security: delivery backfill execute requires valid confirmToken (39.8735ms)
✔ security: delivery recovery execute requires valid confirmToken and seals delivery (38.885083ms)
✔ security: ops_readonly.html avoids innerHTML for dynamic data (XSS regression) (0.885584ms)
✔ security: /admin/* is protected by ADMIN_OS_TOKEN (cookie login) (23.647208ms)
✔ security: /api/phaseLLM4/faq/answer is protected by admin token (34.073041ms)
✔ security: redac membership id is not stored in plaintext (1.627ms)
ℹ tests 1053
ℹ suites 0
ℹ pass 1033
ℹ fail 20
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14368.564792

✖ failing tests:

test at tests/phase127/phase127_last_reaction_at.test.js:33:1
✖ phase127: lastReactionAt prefers clickAt over readAt (19.868208ms)
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
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (1.755375ms)
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
✖ phase308: top3 analytics hotspots use explicit bounded limits (10.166167ms)
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
✖ phase310: repo-map check mode passes when generated artifact is current (106.781041ms)
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
✖ phase315: cleanup check script passes when generated artifacts are current (115.367875ms)
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
✖ phase317: notification operational summary uses bounded range query with legacy fallback (6.383541ms)
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
✖ phase319: user operational summary uses range-first events/deliveries with fallback (4.136875ms)
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
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (4.767417ms)
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
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (4.256917ms)
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
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.907834ms)
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
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.926625ms)
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
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.372667ms)
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
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.59425ms)
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
✖ phase358: notification summary collects notification ids and queries scoped events first (3.357083ms)
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
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.384916ms)
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
✖ phase372: read path budgets include current baseline section for phase372 (4.871ms)
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
✖ phase372: launch checklist includes product-readiness API checks (3.531583ms)
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
✖ admin summaries: users and notifications (6.783458ms)
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
✖ phase5 ops filters: date range (3.874167ms)
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
✖ getUserStateSummary: returns read-only state (6.475375ms)
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
