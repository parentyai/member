# Phase273 Execution Log

## Branch
- `codex/phase273`

## Scope
- City Pack metrics daily (pack/slot/sourceRef) add-only.

## Commands
- `git status -sb`
  - `## codex/phase273...origin/main`
- `node --test tests/phase273/*.test.js`
  - PASS (5/5)
- `npm run test:docs`
  - PASS (`[docs] OK`)
- `npm test`
  - PASS (745/745)
- `git diff --name-only`
  - `apps/admin/app.html`
  - `apps/admin/assets/admin_app.js`
  - `docs/ADMIN_UI_DICTIONARY_JA.md`
  - `docs/DATA_MAP.md`
  - `docs/SSOT_INDEX.md`
  - `src/index.js`
  - `src/routes/admin/cityPackReviewInbox.js`
  - `src/repos/firestore/cityPackMetricsDailyRepo.js` (new)
  - `src/usecases/cityPack/computeCityPackMetrics.js` (new)
  - `tests/phase273/*` (new)
  - `docs/PHASE273_PLAN.md` (new)
  - `docs/PHASE273_EXECUTION_LOG.md` (new)

## CI Evidence
- merge後に `docs/CI_EVIDENCE/YYYY-MM-DD_<runid>_phase273.log` を保存する。
