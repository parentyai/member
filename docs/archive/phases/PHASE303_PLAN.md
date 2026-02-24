# Phase303 Plan

## Goal
- Phase302 の merge 後 main run の CI 証跡を `docs/CI_EVIDENCE` に保存し、execution log に run id と保存先を固定する。

## Scope
- `/Users/parentyai.com/Projects/Member/docs/CI_EVIDENCE/2026-02-20_22207472473_phase302.log`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE302_EXECUTION_LOG.md`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE303_PLAN.md`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE303_EXECUTION_LOG.md`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Out of scope
- アプリコード変更
- API変更
- UI変更

## Acceptance
- main merge commit (`#551`) に紐づく run log が保存されている。
- `PHASE302_EXECUTION_LOG.md` に run id と保存ファイル名が記録されている。
- `npm test` PASS。
- `npm run test:docs` PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
