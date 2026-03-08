# PROJECT_INFRA_MAP

- generatedAt: 2026-03-08T03:08:07.132Z
- gitCommit: 8bae8342b36e44b086956dc2e1ec93d72398e0a5
- branch: codex/knowledge-graph-v2-finalize
- sourceDigest: abc077ebe50af3043a56474579a2842968ebd435af568f87aadc09d56fba3eb4
- runtime.cloudRun: OBSERVED_RUNTIME
- runtime.secretManager: OBSERVED_RUNTIME
- runtime.firestore: OBSERVED_RUNTIME

## Runtime Probe Runbook
1. `gcloud auth login --update-adc`
2. `gcloud auth application-default login`
3. `npm run knowledge-graph:probe-runtime`

If Firestore read fails, runtime rows are preserved with `UNOBSERVED_RUNTIME` and the error reason.

| Component | Dependency | Evidence |
| --- | --- | --- |
| CloudRun:member | region=us-east1, serviceAccount=member-runtime@member-485303.iam.gserviceaccount.com, image=us-east1-docker.pkg.dev/member-485303/cloud-run-source-deploy/member:b1599d21dd36a956d0516dd2190dc16ba772b408 | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| CloudRun:member-track | region=us-east1, serviceAccount=member-runtime@member-485303.iam.gserviceaccount.com, image=us-east1-docker.pkg.dev/member-485303/cloud-run-source-deploy/member-track:b1599d21dd36a956d0516dd2190dc16ba772b408 | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| CloudRun:member-webhook | region=us-east1, serviceAccount=member-runtime@member-485303.iam.gserviceaccount.com, image=us-east1-docker.pkg.dev/member-485303/cloud-run-source-deploy/member-webhook:b1599d21dd36a956d0516dd2190dc16ba772b408 | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:ADMIN_BASIC_PASS | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:ADMIN_BASIC_USER | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:ADMIN_OS_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:CITY_PACK_JOB_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:JOURNEY_JOB_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:LINE_CHANNEL_ACCESS_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:LINE_CHANNEL_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:OPENAI_API_KEY | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:OPS_CONFIRM_TOKEN_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:REDAC_MEMBERSHIP_ID_HMAC_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:STRIPE_SECRET_KEY | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:STRIPE_WEBHOOK_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| SecretManager:TRACK_TOKEN_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T03:08:01.041Z |
| LLMProvider | https://api.openai.com/v1/chat/completions | src/infra/llmClient.js:69 |
| FirestoreAdminSdk | firebase-admin credentials via ADC | src/infra/firestore.js:1 |
| VendorSourceFetch | HTTP fetch to sourceRef.url in City Pack source audit | src/usecases/cityPack/runCityPackSourceAuditJob.js:71 |
| WebSearchProvider | infra web search adapter for citation source normalization | src/infra/webSearch/provider.js:1 |
