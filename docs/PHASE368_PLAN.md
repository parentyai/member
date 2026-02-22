# PHASE368_PLAN

## 目的
Phase368 の read-path 収束タスクを add-only で実装し、既存互換を維持する。

## スコープ
- Phase368 対象の route/usecase/repo/ui/scripts
- tests/phase368/*
- docs/SSOT_INDEX.md

## 受入条件
- Phase368 の契約テストが PASS する。
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

✔ auditLogsRepo: append writes createdAt (0.939292ms)
✔ auditLogsRepo: append respects provided createdAt (0.180042ms)
✔ recordClickAndRedirect: marks click and returns url (1.051084ms)
✔ recordClickAndRedirect: blocks WARN link (0.500125ms)
✔ killSwitch: default false, set true (0.718042ms)
✔ linkRegistryRepo: setHealth stores WARN state (1.192667ms)
✔ linkRegistryRepo: delete removes link (0.218666ms)
✔ createNotification: stores draft notification (1.074834ms)
✔ createNotification: stores normalized notificationCategory (0.271875ms)
✔ sendNotification: creates deliveries for matching users (1.439959ms)
✔ listNotifications: filters by scenarioKey (0.340125ms)
✔ notificationsRepo: create -> list with filter (3.935333ms)
✔ phase0 smoke (0.401792ms)
✔ testSendNotification: creates delivery after push (5.6075ms)
✔ testSendNotification: blocked when kill switch ON (0.418667ms)
✔ usersRepo: create -> get -> update (0.839459ms)
✔ validateSingleCta: accepts single CTA text (0.472458ms)
✔ validateSingleCta: rejects missing CTA text (0.230375ms)
✔ validateSingleCta: rejects multiple CTAs (0.075875ms)
✔ validateLinkRequired: requires linkRegistryId (0.078041ms)
✔ validateLinkRequired: rejects direct URL (0.069958ms)
✔ validateWarnLinkBlock: blocks WARN state (0.073ms)
✔ validateKillSwitch: blocks when ON (0.084666ms)
✔ validateNotificationPayload: passes when all checks ok (0.604ms)
✔ webhook: valid signature creates user (1.516917ms)
✔ webhook: invalid signature rejected (0.203ms)
✔ sendWelcomeMessage: sends once and records delivery (1.058041ms)
✔ webhook: welcome send is invoked for new user (0.978875ms)
✔ admin notifications: scenario only targeting (step ignored) (5.273417ms)
✔ admin notifications: linkRegistryId required (0.296958ms)
✔ admin notifications: events best-effort does not block (0.351334ms)
✔ checklistsRepo: create -> get -> list (1.222334ms)
✔ events integration: open requires notificationId (0.897208ms)
✔ events integration: click requires notificationId (0.154417ms)
✔ events integration: complete requires checklistId + itemId (1.333792ms)
✔ eventsRepo: create event (0.947959ms)
✔ eventsRepo: missing required fields throws (0.291542ms)
[phase1] checklist skipped: missing step
✔ getChecklistForUser: returns checklists for scenario/step (1.669084ms)
✔ getChecklistForUser: missing step returns empty (1.473167ms)
✔ logEventBestEffort: enforces type constraints (5.135583ms)
✔ phase1 smoke: notify -> delivery -> checklist -> events (3.785625ms)
✔ toggleChecklistItem: upserts and sets completedAt (0.876708ms)
✔ toggleChecklistItem: event failure does not block (1.452125ms)
✔ userChecklistsRepo: upsert -> get -> list (1.229166ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase101: ops assist suggestion includes suggestion/evidence/safety (18.54225ms)
✔ phase102: ops assist input shape is stable (0.898125ms)
✔ phase103: guard blocks invalid suggestion (0.48625ms)
✔ phase103: not ready forces STOP (0.525125ms)
✔ phase104: audit written for ok and block (0.506ms)
✔ phase105: adopt audit appended (1.311583ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
✔ phase106: llm disabled by default falls back to rules (19.516667ms)
✔ phase107: docs exist with required headings (0.945625ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=4c2403e65e0f52deb78b100065fee2bacb749904089644b18496cd844796da0a model=ops-assist-rules opsAssistInputHash=8768d728731372b0066e50a96cb49c943183629775f5ddf0ef8a23fc24d20d19 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U2 cacheHit=false inputHash=537233774f4b2f34de6ccc98996ddc0a704dd593447e713540ebb30150aa64e9 model=ops-assist-rules opsAssistInputHash=de2515a1df72528e84478ec4b8578df7577abf68ac5a24aa8d9724739c30cee3 refreshReason=cache_miss
[OBS] action=ops_assist_suggest result=ok lineUserId=U3 cacheHit=false inputHash=70545ed0e9df1da70262da904475327f4e394fff62173bafb85085c3a3802d9b model=ops-assist-rules opsAssistInputHash=b0bb3a28bf10ada05df4241e6146d5a9cd995efb995eb50929d8c585f2f9e6b9 refreshReason=cache_miss
✔ phase108: suggest -> adopt -> submit audit flow (12.541083ms)
✔ phase117: resolve automation targets respects config filters (3.034917ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase118: suggestion schema is fixed (2.833958ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=76f759f185398c95cba0d76b6c48eaeecf61de0768d665fb5f6183e5b34852ce model=ops-assist-rules opsAssistInputHash=4f6cfc40625787cc2a4c46a9a1303d167f889dd67fb3f968accff774990de900 refreshReason=cache_miss
✔ phase119: audit append on suggestion includes notificationId (4.890667ms)
✔ implementation targets: single fixed entry (0.399833ms)
✔ implementation targets acceptance: fixed single IN target (0.572667ms)
✔ implementation targets acceptance: query does not change result (0.120708ms)
✔ implementation targets api: returns fixed registry (2.529625ms)
✔ ops readonly ui includes implementation targets section (0.712375ms)
✔ phase120: decision log stores source + suggestion snapshot (1.053375ms)
✔ phase121: ops notice send flow writes delivery and audit (12.828958ms)
✔ phase122: ops console view includes suggestion and audit id (0.554708ms)
✔ phase123: killSwitch blocks ops assist suggestion (0.695708ms)
✔ phase124: docs exist with required headings (0.802916ms)
[webhook] requestId=a963c54b-fff4-4dc2-bb40-6d34e8375c35 accept
[OBS] action=webhook result=ok requestId=a963c54b-fff4-4dc2-bb40-6d34e8375c35 lineUserId=U1
✔ phase125: SERVICE_MODE=webhook is webhook-only (+ appends webhook events) (41.24575ms)
✔ phase125: logLineWebhookEvents writes minimal schema (type + ref) (0.67ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
[OBS] action=click result=ok requestId=unknown deliveryId=auto_1 linkRegistryId=l1
✔ phase126: existing POST /track/click still redirects and records clickAt (38.231917ms)
[OBS] action=click_post_compat result=reject requestId=unknown
✔ phase126: POST /track/click can be disabled via TRACK_POST_CLICK_ENABLED=0 (3.489416ms)
[OBS] action=click-write result=ok deliveryId=auto_1 ctaText=openA linkRegistryId=l1
✔ phase126: GET /t/{token} records clickAt + stats and redirects (29.684917ms)
✔ phase126: tampered token is rejected and does not write clickAt/stats (43.34775ms)
✔ phase126: expired token is rejected and does not write clickAt/stats (12.76775ms)
✔ phase127: docs exist with reaction definitions (0.615208ms)
✖ phase127: lastReactionAt prefers clickAt over readAt (17.307375ms)
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.723292ms)
✔ phase127: lastReactionAt is null when both clickAt/readAt missing (0.332125ms)
✔ phase128: stable ordering is deterministic and follows SSOT sort spec (1.35ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase129: ops console view appends audit_logs with traceId (12.105292ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase130: NO_ACTION submit appends decision_logs + audit_logs (no execution) (1.955083ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase131: ops console includes add-only display fields (LINE-only reaction + execution message) (12.495292ms)
✔ phase132: kill switch blocks STOP_AND_ESCALATE (no send side effect) (3.040791ms)
✔ phase132: ops_readonly.html sets x-actor header to avoid actor=unknown (0.721958ms)
✔ phase132: execute fills traceId from existing decision audit when payload traceId missing (6.762166ms)
✔ phase133: GET /api/admin/trace returns audits/decisions/timeline for traceId (73.591125ms)
✔ phase134: run_trace_smoke.js completes with zero side effects and outputs trace bundle shape (138.36725ms)
✔ phase134: run_trace_smoke.js exits non-zero on failure (39.523375ms)
✔ phase135: runbook and ssot index exist with required headings (0.935625ms)
✔ phase137: notification reaction summary aggregates deliveries deterministically (2.915333ms)
✔ phase137: ctr is 0 when sent is 0 (0.356625ms)
✔ phase138: read model includes add-only reactionSummary + notificationHealth without breaking existing keys (7.158041ms)
✔ phase138: reactionSummary always exists even when no deliveries (2.477834ms)
✔ phase139: notification health evaluation thresholds are fixed (0.450459ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase140: ops console includes notificationHealthSummary + topUnhealthyNotifications (add-only) (4.043167ms)
✔ phase141: suggests mitigation when health is bad (0.512792ms)
✔ phase141: returns null when no unhealthy notifications (0.079083ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
✔ phase142: trace bundle includes notification_mitigation.decision audit + decision log snapshot (2.377125ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_3 failure_class=PASS nextAction=NO_ACTION
✔ phase145: audit logs cover view/suggest/decision/execute via single traceId (6.515333ms)
✔ phase150: RUNBOOK_OPS exists with required headings (0.691459ms)
✔ phase158: LAUNCH_CHECKLIST exists with required headings (1.716709ms)
✔ phase153: run_ops_smoke.js completes with guarded execute and trace bundle coverage (91.761ms)
✔ phase160: checkNotificationCap passes includeLegacyFallback=false to delivery counters (5.331042ms)
✔ phase160: checkNotificationCap defaults includeLegacyFallback=true (0.176208ms)
✔ phase160: checkNotificationCap skips delivery counters during active quietHours (0.141ms)
✔ phase160: checkNotificationCap uses snapshot counter when available (0.13825ms)
✔ phase160: deliveredAt backfill summary + apply (14.78925ms)
✔ phase160: delivery count uses deliveredAt and falls back to legacy sentAt (6.210875ms)
✔ phase160: notification caps normalize accepts extended fields (1.091583ms)
✔ phase160: notification caps block during quiet hours (0.212542ms)
✔ phase160: notification caps block when category is required but missing (0.082125ms)
✔ phase160: notification caps block per user daily before weekly (0.071666ms)
✔ phase160: notification caps normalize defaults to null (1.00625ms)
✔ phase160: notification caps reject invalid values (0.22025ms)
✔ phase160: notification caps block when delivered count reaches cap (0.20575ms)
✔ phase160: notification policy is no-op when servicePhase/preset are unset (0.789458ms)
✔ phase160: notification policy allows phase1 presetA immediate action (0.174459ms)
✔ phase160: notification policy blocks disallowed category (0.070167ms)
✔ phase160: SSOT docs exist for servicePhase and notificationPreset (1.981708ms)
✔ phase160: servicePhase/preset getters return null when unset (1.081125ms)
✔ phase160: servicePhase/preset setters validate and persist (2.036458ms)
✔ phase161: admin pages include x-actor headers (2.201917ms)
✔ phase161: execute is blocked when per-user weekly cap is exceeded (13.74675ms)
✔ phase161: execute failure writes notifications.send.execute audit with ok=false (9.968916ms)
✔ phase161: composer flow draft -> approve -> plan -> execute (no real send) (5.432041ms)
✔ phase161: partial send failure -> rerun executes remaining only (no double-send) (8.720167ms)
✔ phase161: execute is blocked when category is disallowed by servicePhase/preset (6.283375ms)
✔ phase161: docs exist for admin UI OS + data model + runbook (1.185334ms)
✔ redac membership: happy path links and persists hash+last4 (4.111917ms)
✔ redac membership: duplicate (linked to another user) is rejected (3.296875ms)
✔ redac membership: invalid format returns invalid_format (0.232291ms)
✔ redac membership: non-command message is noop (0.254292ms)
✔ redac membership: usage guidance when command prefix has no payload (0.172833ms)
✔ redac membership: usage guidance when help keyword is used (0.196125ms)
✔ redac membership: same user can replace their redac id (releases previous id) (0.338417ms)
✔ ops readonly ui includes Redac status display label (0.690334ms)
✔ admin redac unlink: happy path removes link and clears user fields (7.630667ms)
✔ admin redac unlink: not found returns 404 (0.309875ms)
✔ admin redac unlink: invalid format returns 400 (0.196292ms)
✔ phase164: LINE command "会員ID 確認" replies with status (last4 only) (3.684208ms)
✔ phase164: LINE command prefix without payload replies usage guidance (2.519916ms)
✔ phase164: redac line message templates include next action guidance (0.4715ms)
✔ phase170: deploy workflow supports stg/prod environment split (0.827ms)
✔ phase170: deploy-webhook workflow supports stg/prod environment split (0.297458ms)
✔ phase170: deploy-track workflow supports stg/prod environment split (0.259875ms)
✔ phase171: parseArgs reads env defaults and supports skip flags (0.710208ms)
✔ phase171: parseArgs requires admin token (0.289583ms)
✔ phase171: buildTraceId is stable format (3.71725ms)
✔ phase171: evaluateExitCode treats skip as failure in strict mode (0.304542ms)
✔ phase171: markdown summary includes scenario status and trace (0.423333ms)
✔ phase171: normalizeNotificationCaps and buildActiveQuietHours are add-only safe (0.490875ms)
✔ phase171: resolveOutFile uses default artifacts directory (2.110125ms)
✔ phase173: master ui renders impact preview risk and breakdown labels (2.237125ms)
✔ phase173: master ui includes delivery recovery operation guidance (1.119916ms)
✔ phase174: all redac reply templates include explicit next action phrase (0.517875ms)
✔ phase177: redac status route returns sampled consistency summary (40.495958ms)
✔ phase177: master ui includes redac health section and status endpoint call (0.406709ms)
✔ phase178: deploy workflow grants runtime SA secret accessor for member secrets (2.199667ms)
✔ phase178: deploy-webhook workflow grants runtime SA secret accessor for webhook secrets (0.553709ms)
✔ phase178: deploy-track workflow grants runtime SA secret accessor for track token secret (0.278ms)
✔ phase179: notification routes include structured route_error logging + trace/request in 500 payload (0.734375ms)
✔ phase179: logRouteError emits sanitized structured line (10.511708ms)
✔ phase180: parseArgs accepts route_error options (1.876709ms)
✔ phase180: parseArgs rejects fetch-route-errors without project id (0.363375ms)
✔ phase180: buildRouteErrorLoggingFilter contains route_error prefix and trace id (0.12225ms)
✔ phase180: fetchRouteErrors parses gcloud output lines (0.63975ms)
✔ phase180: markdown summary prints route_error capture status (0.160459ms)
✔ phase181: deploy workflow requires explicit prod confirmation (0.563625ms)
✔ phase181: deploy-webhook workflow requires explicit prod confirmation (0.113458ms)
✔ phase181: deploy-track workflow requires explicit prod confirmation (0.095208ms)
✔ phase182: deploy workflow preflight validates required vars and secrets (1.987625ms)
✔ phase182: deploy-webhook workflow preflight validates required vars and secrets (0.2435ms)
✔ phase182: deploy-track workflow preflight validates required vars and secrets (0.10725ms)
✔ phase183: parseArgs enables fetchRouteErrors when fail-on-route-errors is set (0.614125ms)
✔ phase183: parseArgs rejects fail-on-route-errors without project id (0.282958ms)
✔ phase183: strict gate marks PASS as FAIL when route_error is detected (0.096583ms)
✔ phase183: strict gate keeps original reason for already failed scenario (0.065041ms)
✔ phase183: strict gate is no-op when strict mode is disabled (0.060834ms)
✔ phase184: stg notification e2e workflow is defined with required inputs (1.024916ms)
✔ phase184: stg notification e2e workflow runs proxy and strict route error gate (0.180292ms)
✔ phase184: stg notification e2e workflow uploads artifacts (0.243375ms)
✔ phase185: deploy workflow preflight separates missing from permission issues (0.577125ms)
✔ phase185: deploy-webhook workflow preflight separates missing from permission issues (0.12175ms)
✔ phase185: deploy-track workflow preflight separates missing from permission issues (0.095458ms)
✔ phase186: stg e2e workflow preflight separates missing from permission issues (0.780541ms)
✔ phase186: segment query accepts loose lineUserIds format (1.091792ms)
✔ phase187 t01: read-model keys required by monitor/read_model (5.5065ms)
✔ phase188B: waitRule values produce nextWaitDays (5.367959ms)
✔ phase189: targetCountSource derives from plan audit (1.777166ms)
✔ phase190: cap count labels derived from execute audit (5.690583ms)
✔ phase191: SSOT read-model keys close loop to output + UI (2.372167ms)
✔ runPhase2Automation: dryRun does not write reports (2.483833ms)
✔ runPhase2Automation: writes reports when not dryRun (0.57725ms)
[OBS] action=click-write result=ok deliveryId=d1 ctaText=openA linkRegistryId=l1
✔ recordClickAndRedirect: track mode records stats (best-effort) and returns redirect url (3.0075ms)
✔ recordClickAndRedirect: member mode does not record stats unless explicitly enabled (0.623ms)
✔ phase201: ops/monitor/read_model include status summary panels (0.808209ms)
✔ phase202: composer shows plan target count label (0.582834ms)
✔ phase202: ops segment plan note includes count (0.306959ms)
✔ phase203: ops has list/detail sections (0.78175ms)
✔ phase203: monitor has drilldown detail panel (0.158ms)
✔ phase203: read-model has drilldown detail panel (0.113584ms)
✔ phase204: weekOverWeek delta is computed from deliveries (6.769334ms)
✔ phase205: plan returns capBlockedCount based on caps (5.278708ms)
✔ phase205: composer shows plan cap blocked count label (0.255291ms)
✔ phase206: dry-run stores run record and passes (5.878208ms)
✔ phase206: failure taxonomy mapping (0.495375ms)
✔ phase206: self-send uses sendNotification without status update (4.322541ms)
✔ phase206: GET /api/admin/user-timeline returns deliveries + trace (48.619917ms)
✔ phase207: /admin/app and /admin/ui-dict are protected by admin token (36.555958ms)
✔ phase207: /admin/app returns shell and /admin/ui-dict returns dictionary when token is present (15.965459ms)
✔ phase207: all ui.* keys used in /admin/app exist in ADMIN_UI_DICTIONARY_JA (7.079958ms)
✔ phase209: master ui includes llm config controls (0.82425ms)
✔ phase209: master ui wires llm config endpoints (2.276708ms)
[OBS] action=click-write result=ok deliveryId=auto_4 ctaText=openB linkRegistryId=auto_1
✔ phase21 t06: clickCount increments for openB in day window (2.141ms)
✔ phase21 t12: accepts --track-base-url and does not emit trackBaseUrl required (39.405333ms)
✔ phase21 t12: missing track base url exits with trackBaseUrl required (39.60925ms)
✔ phase21 t15: missing track base url exits with code 2 (48.411041ms)
✔ phase21 t16: verify env does not emit VERIFY_ENV_ERROR after npm ci (8.873167ms)
✔ phase21 t17: GAC set exits with code 2 (36.230458ms)
✔ phase21 t17: allow-gac bypasses guard (7.475833ms)
{"trackBaseUrl":"https://example.com","fromUtc":"2026-02-22T00:00:00.000Z","toUtc":"2026-02-23T00:00:00.000Z","linkRegistryId":"l1"}
✔ phase21 t18: invalid_rapt classified as env error (8.441375ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT=1 (5.041708ms)
✔ testSendNotification: member mode records sent stats when PHASE18_CTA_EXPERIMENT is not enabled (0.191084ms)
✔ testSendNotification: member mode records sent stats when ENV_NAME=stg even if PHASE18_CTA_EXPERIMENT is not enabled (0.161042ms)
✔ testSendNotification: track mode records sent stats without experiment flag (0.137791ms)
✔ ctaStatsRepo: incrementSent writes sentCount field (0.351583ms)
✔ phase210: master ui includes llm faq validation section (0.773083ms)
✔ phase210: master ui wires admin llm faq endpoint (1.488ms)
✔ phase211: master ui includes llm ops explain / next actions section (0.857416ms)
✔ phase211: master ui wires llm ops endpoints (1.341958ms)
✔ phase212: admin app includes LLM nav and pane controls (1.732625ms)
✔ phase212: admin app wires LLM endpoints from pane actions (1.402125ms)
✔ phase213: admin app includes llm config controls in llm pane (1.110458ms)
✔ phase213: admin app wires llm config endpoints (0.842791ms)
✔ phase214: admin app includes llm audit drilldown button (2.583709ms)
✔ phase214: admin app wires llm trace to audit pane search (1.424084ms)
✔ phase215: admin app uses admin llm ops endpoints with legacy fallback (1.198125ms)
✔ phase215: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (84.675833ms)
✔ phase216: master llm ops panel uses admin endpoints first (1.909041ms)
✔ phase216: master llm ops panel keeps legacy fallback endpoints (0.763125ms)
✔ phase217: ops_readonly uses admin llm ops endpoints first (2.302333ms)
✔ phase217: ops_readonly keeps legacy llm ops fallback endpoints (0.378375ms)
✔ phase218: admin_app uses admin LLM endpoints first with legacy fallback (1.185583ms)
✔ phase218: master uses admin LLM endpoints first with legacy fallback (0.295416ms)
✔ phase218: ops_readonly uses admin LLM endpoints first with legacy fallback (0.307583ms)
✔ phase219: phaseLLM4 compat route appends deprecated metadata on blocked response (1.324458ms)
✔ phase219: phaseLLM4 compat route returns 400 on required/invalid parse errors (0.35775ms)
✔ phase22 t01: CTR calculation and delta (2.624709ms)
✔ phase22 t01: zero division yields 0 CTR (0.152083ms)
✔ phase22 t01: JSON structure keys (0.132708ms)
✔ phase22 t02: verify then kpi order with args (0.61075ms)
✔ phase22 t02: exit code mapping to env error (0.074792ms)
✔ phase22 t02: exit code mapping to runtime error (0.057916ms)
✔ phase22 t02: run executes verify then kpi (0.267ms)
✔ phase22 t03: PASS when totals meet thresholds (1.612333ms)
✔ phase22 t03: FAIL when totalSent insufficient (0.332666ms)
✔ phase22 t03: FAIL when deltaCTR below threshold (0.286709ms)
✔ phase22 t03: PASS when minDeltaCtr is 0 even if deltaCTR negative (0.37175ms)
✔ phase22 t03: FAIL when required key missing (0.352625ms)
✔ phase22 t03: FAIL on JSON parse error (0.222709ms)
✔ phase22 t03: stdin read error yields env error code (1.203542ms)
✔ phase22 t04: PASS when gate exitCode=0 (3.171375ms)
✔ phase22 t04: FAIL when gate exitCode=1 (0.447583ms)
✔ phase22 t04: VERIFY_ENV_ERROR when gate exitCode=2 (0.343542ms)
✔ phase22 t04: snapshot throws => FAIL (0.188375ms)
✔ phase22 t04: runner throws => FAIL (0.096417ms)
✔ phase22 t05: upsertSnapshot sets createdAt serverTimestamp (0.729ms)
✔ phase22 t05: upsertSnapshot uses merge true (0.157958ms)
✔ phase22 t05: no --write keeps exitCode and does not call repo (0.916041ms)
✔ phase22 t05: --write 1 calls repo and keeps exitCode on error (0.274083ms)
✔ phase22 t06: defaults return JSON (0.624709ms)
✔ phase22 t06: repo error yields LIST_ENV_ERROR exitCode=2 (0.166625ms)
✔ phase22 t06: limit and order applied (1.222833ms)
✔ phase22 t06: cta filters applied (0.303ms)
✔ phase22 t07: PASS returns exitCode 0 and no record on dry-run (1.168875ms)
✔ phase22 t07: write=1 calls record after pass (0.318ms)
✔ phase22 t07: FAIL bubbles exitCode 1 (0.735625ms)
✔ phase22 t07: VERIFY_ENV_ERROR bubbles exitCode 2 (0.117667ms)
✔ phase22 t07: runner exception returns exitCode 1 (0.158791ms)
✔ phase22 t08: workflow files exist and include runner (0.924708ms)
(node:93656) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase22/phase22_t10a_workflow_artifact_always.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase22 t10a: dryrun workflow uploads artifacts always (0.547083ms)
✔ phase22 t10a: write workflow uploads artifacts always (0.105042ms)
✔ phase22 t11: FAIL output includes reasonCode (1.36425ms)
✔ phase22 t12: INVALID_ARGS when required args missing (2.709458ms)
✔ phase22 t12: SUBPROCESS_EXIT_NONZERO when kpi+gate present (0.612708ms)
✔ phase22 t12: RUNTIME_ERROR when runAndGate throws (0.13325ms)
✔ phase22 t13: dryrun workflow uploads artifacts and writes summary (0.562834ms)
✔ phase22 t13: write workflow uploads artifacts and writes summary (0.121458ms)
✔ phase22 t14: dryrun workflow contains failure_class rules (0.615667ms)
✔ phase22 t14: write workflow contains failure_class rules (0.103625ms)
✔ phase22 t16: invalid_rapt => ENV classification (1.456541ms)
✔ phase22 t16: firebase-admin missing => ENV classification (0.187875ms)
✔ phase22 t16: generic stderr => IMPL classification (0.11275ms)
✔ phase22 t16: empty stderr => UNKNOWN classification (0.130667ms)
✔ phase22 t18: stderr is captured on exitCode!=0 (3.639208ms)
✔ phase22 t18: empty stderr yields zero bytes and capture=empty (0.230375ms)
✔ phase22 t18: spawn error yields SPAWN_ERROR signature (0.125334ms)
✔ phase22 t20: dryrun workflow provides FIRESTORE_PROJECT_ID (0.493958ms)
✔ phase22 t20: write workflow provides FIRESTORE_PROJECT_ID (0.077834ms)
✔ phase22 t22: ok=true payload includes required keys (2.471541ms)
✔ phase22 t22: stderr present yields head and bytes (0.13525ms)
✔ phase22 t22: stderr empty yields (empty) head and 0 bytes (0.073792ms)
✔ phase220: /api/admin/llm/faq/answer is protected by admin token (fail-closed) (66.075083ms)
✔ phase221: /api/admin/llm/config/* require admin token (fail-closed) (64.799458ms)
✔ phase222: /api/admin/llm/config/* require x-actor when admin token is provided (69.00525ms)
✔ phase223: /api/admin/llm/faq/answer does not require x-actor (admin token provided) (66.541542ms)
✔ phase224: admin/master LLM FAQ request uses buildHeaders (x-actor included) (0.692625ms)
✔ phase224: admin/app LLM FAQ request uses buildHeaders (x-actor included) (0.536ms)
✔ phase225: admin llm faq audit actor uses x-actor header when provided (61.4695ms)
✔ phase226: /api/admin/llm/ops-explain and /api/admin/llm/next-actions require admin token (fail-closed) (88.971584ms)
✔ phase227 t01: /api/admin/llm/ops-explain passes x-actor to usecase params (17.392959ms)
✔ phase227 t02: /api/admin/llm/next-actions passes x-actor to usecase params (17.361916ms)
✔ phase227 t03: ops-explain audit actor follows params.actor (no llm) (4.772125ms)
✔ phase227 t04: next-actions audit actor follows params.actor (no llm) (3.473ms)
✔ phase228: /api/phaseLLM2/ops-explain and /api/phaseLLM3/ops-next-actions require admin token (fail-closed) (53.124958ms)
✔ phase229: faq blocks when high-risk article has no contact source (6.040334ms)
✔ phase229: faq blocks when high-risk citation omits contact source (0.869209ms)
✔ phase229: faq passes when high-risk citation includes contact source (0.354792ms)
✔ phase229: faqArticlesRepo excludes expired validUntil and FAQ-disallowed intents (7.608916ms)
(node:93679) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t01_workflow_oidc_auth.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t01: dryrun workflow includes OIDC auth and setup-gcloud (0.438042ms)
✔ phase23 t01: write workflow includes OIDC auth and setup-gcloud (0.071167ms)
(node:93680) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t02_workflow_summary_keys.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t02: dryrun workflow summary includes required keys (0.450292ms)
✔ phase23 t02: write workflow summary includes required keys (0.088125ms)
(node:93681) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t03_workflow_human_decision_hint.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t03: dryrun workflow includes humanDecisionHint rules (0.4515ms)
✔ phase23 t03: write workflow includes humanDecisionHint rules (0.080333ms)
(node:93682) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t05_workflow_service_mode_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t05: dryrun workflow sets SERVICE_MODE=member (0.471542ms)
✔ phase23 t05: write workflow sets SERVICE_MODE=member (0.069ms)
(node:93683) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t06_workflow_verify_rest_env.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t06: dryrun workflow sets PHASE21_VERIFY_REST=1 (0.49275ms)
✔ phase23 t06: write workflow sets PHASE21_VERIFY_REST=1 (0.071959ms)
(node:93684) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_minimal_inputs.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: decision table uses minimal routing inputs (0.886375ms)
✔ phase23 t08: required observation keys match decision inputs (0.256208ms)
(node:93685) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t08_runbook_observation_keys_match_workflow.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t08: observation keys match workflow summary keys (1.05875ms)
(node:93686) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_decision_table_complete.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close decision table exists and has required columns (0.802292ms)
✔ phase23 t09: closeDecision values are CLOSE or NO_CLOSE (0.193708ms)
(node:93687) [MODULE_TYPELESS_PACKAGE_JSON] Warning: Module type of file:///Users/parentyai.com/Projects/Member/tests/phase23/phase23_t09_close_log_matches_runbook.test.js is not specified and it doesn't parse as CommonJS.
Reparsing as ES module because module syntax was detected. This incurs a performance overhead.
To eliminate this warning, add "type": "module" to /Users/parentyai.com/Projects/Member/package.json.
(Use `node --trace-warnings ...` to show where the warning was created)
✔ phase23 t09: close declaration includes phaseResult and closeDecision (0.427208ms)
✔ phase230: faq blocks when top score is below minimum confidence (6.163875ms)
✔ phase230: faq blocks when top1/top2 ratio is below threshold (0.414416ms)
✔ phase230: faq allows confident candidates to proceed (1.246625ms)
✔ phase230: faq repo ranking prefers keyword > synonym > tag matches (4.5905ms)
✔ phase231: faq includes disclaimer version in response and audit events (6.806458ms)
✔ phase231: faq blocked response still includes disclaimer and rendered audit (0.594084ms)
✔ phase231: ops explanation and next actions include disclaimer version and rendered audit (2.928584ms)
✔ phase232: /admin/app includes FAQ block UX panel elements (0.839292ms)
✔ phase232: /admin/master includes FAQ block UX panel elements (0.233875ms)
✔ phase232: admin app dictionary has block UX keys (0.762375ms)
✔ phase232: faq blocked payload includes category/actions/suggestions for kb_no_match (3.330417ms)
✔ phase232: faq blocked payload provides fallback actions and max-3 suggested FAQs (0.808916ms)
✔ phase233: next action candidates are abstract-only and sanitized to contract keys (3.168583ms)
✔ phase233: ops explanation includes fixed template sections (2.456042ms)
✔ phase234: FAQ blocks with consent_missing when lawfulBasis=consent and consentVerified=false (4.475791ms)
✔ phase234: llm config plan/set supports llmPolicy snapshot and hash verification (37.362916ms)
✔ phase234: ops/next-actions audit payload includes llmPolicy snapshot fields (2.789042ms)
✔ phase235: checklist_guidance mode is allowed and returns answer when guard passes (3.776625ms)
✔ phase235: guide-only mode blocks free-chat mode (3.002458ms)
✔ phase235: personalization beyond allow-list is blocked (2.85175ms)
✔ phase24 t02: appendDecision sets decidedAt and createdAt serverTimestamp (1.037875ms)
✔ phase24 t02: appendDecision does not overwrite previous entries (0.194459ms)
✔ phase24 t02: getLatestDecision returns most recent by decidedAt (0.88975ms)
✔ phase24 t02: invalid decision enum is rejected (0.88725ms)
✔ phase24 t03: memberNumber missing => BLOCK (0.481833ms)
✔ phase24 t03: memberNumber stale => WARN (0.075167ms)
✔ phase24 t03: memberNumber ok => INFO (0.484625ms)
✔ phase24 t03: checklist incomplete => WARN (0.067666ms)
✔ phase24 t04: missing linkRegistryId => BLOCK (0.47425ms)
✔ phase24 t04: invalid ctaText => BLOCK (0.078667ms)
✔ phase24 t04: missing deliveries => WARN (0.071041ms)
✔ phase24 t04: event without delivery => BLOCK (0.109291ms)
✔ phase24 t05: progress without definition => BLOCK (0.511583ms)
✔ phase24 t05: missing required item => BLOCK (0.076084ms)
✔ phase24 t05: completed but incomplete => BLOCK (0.068125ms)
✔ phase24 t05: required satisfied => ok and complete (0.478208ms)
✔ phase24 t06: memberNumber missing => BLOCK (0.625208ms)
✔ phase24 t06: memberNumber invalid format => WARN (0.138875ms)
✔ phase24 t06: duplicate memberNumber => BLOCK (0.117917ms)
✔ phase24 t06: normal => OK (0.336292ms)
✔ phase24 t07: recordOpsNextAction appends decisionLog and upserts opsState (0.673834ms)
✔ phase24 t07: invalid nextAction is rejected (0.252708ms)
✔ phase24 t07: upsert stores updatedAt serverTimestamp (0.691083ms)
✔ phase24 t07: phase23 runbook still contains decision table keys (0.41175ms)
✔ phase24 t08: missing opsState => WARN (0.662875ms)
✔ phase24 t08: missing nextAction => WARN (0.07425ms)
✔ phase24 t08: opsState with nextAction => OK (0.063291ms)
✔ phase24 t08: summary includes opsState when present (3.3445ms)
✔ phase24 t09: missing opsState => WARN missing_ops_state (0.893416ms)
✔ phase24 t09: missing decision log => WARN missing_decision_log (0.090792ms)
✔ phase24 t09: mismatched nextAction => WARN mismatched_next_action (0.086625ms)
✔ phase24 t09: matching decision log => OK (0.075209ms)
✔ phase24 t10: all OK => READY (1.040667ms)
✔ phase24 t10: warn missing in opsStateCompleteness => NOT_READY (0.15375ms)
✔ phase241: /admin/ops redirects to /admin/app when authenticated (22.121125ms)
✔ phase241: notification deliveries API supports memberNumber search and vendor fallback (24.218625ms)
✔ phase241: monitor insights returns vendor CTR, AB snapshot, FAQ reference top (23.769292ms)
✔ phase241: admin app removes status summary panels from operational panes (0.9275ms)
✔ phase241: admin app includes monitor user timeline and insights sections (0.329916ms)
✔ phase241: ops safe test flow propagates traceId into monitor pane (1.105959ms)
✔ phase241: all ui.* keys used in /admin/app are present in dictionary (3.854625ms)
✔ phase243: faqArticlesRepo accepts version fallback and excludes invalid schema rows (3.587042ms)
✔ phase244: blocked low_confidence returns kbMeta and policySnapshotVersion (9.185083ms)
✔ phase244: success response includes kbMeta and policySnapshotVersion (0.926167ms)
✔ phase245: FAQ writes llm_disclaimer_rendered with surface=api (8.410958ms)
✔ phase245: Ops explain writes llm_disclaimer_rendered with surface=api (0.562083ms)
✔ phase245: Next actions writes llm_disclaimer_rendered with surface=api (0.569708ms)
✔ phase246: blocked payload always includes safe fallbackActions and suggestedFaqs <= 3 (8.369167ms)
✔ phase246: admin app filters direct URL sourceId in block panel (0.487042ms)
✔ phase247: ops template sections order is fixed (2.91075ms)
✔ phase247: next action internal enum stays uppercase (0.908916ms)
✔ phase247: admin app lowercases next actions for display only (0.69675ms)
✔ phase248: blocked reason taxonomy mapper is shared (0.415ms)
✔ phase248: FAQ audit stores regulatoryProfile (7.930709ms)
✔ phase248: Ops/NextAction audits include regulatoryProfile (1.078084ms)
✔ phase249: guide-only modes remain allowed (10.332959ms)
✔ phase249: non guide-only mode is blocked (0.337166ms)
✔ phase249: personalization is restricted to locale/servicePhase (0.249042ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d123 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t02: dryRun does not write and returns readiness (1.178625ms)
✔ phase25 t02: dryRun false writes and returns decisionLogId (8.018833ms)
✔ phase25 t02: readiness NOT_READY still returns ok (0.473209ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t03: ops console returns required keys (4.395625ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t04: console recommendedNextAction flows into submit (9.578209ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=invalid nextAction
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=ENV nextAction=RERUN_MAIN reason=invalid nextAction
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d9 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase25 t05: READY writes audit snapshot (10.318208ms)
✔ phase25 t05: READY rejects nextAction not in allowedNextActions (0.351625ms)
✔ phase25 t05: NOT_READY allows only STOP_AND_ESCALATE (0.309458ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=PASS nextAction=NO_ACTION reason=invalid consistency
✔ phase25 t06: opsState missing => WARN (0.593042ms)
✔ phase25 t06: decisionLog missing => WARN (0.23125ms)
✔ phase25 t06: opsState source mismatch => FAIL (0.435834ms)
✔ phase25 t06: missing audit snapshot => FAIL (0.172125ms)
✔ phase25 t06: submit rejects on consistency FAIL (2.442291ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t07: READY recommended is in allowedNextActions (10.502083ms)
✔ phase25 t07: NOT_READY forces STOP_AND_ESCALATE only (0.304917ms)
✔ phase25 t07: consistency FAIL downgrades readiness to NOT_READY (0.260042ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U3 closeDecision=NO_CLOSE decisionDrift=NONE readiness=NOT_READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase25 t08: READY yields closeDecision CLOSE (10.157792ms)
✔ phase25 t08: NOT_READY yields closeDecision NO_CLOSE (0.296709ms)
✔ phase25 t08: consistency FAIL yields closeDecision NO_CLOSE (0.243708ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
✔ phase25 t09: audit includes closeDecision fields (9.48375ms)
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=NO_ACTION reason=closeDecision closed
[OBS] action=ops_decision_submit result=error lineUserId=U1 failure_class=IMPL nextAction=FIX_AND_RERUN reason=closeDecision: NO_CLOSE
✔ phase25 t10: CLOSE rejects submit (1.564709ms)
✔ phase25 t10: NO_CLOSE rejects non-escalate actions (0.200875ms)
✔ phase250: source audit classifies ok/redirect/http_error/timeout and stores screenshot paths (2.832792ms)
✔ phase250: confirm extends validUntil by 120 days and sets active (2.896375ms)
✔ phase250: retire returns warning when source is still used by city packs (0.559334ms)
✔ phase250: sendNotification blocks when referenced source is expired (1.661875ms)
✔ phase250: canary run stores run summary, evidence and audit logs with traceId (3.535459ms)
✔ phase250: review inbox requires admin token and internal audit route requires job token (103.13425ms)
✔ phase251 t01: parseArgs reads required env and trims service url (1.694292ms)
✔ phase251 t01: parseArgs supports canary mode and ids (0.724292ms)
✔ phase251 t01: parseArgs rejects invalid mode (0.236708ms)
✔ phase251 t01: parseArgs rejects unknown args (0.07875ms)
✔ phase251 t02: invokeCityPackAudit returns ok on 200/ok:true (1.259042ms)
✔ phase251 t02: invokeCityPackAudit returns fail on non-2xx (0.171209ms)
✔ phase251 t02: invokeCityPackAudit falls back on invalid json response (0.134208ms)
✔ phase251 t03: workflow exists and calls runner script (0.746584ms)
✔ phase252: city pack audit runs API requires token and returns summary/status (33.153084ms)
✔ phase252: admin app includes city pack run history panel and controls (1.233083ms)
✔ phase252: index routes include city-pack-source-audit/runs (0.597125ms)
✔ phase253: city pack run detail API requires token and returns run + evidences (29.008292ms)
✔ phase253: admin app includes city pack trace button and run detail fetch (1.195833ms)
✔ phase253: index routes include city-pack-source-audit/runs/:runId (0.574667ms)
✔ phase254: admin app includes city pack run detail table and raw drawer (0.786208ms)
✔ phase254: run detail renderer opens evidence and handles missing trace (0.923167ms)
✔ phase254: city pack run detail dictionary keys are defined (0.804ms)
✔ phase256: city pack run detail API applies evidence limit query (33.313833ms)
✔ phase256: admin app includes run detail limit input and query wiring (1.140958ms)
✔ phase256: dictionary includes city pack run detail limit keys (0.764708ms)
✔ phase26: ops console list includes memberFlags (add-only) (2.303667ms)
✔ phase26 t01: list splits READY/NOT_READY and returns required keys (2.984916ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_decision_submit result=ok lineUserId=U2 decisionLogId=d2 failure_class=ENV nextAction=STOP_AND_ESCALATE
✔ phase26 t02: postCheck verifies READY decisions (8.464458ms)
✔ phase26 t02: postCheck verifies NOT_READY decisions (0.320125ms)
✔ phase26 t03: docs exist with required headings (0.986708ms)
✔ phase26 t04: list returns pageInfo placeholder (1.874292ms)
✔ phase26 t04: list returns pageInfo even when empty (0.430375ms)
✔ phase260: region declare creates request and user fields (2.62625ms)
✔ phase260: draft job creates source refs and draft city pack (2.790709ms)
✔ phase260: city-pack-requests routes require admin token (27.291458ms)
✔ phase260: internal city-pack draft job requires token (30.654666ms)
✔ phase260: admin app includes city pack request panel (2.112834ms)
✔ phase261: /admin/app uses decision cards and removes summary header blocks (0.955125ms)
✔ phase261: decision state rules are fixed to READY/ATTENTION/STOP (0.85775ms)
✔ phase261: details auto-open for ATTENTION/STOP (0.413958ms)
✔ phase261: vendor facade list/edit/activate/disable keeps compatibility with link_registry (35.010875ms)
✔ phase261: vendor actions require and persist traceId in audit logs (26.523792ms)
✔ phase261: initial pane contract keeps 3-action decision layout (1.075917ms)
✔ phase262: admin_app defines Alt+0..9 pane shortcuts (contract) (1.023542ms)
✔ phase262: admin.css provides focus-visible and reduced-motion rules (contract) (1.170625ms)
✔ phase263: decision card state classes exist in CSS and JS (contract) (0.960084ms)
✔ phase263: decision reasons are built via shared 2-line formatter (contract) (1.522125ms)
✔ phase264: admin.css provides table scroll + sticky header rules (contract) (0.558875ms)
✔ phase264: vendor table supports arrow key navigation + enter select (contract) (0.977458ms)
✔ phase266: city pack create normalizes targetingRules and slots (1.397333ms)
✔ phase266: city pack structure update route requires admin token and appends audit (30.5765ms)
✔ phase266: draft job creates default targetingRules and slots (2.821625ms)
✔ phase266: admin app includes city pack structure editor controls (1.355958ms)
✔ phase266: admin app wires city pack structure save endpoint (0.790917ms)
✔ phase267: source ref policy fields are normalized and persisted (0.94725ms)
✔ phase267: source policy route requires admin token and writes audit (30.807166ms)
✔ phase267: optional source failures do not block city pack validation (1.600542ms)
✔ phase267: required source failures still block city pack validation (0.233375ms)
✔ phase267: sendNotification uses cityPackFallback when only optional sources are invalid (3.513208ms)
✔ phase267: sendNotification remains fail-closed when required source is invalid (0.4775ms)
✔ phase267: admin app city pack pane has source policy controls (0.83975ms)
✔ phase267: admin app JS posts source policy update endpoint (0.486416ms)
✔ phase268: light/heavy stage updates source confidence and stage fields (2.368958ms)
✔ phase268: review inbox exposes priority/confidence/audit stage and sorts by priority (32.433208ms)
✔ phase268: internal light/heavy city pack audit routes require token and set stage (164.708708ms)
✔ phase268: city pack pane includes priority/confidence/stage columns and run mode options (0.969875ms)
✔ phase268: city pack run action posts stage and mode (1.139708ms)
✔ phase269: city pack structure editor includes basePackId input with dict keys (2.053667ms)
✔ phase269: admin app reads basePackId input and posts it on structure save (0.919042ms)
✔ phase269: city pack structure update validates base pack depth and self reference (1.262583ms)
✔ phase269: cityPacksRepo normalizes basePackId and overrides in structure patch (0.506167ms)
✔ phase27 t01: docs exist with required headings (1.507792ms)
✔ phase27 t02: list sorts READY first then cursorCandidate desc then lineUserId (4.5815ms)
✔ phase27 t02: list stabilizes order by lineUserId when cursorCandidate is null (9.269334ms)
✔ phase27 t03: list guards required keys/types when console result is missing fields (1.540333ms)
✔ phase27 t04: list keeps pagination compatibility keys (nextPageToken + pageInfo) (2.4885ms)
✔ phase27 t04: list returns pagination keys even when items is empty (0.467625ms)
✔ phase270: City Pack Feedback command stores feedback and event (1.586625ms)
✔ phase270: city-pack-feedback routes require admin token (36.65675ms)
✔ phase270: admin app includes feedback inbox and detail panels (2.087584ms)
✔ phase270: admin app loads feedback and posts actions (2.929625ms)
✔ phase271: city-pack-bulletins routes require admin token (33.65725ms)
✔ phase271: bulletin send uses sendNotification + killSwitch guard (0.762875ms)
✔ phase271: update proposal allowlist enforced and apply updates city pack (45.952542ms)
✔ phase271: admin app includes bulletin inbox and detail panels (0.876584ms)
✔ phase271: admin app includes proposal inbox and detail panels (0.819166ms)
✔ phase271: bulletin/proposal dictionary keys exist (3.304875ms)
✔ phase272: composer pane contains type-driven form, live preview, and saved list blocks (0.942167ms)
✔ phase272: non-STEP defaults are fixed to scenario A / week / limit 50 (1.128459ms)
✔ phase272: GET /api/admin/os/notifications/list returns rows under admin guard (58.916583ms)
✔ phase272: GET /api/admin/os/link-registry/:id returns lookup payload and enforces admin token (47.923625ms)
✔ phase272: composer danger actions require confirm and keep trace-aware calls (2.682209ms)
✔ phase272: composer type-driven dictionary keys exist (6.0405ms)
✔ phase272: createNotification stores notificationType and notificationMeta add-only fields (5.019ms)
✔ phase273: city-pack-metrics route is admin-guarded and persists daily rows (57.970333ms)
✔ phase273: computeCityPackMetrics aggregates by cityPack/slot/sourceRef with unmapped fallback (10.55325ms)
✔ phase273: admin app has city pack metrics panel and loader wiring (1.35225ms)
✔ phase273: city pack metrics dictionary keys exist (3.415125ms)
✔ phase273: index wires /api/admin/city-pack-metrics into city pack admin route set (0.632584ms)
✔ phase274: city pack route supports export + import dry-run/apply with confirm token (1.518ms)
✔ phase274: template library route exposes list/create/detail/activate/retire (0.785458ms)
✔ phase274: template library repo uses city_pack_template_library collection (0.466083ms)
✔ phase274: index wires city pack import/export + template library endpoints (0.642291ms)
✔ phase274: app.html contains template library and import/export controls in city pack pane (1.337417ms)
✔ phase274: admin_app wires template library load and import/export actions (0.966375ms)
✔ phase274: template library/import-export dictionary keys exist (2.285ms)
✔ phase28 t01: docs exist with required headings (0.87625ms)
✔ phase28 t02: pagination returns page1/page2 without overlap and stable order (19.033666ms)
✔ phase28 t03: invalid cursor is rejected (1.133208ms)
✔ phase28 t04: READY priority holds across pages (17.889667ms)
✔ phase28 t05: required keys are present on all pages (18.685083ms)
✔ phase29 t01: nextPageToken can be used as cursor (compatible with pageInfo.nextCursor) (11.522958ms)
✔ phase29 t02: signed cursor is returned and can paginate without overlap (optional security) (13.166834ms)
✔ phase29 t03: signed cursor verifies signature and enforce mode rejects unsigned cursor (15.793334ms)
✔ phase30 t01: cursorInfo defaults to UNSIGNED and enforce=false (3.01625ms)
✔ phase30 t02: cursorInfo reflects signing/enforce even when items empty (2.000542ms)
✔ phase304: composer pane keeps type-driven form + live preview + saved list while hiding trace input UI (0.847416ms)
✔ phase304: css enforces no-fold behavior and hides decision summaries (0.785583ms)
✔ phase304: dashboard KPI endpoint is wired and returns six KPI keys contract (1.890542ms)
✔ phase304: saved filter uses AND conditions and preview reflects CTA2 (1.103917ms)
✔ phase306: city_pack_requests persists add-only experience fields (2.967917ms)
✔ phase306: city_pack_feedback supports slot/message/resolution and status extensions (1.01225ms)
✔ phase306: draft job writes slotContents + request experience fields (4.206291ms)
✔ phase306: kill switch blocks city pack admin/internal write operations (42.078417ms)
✔ phase306: city pack pane shows request stage/warning/aging and feedback slot/resolution (0.912458ms)
✔ phase306: city pack feedback actions include triage/resolve handlers (1.688792ms)
✔ phase306: index routes include city-pack-feedback triage/resolve actions (0.682375ms)
✔ phase306: city pack request/feedback dictionary keys exist (3.448625ms)
✔ phase307: legacy duplicate repos are frozen as canonical forwarders (no direct db write) (2.407583ms)
✔ phase307: canonical user query path does not reintroduce scenario-field filtering (0.561541ms)
✔ phase307: ops review flow normalizes drift fields before writing (0.157292ms)
✔ phase307: missing-index fallback points do not exceed audit baseline (2.462291ms)
✔ phase307: newly added structural files do not introduce fallback catches (0.392625ms)
✔ phase307: normalizeOpsStateRecord keeps canonical keys only (2.402041ms)
✔ phase307: opsStateRepo read prefers canonical ops_states then falls back to legacy ops_state (3.711541ms)
✔ phase307: protection matrix resolves expected auth classes (0.790209ms)
✔ phase307: index.js routes protection via resolvePathProtection reference (0.303458ms)
✔ phase307: internal retention dry-run route requires only internal token (not admin token) (100.632833ms)
✔ phase307: retention dry-run does not delete docs and appends audit log (39.877041ms)
✔ phase307: normalizeScenarioKey absorbs scenario/scenarioKey drift (0.450792ms)
✔ phase307: usersRepo.listUsers accepts legacy scenario input and queries canonical scenarioKey (0.90775ms)
✖ phase308: top3 analytics hotspots use explicit bounded limits (7.341833ms)
✔ phase308: runtime routes/scripts do not import legacy duplicate repos (2.72425ms)
✔ phase308: missing-index fail mode defaults to true on stg/prod env (0.444709ms)
✔ phase308: every repo fallback branch has indexFallbackPolicy hooks (5.340333ms)
✔ phase308: retention dry-run fails closed on undefined collection policy (115.551625ms)
✔ phase308: retention policy covers all collections from audit lifecycle snapshot (0.574167ms)
✔ phase308: struct drift backfill supports dry-run and apply with audit trace (62.687709ms)
✔ phase309: struct drift backfill supports resumeAfterUserId cursor (13.03775ms)
✔ phase309: admin struct drift routes require admin token and support list/execute (41.746167ms)
✔ phase309: retention apply is env/flag guarded and filters by policy (55.913333ms)
✔ phase309: ops snapshot job builds snapshots and dashboard reads snapshot first (56.143583ms)
✔ phase309: review legacy page exposes LEGACY guidance to /admin/app (0.990583ms)
✔ phase309: admin app includes struct drift panel controls and handlers (1.355375ms)
✔ phase309: trace repos use index-oriented where+orderBy queries (0.543625ms)
✔ phase31 t01: ops_readonly includes ops console list/detail/submit sections (0.81725ms)
✔ phase31 t02: ops_readonly defines ops console fetch/submit helpers (0.835292ms)
✔ phase310: repo_map_ui.json exposes required machine-readable sections (0.524375ms)
✖ phase310: repo-map check mode passes when generated artifact is current (109.589458ms)
✔ phase310: /api/admin/repo-map is admin protected and returns payload for authorized actor (86.834417ms)
✔ phase310: app shell includes developer menu and developer-map pane hooks (1.2155ms)
✔ phase310: developer-map pane keeps no-fold structure (0.913333ms)
✔ phase310: developer labels exist in dictionary and audit workflow checks repo-map drift (2.375292ms)
✔ phase311: repo map exposes three layers and canonical developer statuses (0.482792ms)
✔ phase311: feature completion maps deterministically to developer status (5.193125ms)
✔ phase311: /api/admin/repo-map remains admin-guarded and returns layers (70.519792ms)
✔ phase311: redac/user manuals are rendered without details blocks (0.920583ms)
✔ phase311: repo map keeps japanese glossary for internal terms and manual labels (2.435459ms)
✔ phase311: developer matrix render uses scenario-step cells with count and state labels (4.914542ms)
✔ phase311: audit workflow and package scripts enforce repo-map drift checks (0.482334ms)
✔ phase312: snapshot read mode defaults to prefer (0.446375ms)
✔ phase312: snapshot read mode supports require and legacy disabled compatibility (0.099542ms)
✔ phase312: dashboard KPI returns NOT AVAILABLE and no full-scan fallback in require mode (47.845542ms)
✔ phase312: require mode returns NOT AVAILABLE placeholders for summary/state when snapshot is missing (1.556458ms)
✔ phase313: /api/admin/legacy-status is admin guarded and returns legacy route summary (82.625208ms)
✔ phase313: developer map includes LEGACY status controls without removing existing routes (1.399125ms)
✔ phase313: index wires /api/admin/legacy-status route (0.612333ms)
✔ phase314: retention apply rejects unmatched dryRunTraceId and accepts matched trace (50.990833ms)
✔ phase314: retention apply supports maxDeletes/cursor and appends audit payload (69.45675ms)
✖ phase315: cleanup check script passes when generated artifacts are current (108.623583ms)
✔ phase315: unreachable baseline files are frozen with LEGACY marker (1.152542ms)
✔ phase315: legacy aliases carry LEGACY_HEADER and canonical forwarding (0.989916ms)
✔ phase315: INDEX_PLAN covers all fallback source files from audit input (0.44125ms)
✔ phase315: retention addendum and lifecycle cover all retention policy collections (0.576959ms)
✔ phase315: protection matrix keeps admin/internal protection classes (1.419083ms)
✔ phase315: internal job routes keep token guard and killSwitch dependency map is generated (0.589709ms)
✔ phase316: analytics range queries return only bounded rows (1.375542ms)
✔ phase316: dashboard KPI read path uses bounded range queries for events/deliveries (0.462875ms)
✔ phase316: user operational summary sources users from canonical usersRepo listUsers (1.102084ms)
✖ phase317: notification operational summary uses bounded range query with legacy fallback (5.589959ms)
✔ phase317: notification summary ignores events older than notification sendAt in bounded path (4.007375ms)
✔ phase318: analytics users/notifications range queries return only bounded rows (1.393542ms)
✔ phase318: dashboard KPI read path uses bounded range queries for users/notifications with fallback (0.474417ms)
✖ phase319: user operational summary uses range-first events/deliveries with fallback (7.531292ms)
✔ phase319: range-first path ignores out-of-window events when bounded set is non-empty (5.360958ms)
✔ phase32 t01: READY suggestions filtered to allowedNextActions (2.19425ms)
✔ phase32 t02: NOT_READY suggests STOP_AND_ESCALATE only (2.897042ms)
✔ phase32 t03: llm failure yields empty suggestions (2.434166ms)
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (6.336625ms)
✔ phase320: range-first path for user state ignores older events outside user window when bounded set is non-empty (3.785459ms)
✔ phase321: monitor insights uses sentAt range query first with bounded fallback (0.533459ms)
✔ phase321: monitor insights excludes out-of-window delivery when bounded set is non-empty (27.490458ms)
✔ phase322: phase2 automation uses range path when weekly events exist (2.604083ms)
✔ phase322: phase2 automation falls back to listAll events when weekly range is empty (2.554625ms)
✔ phase323: phase5 notifications summary route parses limit/eventsLimit bounds (0.490125ms)
✔ phase323: notifications filtered usecase forwards limit/eventsLimit to operational summary (0.454667ms)
✔ phase324: phase5 users summary route parses limit/analyticsLimit bounds (0.48725ms)
✔ phase324: users filtered usecase forwards limit/analyticsLimit to operational summary (0.457875ms)
✔ phase325: phase5 stale member route parses limit bounds (0.467ms)
✔ phase325: stale member summary respects limit option (1.018458ms)
✔ phase326: phase4 users summary route parses limit/analyticsLimit bounds (0.543125ms)
✔ phase326: user operational summary respects limit option (3.280416ms)
✔ phase327: phase4 notifications route parses limit/eventsLimit bounds (0.53425ms)
✔ phase327: notification operational summary accepts bounded eventsLimit (3.823208ms)
✔ phase328: phase5 state summary route parses analyticsLimit bounds (0.740792ms)
✔ phase328: user state summary accepts analyticsLimit knob (2.810959ms)
✔ phase329: phase4 users summary route parses snapshotMode (0.492292ms)
✔ phase329: phase5 state summary route parses snapshotMode (0.460291ms)
✔ phase329: snapshotMode=require argument returns NOT AVAILABLE semantics when snapshot is missing (1.4775ms)
✔ phase33 t01: execute actions return execution snapshots (9.65425ms)
✔ phase33 t02: duplicate execution is blocked (0.9145ms)
✔ phase33 t02: readiness NOT_READY blocks execution (9.166166ms)
✔ phase330: phase4 notifications summary route parses snapshotMode (0.557166ms)
✔ phase330: notification summary returns snapshot data in require mode (2.481083ms)
✔ phase330: notification summary require mode returns empty when snapshot missing (0.477916ms)
✔ phase330: ops snapshot build includes notification_operational_summary item (3.585917ms)
✔ phase331: phase5 notifications summary route parses snapshotMode (0.450167ms)
✔ phase331: phase5 notifications filtered usecase forwards snapshotMode (1.258333ms)
✔ phase331: phase5 notifications summary returns empty in snapshot require mode when snapshot missing (1.831875ms)
✔ phase332: phase5 users summary route parses snapshotMode (0.528459ms)
✔ phase332: phase5 users filtered usecase forwards snapshotMode (0.5145ms)
✔ phase333: phase5 users summary returns empty in snapshot require mode when snapshot missing (1.430333ms)
✔ phase334: phase4 summary routes include metadata fields and includeMeta option (0.524416ms)
✔ phase334: user operational summary includeMeta returns not_available metadata in require mode (1.646333ms)
✔ phase334: notification operational summary includeMeta returns not_available metadata in require mode (1.650917ms)
✔ phase335: monitor insights route parses snapshotMode and has require no-fallback branch (0.557459ms)
✔ phase335: monitor insights returns 400 on invalid snapshotMode (0.744375ms)
✔ phase336: index wires /api/admin/retention-runs route (0.647209ms)
✔ phase336: retention-runs returns retention actions only and maps payload fields (1.810417ms)
✔ phase337: phase5 summary routes include metadata fields (0.548792ms)
✔ phase337: users summary includeMeta returns items+meta in require mode (1.375541ms)
✔ phase337: notifications summary includeMeta returns items+meta in require mode (0.364833ms)
✔ phase338: phase5 state route returns metadata fields (0.4865ms)
✔ phase338: phase5 state require mode returns not_available metadata when snapshot missing (1.02325ms)
✔ phase339: analyticsReadRepo defines user-scoped query readers (0.481917ms)
✔ phase339: phase5 state summary uses scoped queries before listAll fallback (0.511709ms)
✔ phase34 t01: suggestion drift is detected (2.633042ms)
✔ phase34 t02: execution drift is detected (1.264625ms)
✔ phase34 t03: policy drift is detected (1.044792ms)
✔ phase34 t04: no drift when suggestion/ops/execution align (1.882583ms)
✔ phase34 t05: phase32 -> phase33 -> phase34 appends decision drift (8.070875ms)
✔ phase340: snapshot freshness helpers resolve minutes and stale judgement (1.340208ms)
✔ phase340: user summary require mode treats stale snapshot as not_available (2.645875ms)
✔ phase341: internal ops snapshot job forwards targets payload (0.496458ms)
✔ phase341: buildOpsSnapshots supports partial targets with backward-compatible default (2.47875ms)
✔ phase342: maintenance pane includes retention runs read-only panel (0.793125ms)
✔ phase342: admin app loads retention runs from admin API (2.10525ms)
✔ phase342: retention runs ui dictionary keys exist (0.696208ms)
✔ phase343: audit inputs manifest contains required metadata and file hashes (0.490458ms)
✔ phase343: package scripts and audit workflow include audit-inputs checks (0.496209ms)
✔ phase344: load risk report keeps required keys (0.513583ms)
✔ phase344: load risk scripts, budgets doc, and workflow check are wired (0.628625ms)
✔ phase345: audit inputs manifest uses real metadata values (0.555791ms)
✔ phase346: load risk hotspots include endpoint mapping (0.509042ms)
✔ phase347: phase4 summary routes parse fallbackMode and reject invalid values (0.483208ms)
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (4.872208ms)
✔ phase348: phase5 ops/state routes parse fallbackMode and forward it (0.694375ms)
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.33675ms)
✔ phase349: ops snapshot repo and route contracts exist (0.575042ms)
✔ phase349: index wires ops snapshot health admin endpoint (0.713542ms)
✔ phase35: notices repo create/get/list/update (1.222791ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_console_get result=ok lineUserId=U2 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase35 t01: console execution status reflects latest execution log (10.775458ms)
✔ phase35 t01: console execution status defaults to UNKNOWN when missing (0.281208ms)
✔ phase35 t02: list includes executionStatus summary (1.568709ms)
✔ phase35 t02: list defaults executionStatus when missing (0.446542ms)
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=IMPL nextAction=STOP_AND_ESCALATE
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=STOP_AND_ESCALATE suggestedTemplateKey=ops_escalate
✔ phase35 t03: ops loop updates executionStatus (4.793334ms)
✔ phase350: read path budgets include current baseline ratchet values (0.583583ms)
✔ phase350: load risk budget parser uses last matching budget values (0.511333ms)
✔ phase351: dashboard kpi route parses fallbackMode and rejects invalid value (0.544458ms)
✔ phase351: dashboard kpi compute path blocks listAll fallback when fallbackMode=block (0.522458ms)
✔ phase352: analytics read repo exposes checklist scoped query by scenario+step (0.638917ms)
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.332667ms)
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.415042ms)
✔ phase353: phase4/phase5 routes expose fallback diagnostics fields (0.711708ms)
✔ phase353: summary/state usecases track fallback source diagnostics (0.771ms)
✔ phase354: ops snapshot health route accepts snapshotType filter and forwards to repo (0.483125ms)
✔ phase354: maintenance pane contains snapshot health controls and table (0.854708ms)
✔ phase354: admin app loads snapshot health via admin API (0.949208ms)
✔ phase355: read path budgets include hotspots_count_max in current baseline (0.440542ms)
✔ phase355: load risk script parses and checks hotspots_count_max budget (0.478375ms)
✔ phase356: fallback policy module defines env-driven default and resolver (0.612125ms)
✔ phase356: dashboard/phase4/phase5 routes use fallback policy default on missing query (0.583083ms)
✔ phase357: analytics read repo exposes lineUserIds scoped user_checklists query (0.464833ms)
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.911834ms)
✔ phase358: analytics read repo exposes notificationIds scoped events query (0.595125ms)
✖ phase358: notification summary collects notification ids and queries scoped events first (3.401166ms)
✔ phase359: phase2 automation route validates fallbackMode and forwards it (0.445583ms)
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (4.598084ms)
✔ phase35-39: docs exist with required headings (1.396833ms)
✔ phase36: notice send flow pushes and records delivery/audit (0.632834ms)
✔ phase360: monitor insights route accepts fallbackMode and blocks listAll fallback (0.506ms)
✔ phase360: monitor insights emits read_path fallback audit action when fallback is used or blocked (0.599625ms)
✔ phase361: read-path routes include fallback audit actions (0.583875ms)
✔ phase362: read path budgets include current baseline section for phase362 (0.429916ms)
✔ phase362: load-risk budget parser uses last baseline entries (0.472917ms)
✔ phase363: load risk hotspots exclude listAll function declarations (1.318ms)
✔ phase363: fallback_risk equals unique fallback file/call surfaces (1.047958ms)
✔ phase364: analytics read repo provides scoped checklist/delivery methods (0.528583ms)
✔ phase364: phase4 users summary uses scoped reads and blocks fallback only on query failure (0.48025ms)
✔ phase365: phase4 notification summary uses global events fallback only after scoped/range query failures (0.44875ms)
✔ phase365: index requirements include scoped checklist/delivery query entries (0.905375ms)
✔ phase366: phase5 state summary uses scoped checklist pairs and fallback only on query failures (0.524541ms)
✔ phase367: phase2 automation prefers scoped reads before listAll fallbacks (0.491167ms)
✔ phase367: phase2 automation route keeps fallbackMode allow|block contract (0.526208ms)
✔ phase368: dashboard KPI responses include unified fallback diagnostics keys (0.489417ms)
✔ phase368: monitor insights response includes source/asOf/freshness and fallback diagnostics (0.475083ms)
✔ phase369: read path fallback summary route exposes grouped and recent rows (0.517125ms)
✔ phase369: index routes /api/admin/read-path-fallback-summary (0.619625ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=auto_1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=ops_console_get result=ok lineUserId=U1 closeDecision=CLOSE decisionDrift=NONE readiness=READY recommendedNextAction=NO_ACTION meta_json={"suggestedTemplateKey":null}
✔ phase36-39: full ops flow yields timeline + traceability (4.67375ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
✔ phase36: decision timeline appends DECIDE/POSTCHECK/EXECUTE (3.128583ms)
✔ phase37: notification summary includes decision trace when linked (2.723958ms)
✔ phase38: getOpsAssistContext returns read-only payload (0.707584ms)
✔ phase39: stale console is rejected and logged (1.51825ms)
✔ phase37: mark read and click append audit logs (0.502375ms)
✔ phase370: maintenance pane contains fallback summary controls and table (0.85725ms)
✔ phase370: admin app loads read-path fallback summary via admin API (0.951958ms)
✔ phase371: product readiness route returns GO/NO_GO with blockers and checks (0.60675ms)
✔ phase371: index routes /api/admin/product-readiness (0.798167ms)
✖ phase372: read path budgets include current baseline section for phase372 (3.559667ms)
✖ phase372: launch checklist includes product-readiness API checks (4.362333ms)
✔ phase38: ops dashboard returns dashboard items (1.183292ms)
✔ phase39: suggestion schema and audit are fixed (2.844208ms)
✖ admin summaries: users and notifications (6.722ms)
✔ getNotificationReadModel: counts delivered/read/click (3.940333ms)
✔ toggle checklist done persists and reflects in GET (1.544208ms)
✔ toggle checklist done false clears in GET (0.318709ms)
✔ getMemberProfile returns memberNumber (0.844125ms)
✔ setMemberNumber writes trimmed value (0.776625ms)
✔ setMemberNumber clears when empty (0.175ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase40-44: full flow returns view + automation skips NO_ACTION execution (7.985ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase40: suggestion has disclaimer and no nextAction field (8.966916ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=29dc7f40e3e1f42ceaf47db8806c478df227facf0a1f9b5674fe50c2d49f2ba4 model=ops-assist-rules opsAssistInputHash=2b9b1b9ca2743a7609155a4323cb31e23905a00606600da37bb2049735dde0fa refreshReason=cache_miss
✔ phase41: llm assist suggestion appends timeline entry (3.415375ms)
✔ phase42: ops console view returns read-only payload (1.632375ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
✔ phase43: automation disabled by default (7.132958ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase44: automation guard triggers escalation (6.967625ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=f7b543f51277cbc932562b00fd26e711e71ebba2112fef4e3ffdffd1e0451a77 model=ops-assist-rules opsAssistInputHash=51fcb97feedd69b931804436952625029700aeac1a8ebaaf5a28977f87e3e9d8 refreshReason=cache_miss
✔ phase45: suggestion falls back to allowed action (9.691084ms)
✔ phase45: prompt payload shape is fixed (0.903167ms)
✔ phase46: ops assist cache stores latest entry (1.176833ms)
✔ phase46: ops console view includes assist only when requested (0.564833ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase47: automation timeline links decision log (7.186833ms)
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
✔ phase47: dry-run returns guard without writes (1.019792ms)
[OBS] action=automation_execute result=fail lineUserId=U1 action=NO_ACTION reason=automation_guard_failed
✔ phase47: execute requires readiness OK (8.763417ms)
✔ phase48: automation config default disabled (1.083291ms)
✔ phase48: automation config list shape fixed (1.584958ms)
[OBS] action=ops_decision_submit result=ok lineUserId=U1 decisionLogId=d1 failure_class=PASS nextAction=NO_ACTION
[OBS] action=automation_dry_run result=ok lineUserId=U1 action=NO_ACTION meta_json={"reason":null}
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_disabled
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase49: full ops flow stays consistent (10.812042ms)
✔ memberNumber stale: 14 days threshold (0.994375ms)
✔ ops attention flag: memberNumber missing, checklist incomplete, stale (3.477625ms)
✖ phase5 ops filters: date range (4.152584ms)
✔ phase323: notifications summary filter forwards limit/eventsLimit options (0.955917ms)
✔ phase324: users summary filter forwards limit/analyticsLimit options (1.398209ms)
✔ ops filters: no params keeps all items (4.813834ms)
✔ ops filters: needsAttention (1.002042ms)
✔ ops filters: stale (0.421583ms)
✔ ops filters: unreviewed (0.436583ms)
✔ ops filters: reviewAgeDays (0.403625ms)
✔ ops filters: invalid reviewAgeDays returns 400 (0.13725ms)
✔ ops flags: memberNumber stale yes/no (4.151084ms)
✔ ops review: saves lastReviewed fields (1.06525ms)
✔ ops review write: updates user opsReview fields (1.367333ms)
✖ getUserStateSummary: returns read-only state (5.93225ms)
✔ phase50: obs emitted on submit and execute (8.497916ms)
✔ phase50: obs format is key=value and meta_json (0.557541ms)
[OBS] action=ops_assist_suggest result=cache_hit lineUserId=U1 cacheHit=true inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=cache_hit
✔ phase51: cache hit returns cached suggestion without regeneration (11.163542ms)
[OBS] action=ops_assist_suggest result=ok lineUserId=U1 cacheHit=false inputHash=2477ba3552c466615d498dde666a46fc48a34b9f15001759829c840cfe7de2f9 model=ops-assist-rules opsAssistInputHash=4358f92a1543925311c38e3b5b823739c3b68bb8a18f2f9ea3a0894bec801736 refreshReason=input_changed
✔ phase51: input hash change triggers refresh (9.187209ms)
[OBS] action=ops_batch_run result=dry_run dryRun=true jobKey=refresh_ops_console limit=10
✔ phase52: dry-run does not call writers (0.817292ms)
✔ phase52: invalid jobKey is rejected (1.061083ms)
✔ phase53: suggest template mapping (0.425791ms)
✔ phase53: template repo stores and lists templates (1.06175ms)
✔ phase54: docs exist with required headings (0.775ms)
✔ phase6 member summary: 400 when lineUserId missing (1.020291ms)
✔ phase6 member summary: 404 when user not found (0.355875ms)
✔ phase6 member summary: returns minimal summary (1.796ms)
✔ phase6 member summary: includes redac status (last4 only) (0.399166ms)
✔ phase60: cursor HMAC roundtrip (0.907375ms)
✔ phase60: missing secret is rejected when unsigned not allowed (0.739542ms)
✔ phase60: tampered cursor is rejected (1.031166ms)
✔ phase61: active template cannot be edited (1.576459ms)
✔ phase61: templates CRUD happy path (1.309583ms)
✔ phase61: template rejects invalid notificationCategory (0.745042ms)
✔ phase62: same date is idempotent (0.98925ms)
✔ phase62: generate report persists summary (1.168458ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=automation_dry_run_only
✔ phase63: dry_run_only blocks execute (7.490959ms)
[OBS] action=automation_execute result=skip lineUserId=U1 action=NO_ACTION reason=no_action_not_executable
✔ phase63: execute mode allows when guard + recent dry run ok (8.226708ms)
✔ phase64: docs exist with headers (1.436125ms)
✔ phase65: job is idempotent for same date (1.265291ms)
✔ phase65: job token required (0.553ms)
✔ phase66: segment uses lineUserIds override (1.279041ms)
✔ phase66: segment needsAttention filters (1.700291ms)
✔ phase66: segment READY only (1.347167ms)
✔ phase66: segment filters by redacStatus + hasMemberNumber (1.782916ms)
✔ phase67: plan appends audit log (3.141833ms)
✔ phase67: plan does not send (3.274333ms)
✔ phase68: execute is blocked by per-user weekly cap (4.765375ms)
✔ phase68: execute is blocked when category is disallowed by servicePhase/preset (3.624083ms)
✔ phase68: execute appends audit and sends (106.630958ms)
✔ phase68: reject when mode is dry_run_only (1.441291ms)
✔ phase68: reject without matching plan (2.676584ms)
✔ phase69: docs exist with headers (0.907292ms)
✔ phase70: ops_readonly includes segment send and retry queue sections (0.725709ms)
✔ phase71: execute rejects when planHash mismatched (3.153708ms)
✔ phase71: plan returns planHash with stable bucket (2.290958ms)
✔ phase72: testSendNotification with deliveryId is idempotent (second call skips push) (2.245958ms)
✔ phase72: retryQueuedSend passes through deliveryId to sendFn (3.029333ms)
✔ phase72: testSendNotification skips sealed deliveryId without pushing (0.227375ms)
✔ phase72: sendNotification skips sealed delivery and does not push duplicate (1.459709ms)
✔ phase72: enqueue retry queue on send failure (105.12125ms)
✔ phase72: no enqueue when send succeeds (3.952958ms)
✔ phase72: testSendNotification sets sentAt/deliveredAt when missing (8.456084ms)
✔ phase73: retry is blocked by per-user weekly cap (3.569292ms)
✔ phase73: retry is blocked when category is disallowed by servicePhase/preset (3ms)
✔ phase73: retry failure keeps pending with lastError (3.93025ms)
✔ phase73: list retry queue returns pending only (2.042625ms)
✔ phase73: retry success marks done (7.780583ms)
✔ phase74: docs exist with required headings (1.768334ms)
✔ phase75: get active template returns latest active version (2.70925ms)
✔ phase75: template version increments per key (1.231542ms)
✔ phase76: execute rejects when templateVersion mismatched (3.433125ms)
✔ phase76: plan returns templateVersion from active template (4.3325ms)
✔ phase77: create segment enforces unique key (1.3815ms)
✔ phase77: list active segments returns active only (1.270333ms)
✔ phase78: ops_readonly includes saved segments dropdown (0.766542ms)
✔ phase79: audit log contains run and plan snapshots (110.87775ms)
✔ phase79: docs exist with required headings (1.192209ms)
✔ phase79: execute returns runId (5.977333ms)
✔ phase80: cursor sign/verify roundtrip (0.776542ms)
✔ phase80: list rejects tampered signed cursor (1.269167ms)
✔ phase81: dry-run appends audit log (4.63725ms)
✔ phase81: dry-run has no side effects (2.946875ms)
✔ phase82: confirm token verifies with matching payload (1.247792ms)
✔ phase82: confirm token rejects mismatch (0.951458ms)
✔ phase83: ops_readonly includes dry-run flow (0.815541ms)
✔ phase84: docs exist with required headings (1.225708ms)
✔ phase85: automation_runs repo create/patch/get (1.110666ms)
✔ phase86: batching updates progress cursor (16.142458ms)
✔ phase86: rate limit applied with sleep (0.467167ms)
✔ phase87: no retry on validation error (0.647541ms)
✔ phase87: retry transient errors (0.52875ms)
✔ phase88: partial failure yields DONE_WITH_ERRORS (14.696667ms)
✔ phase89: aborted run records ops state (10.080958ms)
✔ phase89: breaker aborts on 429 storm (13.992458ms)
✔ phase90: run status route returns run (1.066209ms)
✔ phase91: audit logs appended on start/done/abort (14.656666ms)
✔ phase92: docs exist with required headings (0.474083ms)
✔ phaseLLM1: allow list blocks extra fields (0.5565ms)
✔ phaseLLM1: allow list passes and filters (2.329041ms)
✔ phaseLLM1: feature flag disabled by default (0.438042ms)
✔ phaseLLM1: feature flag enabled values (0.088708ms)
✔ phaseLLM1: feature flag rejects other values (0.074292ms)
✔ phaseLLM1: validate OpsExplanation schema (0.921625ms)
✔ phaseLLM1: validate NextActionCandidates schema (0.628ms)
✔ phaseLLM1: validate FAQAnswer schema (0.466583ms)
✔ phaseLLM1: schema rejects direct URL in FAQ answer (0.392458ms)
✔ phaseLLM2: ops_readonly renders llm explanation section (0.743583ms)
✔ phaseLLM2: explanation fallback when LLM disabled (5.137083ms)
✔ phaseLLM2: accepts valid LLM explanation when enabled (0.803833ms)
✔ phaseLLM2: invalid LLM output falls back (0.397ms)
✔ phaseLLM3: ops_readonly includes next action candidates section (0.864416ms)
✔ phaseLLM3: fallback when LLM disabled (3.904459ms)
✔ phaseLLM3: accepts valid LLM candidates when enabled (2.278416ms)
✔ phaseLLM3: invalid LLM candidates fallback (1.002084ms)
✔ phaseLLM4: block when LLM disabled (4.8065ms)
✔ phaseLLM4: accepts valid LLM answer with allowed citations (0.976833ms)
✔ phaseLLM4: citations required (0 citations => block) (0.3265ms)
✔ phaseLLM4: WARN link is blocked (0.324292ms)
✔ phaseLLM5: runbook and phase plan docs exist (1.101834ms)
✔ phaseLLM6: allow-list blocks out-of-scope secret field (0.584583ms)
✔ phaseLLM6: restricted category is blocked when not allowed (0.201666ms)
✔ phaseLLM6: audit appends traceId for generated and blocked outcomes (4.054958ms)
✔ phaseLLM6: dual gate blocks when db flag is false (3.351167ms)
✔ phaseLLM6: dual gate blocks when env flag is false (0.321125ms)
✔ phaseLLM6: dual gate allows when db+env are true (0.631833ms)
✔ phaseLLM6: faq blocks when KB has no candidate (2.83875ms)
✔ phaseLLM6: faq blocks when citations are zero (3.41525ms)
✔ phaseLLM6: faq blocks direct URL in answer (3.058792ms)
✔ phaseLLM6: faq blocks WARN link (0.485667ms)
✔ phaseLLM6: llmEnabled defaults false and can be persisted (1.04575ms)
✔ phaseLLM6: faqArticlesRepo returns active locale-matched top scored rows (4.773042ms)
✔ phaseLLM6: faq output blocks when citations are missing (1.780583ms)
✔ phaseLLM6: faq output blocks direct URL (0.245708ms)
✔ phaseLLM6: next actions block invalid action (0.51075ms)
✔ phaseLLM6: llm config status/plan/set works with confirm token (48.196458ms)
✔ taxonomy: contact_source_required → CONTACT_SOURCE_REQUIRED (0.495916ms)
✔ taxonomy: kb_schema_invalid → KB_SCHEMA_INVALID (0.074ms)
✔ taxonomy: llm_api_error → LLM_API_ERROR (0.06ms)
✔ taxonomy: llm_timeout → LLM_API_ERROR (0.058333ms)
✔ taxonomy: adapter_missing → LLM_API_ERROR (0.057542ms)
✔ taxonomy: existing entries still correct (0.061583ms)
✔ taxonomy: unknown reason → UNKNOWN (0.071ms)
✔ taxonomy: llm_disabled with nullOnDisabled=true → null (0.053709ms)
✔ handleCreate: missing x-actor → 400 (0.820792ms)
✔ handleCreate: invalid article body → 422 with errors (0.616459ms)
✔ handleCreate: valid article → 200 with id (1.803792ms)
✔ handleList: returns articles → 200 (3.678584ms)
✔ handleUpdate: valid patch → 200 with id (0.332ms)
✔ handleDelete: soft deletes article → 200 with id (2.2635ms)
✔ validateKbArticle: all required fields → valid (0.858708ms)
✔ validateKbArticle: missing status → invalid (0.162208ms)
✔ validateKbArticle: invalid status → invalid (0.068625ms)
✔ validateKbArticle: missing riskLevel → invalid (0.07225ms)
✔ validateKbArticle: invalid riskLevel → invalid (3.413209ms)
✔ validateKbArticle: missing both version and versionSemver → invalid (0.345792ms)
✔ validateKbArticle: versionSemver only (no version) → valid (0.093417ms)
✔ validateKbArticle: invalid semver string → invalid (0.063458ms)
✔ validateKbArticle: missing validUntil → invalid (0.089625ms)
✔ validateKbArticle: validUntil null → invalid (0.113125ms)
✔ validateKbArticle: allowedIntents undefined → invalid (0.082042ms)
✔ validateKbArticle: allowedIntents null → invalid (0.050709ms)
✔ validateKbArticle: allowedIntents empty array [] → valid (all intents allowed) (0.055875ms)
✔ validateKbArticle: multiple errors returned (0.05175ms)
✔ search strict: article without riskLevel is rejected by validateKbArticle (0.830708ms)
✔ search strict: article without allowedIntents is rejected by validateKbArticle (0.155958ms)
✔ search strict: normalizeRiskLevel(undefined) → invalid (null), not defaulted to low (0.087125ms)
✔ search strict: allowedIntents=[] is valid (all intents allowed) (0.065417ms)
✔ search strict: allowedIntents with entries is valid (0.076041ms)
✔ llmClient: throws when OPENAI_API_KEY is not set (1.190125ms)
✔ llmClient: throws when OPENAI_API_KEY is missing entirely (0.345708ms)
✔ llmClient: throws llm_api_error on HTTP non-200 response (0.533625ms)
✔ llmClient: throws llm_api_error on empty response content (0.532208ms)
✔ llmClient: throws llm_api_error on non-JSON response content (0.428334ms)
✔ llmClient: returns { answer, model } on successful response (1.231875ms)
✔ llmClient: uses OPENAI_MODEL env var when set (0.179333ms)
✔ llmClient: defaults to gpt-4o-mini when OPENAI_MODEL not set (0.115875ms)
✔ llmClient: sends Authorization header with Bearer token (0.111709ms)
✔ llmClient: uses json_object response_format (0.182958ms)
✔ llmClient: exports explainOps method (0.436917ms)
✔ llmClient: exports suggestNextActionCandidates method (0.067459ms)
✔ llmClient.explainOps: throws when OPENAI_API_KEY is not set (0.354334ms)
✔ llmClient.suggestNextActionCandidates: throws when OPENAI_API_KEY is not set (0.113667ms)
✔ llmClient: callOpsExplain returns { answer, model } on success (0.739959ms)
✔ llmClient: callNextActionCandidates returns { answer, model } on success (0.528ms)
✔ getNextActionCandidates: returns ok:true with fallback when LLM disabled (3.965833ms)
✔ getNextActionCandidates: fallback includes up to 3 candidates with abstract actions only (0.247916ms)
✔ getNextActionCandidates: response includes nextActionTemplate (next_actions_template_v1) (0.186791ms)
✔ getNextActionCandidates: uses llmAdapter.suggestNextActionCandidates when LLM enabled (0.538833ms)
✔ getNextActionCandidates: falls back when adapter_missing (0.245709ms)
✔ getNextActionCandidates: LLM output with invalid action is filtered out (0.268791ms)
✔ getNextActionCandidates: includes disclaimer in response (0.157209ms)
✔ getNextActionCandidates: throws when lineUserId is missing (0.278875ms)
✔ getOpsExplanation: returns ok:true with fallback when LLM disabled (6.856834ms)
✔ getOpsExplanation: response includes opsTemplate (ops_template_v1) (0.753459ms)
✔ getOpsExplanation: response includes opsHealthTemplate (ops_health_template_v1) (0.737542ms)
✔ getOpsExplanation: uses llmAdapter.explainOps when LLM enabled (1.211458ms)
✔ getOpsExplanation: falls back when adapter_missing (no llmAdapter in deps) (0.373666ms)
✔ getOpsExplanation: falls back on LLM timeout (4.046958ms)
✔ getOpsExplanation: includes disclaimer in response (0.287416ms)
✔ getOpsExplanation: throws when lineUserId is missing (0.308208ms)
✔ consent status: returns guideModeLocked=false when lawfulBasis is not consent (4.068042ms)
✔ consent status: guideModeLocked=true when lawfulBasis=consent and unverified (0.360417ms)
✔ consent status: guideModeLocked=false when lawfulBasis=consent and verified (0.286458ms)
✔ consent verify: sets consentVerified=true when lawfulBasis=consent (0.8125ms)
✔ consent verify: returns 409 when lawfulBasis is not consent (0.312792ms)
✔ consent verify: returns 409 when lawfulBasis is unspecified (0.324125ms)
✔ consent verify: audit log is written on success (0.742333ms)
✔ consent verify: audit log is written on failure (wrong lawfulBasis) (0.143584ms)
✔ consent revoke: sets consentVerified=false regardless of lawfulBasis (0.160625ms)
✔ consent revoke: guideModeLocked=false when lawfulBasis is not consent (0.861542ms)
✔ consent revoke: audit log is written (0.116167ms)
✔ consent status: returns 400 when x-actor header is missing (0.070292ms)
✔ consent verify: returns 400 when x-actor header is missing (0.061708ms)
✔ ops explain: consent_missing blocks LLM when lawfulBasis=consent and unverified (3.241584ms)
✔ ops explain: LLM available after consent verified (lawfulBasis=consent, consentVerified=true) (0.570791ms)
✔ ops explain: LLM available with legitimate_interest (no consent needed) (0.306458ms)
✔ ops explain: llmStatus=disabled overrides consent when LLM flag is off (0.247417ms)
✔ next actions: consent_missing blocks LLM when lawfulBasis=consent and unverified (0.648291ms)
✔ next actions: LLM available after consent verified (0.720416ms)
✔ next actions: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (2.649083ms)
✔ ops explain: consent_missing audit entry has blockedReasonCategory=CONSENT_MISSING (0.423708ms)
✔ recordUserLlmConsent: accept returns ok with accepted status (0.868833ms)
✔ recordUserLlmConsent: revoke returns ok with revoked status (0.102542ms)
✔ recordUserLlmConsent: throws when lineUserId missing (0.266166ms)
✔ recordUserLlmConsent: throws when lineUserId is not a string (1.641958ms)
✔ recordUserLlmConsent: audit log written on accept with correct action (0.36125ms)
✔ recordUserLlmConsent: audit log written on revoke with correct action (0.425958ms)
✔ recordUserLlmConsent: uses default LLM_CONSENT_VERSION when consentVersion omitted (0.33175ms)
✔ recordUserLlmConsent: accepts custom consentVersion (0.526542ms)
✔ recordUserLlmConsent: default actor is line_user (0.265417ms)
✔ recordUserLlmConsent: audit failure does not throw (best-effort) (0.595417ms)
✔ userConsentsRepo: setUserLlmConsent accept stores accepted status (0.812208ms)
✔ userConsentsRepo: setUserLlmConsent revoke stores revoked status (0.118958ms)
✔ userConsentsRepo: getUserLlmConsent returns null for unknown user (0.104417ms)
✔ userConsentsRepo: getUserLlmConsent returns accepted record (0.103875ms)
✔ userConsentsRepo: getUserLlmConsent normalizes unknown status to pending (0.088667ms)
✔ userConsentsRepo: setUserLlmConsent throws on missing lineUserId (0.275791ms)
✔ userConsentsRepo: setUserLlmConsent uses default version when omitted (0.49925ms)
✔ userConsentsRepo: merge preserves existing fields (0.081375ms)
✔ webhook: "AI同意" command replies with consent confirmation (1.6915ms)
✔ webhook: "LLM同意" command replies with consent confirmation (0.335375ms)
✔ webhook: "AI拒否" command replies with revoke confirmation (0.221333ms)
✔ webhook: "LLM拒否" command replies with revoke confirmation (0.153458ms)
✔ webhook: consent command does not produce membership error reply (0.184666ms)
✔ webhook: unrelated text does not trigger consent handler (2.472875ms)
✔ webhook: consent handler stores consent status in user_consents collection (0.335042ms)
✔ webhook: AI拒否 stores revoked status in user_consents collection (0.21075ms)
✔ security: admin pages avoid unsafe HTML injection primitives (2.193792ms)
✔ security: automation config set requires valid confirmToken and writes audit on mismatch (36.069875ms)
✔ security: system config set requires valid confirmToken and writes audit on mismatch (39.2345ms)
✔ security: system config impactPreview includes cap breakdown fields (36.63775ms)
✔ security: system config plan succeeds when notificationCaps are all null (4.292792ms)
✔ security: system config impactPreview respects deliveryCountLegacyFallback mode (3.988667ms)
✔ security: system config impactPreview skips delivery counters during active quietHours (3.477792ms)
✔ security: system config notificationCaps roundtrip and fallback (40.567375ms)
✔ security: cookie-auth state-changing requests require same-origin (CSRF guard) (28.903375ms)
✔ security: delivery backfill execute requires valid confirmToken (37.4595ms)
✔ security: delivery recovery execute requires valid confirmToken and seals delivery (40.443ms)
✔ security: ops_readonly.html avoids innerHTML for dynamic data (XSS regression) (1.251958ms)
✔ security: /admin/* is protected by ADMIN_OS_TOKEN (cookie login) (28.436875ms)
✔ security: /api/phaseLLM4/faq/answer is protected by admin token (32.740583ms)
✔ security: redac membership id is not stored in plaintext (1.839708ms)
ℹ tests 1053
ℹ suites 0
ℹ pass 1033
ℹ fail 20
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 14300.301666

✖ failing tests:

test at tests/phase127/phase127_last_reaction_at.test.js:33:1
✖ phase127: lastReactionAt prefers clickAt over readAt (17.307375ms)
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
✖ phase127: lastReactionAt falls back to readAt when clickAt missing (0.723292ms)
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
✖ phase308: top3 analytics hotspots use explicit bounded limits (7.341833ms)
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
✖ phase310: repo-map check mode passes when generated artifact is current (109.589458ms)
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
✖ phase315: cleanup check script passes when generated artifacts are current (108.623583ms)
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
✖ phase317: notification operational summary uses bounded range query with legacy fallback (5.589959ms)
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
✖ phase319: user operational summary uses range-first events/deliveries with fallback (7.531292ms)
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
✖ phase320: user state summary uses user-targeted read and range-first events/deliveries (6.336625ms)
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
✖ phase347: phase4 usecases guard listAll fallback when fallbackMode is block (4.872208ms)
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
✖ phase348: phase5 state summary guards listAll fallback when fallbackMode is block (3.33675ms)
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
✖ phase352: phase4 user operational summary prefers checklist scoped read path (3.332667ms)
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
✖ phase352: phase5 state summary prefers checklist scoped read path with fallback guard (3.415042ms)
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
✖ phase357: phase4 user summary uses scoped user_checklists query and keeps guarded listAll fallback (3.911834ms)
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
✖ phase358: notification summary collects notification ids and queries scoped events first (3.401166ms)
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
✖ phase359: phase2 automation usecase exposes fallbackMode and block-path not_available markers (4.598084ms)
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
✖ phase372: read path budgets include current baseline section for phase372 (3.559667ms)
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
✖ phase372: launch checklist includes product-readiness API checks (4.362333ms)
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
✖ admin summaries: users and notifications (6.722ms)
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
✖ phase5 ops filters: date range (4.152584ms)
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
✖ getUserStateSummary: returns read-only state (5.93225ms)
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
