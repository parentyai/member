# PHASE370_PLAN

## 目的
Phase370 の read-path 収束タスクを add-only で実装し、既存互換を維持する。

## スコープ
- Phase370 対象の route/usecase/repo/ui/scripts
- tests/phase370/*
- docs/SSOT_INDEX.md

## 受入条件
- Phase370 の契約テストが PASS する。
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

✔ auditLogsRepo: append writes createdAt (0.949208ms)
✔ auditLogsRepo: append respects provided createdAt (0.214209ms)
✔ recordClickAndRedirect: marks click and returns url (1.714666ms)
✔ recordClickAndRedirect: blocks WARN link (0.481458ms)
✔ killSwitch: default false, set true (3.3495ms)
✔ linkRegistryRepo: setHealth stores WARN state (1.226708ms)
✔ linkRegistryRepo: delete removes link (0.22325ms)
✔ createNotification: stores draft notification (1.094709ms)
✔ createNotification: stores normalized notificationCategory (0.295292ms)
✔ sendNotification: creates deliveries for matching users (1.671583ms)
✔ listNotifications: filters by scenarioKey (0.655ms)
✔ notificationsRepo: create -> list with filter (1.181834ms)
✔ phase0 smoke (0.423625ms)
✔ testSendNotification: creates delivery after push (4.629458ms)
✔ testSendNotification: blocked when kill switch ON (0.475833ms)
✔ usersRepo: create -> get -> update (8.712917ms)
✔ validateSingleCta: accepts single CTA text (0.485541ms)
✔ validateSingleCta: rejects missing CTA text (0.230417ms)
✔ validateSingleCta: rejects multiple CTAs (0.075084ms)
✔ validateLinkRequired: requires linkRegistryId (0.079166ms)
✔ validateLinkRequired: rejects direct URL (0.068917ms)
✔ validateWarnLinkBlock: blocks WARN state (0.073334ms)
✔ validateKillSwitch: blocks when ON (0.096583ms)
✔ validateNotificationPayload: passes when all checks ok (1.650709ms)
✔ webhook: valid signature creates user (1.514417ms)
✔ webhook: invalid signature rejected (0.20025ms)
✔ sendWelcomeMessage: sends once and records delivery (1.075708ms)
✔ webhook: welcome send is invoked for new user (1.859291ms)
✔ admin notifications: scenario only targeting (step ignored) (4.335166ms)
✔ admin notifications: linkRegistryId required (0.304208ms)
✔ admin notifications: events best-effort does not block (0.355667ms)
✔ checklistsRepo: create -> get -> list (1.191584ms)
✔ events integration: open requires notificationId (0.963542ms)
✔ events integration: click requires notificationId (0.153458ms)
✔ events integration: complete requires checklistId + itemId (2.392083ms)
✔ eventsRepo: create event (5.511958ms)
✔ eventsRepo: missing required fields throws (0.481333ms)
[phase1] checklist skipped: missing step
✔ getChecklistForUser: returns checklists for scenario/step (1.039042ms)
✔ getChecklistForUser: missing step returns empty (0.498708ms)
✔ logEventBestEffort: enforces type constraints (0.882167ms)
✔ phase1 smoke: notify -> delivery -> checklist -> events (11.987208ms)
✔ toggleChecklistItem: upserts and sets completedAt (0.8995ms)
✔ toggleChecklistItem: event failure does not block (0.726459ms)
✔ userChecklistsRepo: upsert -> get -> list (2.22225ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase101: ops assist suggestion includes suggestion/evidence/safety (10.463959ms)
✔ phase102: ops assist input shape is stable (0.959834ms)
✔ phase103: guard blocks invalid suggestion (1.81375ms)
✔ phase103: not ready forces STOP (0.442958ms)
✔ phase104: audit written for ok and block (4.111958ms)
✔ phase105: adopt audit appended (0.508333ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase106: llm disabled by default falls back to rules (10.426625ms)
✔ phase107: docs exist with required headings (0.984334ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U2 cacheHit=false inputHash=537233774f4b2f34de6ccc98996ddc0a704dd593447e713540ebb30150aa64e9 model=ops-assist-rules opsAssistInputHash=de2515a1df72528e84478ec4b8578df7577abf68ac5a24aa8d9724739c30cee3 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U3 cacheHit=false inputHash=70545ed0e9df1da70262da904475327f4e394fff62173bafb85085c3a3802d9b model=ops-assist-rules opsAssistInputHash=b0bb3a28bf10ada05df4241e6146d5a9cd995efb995eb50929d8c585f2f9e6b9 refreshReason=cache_miss
✔ phase108: suggest -> adopt -> submit audit flow (17.485792ms)
✔ phase117: resolve automation targets respects config filters (0.6875ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase118: suggestion schema is fixed (11.391708ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase119: audit append on suggestion includes notificationId (6.206625ms)
✔ implementation targets: single fixed entry (0.419792ms)
✔ implementation targets acceptance: fixed single IN target (0.558084ms)
✔ implementation targets acceptance: query does not change result (0.096625ms)
✔ implementation targets api: returns fixed registry (0.545417ms)
✔ ops readonly ui includes implementation targets section (1.156375ms)
✔ phase120: decision log stores source + suggestion snapshot (1.098542ms)
✔ phase121: ops notice send flow writes delivery and audit (8.276833ms)
✔ phase122: ops console view includes suggestion and audit id (0.585ms)
✔ phase123: killSwitch blocks ops assist suggestion (0.62225ms)
✔ phase124: docs exist with required headings (1.266ms)
[webhook] requestId=71ed4820-72f1-4e4e-9e18-b4acc5cec4d6 accept
[OBS] action=webhook result=ok requestId=71ed4820-72f1-4e4e-9e18-b4acc5cec4d6 lineUserId=U1
✔ phase125: SERVICE_MODE=webhook is webhook-only (+ appends webhook events) (36.074291ms)
✔ phase125: logLineWebhookEvents writes minimal schema (type + ref) (0.611625ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
[OBS] action=click result=ok requestId=unknown deliveryId=auto_1 linkRegistryId=l1
✔ phase126: existing POST /track/click still redirects and records clickAt (54.959125ms)
[OBS] action=click_post_compat result=reject requestId=unknown
✔ phase126: POST /track/click can be disabled via TRACK_POST_CLICK_ENABLED=0 (4.009042ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
✔ phase126: GET /t/{token} records clickAt + stats and redirects (43.031667ms)
✔ phase126: tampered token is rejected and does not write clickAt/stats (48.082834ms)
✔ phase126: expired token is rejected and does not write clickAt/stats (16.309209ms)
✔ phase127: docs exist with reaction definitions (0.840958ms)
✖ phase127: lastReactionAt prefers clickAt over readAt (19.91475ms)
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.665041ms)
✔ phase127: lastReactionAt is null when both clickAt/readAt missing (0.315875ms)
✔ phase128: stable ordering is deterministic and follows SSOT sort spec (1.748333ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase129: ops console view appends audit_logs with traceId (8.964084ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase130: NO_ACTION submit appends decision_logs + audit_logs (no execution) (1.941042ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase131: ops console includes add-only display fields (LINE-only reaction + execution message) (29.975875ms)
✔ phase132: kill switch blocks STOP_AND_ESCALATE (no send side effect) (6.246209ms)
✔ phase132: ops_readonly.html sets x-actor header to avoid actor=unknown (2.134375ms)
✔ phase132: execute fills traceId from existing decision audit when payload traceId missing (2.535292ms)
✔ phase133: GET /api/admin/trace returns audits/decisions/timeline for traceId (37.123959ms)
✔ phase134: run_trace_smoke.js completes with zero side effects and outputs trace bundle shape (166.629792ms)
✔ phase134: run_trace_smoke.js exits non-zero on failure (40.292166ms)
✔ phase135: runbook and ssot index exist with required headings (1.043208ms)
✔ phase137: notification reaction summary aggregates deliveries deterministically (2.673083ms)
✔ phase137: ctr is 0 when sent is 0 (1.03525ms)
✔ phase138: read model includes add-only reactionSummary + notificationHealth without breaking existing keys (4.868834ms)
✔ phase138: reactionSummary always exists even when no deliveries (0.442083ms)
✔ phase139: notification health evaluation thresholds are fixed (0.425708ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase140: ops console includes notificationHealthSummary + topUnhealthyNotifications (add-only) (4.730583ms)
✔ phase141: suggests mitigation when health is bad (0.5405ms)
✔ phase141: returns null when no unhealthy notifications (0.086708ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase142: trace bundle includes notification_mitigation.decision audit + decision log snapshot (2.908459ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_3 failure_class=PASS nextAction=NO_ACTION
✔ phase145: audit logs cover view/suggest/decision/execute via single traceId (6.92125ms)
✔ phase150: RUNBOOK_OPS exists with required headings (0.799625ms)
✔ phase158: LAUNCH_CHECKLIST exists with required headings (1.78825ms)
✔ phase153: run_ops_smoke.js completes with guarded execute and trace bundle coverage (112.197084ms)
✔ phase160: checkNotificationCap passes includeLegacyFallback=false to delivery counters (3.969542ms)
✔ phase160: checkNotificationCap defaults includeLegacyFallback=true (0.177333ms)
✔ phase160: checkNotificationCap skips delivery counters during active quietHours (0.142ms)
✔ phase160: checkNotificationCap uses snapshot counter when available (0.141458ms)
✔ phase160: deliveredAt backfill summary + apply (16.122458ms)
✔ phase160: delivery count uses deliveredAt and falls back to legacy sentAt (7.016667ms)
✔ phase160: notification caps normalize accepts extended fields (1.683375ms)
✔ phase160: notification caps block during quiet hours (0.531958ms)
✔ phase160: notification caps block when category is required but missing (0.189208ms)
✔ phase160: notification caps block per user daily before weekly (0.191292ms)
✔ phase160: notification caps normalize defaults to null (0.942417ms)
✔ phase160: notification caps reject invalid values (0.235084ms)
✔ phase160: notification caps block when delivered count reaches cap (0.231584ms)
✔ phase160: notification policy is no-op when servicePhase/preset are unset (0.500458ms)
✔ phase160: notification policy allows phase1 presetA immediate action (0.161833ms)
✔ phase160: notification policy blocks disallowed category (0.069959ms)
✔ phase160: SSOT docs exist for servicePhase and notificationPreset (2.146417ms)
✔ phase160: servicePhase/preset getters return null when unset (1.21975ms)
✔ phase160: servicePhase/preset setters validate and persist (2.401292ms)
✔ phase161: admin pages include x-actor headers (1.551333ms)
✔ phase161: execute is blocked when per-user weekly cap is exceeded (8.628375ms)
✔ phase161: execute failure writes notifications.send.execute audit with ok=false (10.404166ms)
✔ phase161: composer flow draft -> approve -> plan -> execute (no real send) (6.547666ms)
✔ phase161: partial send failure -> rerun executes remaining only (no double-send) (8.180875ms)
✔ phase161: execute is blocked when category is disallowed by servicePhase/preset (7.287ms)
✔ phase161: docs exist for admin UI OS + data model + runbook (1.195292ms)
✔ redac membership: happy path links and persists hash+last4 (2.142584ms)
✔ redac membership: duplicate (linked to another user) is rejected (1.594167ms)
✔ redac membership: invalid format returns invalid_format (1.7225ms)
✔ redac membership: non-command message is noop (0.470083ms)
✔ redac membership: usage guidance when command prefix has no payload (0.590708ms)
✔ redac membership: usage guidance when help keyword is used (0.642458ms)
✔ redac membership: same user can replace their redac id (releases previous id) (1.144541ms)
✔ ops readonly ui includes Redac status display label (1.390625ms)
✔ admin redac unlink: happy path removes link and clears user fields (3.237083ms)
✔ admin redac unlink: not found returns 404 (0.253791ms)
✔ admin redac unlink: invalid format returns 400 (1.453459ms)
✔ phase164: LINE command "会員ID 確認" replies with status (last4 only) (3.008125ms)
✔ phase164: LINE command prefix without payload replies usage guidance (2.22775ms)
✔ phase164: redac line message templates include next action guidance (0.456708ms)
✔ phase170: deploy workflow supports stg/prod environment split (0.993375ms)
✔ phase170: deploy-webhook workflow supports stg/prod environment split (0.577958ms)
✔ phase170: deploy-track workflow supports stg/prod environment split (0.31475ms)
✔ phase171: parseArgs reads env defaults and supports skip flags (0.709833ms)
✔ phase171: parseArgs requires admin token (0.3065ms)
✔ phase171: buildTraceId is stable format (1.297166ms)
✔ phase171: evaluateExitCode treats skip as failure in strict mode (0.137125ms)
✔ phase171: markdown summary includes scenario status and trace (0.163916ms)
✔ phase171: normalizeNotificationCaps and buildActiveQuietHours are add-only safe (0.552417ms)
✔ phase171: resolveOutFile uses default artifacts directory (0.90225ms)
✔ phase173: master ui renders impact preview risk and breakdown labels (0.813958ms)
✔ phase173: master ui includes delivery recovery operation guidance (1.086042ms)
✔ phase174: all redac reply templates include explicit next action phrase (0.480708ms)
✔ phase177: redac status route returns sampled consistency summary (45.720958ms)
✔ phase177: master ui includes redac health section and status endpoint call (0.638209ms)
✔ phase178: deploy workflow grants runtime SA secret accessor for member secrets (0.627375ms)
✔ phase178: deploy-webhook workflow grants runtime SA secret accessor for webhook secrets (0.126083ms)
✔ phase178: deploy-track workflow grants runtime SA secret accessor for track token secret (0.102584ms)
✔ phase179: notification routes include structured route_error logging + trace/request in 500 payload (0.780667ms)
✔ phase179: logRouteError emits sanitized structured line (8.0275ms)
✔ phase180: parseArgs accepts route_error options (0.685459ms)
✔ phase180: parseArgs rejects fetch-route-errors without project id (0.3255ms)
✔ phase180: buildRouteErrorLoggingFilter contains route_error prefix and trace id (0.121333ms)
✔ phase180: fetchRouteErrors parses gcloud output lines (0.476792ms)
✔ phase180: markdown summary prints route_error capture status (0.132458ms)
✔ phase181: deploy workflow requires explicit prod confirmation (0.556583ms)
✔ phase181: deploy-webhook workflow requires explicit prod confirmation (0.117834ms)
✔ phase181: deploy-track workflow requires explicit prod confirmation (0.09125ms)
✔ phase182: deploy workflow preflight validates required vars and secrets (0.627792ms)
✔ phase182: deploy-webhook workflow preflight validates required vars and secrets (0.147917ms)
✔ phase182: deploy-track workflow preflight validates required vars and secrets (0.116209ms)
✔ phase183: parseArgs enables fetchRouteErrors when fail-on-route-errors is set (0.645417ms)
✔ phase183: parseArgs rejects fail-on-route-errors without project id (0.28925ms)
✔ phase183: strict gate marks PASS as FAIL when route_error is detected (0.093042ms)
✔ phase183: strict gate keeps original reason for already failed scenario (0.062625ms)
✔ phase183: strict gate is no-op when strict mode is disabled (0.056584ms)
✔ phase184: stg notification e2e workflow is defined with required inputs (1.462916ms)
✔ phase184: stg notification e2e workflow runs proxy and strict route error gate (0.487875ms)
✔ phase184: stg notification e2e workflow uploads artifacts (0.435041ms)
✔ phase185: deploy workflow preflight separates missing from permission issues (0.584875ms)
✔ phase185: deploy-webhook workflow preflight separates missing from permission issues (0.12125ms)
✔ phase185: deploy-track workflow preflight separates missing from permission issues (0.09975ms)
✔ phase186: stg e2e workflow preflight separates missing from permission issues (0.8465ms)
✔ phase186: segment query accepts loose lineUserIds format (1.092041ms)
✔ phase187 t01: read-model keys required by monitor/read_model (5.631459ms)
✔ phase188B: waitRule values produce nextWaitDays (6.581292ms)
✔ phase189: targetCountSource derives from plan audit (4.947375ms)
✔ phase190: cap count labels derived from execute audit (4.734041ms)
✔ phase191: SSOT read-model keys close loop to output + UI (2.036875ms)
✔ runPhase2Automation: dryRun does not write reports (5.9725ms)
✔ runPhase2Automation: writes reports when not dryRun (2.689417ms)
[OBS] action=click-write result=ok deliveryId=d1 ctaText=openA linkRegistryId=l1
✔ recordClickAndRedirect: track mode records stats (best-effort) and returns redirect url (0.931125ms)
✔ recordClickAndRedirect: member mode does not record stats unless explicitly enabled (0.184292ms)
✔ phase201: ops/monitor/read_model include status summary panels (0.842417ms)
✔ phase202: composer shows plan target count label (1.810667ms)
✔ phase202: ops segment plan note includes count (0.933833ms)
✔ phase203: ops has list/detail sections (0.709667ms)
✔ phase203: monitor has drilldown detail panel (0.122584ms)
✔ phase203: read-model has drilldown detail panel (0.102333ms)
✔ phase204: weekOverWeek delta is computed from deliveries (6.263416ms)
✔ phase205: plan returns capBlockedCount based on caps (6.608125ms)
✔ phase205: composer shows plan cap blocked count label (0.316667ms)
✔ phase206: dry-run stores run record and passes (4.826125ms)
✔ phase206: failure taxonomy mapping (0.449333ms)
✔ phase206: self-send uses sendNotification without status update (7.82275ms)
✔ phase206: GET /api/admin/user-timeline returns deliveries + trace (35.944083ms)
✔ phase207: /admin/app and /admin/ui-dict are protected by admin token (35.174333ms)
✔ phase207: /admin/app returns shell and /admin/ui-dict returns dictionary when token is present (11.40875ms)
✔ phase207: all ui.* keys used in /admin/app exist in ADMIN_UI_DICTIONARY_JA (6.594334ms)
✔ phase209: master ui includes llm config controls (0.615458ms)
✔ phase209: master ui wires llm config endpoints (0.832958ms)
[OBS] action=click-write result=ok deliveryId=auto_4 ctaText=openB linkRegistryId=auto_1
✔ phase21 t06: clickCount increments for openB in day window (1.556958ms)
✔ phase21 t12: accepts --track-base-url and does not emit trackBaseUrl required (52.457417ms)
✔ phase21 t12: missing track base url exits with trackBaseUrl required (43.450458ms)
✔ phase21 t15: missing track base url exits with code 2 (40.965209ms)
✔ phase21 t16: verify env does not emit VERIFY_ENV_ERROR after npm ci (9.232417ms)
✔ phase21 t17: GAC set exits with code 2 (43.842792ms)
✔ phase21 t17: allow-gac bypasses guard (10.740333ms)
{"trackBaseUrl":"https://example.com","fromUtc":"2026-02-22T00:00:00.000Z","toUtc":"2026-02-23T00:00:00.000Z","linkRegistryId":"l1"}
✔ phase21 t18: invalid_rapt classified as env error (7.715334ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT=1 (3.986042ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT is not enabled (0.260667ms)
✔ testSendNotification: member mode records sent stats when ENV_NAME=stg even if PHASE18_CTA_EXPERIMENT is not enabled (0.170125ms)
✔ testSendNotification: track mode records sent stats without experiment flag (0.160333ms)
✔ ctaStatsRepo: incrementSent writes sentCount field (0.414209ms)
✔ phase210: master ui includes llm faq validation section (2.021417ms)
✔ phase210: master ui wires admin llm faq endpoint (1.354458ms)
✔ phase211: master ui includes llm ops explain / next actions section (0.686625ms)
✔ phase211: master ui wires llm ops endpoints (1.335667ms)
✔ phase212: admin app includes LLM nav and pane controls (1.105041ms)
✔ phase212: admin app wires LLM endpoints from pane actions (0.831375ms)
✔ phase213: admin app includes llm config controls in llm pane (1.347375ms)
✔ phase213: admin app wires llm config endpoints (0.93ms)
✔ phase214: admin app includes llm audit drilldown button (0.899833ms)
✔ phase214: admin app wires llm trace to audit pane search (0.56475ms)
✔ phase215: admin app uses admin llm ops endpoints with legacy fallback (2.074875ms)
✔ phase215: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (84.7435ms)
✔ phase216: master llm ops panel uses admin endpoints first (1.314541ms)
✔ phase216: master llm ops panel keeps legacy fallback endpoints (1.97875ms)
✔ phase217: ops_readonly uses admin llm ops endpoints first (0.842416ms)
✔ phase217: ops_readonly keeps legacy llm ops fallback endpoints (0.412958ms)
✔ phase218: admin_app uses admin LLM endpoints first with legacy fallback (1.215291ms)
✔ phase218: master uses admin LLM endpoints first with legacy fallback (0.327875ms)
✔ phase218: ops_readonly uses admin LLM endpoints first with legacy fallback (0.310959ms)
✔ phase219: phaseLLM4 compat route appends deprecated metadata on blocked response (0.927ms)
✔ phase219: phaseLLM4 compat route returns 400 on required/invalid parse errors (0.253791ms)
✔ phase22 t01: CTR calculation and delta (2.321959ms)
✔ phase22 t01: zero division yields 0 CTR (0.10925ms)
✔ phase22 t01: JSON structure keys (0.11475ms)
✔ phase22 t02: verify then kpi order with args (0.713042ms)
✔ phase22 t02: exit code mapping to env error (0.094291ms)
✔ phase22 t02: exit code mapping to runtime error (0.057417ms)
✔ phase22 t02: run executes verify then kpi (0.352792ms)
✔ phase22 t03: PASS when totals meet thresholds (1.7225ms)
✔ phase22 t03: FAIL when totalSent insufficient (0.397334ms)
✔ phase22 t03: FAIL when deltaCTR below threshold (0.348625ms)
✔ phase22 t03: PASS when minDeltaCtr is 0 even if deltaCTR negative (0.239ms)
✔ phase22 t03: FAIL when required key missing (0.30275ms)
✔ phase22 t03: FAIL on JSON parse error (0.332583ms)
✔ phase22 t03: stdin read error yields env error code (0.552042ms)
✔ phase22 t04: PASS when gate exitCode=0 (3.221625ms)
✔ phase22 t04: FAIL when gate exitCode=1 (0.313834ms)
✔ phase22 t04: VERIFY_ENV_ERROR when gate exitCode=2 (0.333167ms)
✔ phase22 t04: snapshot throws => FAIL (0.345625ms)
✔ phase22 t04: runner throws => FAIL (0.1105ms)
✔ phase22 t05: upsertSnapshot sets createdAt serverTimestamp (2.545375ms)
✔ phase22 t05: upsertSnapshot uses merge true (0.297667ms)
✔ phase22 t05: no --write keeps exitCode and does not call repo (0.890375ms)
✔ phase22 t05: --write 1 calls repo and keeps exitCode on error (0.249792ms)
✔ phase22 t06: defaults return JSON (0.587291ms)
✔ phase22 t06: repo error yields LIST_ENV_ERROR exitCode=2 (0.181584ms)
✔ phase22 t06: limit and order applied (1.110167ms)
✔ phase22 t06: cta filters applied (0.279958ms)
✔ phase22 t07: PASS returns exitCode 0 and no record on dry-run (2.195583ms)
✔ phase22 t07: write=1 calls record after pass (0.234292ms)
✔ phase22 t07: FAIL bubbles exitCode 1 (1.36175ms)
✔ phase22 t07: VERIFY_ENV_ERROR bubbles exitCode 2 (0.464416ms)
✔ phase22 t07: runner exception returns exitCode 1 (0.506417ms)
✔ phase22 t08: workflow files exist and include runner (1.000916ms)
(node:95542) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase22/phase22_t10a_workflow_artifact_always.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase22 t10a: dryrun workflow uploads artifacts always (0.592375ms)
✔ phase22 t10a: write workflow uploads artifacts always (0.113625ms)
✔ phase22 t11: FAIL output includes reasonCode (1.479583ms)
✔ phase22 t12: INVALID_ARGS when required args missing (3.657041ms)
✔ phase22 t12: SUBPROCESS_EXIT_NONZERO when kpi+gate present (0.648333ms)
✔ phase22 t12: RUNTIME_ERROR when runAndGate throws (0.138ms)
✔ phase22 t13: dryrun workflow uploads artifacts and writes summary (1.194166ms)
✔ phase22 t13: write workflow uploads artifacts and writes summary (0.166541ms)
✔ phase22 t14: dryrun workflow contains failure_class rules (0.579584ms)
✔ phase22 t14: write workflow contains failure_class rules (0.093541ms)
✔ phase22 t16: invalid_rapt => ENV classification (1.443375ms)
✔ phase22 t16: firebase-admin missing => ENV classification (0.163542ms)
✔ phase22 t16: generic stderr => IMPL classification (0.115542ms)
✔ phase22 t16: empty stderr => UNKNOWN classification (0.133917ms)
✔ phase22 t18: stderr is captured on exitCode!=0 (1.5655ms)
✔ phase22 t18: empty stderr yields zero bytes and capture=empty (0.166375ms)
✔ phase22 t18: spawn error yields SPAWN_ERROR signature (0.118042ms)
✔ phase22 t20: dryrun workflow provides FIRESTORE_PROJECT_ID (1.435458ms)
✔ phase22 t20: write workflow provides FIRESTORE_PROJECT_ID (0.308917ms)
✔ phase22 t22: ok=true payload includes required keys (3.347708ms)
✔ phase22 t22: stderr present yields head and bytes (0.129584ms)
✔ phase22 t22: stderr empty yields (empty) head and 0 bytes (0.07625ms)
✔ phase220: /api/admin/llm/faq/answer is protected by admin token (fail-closed) (54.673125ms)
✔ phase221: /api/admin/llm/config/* require admin token (fail-closed) (58.890667ms)
✔ phase222: /api/admin/llm/config/* require x-actor when admin token is provided (76.164625ms)
✔ phase223: /api/admin/llm/faq/answer does not require x-actor (admin token provided) (55.826459ms)
✔ phase224: admin/master LLM FAQ request uses buildHeaders (x-actor included) (0.637167ms)
✔ phase224: admin/app LLM FAQ request uses buildHeaders (x-actor included) (1.011375ms)
✔ phase225: admin llm faq audit actor uses x-actor header when provided (54.169917ms)
✔ phase226: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (fail-closed) (55.007459ms)
✔ phase227 t01: /api/admin/llm/ops-explain passes x-actor to usecase params (19.464291ms)
✔ phase227 t02: /api/admin/llm/next-actions passes x-actor to usecase params (17.72625ms)
✔ phase227 t03: ops-explain audit actor follows params.actor (no llm) (5.404583ms)
✔ phase227 t04: next-actions audit actor follows params.actor (no llm) (6.424833ms)
✔ phase228: /api/phaseLLM2/ops-explain and /api/phaseLLM3/ops-next-actions require admin token (fail-closed) (48.65675ms)
✔ phase229: faq blocks when high-risk article has no contact source (6.981791ms)
✔ phase229: faq blocks when high-risk citation omits contact source (1.469917ms)
✔ phase229: faq passes when high-risk citation includes contact source (0.430125ms)
✔ phase229: faqArticlesRepo excludes expired validUntil and FAQ-disallowed intents (4.2965ms)
(node:95565) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t01_workflow_oidc_auth.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t01: dryrun workflow includes OIDC auth and setup-gcloud (0.434917ms)
✔ phase23 t01: write workflow includes OIDC auth and setup-gcloud (0.071291ms)
(node:95566) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t02_workflow_summary_keys.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t02: dryrun workflow summary includes required keys (0.468167ms)
✔ phase23 t02: write workflow summary includes required keys (0.096917ms)
(node:95567) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t03_workflow_human_decision_hint.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t03: dryrun workflow includes humanDecisionHint rules (0.517791ms)
✔ phase23 t03: write workflow includes humanDecisionHint rules (0.277875ms)
(node:95568) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t05_workflow_service_mode_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t05: dryrun workflow sets SERVICE_MODE=member (0.48075ms)
✔ phase23 t05: write workflow sets SERVICE_MODE=member (0.071167ms)
(node:95569) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t06_workflow_verify_rest_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t06: dryrun workflow sets PHASE21_VERIFY_REST=1 (0.502084ms)
✔ phase23 t06: write workflow sets PHASE21_VERIFY_REST=1 (0.071542ms)
(node:95570) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_minimal_inputs.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: decision table uses minimal routing inputs (0.865709ms)
✔ phase23 t08: required observation keys match decision inputs (0.219834ms)
(node:95571) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_observation_keys_match_workflow.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: observation keys match workflow summary keys (1.15025ms)
(node:95572) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_decision_table_complete.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close decision table exists and has required columns (2.731084ms)
✔ phase23 t09: closeDecision values are CLOSE or NO_CLOSE (0.529958ms)
(node:95573) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_log_matches_runbook.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close declaration includes phaseResult and closeDecision (0.452291ms)
✔ phase230: faq blocks when top score is below minimum confidence (5.251666ms)
✔ phase230: faq blocks when top1/top2 ratio is below threshold (0.482875ms)
✔ phase230: faq allows confident candidates to proceed (0.837167ms)
✔ phase230: faq repo ranking prefers keyword > synonym > tag matches (5.343083ms)
✔ phase231: faq includes disclaimer version in response and audit events (4.100166ms)
✔ phase231: faq blocked response still includes disclaimer and rendered audit (0.559666ms)
✔ phase231: ops explanation and next actions include disclaimer version and rendered audit (3.317959ms)
✔ phase232: /admin/app includes FAQ block UX panel elements (1.389416ms)
✔ phase232: /admin/master includes FAQ block UX panel elements (0.332667ms)
✔ phase232: admin app dictionary has block UX keys (1.728833ms)
✔ phase232: faq blocked payload includes category/actions/suggestions for kb_no_match (3.955084ms)
✔ phase232: faq blocked payload provides fallback actions and max-3 suggested FAQs (0.637292ms)
✔ phase233: next action candidates are abstract-only and sanitized to contract keys (3.240417ms)
✔ phase233: ops explanation includes fixed template sections (2.280084ms)
✔ phase234: FAQ blocks with consent_missing when lawfulBasis=consent and consentVerified=false (5.451833ms)
✔ phase234: llm config plan/set supports llmPolicy snapshot and hash verification (36.751583ms)
✔ phase234: ops/next-actions audit payload includes llmPolicy snapshot fields (2.562208ms)
✔ phase235: checklist_guidance mode is allowed and returns answer when guard passes (3.413416ms)
✔ phase235: guide-only mode blocks free-chat mode (4.040959ms)
✔ phase235: personalization beyond allow-list is blocked (2.862375ms)
✔ phase24 t02: appendDecision sets decidedAt and createdAt serverTimestamp (0.880459ms)
✔ phase24 t02: appendDecision does not overwrite previous entries (0.176208ms)
✔ phase24 t02: getLatestDecision returns most recent by decidedAt (0.919ms)
✔ phase24 t02: invalid decision enum is rejected (0.831208ms)
✔ phase24 t03: memberNumber missing => BLOCK (0.636959ms)
✔ phase24 t03: memberNumber stale => WARN (0.086375ms)
✔ phase24 t03: memberNumber ok => INFO (0.538667ms)
✔ phase24 t03: checklist incomplete => WARN (0.071083ms)
✔ phase24 t04: missing linkRegistryId => BLOCK (0.556333ms)
✔ phase24 t04: invalid ctaText => BLOCK (0.081167ms)
✔ phase24 t04: missing deliveries => WARN (0.067333ms)
✔ phase24 t04: event without delivery => BLOCK (0.05975ms)
✔ phase24 t05: progress without definition => BLOCK (0.511417ms)
✔ phase24 t05: missing required item => BLOCK (0.079583ms)
✔ phase24 t05: completed but incomplete => BLOCK (0.067542ms)
✔ phase24 t05: required satisfied => ok and complete (0.490291ms)
✔ phase24 t06: memberNumber missing => BLOCK (0.98675ms)
✔ phase24 t06: memberNumber invalid format => WARN (0.191125ms)
✔ phase24 t06: duplicate memberNumber => BLOCK (0.2075ms)
✔ phase24 t06: normal => OK (0.48ms)
✔ phase24 t07: recordOpsNextAction appends decisionLog and upserts opsState (0.6905ms)
✔ phase24 t07: invalid nextAction is rejected (0.257958ms)
✔ phase24 t07: upsert stores updatedAt serverTimestamp (0.7105ms)
✔ phase24 t07: phase23 runbook still contains decision table keys (0.559709ms)
✔ phase24 t08: missing opsState => WARN (0.714791ms)
✔ phase24 t08: missing nextAction => WARN (0.073708ms)
✔ phase24 t08: opsState with nextAction => OK (0.068125ms)
✔ phase24 t08: summary includes opsState when present (3.771709ms)
✔ phase24 t09: missing opsState => WARN missing_ops_state (1.03425ms)
✔ phase24 t09: missing decision log => WARN missing_decision_log (0.108625ms)
✔ phase24 t09: mismatched nextAction => WARN mismatched_next_action (0.092291ms)
✔ phase24 t09: matching decision log => OK (0.08ms)
✔ phase24 t10: all OK => READY (0.844375ms)
✔ phase24 t10: warn missing in opsStateCompleteness => NOT_READY (0.113458ms)
✔ phase241: /admin/ops redirects to /admin/app when authenticated (23.0185ms)
✔ phase241: notification deliveries API supports memberNumber search and vendor fallback (23.433375ms)
✔ phase241: monitor insights returns vendor CTR, AB snapshot, FAQ reference top (23.816583ms)
✔ phase241: admin app removes status summary panels from operational panes (0.90025ms)
✔ phase241: admin app includes monitor user timeline and insights sections (0.4115ms)
✔ phase241: ops safe test flow propagates traceId into monitor pane (0.952125ms)
✔ phase241: all ui.* keys used in /admin/app are present in dictionary (4.784334ms)
✔ phase243: faqArticlesRepo accepts version fallback and excludes invalid schema rows (4.497917ms)
✔ phase244: blocked low_confidence returns kbMeta and policySnapshotVersion (9.614333ms)
✔ phase244: success response includes kbMeta and policySnapshotVersion (0.845458ms)
✔ phase245: FAQ writes llm_disclaimer_rendered with surface=api (8.321292ms)
✔ phase245: Ops explain writes llm_disclaimer_rendered with surface=api (1.061667ms)
✔ phase245: Next actions writes llm_disclaimer_rendered with surface=api (0.705083ms)
✔ phase246: blocked payload always includes safe fallbackActions and suggestedFaqs <= 3 (10.393875ms)
✔ phase246: admin app filters direct URL sourceId in block panel (0.492084ms)
✔ phase247: ops template sections order is fixed (2.140291ms)
✔ phase247: next action internal enum stays uppercase (0.697792ms)
✔ phase247: admin app lowercases next actions for display only (0.546542ms)
✔ phase248: blocked reason taxonomy mapper is shared (0.471042ms)
✔ phase248: FAQ audit stores regulatoryProfile (8.531167ms)
✔ phase248: Ops/NextAction audits include regulatoryProfile (1.083625ms)
✔ phase249: guide-only modes remain allowed (10.380709ms)
✔ phase249: non guide-only mode is blocked (0.415709ms)
✔ phase249: personalization is restricted to locale/servicePhase (0.2655ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d123 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t02: dryRun does not write and returns readiness (1.046709ms)
✔ phase25 t02: dryRun false writes and returns decisionLogId (7.85675ms)
✔ phase25 t02: readiness NOT_READY still returns ok (0.437083ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t03: ops console returns required keys (4.044083ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t04: console recommendedNextAction flows into submit (9.693ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=invalid nextAction
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=ENV nextAction=RERUN_MAIN reason=invalid nextAction
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t05: READY writes audit snapshot (9.369208ms)
✔ phase25 t05: READY rejects nextAction not in allowedNextActions (0.453417ms)
✔ phase25 t05: NOT_READY allows only STOP_AND_ESCALATE (0.419083ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=PASS nextAction=NO_ACTION reason=invalid consistency
✔ phase25 t06: opsState missing => WARN (0.575792ms)
✔ phase25 t06: decisionLog missing => WARN (0.111417ms)
✔ phase25 t06: opsState source mismatch => FAIL (0.120209ms)
✔ phase25 t06: missing audit snapshot => FAIL (0.084917ms)
✔ phase25 t06: submit rejects on consistency FAIL (1.181875ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t07: READY recommended is in allowedNextActions (9.587041ms)
✔ phase25 t07: NOT_READY forces STOP_AND_ESCALATE only (0.327083ms)
✔ phase25 t07: consistency FAIL downgrades readiness to NOT_READY (0.26225ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t08: READY yields closeDecision CLOSE (10.215166ms)
✔ phase25 t08: NOT_READY yields closeDecision NO_CLOSE (0.377167ms)
✔ phase25 t08: consistency FAIL yields closeDecision NO_CLOSE (0.269541ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t09: audit includes closeDecision fields (9.4595ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=NO_ACTION reason=closeDecision closed
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=closeDecision: NO_CLOSE
✔ phase25 t10: CLOSE rejects submit (1.507416ms)
✔ phase25 t10: NO_CLOSE rejects non-escalate actions (0.188125ms)
✔ phase250: source audit classifies ok/redirect/http_error/timeout and stores screenshot paths (3.273333ms)
✔ phase250: confirm extends validUntil by 120 days and sets active (1.723709ms)
✔ phase250: retire returns warning when source is still used by city packs (0.533167ms)
✔ phase250: sendNotification blocks when referenced source is expired (3.390041ms)
✔ phase250: canary run stores run summary, evidence and audit logs with traceId (4.274083ms)
✔ phase250: review inbox requires admin token and internal audit route requires job token (96.217833ms)
✔ phase251 t01: parseArgs reads required env and trims service url (0.58425ms)
✔ phase251 t01: parseArgs supports canary mode and ids (0.739375ms)
✔ phase251 t01: parseArgs rejects invalid mode (0.246ms)
✔ phase251 t01: parseArgs rejects unknown args (0.079916ms)
✔ phase251 t02: invokeCityPackAudit returns ok on 200/ok:true (1.165459ms)
✔ phase251 t02: invokeCityPackAudit returns fail on non-2xx (0.154084ms)
✔ phase251 t02: invokeCityPackAudit falls back on invalid json response (0.126417ms)
✔ phase251 t03: workflow exists and calls runner script (0.8115ms)
✔ phase252: city pack audit runs API requires token and returns summary/status (37.095292ms)
✔ phase252: admin app includes city pack run history panel and controls (1.835125ms)
✔ phase252: index routes include city-pack-source-audit/runs (1.435083ms)
✔ phase253: city pack run detail API requires token and returns run + evidences (26.497625ms)
✔ phase253: admin app includes city pack trace button and run detail fetch (1.191708ms)
✔ phase253: index routes include city-pack-source-audit/runs/:runId (0.56775ms)
✔ phase254: admin app includes city pack run detail table and raw drawer (1.035375ms)
✔ phase254: run detail renderer opens evidence and handles missing trace (0.945208ms)
✔ phase254: city pack run detail dictionary keys are defined (0.7275ms)
✔ phase256: city pack run detail API applies evidence limit query (29.101791ms)
✔ phase256: admin app includes run detail limit input and query wiring (1.103584ms)
✔ phase256: dictionary includes city pack run detail limit keys (0.675584ms)
✔ phase26: ops console list includes memberFlags (add-only) (2.499042ms)
✔ phase26 t01: list splits READY/NOT_READY and returns required keys (3.559333ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U2 decisionLogId=d2 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase26 t02: postCheck verifies READY decisions (10.740791ms)
✔ phase26 t02: postCheck verifies NOT_READY decisions (0.37175ms)
✔ phase26 t03: docs exist with required headings (0.879875ms)
✔ phase26 t04: list returns pageInfo placeholder (1.83625ms)
✔ phase26 t04: list returns pageInfo even when empty (0.449583ms)
✔ phase260: region declare creates request and user fields (2.320166ms)
✔ phase260: draft job creates source refs and draft city pack (2.9755ms)
✔ phase260: city-pack-requests routes require admin token (28.656875ms)
✔ phase260: internal city-pack draft job requires token (30.738459ms)
✔ phase260: admin app includes city pack request panel (0.816416ms)
✔ phase261: /admin/app uses decision cards and removes summary header blocks (3.229ms)
✔ phase261: decision state rules are fixed to READY/ATTENTION/STOP (0.958542ms)
✔ phase261: details auto-open for ATTENTION/STOP (0.463166ms)
✔ phase261: vendor facade list/edit/activate/disable keeps compatibility with link_registry (33.820042ms)
✔ phase261: vendor actions require and persist traceId in audit logs (34.02225ms)
✔ phase261: initial pane contract keeps 3-action decision layout (1.198833ms)
✔ phase262: admin_app defines Alt+0..9 pane shortcuts (contract) (1.090458ms)
✔ phase262: admin.css provides focus-visible and reduced-motion rules (contract) (0.967792ms)
✔ phase263: decision card state classes exist in CSS and JS (contract) (1.058708ms)
✔ phase263: decision reasons are built via shared 2-line formatter (contract) (1.463375ms)
✔ phase264: admin.css provides table scroll + sticky header rules (contract) (0.575667ms)
✔ phase264: vendor table supports arrow key navigation + enter select (contract) (1.892042ms)
✔ phase266: city pack create normalizes targetingRules and slots (1.926667ms)
✔ phase266: city pack structure update route requires admin token and appends audit (38.683625ms)
✔ phase266: draft job creates default targetingRules and slots (3.676208ms)
✔ phase266: admin app includes city pack structure editor controls (1.809417ms)
✔ phase266: admin app wires city pack structure save endpoint (0.654583ms)
✔ phase267: source ref policy fields are normalized and persisted (1.113125ms)
✔ phase267: source policy route requires admin token and writes audit (42.787291ms)
✔ phase267: optional source failures do not block city pack validation (1.028416ms)
✔ phase267: required source failures still block city pack validation (0.17175ms)
✔ phase267: sendNotification uses cityPackFallback when only optional sources are invalid (6.708042ms)
✔ phase267: sendNotification remains fail-closed when required source is invalid (0.545291ms)
✔ phase267: admin app city pack pane has source policy controls (0.838167ms)
✔ phase267: admin app JS posts source policy update endpoint (0.546333ms)
✔ phase268: light/heavy stage updates source confidence and stage fields (5.194083ms)
✔ phase268: review inbox exposes priority/confidence/audit stage and sorts by priority (32.000667ms)
✔ phase268: internal light/heavy city pack audit routes require token and set stage (120.205917ms)
✔ phase268: city pack pane includes priority/confidence/stage columns and run mode options (0.892584ms)
✔ phase268: city pack run action posts stage and mode (1.155791ms)
✔ phase269: city pack structure editor includes basePackId input with dict keys (2.337584ms)
✔ phase269: admin app reads basePackId input and posts it on structure save (0.983709ms)
✔ phase269: city pack structure update validates base pack depth and self reference (1.395ms)
✔ phase269: cityPacksRepo normalizes basePackId and overrides in structure patch (0.547208ms)
✔ phase27 t01: docs exist with required headings (0.826333ms)
✔ phase27 t02: list sorts READY first then cursorCandidate desc then lineUserId (3.648667ms)
✔ phase27 t02: list stabilizes order by lineUserId when cursorCandidate is null (8.80825ms)
✔ phase27 t03: list guards required keys/types when console result is missing fields (2.352875ms)
✔ phase27 t04: list keeps pagination compatibility keys (nextPageToken + pageInfo) (2.460208ms)
✔ phase27 t04: list returns pagination keys even when items is empty (1.249416ms)
✔ phase270: City Pack Feedback command stores feedback and event (4.045166ms)
✔ phase270: city-pack-feedback routes require admin token (28.828792ms)
✔ phase270: admin app includes feedback inbox and detail panels (0.826208ms)
✔ phase270: admin app loads feedback and posts actions (2.064666ms)
✔ phase271: city-pack-bulletins routes require admin token (42.249375ms)
✔ phase271: bulletin send uses sendNotification + killSwitch guard (8.473125ms)
✔ phase271: update proposal allowlist enforced and apply updates city pack (33.520875ms)
✔ phase271: admin app includes bulletin inbox and detail panels (1.380292ms)
✔ phase271: admin app includes proposal inbox and detail panels (0.930917ms)
✔ phase271: bulletin/proposal dictionary keys exist (3.079459ms)
✔ phase272: composer pane contains type-driven form, live preview, and saved list blocks (1.07ms)
✔ phase272: non-STEP defaults are fixed to scenario A / week / limit 50 (1.031834ms)
✔ phase272: GET /api/admin/os/notifications/list returns rows under admin guard (42.038209ms)
✔ phase272: GET /api/admin/os/link-registry/:id returns lookup payload and enforces admin token (45.316625ms)
✔ phase272: composer danger actions require confirm and keep trace-aware calls (0.909333ms)
✔ phase272: composer type-driven dictionary keys exist (4.095042ms)
✔ phase272: createNotification stores notificationType and notificationMeta add-only fields (1.987708ms)
✔ phase273: city-pack-metrics route is admin-guarded and persists daily rows (41.467875ms)
✔ phase273: computeCityPackMetrics aggregates by cityPack/slot/sourceRef with unmapped fallback (16.169834ms)
✔ phase273: admin app has city pack metrics panel and loader wiring (1.520375ms)
✔ phase273: city pack metrics dictionary keys exist (3.641958ms)
✔ phase273: index wires /api/admin/city-pack-metrics into city pack admin route set (0.65175ms)
✔ phase274: city pack route supports export + import dry-run/apply with confirm token (0.47275ms)
✔ phase274: template library route exposes list/create/detail/activate/retire (0.913667ms)
✔ phase274: template library repo uses city_pack_template_library collection (0.376125ms)
✔ phase274: index wires city pack import/export + template library endpoints (1.884541ms)
✔ phase274: app.html contains template library and import/export controls in city pack pane (0.888625ms)
✔ phase274: admin_app wires template library load and import/export actions (1.601666ms)
✔ phase274: template library/import-export dictionary keys exist (2.039042ms)
✔ phase28 t01: docs exist with required headings (0.902667ms)
✔ phase28 t02: pagination returns page1/page2 without overlap and stable order (19.798792ms)
✔ phase28 t03: invalid cursor is rejected (1.215083ms)
✔ phase28 t04: READY priority holds across pages (19.56275ms)
✔ phase28 t05: required keys are present on all pages (12.14025ms)
✔ phase29 t01: nextPageToken can be used as cursor (compatible with pageInfo.nextCursor) (16.511042ms)
✔ phase29 t02: signed cursor is returned and can paginate without overlap (optional security) (15.948833ms)
✔ phase29 t03: signed cursor verifies signature and enforce mode rejects unsigned cursor (11.097875ms)
✔ phase30 t01: cursorInfo defaults to UNSIGNED and enforce=false (2.781917ms)
✔ phase30 t02: cursorInfo reflects signing/enforce even when items empty (3.468625ms)
✔ phase304: composer pane keeps type-driven form + live preview + saved list while hiding trace input UI (0.866792ms)
✔ phase304: css enforces no-fold behavior and hides decision summaries (1.307209ms)
✔ phase304: dashboard KPI endpoint is wired and returns six KPI keys contract (0.676333ms)
✔ phase304: saved filter uses AND conditions and preview reflects CTA2 (1.000875ms)
✔ phase306: city_pack_requests persists add-only experience fields (5.450666ms)
✔ phase306: city_pack_feedback supports slot/message/resolution and status extensions (1.281416ms)
✔ phase306: draft job writes slotContents + request experience fields (6.266791ms)
✔ phase306: kill switch blocks city pack admin/internal write operations (42.825958ms)
✔ phase306: city pack pane shows request stage/warning/aging and feedback slot/resolution (0.92975ms)
✔ phase306: city pack feedback actions include triage/resolve handlers (0.613083ms)
✔ phase306: index routes include city-pack-feedback triage/resolve actions (0.769125ms)
✔ phase306: city pack request/feedback dictionary keys exist (5.623375ms)
✔ phase307: legacy duplicate repos are frozen as canonical forwarders (no direct db write) (1.861291ms)
✔ phase307: canonical user query path does not reintroduce scenario-field filtering (0.543958ms)
✔ phase307: ops review flow normalizes drift fields before writing (0.278584ms)
✔ phase307: missing-index fallback points do not exceed audit baseline (3.949875ms)
✔ phase307: newly added structural files do not introduce fallback catches (0.491667ms)
✔ phase307: normalizeOpsStateRecord keeps canonical keys only (0.896125ms)
✔ phase307: opsStateRepo read prefers canonical ops_states then falls back to legacy ops_state (0.772917ms)
✔ phase307: protection matrix resolves expected auth classes (0.83525ms)
✔ phase307: index.js routes protection via resolvePathProtection reference (0.421584ms)
✔ phase307: internal retention dry-run route requires only internal token (not admin token) (99.843458ms)
✔ phase307: retention dry-run does not delete docs and appends audit log (41.348125ms)
✔ phase307: normalizeScenarioKey absorbs scenario/scenarioKey drift (0.639ms)
✔ phase307: usersRepo.listUsers accepts legacy scenario input and queries canonical scenarioKey (2.72025ms)
✖ phase308: top3 analytics hotspots use explicit bounded limits (5.985791ms)
✔ phase308: runtime routes/scripts do not import legacy duplicate repos (0.787959ms)
✔ phase308: missing-index fail mode defaults to true on stg/prod env (0.623667ms)
✔ phase308: every repo fallback branch has indexFallbackPolicy hooks (3.605125ms)
✔ phase308: retention dry-run fails closed on undefined collection policy (89.818875ms)
✔ phase308: retention policy covers all collections from audit lifecycle snapshot (1.245417ms)
✔ phase308: struct drift backfill supports dry-run and apply with audit trace (62.36625ms)
✔ phase309: struct drift backfill supports resumeAfterUserId cursor (10.428167ms)
✔ phase309: admin struct drift routes require admin token and support list/execute (42.807709ms)
✔ phase309: retention apply is env/flag guarded and filters by policy (59.310666ms)
✔ phase309: ops snapshot job builds snapshots and dashboard reads snapshot first (60.525458ms)
✔ phase309: review legacy page exposes LEGACY guidance to /admin/app (0.600083ms)
✔ phase309: admin app includes struct drift panel controls and handlers (0.918958ms)
✔ phase309: trace repos use index-oriented where+orderBy queries (0.455042ms)
✔ phase31 t01: ops_readonly includes ops console list/detail/submit sections (1.594875ms)
✔ phase31 t02: ops_readonly defines ops console fetch/submit helpers (1.998666ms)
✔ phase310: repo_map_ui.json exposes required machine-readable sections (0.451084ms)
✖ phase310: repo-map check mode passes when generated artifact is current (109.38925ms)
✔ phase310: /api/admin/repo-map is admin protected and returns payload for authorized actor (91.891041ms)
✔ phase310: app shell includes developer menu and developer-map pane hooks (1.308042ms)
✔ phase310: developer-map pane keeps no-fold structure (1.207375ms)
✔ phase310: developer labels exist in dictionary and audit workflow checks repo-map drift (3.357083ms)
✔ phase311: repo map exposes three layers and canonical developer statuses (0.563042ms)
✔ phase311: feature completion maps deterministically to developer status (5.737958ms)
✔ phase311: /api/admin/repo-map remains admin-guarded and returns layers (70.498833ms)
✔ phase311: redac/user manuals are rendered without details blocks (2.184666ms)
✔ phase311: repo map keeps japanese glossary for internal terms and manual labels (3.436ms)
✔ phase311: developer matrix render uses scenario-step cells with count and state labels (4.107667ms)
✔ phase311: audit workflow and package scripts enforce repo-map drift checks (0.831708ms)
✔ phase312: snapshot read mode defaults to prefer (0.570792ms)
✔ phase312: snapshot read mode supports require and legacy disabled compatibility (0.117625ms)
✔ phase312: dashboard KPI returns NOT AVAILABLE and no full-scan fallback in require mode (56.596042ms)
✔ phase312: require mode returns NOT AVAILABLE placeholders for summary/state when snapshot is missing (1.504083ms)
✔ phase313: /api/admin/legacy-status is admin guarded and returns legacy route summary (89.343625ms)
✔ phase313: developer map includes LEGACY status controls without removing existing routes (1.175083ms)
✔ phase313: index wires /api/admin/legacy-status route (1.610583ms)
✔ phase314: retention apply rejects unmatched dryRunTraceId and accepts matched trace (42.5055ms)
✔ phase314: retention apply supports maxDeletes/cursor and appends audit payload (75.6545ms)
✖ phase315: cleanup check script passes when generated artifacts are current (108.316875ms)
✔ phase315: unreachable baseline files are frozen with LEGACY marker (2.892542ms)
✔ phase315: legacy aliases carry LEGACY_HEADER and canonical forwarding (0.645ms)
✔ phase315: INDEX_PLAN covers all fallback source files from audit input (0.469166ms)
✔ phase315: retention addendum and lifecycle cover all retention policy collections (0.618709ms)
✔ phase315: protection matrix keeps admin/internal protection classes (1.031875ms)
✔ phase315: internal job routes keep token guard and killSwitch dependency map is generated (0.6565ms)
✔ phase316: analytics range queries return only bounded rows (3.063ms)
✔ phase316: dashboard KPI read path uses bounded range queries for events/deliveries (0.736458ms)
✔ phase316: user operational summary sources users from canonical usersRepo listUsers (0.442333ms)
✖ phase317: notification operational summary uses bounded range query with legacy fallback (4.61725ms)
✔ phase317: notification summary ignores events older than notification sendAt in bounded path (9.748958ms)
✔ phase318: analytics users/notifications range queries return only bounded rows (1.58425ms)
✔ phase318: dashboard KPI read path uses bounded range queries for users/notifications with fallback (0.662666ms)
✖ phase319: user operational summary uses range-first events/deliveries with fallback (3.458542ms)
✔ phase319: range-first path ignores out-of-window events when bounded set is non-empty (5.0765ms)
✔ phase32 t01: READY suggestions filtered to allowedNextActions (7.580666ms)
✔ phase32 t02: NOT_READY suggests STOP_AND_ESCALATE only (1.508417ms)
✔ phase32 t03: llm failure yields empty suggestions (2.17725ms)
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (11.719708ms)
✔ phase320: range-first path for user state ignores older events outside user window when bounded set is non-empty (4.154834ms)
✔ phase321: monitor insights uses sentAt range query first with bounded fallback (0.510791ms)
✔ phase321: monitor insights excludes out-of-window delivery when bounded set is non-empty (27.910958ms)
✔ phase322: phase2 automation uses range path when weekly events exist (2.447042ms)
✔ phase322: phase2 automation falls back to listAll events when weekly range is empty (3.536125ms)
✔ phase323: phase5 notifications summary route parses limit/eventsLimit bounds (0.543667ms)
✔ phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary (0.489625ms)
✔ phase324: phase5 users summary route parses limit/analyticsLimit bounds (0.454875ms)
✔ phase324: users filtered usecase forwards limit/analyticsLimit to operational summary (0.43875ms)
✔ phase325: phase5 stale member route parses limit bounds (1.219209ms)
✔ phase325: stale member summary respects limit option (1.192959ms)
✔ phase326: phase4 users summary route parses limit/analyticsLimit bounds (0.502791ms)
✔ phase326: user operational summary respects limit option (3.066917ms)
✔ phase327: phase4 notifications route parses limit/eventsLimit bounds (0.466916ms)
✔ phase327: notification operational summary accepts bounded eventsLimit (4.017708ms)
✔ phase328: phase5 state summary route parses analyticsLimit bounds (0.488666ms)
✔ phase328: user state summary accepts analyticsLimit knob (4.120917ms)
✔ phase329: phase4 users summary route parses snapshotMode (0.515334ms)
✔ phase329: phase5 state summary route parses snapshotMode (0.48325ms)
✔ phase329: snapshotMode=require argument returns NOT AVAILABLE semantics when snapshot is missing (1.415041ms)
✔ phase33 t01: execute actions return execution snapshots (9.287334ms)
✔ phase33 t02: duplicate execution is blocked (0.918959ms)
✔ phase33 t02: readiness NOT_READY blocks execution (10.214167ms)
✔ phase330: phase4 notifications summary route parses snapshotMode (0.634208ms)
✔ phase330: notification summary returns snapshot data in require mode (2.383542ms)
✔ phase330: notification summary require mode returns empty when snapshot missing (0.559375ms)
✔ phase330: ops snapshot build includes notification_operational_summary item (5.232916ms)
✔ phase331: phase5 notifications summary route parses snapshotMode (0.5355ms)
✔ phase331: phase5 notifications filtered usecase forwards snapshotMode (0.566125ms)
✔ phase331: phase5 notifications summary returns empty in snapshot require mode when snapshot missing (2.356167ms)
✔ phase332: phase5 users summary route parses snapshotMode (0.506208ms)
✔ phase332: phase5 users filtered usecase forwards snapshotMode (0.457875ms)
✔ phase333: phase5 users summary returns empty in snapshot require mode when snapshot missing (1.421583ms)
✔ phase334: phase4 summary routes include metadata fields and includeMeta option (0.526208ms)
✔ phase334: user operational summary includeMeta returns not_available metadata in require mode (1.422625ms)
✔ phase334: notification operational summary includeMeta returns not_available metadata in require mode (1.446625ms)
✔ phase335: monitor insights route parses snapshotMode and has require no-fallback branch (0.61175ms)
✔ phase335: monitor insights returns 400 on invalid snapshotMode (0.837167ms)
✔ phase336: index wires /api/admin/retention-runs route (0.644584ms)
✔ phase336: retention-runs returns retention actions only and maps payload fields (1.803916ms)
✔ phase337: phase5 summary routes include metadata fields (0.514291ms)
✔ phase337: users summary includeMeta returns items+meta in require mode (1.828292ms)
✔ phase337: notifications summary includeMeta returns items+meta in require mode (0.456625ms)
✔ phase338: phase5 state route returns metadata fields (0.478333ms)
✔ phase338: phase5 state require mode returns not_available metadata when snapshot missing (1.204958ms)
✔ phase339: analyticsReadRepo defines user-scoped query readers (0.50825ms)
✔ phase339: phase5 state summary uses scoped queries before listAll fallback (0.548292ms)
✔ phase34 t01: suggestion drift is detected (3.4755ms)
✔ phase34 t02: execution drift is detected (1.512958ms)
✔ phase34 t03: policy drift is detected (1.298666ms)
✔ phase34 t04: no drift when suggestion/ops/execution align (1.872167ms)
✔ phase34 t05: phase32 -> phase33 -> phase34 appends decision drift (10.609333ms)
✔ phase340: snapshot freshness helpers resolve minutes and stale judgement (1.228416ms)
✔ phase340: user summary require mode treats stale snapshot as not_available (2.785833ms)
✔ phase341: internal ops snapshot job forwards targets payload (0.483417ms)
✔ phase341: buildOpsSnapshots supports partial targets with backward-compatible default (2.572667ms)
✔ phase342: maintenance pane includes retention runs read-only panel (0.842541ms)
✔ phase342: admin app loads retention runs from admin API (1.232667ms)
✔ phase342: retention runs ui dictionary keys exist (1.239583ms)
✔ phase343: audit inputs manifest contains required metadata and file hashes (0.65925ms)
✔ phase343: package scripts and audit workflow include audit-inputs checks (0.501417ms)
✔ phase344: load risk report keeps required keys (1.188792ms)
✔ phase344: load risk scripts, budgets doc, and workflow check are wired (0.900042ms)
✔ phase345: audit inputs manifest uses real metadata values (0.485417ms)
✔ phase346: load risk hotspots include endpoint mapping (0.523792ms)
✔ phase347: phase4 summary routes parse fallbackMode and reject invalid values (0.467875ms)
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (3.312291ms)
✔ phase348: phase5 ops/state routes parse fallbackMode and forward it (0.595958ms)
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.428125ms)
✔ phase349: ops snapshot repo and route contracts exist (0.534084ms)
✔ phase349: index wires ops snapshot health admin endpoint (0.809583ms)
✔ phase35: notices repo create/get/list/update (1.286208ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase35 t01: console execution status reflects latest execution log (9.796292ms)
✔ phase35 t01: console execution status defaults to UNKNOWN when missing (0.366541ms)
✔ phase35 t02: list includes executionStatus summary (1.571ms)
✔ phase35 t02: list defaults executionStatus when missing (0.475417ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase35 t03: ops loop updates executionStatus (5.780834ms)
✔ phase350: read path budgets include current baseline ratchet values (0.441917ms)
✔ phase350: load risk budget parser uses last matching budget values (0.7625ms)
✔ phase351: dashboard kpi route parses fallbackMode and rejects invalid value (0.48175ms)
✔ phase351: dashboard kpi compute path blocks listAll fallback when fallbackMode=block (0.526583ms)
✔ phase352: analytics read repo exposes checklist scoped query by scenario+step (0.736834ms)
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.268125ms)
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.436959ms)
✔ phase353: phase4/phase5 routes expose fallback diagnostics fields (0.529625ms)
✔ phase353: summary/state usecases track fallback source diagnostics (0.668125ms)
✔ phase354: ops snapshot health route accepts snapshotType filter and forwards to repo (0.634208ms)
✔ phase354: maintenance pane contains snapshot health controls and table (0.932375ms)
✔ phase354: admin app loads snapshot health via admin API (1.314709ms)
✔ phase355: read path budgets include hotspots_count_max in current baseline (0.570542ms)
✔ phase355: load risk script parses and checks hotspots_count_max budget (0.601625ms)
✔ phase356: fallback policy module defines env-driven default and resolver (0.582583ms)
✔ phase356: dashboard/phase4/phase5 routes use fallback policy default on missing query (0.630083ms)
✔ phase357: analytics read repo exposes lineUserIds scoped user_checklists query (0.538333ms)
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.350583ms)
✔ phase358: analytics read repo exposes notificationIds scoped events query (0.917583ms)
✖ phase358: notification summary collects notification ids and queries scoped events first (3.940125ms)
✔ phase359: phase2 automation route validates fallbackMode and forwards it (0.571791ms)
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.395834ms)
✔ phase35-39: docs exist with required headings (1.532125ms)
✔ phase36: notice send flow pushes and records delivery/audit (0.590542ms)
✔ phase360: monitor insights route accepts fallbackMode and blocks listAll fallback (0.52225ms)
✔ phase360: monitor insights emits read_path fallback audit action when fallback is used or blocked (0.459917ms)
✔ phase361: read-path routes include fallback audit actions (0.704666ms)
✔ phase362: read path budgets include current baseline section for phase362 (0.492041ms)
✔ phase362: load-risk budget parser uses last baseline entries (0.458917ms)
✔ phase363: load risk hotspots exclude listAll function declarations (0.544125ms)
✔ phase363: fallback_risk equals unique fallback file/call surfaces (0.519584ms)
✔ phase364: analytics read repo provides scoped checklist/delivery methods (0.49575ms)
✔ phase364: phase4 users summary uses scoped reads and blocks fallback only on query failure (0.471667ms)
✔ phase365: phase4 notification summary uses global events fallback only after scoped/range query failures (0.502292ms)
✔ phase365: index requirements include scoped checklist/delivery query entries (0.846125ms)
✔ phase366: phase5 state summary uses scoped checklist pairs and fallback only on query failures (0.591084ms)
✔ phase367: phase2 automation prefers scoped reads before listAll fallbacks (0.582459ms)
✔ phase367: phase2 automation route keeps fallbackMode allow|block contract (0.425375ms)
✔ phase368: dashboard KPI responses include unified fallback diagnostics keys (0.51175ms)
✔ phase368: monitor insights response includes source/asOf/freshness and fallback diagnostics (0.479625ms)
✔ phase369: read path fallback summary route exposes grouped and recent rows (0.473417ms)
✔ phase369: index routes /api/admin/read-path-fallback-summary (0.65425ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase36-39: full ops flow yields timeline + traceability (5.05575ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
✔ phase36: decision timeline appends DECIDE/POSTCHECK/EXECUTE (4.541417ms)
✔ phase37: notification summary includes decision trace when linked (2.822625ms)
✔ phase38: getOpsAssistContext returns read-only payload (0.712542ms)
✔ phase39: stale console is rejected and logged (1.549333ms)
✔ phase37: mark read and click append audit logs (0.517541ms)
✔ phase370: maintenance pane contains fallback summary controls and table (0.806542ms)
✔ phase370: admin app loads read-path fallback summary via admin API (1.0135ms)
✔ phase371: product readiness route returns GO/NO_GO with blockers and checks (0.53225ms)
✔ phase371: index routes /api/admin/product-readiness (0.703875ms)
✖ phase372: read path budgets include current baseline section for phase372 (3.225042ms)
✖ phase372: launch checklist includes product-readiness API checks (4.334292ms)
✔ phase38: ops dashboard returns dashboard items (1.457291ms)
✔ phase39: suggestion schema and audit are fixed (1.21225ms)
✖ admin summaries: users and notifications (7.493667ms)
✔ getNotificationReadModel: counts delivered/read/click (3.085583ms)
✔ toggle checklist done persists and reflects in GET (1.557209ms)
✔ toggle checklist done false clears in GET (0.299291ms)
✔ getMemberProfile returns memberNumber (1.295084ms)
✔ setMemberNumber writes trimmed value (0.909125ms)
✔ setMemberNumber clears when empty (0.191708ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase40-44: full flow returns view + automation skips NO_ACTION execution (17.507583ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase40: suggestion has disclaimer and no nextAction field (15.665834ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase41: llm assist suggestion appends timeline entry (3.162875ms)
✔ phase42: ops console view returns read-only payload (0.505292ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
✔ phase43: automation disabled by default (8.163834ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase44: automation guard triggers escalation (7.320583ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=f7b543f51277cbc932562b00fd26e711e71ebba2112fef4e3ffdffd1e0451a77 model=ops-assist-rules opsAssistInputHash=51fcb97feedd69b931804436952625029700aeac1a8ebaaf5a28977f87e3e9d8 refreshReason=cache_miss
✔ phase45: suggestion falls back to allowed action (9.287417ms)
✔ phase45: prompt payload shape is fixed (1.041541ms)
✔ phase46: ops assist cache stores latest entry (1.081625ms)
✔ phase46: ops console view includes assist only when requested (0.555833ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase47: automation timeline links decision log (7.705291ms)
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
✔ phase47: dry-run returns guard without writes (1.011833ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase47: execute requires readiness OK (7.6615ms)
✔ phase48: automation config default disabled (0.927167ms)
✔ phase48: automation config list shape fixed (1.6325ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase49: full ops flow stays consistent (9.012792ms)
✔ memberNumber stale: 14 days threshold (1.100625ms)
✔ ops attention flag: memberNumber missing, checklist incomplete, stale (3.754083ms)
✖ phase5 ops filters: date range (4.862541ms)
✔ phase323: notifications summary filter forwards limit/eventsLimit options (0.893125ms)
✔ phase324: users summary filter forwards limit/analyticsLimit options (1.240875ms)
✔ ops filters: no params keeps all items (3.856666ms)
✔ ops filters: needsAttention (1.208375ms)
✔ ops filters: stale (0.44775ms)
✔ ops filters: unreviewed (0.444916ms)
✔ ops filters: reviewAgeDays (0.404791ms)
✔ ops filters: invalid reviewAgeDays returns 400 (0.143375ms)
✔ ops flags: memberNumber stale yes/no (2.771375ms)
✔ ops review: saves lastReviewed fields (1.024417ms)
✔ ops review write: updates user opsReview fields (0.861875ms)
✖ getUserStateSummary: returns read-only state (7.632416ms)
✔ phase50: obs emitted on submit and execute (7.744625ms)
✔ phase50: obs format is key=value and meta_json (0.849583ms)
[OBS] action=ops_assist_suggest result=cache_hit lineUserId=U1 cacheHit=true inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=cache_hit
✔ phase51: cache hit returns cached suggestion without regeneration (8.621375ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=input_changed
✔ phase51: input hash change triggers refresh (8.629041ms)
[OBS] action=ops_batch_run result=dry_run dryRun=true jobKey=refresh_ops_console limit=10
✔ phase52: dry-run does not call writers (0.8235ms)
✔ phase52: invalid jobKey is rejected (0.63475ms)
✔ phase53: suggest template mapping (0.449208ms)
✔ phase53: template repo stores and lists templates (1.074625ms)
✔ phase54: docs exist with required headings (1.2875ms)
✔ phase6 member summary: 400 when lineUserId missing (0.764125ms)
✔ phase6 member summary: 404 when user not found (0.359083ms)
✔ phase6 member summary: returns minimal summary (2.153291ms)
✔ phase6 member summary: includes redac status (last4 only) (0.481583ms)
✔ phase60: cursor HMAC roundtrip (0.95025ms)
✔ phase60: missing secret is rejected when unsigned not allowed (0.908125ms)
✔ phase60: tampered cursor is rejected (1.006083ms)
✔ phase61: active template cannot be edited (1.282167ms)
✔ phase61: templates CRUD happy path (2.008ms)
✔ phase61: template rejects invalid notificationCategory (1.044083ms)
✔ phase62: same date is idempotent (0.93675ms)
✔ phase62: generate report persists summary (1.136791ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_dry_run_only
✔ phase63: dry_run_only blocks execute (7.920709ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase63: execute mode allows when guard + recent dry run ok (9.292041ms)
✔ phase64: docs exist with headers (1.257125ms)
✔ phase65: job is idempotent for same date (1.249541ms)
✔ phase65: job token required (0.505583ms)
✔ phase66: segment uses lineUserIds override (1.333ms)
✔ phase66: segment needsAttention filters (1.694875ms)
✔ phase66: segment READY only (1.456666ms)
✔ phase66: segment filters by redacStatus + hasMemberNumber (1.669292ms)
✔ phase67: plan appends audit log (2.549833ms)
✔ phase67: plan does not send (2.451791ms)
✔ phase68: execute is blocked by per-user weekly cap (4.676083ms)
✔ phase68: execute is blocked when category is disallowed by servicePhase/preset (3.77275ms)
✔ phase68: execute appends audit and sends (106.79825ms)
✔ phase68: reject when mode is dry_run_only (1.460125ms)
✔ phase68: reject without matching plan (2.574125ms)
✔ phase69: docs exist with headers (0.972708ms)
✔ phase70: ops_readonly includes segment send and retry queue sections (0.694625ms)
✔ phase71: execute rejects when planHash mismatched (3.045583ms)
✔ phase71: plan returns planHash with stable bucket (2.385667ms)
✔ phase72: testSendNotification with deliveryId is idempotent (second call skips push) (2.613459ms)
✔ phase72: retryQueuedSend passes through deliveryId to sendFn (2.197334ms)
✔ phase72: testSendNotification skips sealed deliveryId without pushing (0.223791ms)
✔ phase72: sendNotification skips sealed delivery and does not push duplicate (1.115125ms)
✔ phase72: enqueue retry queue on send failure (111.851834ms)
✔ phase72: no enqueue when send succeeds (4.349541ms)
✔ phase72: testSendNotification sets sentAt/deliveredAt when missing (10.811833ms)
✔ phase73: retry is blocked by per-user weekly cap (4.038584ms)
✔ phase73: retry is blocked when category is disallowed by servicePhase/preset (4.508667ms)
✔ phase73: retry failure keeps pending with lastError (5.841625ms)
✔ phase73: list retry queue returns pending only (3.049792ms)
✔ phase73: retry success marks done (3.808916ms)
✔ phase74: docs exist with required headings (1.009334ms)
✔ phase75: get active template returns latest active version (1.369375ms)
✔ phase75: template version increments per key (1.579208ms)
✔ phase76: execute rejects when templateVersion mismatched (5.930042ms)
✔ phase76: plan returns templateVersion from active template (4.189625ms)
✔ phase77: create segment enforces unique key (1.594583ms)
✔ phase77: list active segments returns active only (1.28925ms)
✔ phase78: ops_readonly includes saved segments dropdown (0.68825ms)
✔ phase79: audit log contains run and plan snapshots (108.066792ms)
✔ phase79: docs exist with required headings (1.371625ms)
✔ phase79: execute returns runId (5.005958ms)
✔ phase80: cursor sign/verify roundtrip (1.42825ms)
✔ phase80: list rejects tampered signed cursor (1.776ms)
✔ phase81: dry-run appends audit log (2.640958ms)
✔ phase81: dry-run has no side effects (3.879084ms)
✔ phase82: confirm token verifies with matching payload (0.876916ms)
✔ phase82: confirm token rejects mismatch (2.521958ms)
✔ phase83: ops_readonly includes dry-run flow (1.020666ms)
✔ phase84: docs exist with required headings (1.256ms)
✔ phase85: automation_runs repo create/patch/get (1.056584ms)
✔ phase86: batching updates progress cursor (15.6745ms)
✔ phase86: rate limit applied with sleep (0.477333ms)
✔ phase87: no retry on validation error (0.637958ms)
✔ phase87: retry transient errors (0.5915ms)
✔ phase88: partial failure yields DONE_WITH_ERRORS (10.717042ms)
✔ phase89: aborted run records ops state (14.9165ms)
✔ phase89: breaker aborts on 429 storm (13.96625ms)
✔ phase90: run status route returns run (4.025167ms)
✔ phase91: audit logs appended on start/done/abort (16.451167ms)
✔ phase92: docs exist with required headings (0.489708ms)
✔ phaseLLM1: allow list blocks extra fields (0.573042ms)
✔ phaseLLM1: allow list passes and filters (0.696708ms)
✔ phaseLLM1: feature flag disabled by default (0.430875ms)
✔ phaseLLM1: feature flag enabled values (0.086ms)
✔ phaseLLM1: feature flag rejects other values (0.07325ms)
✔ phaseLLM1: validate OpsExplanation schema (1.036875ms)
✔ phaseLLM1: validate NextActionCandidates schema (0.37325ms)
✔ phaseLLM1: validate FAQAnswer schema (0.219291ms)
✔ phaseLLM1: schema rejects direct URL in FAQ answer (0.158084ms)
✔ phaseLLM2: ops_readonly renders llm explanation section (1.273916ms)
✔ phaseLLM2: explanation fallback when LLM disabled (3.633667ms)
✔ phaseLLM2: accepts valid LLM explanation when enabled (0.8025ms)
✔ phaseLLM2: invalid LLM output falls back (0.380458ms)
✔ phaseLLM3: ops_readonly includes next action candidates section (1.825875ms)
✔ phaseLLM3: fallback when LLM disabled (3.196291ms)
✔ phaseLLM3: accepts valid LLM candidates when enabled (0.685625ms)
✔ phaseLLM3: invalid LLM candidates fallback (0.264ms)
✔ phaseLLM4: block when LLM disabled (3.476875ms)
✔ phaseLLM4: accepts valid LLM answer with allowed citations (0.9375ms)
✔ phaseLLM4: citations required (0 citations => block) (0.323666ms)
✔ phaseLLM4: WARN link is blocked (0.327333ms)
✔ phaseLLM5: runbook and phase plan docs exist (0.975875ms)
✔ phaseLLM6: allow-list blocks out-of-scope secret field (0.603791ms)
✔ phaseLLM6: restricted category is blocked when not allowed (0.212625ms)
✔ phaseLLM6: audit appends traceId for generated and blocked outcomes (5.230167ms)
✔ phaseLLM6: dual gate blocks when db flag is false (3.044292ms)
✔ phaseLLM6: dual gate blocks when env flag is false (0.325416ms)
✔ phaseLLM6: dual gate allows when db+env are true (0.653084ms)
✔ phaseLLM6: faq blocks when KB has no candidate (6.431417ms)
✔ phaseLLM6: faq blocks when citations are zero (3.604709ms)
✔ phaseLLM6: faq blocks direct URL in answer (3.681875ms)
✔ phaseLLM6: faq blocks WARN link (0.495584ms)
✔ phaseLLM6: llmEnabled defaults false and can be persisted (0.876958ms)
✔ phaseLLM6: faqArticlesRepo returns active locale-matched top scored rows (3.510792ms)
✔ phaseLLM6: faq output blocks when citations are missing (0.703625ms)
✔ phaseLLM6: faq output blocks direct URL (0.172375ms)
✔ phaseLLM6: next actions block invalid action (0.17875ms)
✔ phaseLLM6: llm config status/plan/set works with confirm token (53.182959ms)
✔ taxonomy: contact_source_required → CONTACT_SOURCE_REQUIRED (0.481042ms)
✔ taxonomy: kb_schema_invalid → KB_SCHEMA_INVALID (0.078083ms)
✔ taxonomy: llm_api_error → LLM_API_ERROR (0.056917ms)
✔ taxonomy: llm_timeout → LLM_API_ERROR (0.054333ms)
✔ taxonomy: adapter_missing → LLM_API_ERROR (0.056542ms)
✔ taxonomy: existing entries still correct (0.057667ms)
✔ taxonomy: unknown reason → UNKNOWN (0.061625ms)
✔ taxonomy: llm_disabled with nullOnDisabled=true → null (0.048333ms)
✔ handleCreate: missing x-actor → 400 (0.844833ms)
✔ handleCreate: invalid article body → 422 with errors (0.603708ms)
✔ handleCreate: valid article → 200 with id (1.186875ms)
✔ handleList: returns articles → 200 (1.459959ms)
✔ handleUpdate: valid patch → 200 with id (0.2875ms)
✔ handleDelete: soft deletes article → 200 with id (2.058584ms)
✔ validateKbArticle: all required fields → valid (0.84225ms)
✔ validateKbArticle: missing status → invalid (0.161875ms)
✔ validateKbArticle: invalid status → invalid (0.069541ms)
✔ validateKbArticle: missing riskLevel → invalid (0.070833ms)
✔ validateKbArticle: invalid riskLevel → invalid (0.728958ms)
✔ validateKbArticle: missing both version and versionSemver → invalid (0.11125ms)
✔ validateKbArticle: versionSemver only (no version) → valid (0.069458ms)
✔ validateKbArticle: invalid semver string → invalid (0.057583ms)
✔ validateKbArticle: missing validUntil → invalid (0.080333ms)
✔ validateKbArticle: validUntil null → invalid (0.109334ms)
✔ validateKbArticle: allowedIntents undefined → invalid (0.080167ms)
✔ validateKbArticle: allowedIntents null → invalid (0.050792ms)
✔ validateKbArticle: allowedIntents empty array [] → valid (all intents allowed) (0.051708ms)
✔ validateKbArticle: multiple errors returned (0.054ms)
✔ search strict: article without riskLevel is rejected by validateKbArticle (0.842083ms)
✔ search strict: article without allowedIntents is rejected by validateKbArticle (0.142042ms)
✔ search strict: normalizeRiskLevel(undefined) → invalid (null), not defaulted to low (0.081084ms)
✔ search strict: allowedIntents=[] is valid (all intents allowed) (0.059167ms)
✔ search strict: allowedIntents with entries is valid (0.070666ms)
✔ llmClient: throws when OPENAI_API_KEY is not set (2.631584ms)
✔ llmClient: throws when OPENAI_API_KEY is missing entirely (0.161458ms)
✔ llmClient: throws llm_api_error on HTTP non-200 response (0.171292ms)
✔ llmClient: throws llm_api_error on empty response content (0.142833ms)
✔ llmClient: throws llm_api_error on non-JSON response content (0.145583ms)
✔ llmClient: returns { answer, model } on successful response (1.638125ms)
✔ llmClient: uses OPENAI_MODEL env var when set (0.6225ms)
✔ llmClient: defaults to gpt-4o-mini when OPENAI_MODEL not set (0.339291ms)
✔ llmClient: sends Authorization header with Bearer token (0.359458ms)
✔ llmClient: uses json_object response_format (0.484417ms)
✔ llmClient: exports explainOps method (0.444625ms)
✔ llmClient: exports suggestNextActionCandidates method (0.068541ms)
✔ llmClient.explainOps: throws when OPENAI_API_KEY is not set (0.351667ms)
✔ llmClient.suggestNextActionCandidates: throws when OPENAI_API_KEY is not set (0.113083ms)
✔ llmClient: callOpsExplain returns { answer, model } on success (1.656875ms)
✔ llmClient: callNextActionCandidates returns { answer, model } on success (0.538208ms)
✔ getNextActionCandidates: returns ok:true with fallback when LLM disabled (5.014291ms)
✔ getNextActionCandidates: fallback includes up to 3 candidates with abstract actions only (0.286459ms)
✔ getNextActionCandidates: response includes nextActionTemplate (next_actions_template_v1) (0.201875ms)
✔ getNextActionCandidates: uses llmAdapter.suggestNextActionCandidates when LLM enabled (0.583ms)
✔ getNextActionCandidates: falls back when adapter_missing (0.294084ms)
✔ getNextActionCandidates: LLM output with invalid action is filtered out (0.267792ms)
✔ getNextActionCandidates: includes disclaimer in response (0.1725ms)
✔ getNextActionCandidates: throws when lineUserId is missing (0.273625ms)
✔ getOpsExplanation: returns ok:true with fallback when LLM disabled (5.626167ms)
✔ getOpsExplanation: response includes opsTemplate (ops_template_v1) (0.339125ms)
✔ getOpsExplanation: response includes opsHealthTemplate (ops_health_template_v1) (0.272542ms)
✔ getOpsExplanation: uses llmAdapter.explainOps when LLM enabled (2.650709ms)
✔ getOpsExplanation: falls back when adapter_missing (no llmAdapter in deps) (0.381166ms)
✔ getOpsExplanation: falls back on LLM timeout (4.690375ms)
✔ getOpsExplanation: includes disclaimer in response (1.212542ms)
✔ getOpsExplanation: throws when lineUserId is missing (0.904375ms)
✔ consent status: returns guideModeLocked=false when lawfulBasis is not consent (7.333667ms)
✔ consent status: guideModeLocked=true when lawfulBasis=consent and unverified (0.137166ms)
✔ consent status: guideModeLocked=false when lawfulBasis=consent and verified (0.093833ms)
✔ consent verify: sets consentVerified=true when lawfulBasis=consent (0.182875ms)
✔ consent verify: returns 409 when lawfulBasis is not consent (0.092666ms)
✔ consent verify: returns 409 when lawfulBasis is unspecified (0.0715ms)
✔ consent verify: audit log is written on success (0.1335ms)
✔ consent verify: audit log is written on failure (wrong lawfulBasis) (0.089625ms)
✔ consent revoke: sets consentVerified=false regardless of lawfulBasis (0.137959ms)
✔ consent revoke: guideModeLocked=false when lawfulBasis is not consent (0.824708ms)
✔ consent revoke: audit log is written (0.120083ms)
✔ consent status: returns 400 when x-actor header is missing (0.073458ms)
✔ consent verify: returns 400 when x-actor header is missing (0.063292ms)
✔ ops explain: consent_missing blocks LLM when lawfulBasis=consent and unverified (5.029708ms)
✔ ops explain: LLM available after consent verified (lawfulBasis=consent, consentVerified=true) (0.698833ms)
✔ ops explain: LLM available with legitimate_interest (no consent needed) (0.322792ms)
✔ ops explain: llmStatus=disabled overrides consent when LLM flag is off (0.26075ms)
✔ next actions: consent_missing blocks LLM when lawfulBasis=consent and unverified (0.620042ms)
✔ next actions: LLM available after consent verified (0.376417ms)
✔ next actions: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.285709ms)
✔ ops explain: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (1.812625ms)
✔ recordUserLlmConsent: accept returns ok with accepted status (0.862ms)
✔ recordUserLlmConsent: revoke returns ok with revoked status (0.103ms)
✔ recordUserLlmConsent: throws when lineUserId missing (0.284542ms)
✔ recordUserLlmConsent: throws when lineUserId is not a string (1.83625ms)
✔ recordUserLlmConsent: audit log written on accept with correct action (0.529458ms)
✔ recordUserLlmConsent: audit log written on revoke with correct action (0.29675ms)
✔ recordUserLlmConsent: uses default LLM_CONSENT_VERSION when consentVersion omitted (0.406ms)
✔ recordUserLlmConsent: accepts custom consentVersion (0.254458ms)
✔ recordUserLlmConsent: default actor is line_user (0.104291ms)
✔ recordUserLlmConsent: audit failure does not throw (best-effort) (0.159833ms)
✔ userConsentsRepo: setUserLlmConsent accept stores accepted status (0.60375ms)
✔ userConsentsRepo: setUserLlmConsent revoke stores revoked status (0.123375ms)
✔ userConsentsRepo: getUserLlmConsent returns null for unknown user (0.107291ms)
✔ userConsentsRepo: getUserLlmConsent returns accepted record (0.107416ms)
✔ userConsentsRepo: getUserLlmConsent normalizes unknown status to pending (0.092125ms)
✔ userConsentsRepo: setUserLlmConsent throws on missing lineUserId (0.294375ms)
✔ userConsentsRepo: setUserLlmConsent uses default version when omitted (0.914125ms)
✔ userConsentsRepo: merge preserves existing fields (0.261334ms)
✔ webhook: "AI同意" command replies with consent confirmation (1.62225ms)
✔ webhook: "LLM同意" command replies with consent confirmation (0.232792ms)
✔ webhook: "AI拒否" command replies with revoke confirmation (0.217209ms)
✔ webhook: "LLM拒否" command replies with revoke confirmation (0.171333ms)
✔ webhook: consent command does not produce membership error reply (0.392333ms)
✔ webhook: unrelated text does not trigger consent handler (0.838333ms)
✔ webhook: consent handler stores consent status in user_consents collection (0.256417ms)
✔ webhook: AI拒否 stores revoked status in user_consents collection (0.176959ms)
✔ security: admin pages avoid unsafe HTML injection primitives (1.845417ms)
✔ security: automation config set requires valid confirmToken and writes audit on mismatch (39.208917ms)
✔ security: system config set requires valid confirmToken and writes audit on mismatch (43.311083ms)
✔ security: system config impactPreview includes cap breakdown fields (35.528291ms)
✔ security: system config plan succeeds when notificationCaps are all null (4.317791ms)
✔ security: system config impactPreview respects deliveryCountLegacyFallback mode (3.319209ms)
✔ security: system config impactPreview skips delivery counters during active quietHours (2.295625ms)
✔ security: system config notificationCaps roundtrip and fallback (40.013625ms)
✔ security: cookie-auth state-changing requests require same-origin (CSRF guard) (31.292208ms)
✔ security: delivery backfill execute requires valid confirmToken (39.102667ms)
✔ security: delivery recovery execute requires valid confirmToken and seals delivery (38.615792ms)
✔ security: ops_readonly.html avoids innerHTML for dynamic data (XSS regression) (0.713833ms)
✔ security: /admin/* is protected by ADMIN_OS_TOKEN (cookie login) (24.23075ms)
✔ security: /api/phaseLLM4/faq/answer is protected by admin token (34.239708ms)
✔ security: redac membership id is not stored in plaintext (2.284625ms)
ℹ tests 1053
ℹ suites 0
ℹ pass 1033
ℹ fail 20
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14447.268458

✖ failing tests:

test at tests/phase127/phase127_last_reaction_at.test.js:33:1
✖ phase127: lastReactionAt prefers clickAt over readAt (19.91475ms)
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
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.665041ms)
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
✖ phase308: top3 analytics hotspots use explicit bounded limits (5.985791ms)
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
✖ phase310: repo-map check mode passes when generated artifact is current (109.38925ms)
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
✖ phase315: cleanup check script passes when generated artifacts are current (108.316875ms)
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
✖ phase317: notification operational summary uses bounded range query with legacy fallback (4.61725ms)
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
✖ phase319: user operational summary uses range-first events/deliveries with fallback (3.458542ms)
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
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (11.719708ms)
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
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (3.312291ms)
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
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.428125ms)
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
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.268125ms)
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
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.436959ms)
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
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.350583ms)
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
✖ phase358: notification summary collects notification ids and queries scoped events first (3.940125ms)
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
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (3.395834ms)
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
✖ phase372: read path budgets include current baseline section for phase372 (3.225042ms)
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
✖ phase372: launch checklist includes product-readiness API checks (4.334292ms)
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
✖ admin summaries: users and notifications (7.493667ms)
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
✖ phase5 ops filters: date range (4.862541ms)
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
✖ getUserStateSummary: returns read-only state (7.632416ms)
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
