# PHASE_CITY_PACK_REIMPLEMENT_EXECUTION_LOG

## Branch
- `codex/city-pack-reimplement-250`

## Preconditions
- `git status -sb` で作業ブランチ確認
- `main` の既存挙動を壊さない add-only 方針で開始

## Implemented
- City Pack 専用 Repo/Usecase/Route を新規追加
- `/admin/app` に City Pack 監査 UI（Review Inbox / Evidence Viewer / KPI / 監査実行）を追加
- 通知送信前に `sourceRefs` 検証を追加し、`SOURCE_*` taxonomy で fail-closed
- `/internal/jobs/city-pack-source-audit` を token 保護で追加（冪等 runId）
- `docs/ADMIN_UI_DICTIONARY_JA.md` に City Pack UI 文言を add-only 追記

## Commands
- `npm run test:docs`
- `npm test`
- `node --test tests/phase250/*.test.js`

## Test Result
- `npm run test:docs`: PASS (`[docs] OK`)
- `npm test`: PASS (`664 tests, 664 pass, 0 fail`)
- `tests/phase250`: PASS (`6 tests, 6 pass, 0 fail`)

## Changed Files
- `src/repos/firestore/sourceRefsRepo.js`
- `src/repos/firestore/sourceEvidenceRepo.js`
- `src/repos/firestore/sourceAuditRunsRepo.js`
- `src/repos/firestore/cityPacksRepo.js`
- `src/usecases/cityPack/validateCityPackSources.js`
- `src/usecases/cityPack/activateCityPack.js`
- `src/usecases/cityPack/reviewSourceRefDecision.js`
- `src/usecases/cityPack/runCityPackSourceAuditJob.js`
- `src/domain/cityPackPolicy.js`
- `src/domain/notificationFailureTaxonomy.js`
- `src/usecases/notifications/sendNotification.js`
- `src/usecases/adminOs/executeNotificationSend.js`
- `src/routes/admin/cityPacks.js`
- `src/routes/admin/cityPackReviewInbox.js`
- `src/routes/admin/cityPackEvidence.js`
- `src/routes/internal/cityPackSourceAuditJob.js`
- `src/index.js`
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/DATA_MAP.md`
- `docs/SSOT_INDEX.md`
- `docs/SSOT_CITY_PACK_SECURITY_RULES.md`
- `docs/PHASE_CITY_PACK_REIMPLEMENT_PLAN.md`
- `tests/phase250/*.test.js`

## CI Evidence
- Baseline: `docs/CI_EVIDENCE/2026-02-18_22123643929_phase250-baseline.log`
- PR CI run: `22124453590`
- Stored log: `docs/CI_EVIDENCE/2026-02-18_22124453590_phase250.log`

## P-01..P-10 Mapping (City Pack scope)
- P-06: User 履歴追跡と同様に source 監査履歴を Review Inbox/Evidence Viewer で可視化
- P-07: 監査実行 (`runId/traceId`) → 証跡表示への閉路を追加
- P-08: Ops ハブに City Pack 監査導線を追加
- P-09: `Confirm` 推奨と safe step 表示で回復導線を固定
- P-10: 既存 token ベース UI に準拠して状態/操作/証跡の階層を維持

## Risks
- Playwright screenshot capture はジョブ実行環境依存（ローカル単体では stub で検証）
- Firestore Rules は repo 内では SSOT 設計として管理（反映はインフラ運用タスク）

## Rollback
- `git revert <phase250-merge-commit>`
