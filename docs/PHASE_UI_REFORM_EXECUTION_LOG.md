# PHASE_UI_REFORM_EXECUTION_LOG

## Branch
- `codex/ui-reform-241`

## 実行コマンド
- `git status -sb`
- `git fetch origin`
- `git switch -c codex/ui-reform-241 origin/main`
- `node --test tests/phase207/phase207_t02_admin_app_dictionary_contract.test.js tests/phase241/*.test.js`
- `npm run test:docs`
- `node --test tests/phase241/*.test.js`
- `npm test`

## 差分ファイル
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `src/index.js`
- `src/repos/firestore/faqAnswerLogsRepo.js`
- `src/routes/admin/notificationDeliveries.js` (new)
- `src/routes/admin/monitorInsights.js` (new)
- `docs/ADMIN_UI_DICTIONARY_JA.md`
- `docs/PHASE_UI_REFORM_PLAN.md` (new)
- `docs/PHASE_UI_REFORM_EXECUTION_LOG.md` (new)
- `tests/security/admin_os_token_required.test.js`
- `tests/phase241/phase241_t01_ops_route_redirect_to_admin_app.test.js` (new)
- `tests/phase241/phase241_t02_notification_deliveries_api.test.js` (new)
- `tests/phase241/phase241_t03_monitor_insights_api.test.js` (new)
- `tests/phase241/phase241_t04_admin_app_contract_no_status_summary.test.js` (new)
- `tests/phase241/phase241_t05_ops_test_to_monitor_flow_contract.test.js` (new)
- `tests/phase241/phase241_t06_dictionary_keys_coverage.test.js` (new)

## DOM構造の要点
- `/admin/app` の composer/monitor/errors/read-model ペインから状態サマリーDOMを削除。
- Homeに「今日やること」カードと「安全テスト実行」操作パネルを追加。
- Monitorに以下を追加:
  - ユーザー別通知履歴検索（lineUserId/memberNumber）
  - ベンダー別CTR / AB / FAQ参照Top（7日/30日切替）
  - 詳細ペイン（RAWは折りたたみ）
- Errorsに「次にやる安全な1手」を常設。

## P-01〜P-10 対応表
- P-01: `summary-header` 常設化（`apps/admin/app.html`）
- P-02: 状態サマリー撤去（`apps/admin/app.html`）
- P-03: 運用語化 + tooltip隔離（`apps/admin/app.html`, `apps/admin/assets/admin_app.js`, `docs/ADMIN_UI_DICTIONARY_JA.md`）
- P-04: 操作パネル順序固定（`apps/admin/app.html`）
- P-05: 重要3点強調（Top bar / today card / task cards）
- P-06: ユーザー履歴追跡（`src/routes/admin/notificationDeliveries.js`, Monitor UI）
- P-07: テスト→trace→Monitor導線（Home safe test + `navigateToMonitorWithTrace`）
- P-08: ハブURL統一（`src/index.js` `/admin/ops -> /admin/app`）
- P-09: 回復導線（Errors/Monitor safe next step）
- P-10: token準拠で強弱（`apps/admin/assets/admin.css`）

## テスト結果
- `npm run test:docs`: PASS
- `node --test tests/phase241/*.test.js`: PASS
- `npm test`: PASS（641 tests, 0 fail）
- `node --check apps/admin/assets/admin_app.js`: PASS

## 運用語での改善3点
- 入口を `/admin/ops` に固定し、画面迷子を防止。
- テスト結果から追跡ID経由で履歴確認まで一連で辿れる。
- ベンダー別反応・AB・FAQ参照をMonitorで同時に確認できる。

## CI証跡
- run id: `22121704167`（Audit Gate / push on `main` for merge commit `f9f2859`）
- 保存先: `docs/CI_EVIDENCE/2026-02-18_22121704167_ui-reform.log`
