# Phase305 Plan

## Goal
- Phase304 の merge 後 main run の CI 証跡を `docs/CI_EVIDENCE` に保存し、execution log に run id と保存先を固定する。

## Scope
- `/Users/parentyai.com/Projects/Member/docs/CI_EVIDENCE/2026-02-21_22259058184_phase304.log`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE304_EXECUTION_LOG.md`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE305_PLAN.md`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE305_EXECUTION_LOG.md`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Out of scope
- アプリコード変更
- API変更
- UI変更

## Acceptance
- main merge commit (`#557`) に紐づく run log が保存されている。
- `PHASE304_EXECUTION_LOG.md` に run id と保存ファイル名が記録されている。
- `npm test` PASS。
- `npm run test:docs` PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
