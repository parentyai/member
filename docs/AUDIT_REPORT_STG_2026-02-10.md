# Audit Report (stg) — 2026-02-10

Project: `member-485303` (region: `us-east1`, env: `stg`)

## Scope
- Repo: code + docs + CI gates
- GCP(stg): Cloud Run services + IAM(invoker) + Secret Manager presence (read-only verification + minimal required fixes)

## High-Level Result
- Repo automated gate: **implemented** (CI + 1-command runner)
- Tests: **PASS** (`npm test`, trace smoke, ops smoke)
- Dependency vulnerabilities: **PASS** (`npm audit --audit-level=high` => 0)
- Admin UI XSS: **mitigated** (no `innerHTML` use in ops UI; render uses `textContent`)
- Track token secret: **present** on `member-track` (prevents `GET /t/<token>` from failing due to missing secret)
- Admin/Ops app-layer auth: **implemented** via `ADMIN_OS_TOKEN` (cookie login + `X-Admin-Token` header for scripts)

## P0 Fixes Shipped (Must-Have)
### 1) Admin UI XSS hardening
- File: `apps/admin/ops_readonly.html`
- Change: removed `innerHTML` rendering for dynamic data and replaced with DOM creation + `textContent`.
- Tests:
  - `tests/security/admin_ops_readonly_xss_regression.test.js`

### 2) Admin/Ops app-layer auth (Cloud Run IAM compatible)
- Why: Cloud Run private services use `Authorization: Bearer ...` for IAM. Using Basic Auth would collide with that header.
- Implementation:
  - Env: `ADMIN_OS_TOKEN`
  - Request acceptance: either `X-Admin-Token: <token>` header or `admin_token` cookie
  - Browser flow: `/admin/login` sets `admin_token` cookie; unauthorized `/admin/*` redirects to `/admin/login`.
- File: `src/index.js`
- Tests:
  - `tests/security/admin_os_token_required.test.js`

### 3) Track token secret available on stg
- GCP:
  - Secret Manager: `TRACK_TOKEN_SECRET` exists
  - Cloud Run: `member-track` has `TRACK_TOKEN_SECRET` env from Secret Manager
- Repo:
  - `.github/workflows/deploy-track.yml` ensures secret is set on deploy
  - `.github/workflows/deploy.yml` sets `TRACK_TOKEN_SECRET` for `member` (future-proof; tracking stays disabled unless `TRACK_BASE_URL` is set)

### 4) Dependency vulnerabilities cleared
- `npm audit` previously reported high severity transitive issues.
- Fix applied: `npm audit fix`
- Result: `npm audit --audit-level=high` => 0

## Gates (FAIL/WARN)
### FAIL (CI stops)
- `npm ci`
- `npm run preflight`
- `npm test`
- `npm run test:trace-smoke`
- `npm run test:ops-smoke`
- `npm audit --audit-level=high`
- GO_SCOPE required evidence check (no `UNKNOWN/未記録/未確認/未実施/Status=NO` in required scope)
- Secret scan (gitleaks) + OSV scan (via Docker in CI)

### WARN (reported, not blocking by default)
- docs全域の evidence 未記録（GO_SCOPE外）
- LICENSE/SECURITY/データマップ不足（監査資料としては将来P1で強化推奨）
- SAST (semgrep) findings/exit code (until rules are tuned; SARIF is still produced/uploaded)

## New Automation (Repo)
- Audit runner:
  - `tools/audit/run_audit.sh`
  - outputs `artifacts/audit/*`
- CI workflow:
  - `.github/workflows/audit.yml`
- Support tools:
  - `tools/audit/duplicate_files.py`
  - `tools/audit/go_scope_evidence_check.py`

## GCP(stg) Snapshot (Observed)
### Cloud Run IAM (invoker)
- `member`: private
  - `roles/run.invoker`: `user:nshimamura@parentyai.com`
- `member-webhook`: public
  - `roles/run.invoker`: `allUsers`
- `member-track`: public
  - `roles/run.invoker`: `allUsers`

### Cloud Run env (relevant)
- `member` has secrets:
  - `LINE_CHANNEL_SECRET`, `LINE_CHANNEL_ACCESS_TOKEN`
  - `TRACK_TOKEN_SECRET`
  - `ADMIN_OS_TOKEN`

## How To Reproduce
### Repo audit gate
```sh
bash tools/audit/run_audit.sh
```

### Run core tests
```sh
npm ci
npm test
npm run test:trace-smoke
npm run test:ops-smoke
```

### GCP (read-only checks)
```sh
gcloud run services list --region us-east1 --project member-485303
gcloud run services get-iam-policy member --region us-east1 --project member-485303
gcloud run services get-iam-policy member-webhook --region us-east1 --project member-485303
gcloud run services get-iam-policy member-track --region us-east1 --project member-485303
gcloud run services describe member --region us-east1 --project member-485303
gcloud run services describe member-track --region us-east1 --project member-485303
gcloud secrets list --project member-485303
```

## Residual Risks / Follow-ups (P1)
- License/Privacy/Security documentation: repo has no top-level `LICENSE`/`SECURITY.md`/data map doc; add if you need stronger external audit readiness.
- Cloud Run runtime service account is default compute; consider a dedicated runtime SA with minimal roles (principle of least privilege).
- If `member` remains private: browser access to `/admin/*` requires an access method that satisfies Cloud Run IAM (IAP, proxy, or signed ID token). The app-layer token is an additional guard, not a replacement for IAM.
