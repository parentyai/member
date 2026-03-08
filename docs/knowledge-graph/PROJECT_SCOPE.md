# PROJECT_SCOPE

- generatedAt: 2026-03-08T02:42:23.550Z
- gitCommit: 746298fa07a773f7a9e066c29481c8c44c9ca081
- branch: main
- sourceDigest: c397ec60bcaa3c38e83a8a1a404a0c1861bcdcf50abe8ff0ff9cf730041f2d71
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

| Layer | Component | Location | Evidence |
| --- | --- | --- | --- |
| UI | Admin UI (11 files) | apps/admin/app.html, apps/admin/assets/admin_app.js | apps/admin/app.html:1<br>apps/admin/assets/admin_app.js:1 |
| API | Express route surface (130 route files) | src/index.js, src/routes/* | src/index.js:1<br>docs/REPO_AUDIT_INPUTS/protection_matrix.json:25 |
| Usecase | Domain usecases (209 files) | src/usecases/* | src/usecases/journey/runJourneyTodoReminderJob.js:1<br>docs/REPO_AUDIT_INPUTS/dependency_graph.json:2 |
| Repository | Firestore repositories (94 files) | src/repos/firestore/* | src/repos/firestore/auditLogsRepo.js:1<br>docs/REPO_AUDIT_INPUTS/data_model_map.json:2 |
| Firestore | Collections (89) | docs/REPO_AUDIT_INPUTS/data_model_map.json | docs/REPO_AUDIT_INPUTS/data_model_map.json:2<br>docs/REPO_AUDIT_INPUTS/data_lifecycle.json:3 |
| Jobs | Schedulers and internal jobs (15 workflows) | .github/workflows/*.yml, src/routes/internal/*, src/usecases/**/run*Job.js | .github/workflows/journey-todo-reminder.yml:1<br>src/routes/internal/journeyTodoReminderJob.js:1<br>src/usecases/journey/runJourneyTodoReminderJob.js:1 |
| LLM | Input boundary and adapter pipeline | src/usecases/llm/*, src/infra/llmClient.js, docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json | src/infra/llmClient.js:1<br>docs/REPO_AUDIT_INPUTS/llm_input_boundaries.json:2 |
| Evidence | Audit and trace reconstruction surface | src/repos/firestore/auditLogsRepo.js, src/repos/firestore/decisionTimelineRepo.js, docs/REPO_AUDIT_INPUTS/* | src/repos/firestore/auditLogsRepo.js:1<br>src/repos/firestore/decisionTimelineRepo.js:1<br>docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json:5 |
| Infra | Cloud Run/Secrets/Firestore runtime probe (OBSERVED_RUNTIME) | runtime:gcloud run services list, runtime:gcloud secrets list, runtime:firebase-admin firestore listCollections | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T02:42:17.403Z<br>runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z<br>runtime:firebase-admin firestore listCollections@2026-03-08T02:42:17.403Z |
