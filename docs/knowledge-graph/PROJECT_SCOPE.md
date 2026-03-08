# PROJECT_SCOPE

- generatedAt: 2026-03-08T03:08:07.132Z
- gitCommit: 8bae8342b36e44b086956dc2e1ec93d72398e0a5
- branch: codex/knowledge-graph-v2-finalize
- sourceDigest: abc077ebe50af3043a56474579a2842968ebd435af568f87aadc09d56fba3eb4
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
| Infra | Cloud Run/Secrets/Firestore runtime probe (OBSERVED_RUNTIME) | runtime:gcloud run services list, runtime:gcloud secrets list, runtime:firebase-admin firestore listCollections | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T03:08:01.041Z<br>runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z<br>runtime:firebase-admin firestore listCollections@2026-03-08T03:08:01.041Z |
