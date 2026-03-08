# PROJECT_INFRA_MAP

- generatedAt: 2026-03-08T02:42:23.550Z
- gitCommit: 746298fa07a773f7a9e066c29481c8c44c9ca081
- branch: main
- sourceDigest: c397ec60bcaa3c38e83a8a1a404a0c1861bcdcf50abe8ff0ff9cf730041f2d71
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
| CloudRun:member | region=us-east1, serviceAccount=member-runtime@member-485303.iam.gserviceaccount.com, image=us-east1-docker.pkg.dev/member-485303/cloud-run-source-deploy/member:746298fa07a773f7a9e066c29481c8c44c9ca081 | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| CloudRun:member-track | region=us-east1, serviceAccount=member-runtime@member-485303.iam.gserviceaccount.com, image=us-east1-docker.pkg.dev/member-485303/cloud-run-source-deploy/member-track:746298fa07a773f7a9e066c29481c8c44c9ca081 | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| CloudRun:member-webhook | region=us-east1, serviceAccount=member-runtime@member-485303.iam.gserviceaccount.com, image=us-east1-docker.pkg.dev/member-485303/cloud-run-source-deploy/member-webhook:746298fa07a773f7a9e066c29481c8c44c9ca081 | runtime:gcloud run services list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:ADMIN_BASIC_PASS | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:ADMIN_BASIC_USER | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:ADMIN_OS_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:CITY_PACK_JOB_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:JOURNEY_JOB_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:LINE_CHANNEL_ACCESS_TOKEN | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:LINE_CHANNEL_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:OPENAI_API_KEY | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:OPS_CONFIRM_TOKEN_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:REDAC_MEMBERSHIP_ID_HMAC_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:STRIPE_SECRET_KEY | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:STRIPE_WEBHOOK_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| SecretManager:TRACK_TOKEN_SECRET | name_only_no_secret_value | runtime:gcloud secrets list --format=json --project member-485303@2026-03-08T02:42:17.403Z |
| LLMProvider | https://api.openai.com/v1/chat/completions | src/infra/llmClient.js:69 |
| FirestoreAdminSdk | firebase-admin credentials via ADC | src/infra/firestore.js:1 |
| VendorSourceFetch | HTTP fetch to sourceRef.url in City Pack source audit | src/usecases/cityPack/runCityPackSourceAuditJob.js:71 |
| WebSearchProvider | infra web search adapter for citation source normalization | src/infra/webSearch/provider.js:1 |
