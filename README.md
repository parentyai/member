# Member

## Local Run (Member service + Admin UI)

Admin UI (`/admin/*`) is only available in `SERVICE_MODE=member`.

1. Install deps:

```bash
npm ci
```

2. Start the member service (port `8080`):

```bash
ADMIN_OS_TOKEN='set-a-random-token-here' npm run start:member
```

3. Open:

- `http://127.0.0.1:8080/admin/login`

Enter the same `ADMIN_OS_TOKEN` value to access `/admin/ops` and `/api/admin/*`.

If you start `SERVICE_MODE=track` or `SERVICE_MODE=webhook`, `/admin/*` will return `not found` by design.

## Audit Gate (Repo)

Run the comprehensive audit gate locally:

```bash
npm run audit:gate
```

In CI (GitHub Actions), the audit gate additionally runs Docker-based scans (gitleaks / semgrep / osv-scanner).

## Deploy Environments

- `push(main)` deploys to `stg` (Cloud Run).
- `prod` deploy requires manual `workflow_dispatch` with `target_environment=prod`.
- Detailed setup/verification: `docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md`.
