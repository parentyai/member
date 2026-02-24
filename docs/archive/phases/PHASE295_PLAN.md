# Phase295 Plan

## Goal
- Phase294 の merge 後 main run の CI 証跡を `docs/CI_EVIDENCE` に保存し、execution log に run id と保存先を固定する。

## Scope
- `/Users/parentyai.com/Projects/Member/docs/CI_EVIDENCE/2026-02-19_22190871099_phase294.log`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE294_EXECUTION_LOG.md`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE295_PLAN.md`
- `/Users/parentyai.com/Projects/Member/docs/archive/phases/PHASE295_EXECUTION_LOG.md`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Out of scope
- アプリコード変更
- API変更
- UI変更

## Acceptance
- main merge commit (`#543`) に紐づく run log が保存されている。
- `PHASE294_EXECUTION_LOG.md` に run id と保存ファイル名が記録されている。
- `npm test` PASS。
- `npm run test:docs` PASS。

## Rollback
- PR単位 `git revert <merge_commit>`
