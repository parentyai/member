# PROJECT_STATE_MACHINE_MAP

- generatedAt: 2026-03-08T02:42:23.550Z
- gitCommit: 746298fa07a773f7a9e066c29481c8c44c9ca081
- branch: main
- sourceDigest: c397ec60bcaa3c38e83a8a1a404a0c1861bcdcf50abe8ff0ff9cf730041f2d71
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| Entity | State | Transition | Trigger | Evidence |
| --- | --- | --- | --- | --- |
| notification | draft | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| notification | active | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| notification | sent | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| notification | draft | * -> draft | src/routes/admin/osNotifications.js + src/usecases/notifications/createNotification.js | src/routes/admin/osNotifications.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| notification | active | draft -> active | src/usecases/adminOs/approveNotification.js | src/usecases/adminOs/approveNotification.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| notification | sent | active -> sent | src/usecases/notifications/sendNotification.js | src/usecases/notifications/sendNotification.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:2 |
| city_pack_request | queued | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | collecting | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | drafted | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | needs_review | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | approved | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | active | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | rejected | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | failed | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | queued | * -> queued | src/usecases/cityPack/declareCityRegionFromLine.js | src/usecases/cityPack/declareCityRegionFromLine.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | collecting | * -> collecting | src/usecases/cityPack/runCityPackDraftJob.js | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | drafted | collecting -> drafted | src/usecases/cityPack/runCityPackDraftJob.js | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | needs_review | collecting -> needs_review | src/usecases/cityPack/runCityPackDraftJob.js | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | failed | collecting -> failed | src/usecases/cityPack/runCityPackDraftJob.js | src/usecases/cityPack/runCityPackDraftJob.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | approved | * -> approved | src/routes/admin/cityPackRequests.js | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | rejected | * -> rejected | src/routes/admin/cityPackRequests.js | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | needs_review | * -> needs_review | src/routes/admin/cityPackRequests.js | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| city_pack_request | active | approved -> active | src/routes/admin/cityPackRequests.js + src/usecases/cityPack/activateCityPack.js | src/routes/admin/cityPackRequests.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:35 |
| ops_decision | pending | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| ops_decision | decided | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| ops_decision | escalated | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| ops_decision | resolved | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| ops_decision | decided | pending -> decided | src/usecases/phase25/submitOpsDecision.js | src/usecases/phase25/submitOpsDecision.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| ops_decision | resolved | decided -> resolved | src/usecases/phase33/executeOpsNextAction.js | src/usecases/phase33/executeOpsNextAction.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:121 |
| emergency | draft | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| emergency | approved | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| emergency | sent | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| emergency | rejected | state_defined | state_catalog | docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| emergency | draft | * -> draft | src/usecases/emergency/runEmergencySync.js | src/usecases/emergency/runEmergencySync.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| emergency | approved | draft -> approved | src/usecases/emergency/approveEmergencyBulletin.js | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
| emergency | sent | approved -> sent | src/usecases/emergency/approveEmergencyBulletin.js + src/usecases/notifications/sendNotification.js | src/usecases/emergency/approveEmergencyBulletin.js:1<br>docs/REPO_AUDIT_INPUTS/state_transitions.json:147 |
