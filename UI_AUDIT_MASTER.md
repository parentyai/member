# UI_AUDIT_MASTER

## 【背景】
- 目的: Memberリポジトリの現行UI仕様を推測なしで固定化する。
- 非ゴール: UI改修、実装変更、PR作成、Firestore書き込み。

## 【観測範囲】
- 観測パス: apps/, src/, docs/, tests/
- ランタイム観測: 実施（/admin/login -> /admin/app）
- 証跡スクリーンショット: artifacts/ui-audit-20260306/screenshots/*.png
- 起動条件: ADMIN_OS_TOKENをローカル環境変数で設定した read-only 観測

### Phase0 Mandatory Log

```bash
$ git status -sb
## codex/conversation-router-r719
 M .github/workflows/deploy-webhook.yml
 M .github/workflows/deploy.yml
 M .github/workflows/stg-notification-e2e.yml
 M apps/admin/app.html
 M apps/admin/assets/admin_app.js
 M docs/LLM_RUNBOOK.md
 M docs/REPO_AUDIT_INPUTS/audit_inputs_manifest.json
 M docs/REPO_AUDIT_INPUTS/feature_map.json
 M docs/REPO_AUDIT_INPUTS/load_risk.json
 M docs/REPO_AUDIT_INPUTS/missing_index_surface.json
 M docs/REPO_AUDIT_INPUTS/protection_matrix.json
 M docs/REPO_AUDIT_INPUTS/repo_map_ui.json
 M docs/REPO_AUDIT_INPUTS/retention_risk.json
 M docs/REPO_AUDIT_INPUTS/structure_risk.json
 M docs/REPO_AUDIT_INPUTS/supervisor_master.json
 M src/index.js
 M src/repos/firestore/llmActionLogsRepo.js
 M src/routes/admin/llmConfig.js
 M src/routes/webhookLine.js
 M src/usecases/billing/evaluateLlmBudget.js
 M src/usecases/llm/appendLlmGateDecision.js
 M tests/phase182/phase182_workflow_preflight_guards.test.js
 M tests/phase184/phase184_stg_e2e_workflow_exists.test.js
 M tests/phase650/phase650_t01_deploy_member_llm_secret_env_contract.test.js
 M tests/phase716/phase716_t06_llm_config_concierge_flag_contract.test.js
 M tests/phase717/phase717_t11_entry_gate_meta_contract.test.js
 M tools/run_stg_notification_e2e_checklist.js
?? scripts/check_cloud_run_runtime_contract.js
?? scripts/verify_llm_runtime.sh
?? src/domain/llm/router/
?? src/infra/llm/
?? tests/phase718/phase718_t01_runtime_state_budget_contract.test.js
?? tests/phase718/phase718_t02_paid_greeting_runtime_smoke.test.js
?? tests/phase718/phase718_t03_startup_warning_contract.test.js
?? tests/phase718/phase718_t04_verify_llm_runtime_script_contract.test.js
?? tests/phase718/phase718_t05_cloud_run_runtime_contract_script.test.js
?? tests/phase718/phase718_t06_deploy_webhook_runtime_gate_contract.test.js
?? tests/phase719/phase719_t03_detect_intent_contract.test.js
?? tests/phase719/phase719_t04_conversation_router_contract.test.js
?? tests/phase719/phase719_t05_webhook_conversation_router_paid_contract.test.js

$ git branch --show-current
codex/conversation-router-r719

$ git rev-parse HEAD
fd1acebf9dc8edac547033404ae002de0d916254

```

### 観測コマンドログ（保存先）
- /tmp/member_ui_find_500.log
- /tmp/member_ui_rg_controls_2.log
- /tmp/member_ui_rg_css_2.log
- /tmp/member_ui_rg_routes.log
- /tmp/member_ui_rg_docs_tests.log

## 【事実（Repo構造）】
- Canonical Admin shell: apps/admin/app.html
- Runtime entry routes: src/shared/adminUiRoutesV2.js
- Request routing/guard: src/index.js
- UI runtime logic: apps/admin/assets/admin_app.js
- UI style/tokens: apps/admin/assets/admin.css
- UI文言SSOT: docs/ADMIN_UI_DICTIONARY_JA.md

## 【事実（画面一覧）】
- UI-ADM-HOME: ダッシュボード / entry=/admin/app, D ダッシュボード, /admin/app, /admin/ops / cta=dashboard-reload
- UI-ADM-OPS-FEATURE-CATALOG: Feature Catalog / entry=/admin/app?pane=ops-feature-catalog, FC Feature Catalog / cta=ops-feature-catalog-reload
- UI-ADM-OPS-SYSTEM-HEALTH: System Health / entry=/admin/app?pane=ops-system-health, SH System Health / cta=ops-system-health-reload
- UI-ADM-ALERTS: 要対応 / entry=/admin/app?pane=alerts, ! 要対応, ! 要対応 / cta=alerts-reload
- UI-ADM-COMPOSER: 通知作成 / entry=/admin/app?pane=composer, N 作成, N 作成, L 一覧 / cta=approve / execute
- UI-ADM-MONITOR: 配信結果 / entry=/admin/app?pane=monitor, M 配信結果, J Journey, U 検索 / cta=monitor-reload
- UI-ADM-EMERGENCY-LAYER: Emergency Layer / entry=/admin/app?pane=emergency-layer, EM Emergency Layer, EM Emergency Layer / cta=emergency-provider-reload / emergency-bulletin-reload
- UI-ADM-CITY-PACK: City Pack管理 / entry=/admin/app?pane=city-pack, CP City Pack管理, CP City Pack管理 / cta=city-pack-reload / city-pack-run-audit
- UI-ADM-ERRORS: 異常対応 / entry=/admin/app?pane=errors, E 異常対応, O 状態確認, E 異常対応 / cta=errors-reload
- UI-ADM-READ-MODEL: 通知集計 / entry=/admin/app?pane=read-model, RM 通知集計, S 状態一覧, R 通知集計 / cta=users-summary-analyze
- UI-ADM-VENDORS: ベンダー管理 / entry=/admin/app?pane=vendors, V ベンダー管理, V ベンダー管理 / cta=vendor-unified-reload
- UI-ADM-AUDIT: 判断ログ / entry=/admin/app?pane=audit, A 判断ログ, F FAQ履歴, A 判断ログ / cta=audit-search
- UI-ADM-DEVELOPER-MAP: Repo Map（全体像） / entry=/admin/app?pane=developer-map, LR Legacy Routes / cta=repo-map-reload
- UI-ADM-DEVELOPER-MANUAL-REDAC: 取説（Redac） / entry=/admin/app?pane=developer-manual-redac / cta=manual-redac-open-map
- UI-ADM-DEVELOPER-MANUAL-USER: 取説（ユーザー） / entry=/admin/app?pane=developer-manual-user / cta=manual-user-open-map
- UI-ADM-LLM: LLM支援 / entry=/admin/app?pane=llm, L LLM支援, K FAQナレッジ管理, L LLM支援 / cta=llm-run-faq / llm-config-set
- UI-ADM-SETTINGS: 設定 / entry=/admin/app?pane=settings, S 設定, S 設定, S 設定 / cta=nav-open-settings-ops-only
- UI-ADM-MAINTENANCE: 回復・保守 / entry=/admin/app?pane=maintenance, MT 回復・保守, M 回復・保守, /admin/master / cta=maintenance-product-readiness-reload
- UI-ADM-LOGIN: Admin Login / entry=/admin/login, /admin/login / cta=Login
- UI-ADM-LEGACY-OPS: 運用判断支援（legacy ops_readonly） / entry=/admin/ops / cta=参照のみ（実行は/appへ誘導）

## 【事実（画面別UI仕様）】
### UI-ADM-HOME ダッシュボード
- 入口: /admin/app / D ダッシュボード / /admin/app / /admin/ops / /admin/ops_readonly
- 目的: 通知配信の判断指標を期間別に確認する
- 対応ファイル:
- apps/admin/app.html:318-639
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: dashboard-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/local-preflight, /admin/ui-dict, /api/admin/legacy-status, /api/admin/os/journey-kpi, /api/admin/os/task-rules/plan, /api/admin/os/task-rules/set, /api/admin/send-test, /api/admin/struct-drift/backfill-runs?limit=20, /api/admin/struct-drift/backfill, /api/admin/read-path-fallback-summary?${qs.toString()}, /api/admin/missing-index-surface?${qs.toString()}, /api/admin/product-readiness?${qs.toString()}
- 根拠: apps/admin/app.html:318-639 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-home-1024x768.png
- artifacts/ui-audit-20260306/screenshots/admin-home-1280x800.png
- artifacts/ui-audit-20260306/screenshots/admin-home-1440x900.png

### UI-ADM-OPS-FEATURE-CATALOG Feature Catalog
- 入口: /admin/app?pane=ops-feature-catalog / FC Feature Catalog
- 目的: 機能カタログ状態を一覧把握する
- 対応ファイル:
- apps/admin/app.html:640-666
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: ops-feature-catalog-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: 未観測
- 根拠: apps/admin/app.html:640-666 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-ops-feature-catalog-1440x900.png

### UI-ADM-OPS-SYSTEM-HEALTH System Health
- 入口: /admin/app?pane=ops-system-health / SH System Health
- 目的: 運用システム状態を監視する
- 対応ファイル:
- apps/admin/app.html:667-692
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: ops-system-health-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: 未観測
- 根拠: apps/admin/app.html:667-692 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-ops-system-health-1440x900.png

### UI-ADM-ALERTS 要対応
- 入口: /admin/app?pane=alerts / ! 要対応 / ! 要対応
- 目的: 要対応案件を確認する
- 対応ファイル:
- apps/admin/app.html:693-721
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: alerts-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/os/alerts/summary?limit=200
- 根拠: apps/admin/app.html:693-721 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-alerts-1440x900.png

### UI-ADM-COMPOSER 通知作成
- 入口: /admin/app?pane=composer / N 作成 / N 作成 / L 一覧 / /admin/composer
- 目的: 通知の作成・承認・送信を実行する
- 対応ファイル:
- apps/admin/app.html:722-1101
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: approve / execute / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /admin/read-model/notifications?limit=500, /api/admin/os/link-registry/${encodeURIComponent(id)}, /api/admin/os/notifications/approve, /api/admin/os/notifications/archive, /api/admin/os/notifications/list?${query.toString()}, /api/admin/os/link-registry/${encodeURIComponent(linkId)}, /api/admin/os/kill-switch/status, /api/admin/os/notifications/draft, /api/admin/os/notifications/preview, /api/admin/os/notifications/send/plan, /api/admin/os/notifications/send/execute
- 根拠: apps/admin/app.html:722-1101 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-composer-1280x800.png
- artifacts/ui-audit-20260306/screenshots/admin-composer-1440x900.png

### UI-ADM-MONITOR 配信結果
- 入口: /admin/app?pane=monitor / M 配信結果 / J Journey / U 検索 / M 配信結果 / /admin/monitor
- 目的: 配信結果とユーザー反応を監視する
- 対応ファイル:
- apps/admin/app.html:1102-2219
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: monitor-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/os/notifications/list?${listParams.toString()}, /admin/read-model/notifications?limit=500, /api/admin/notification-deliveries?${params.toString()}, /api/admin/monitor-insights?${params.toString()}
- 根拠: apps/admin/app.html:1102-2219 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-monitor-1440x900.png

### UI-ADM-EMERGENCY-LAYER Emergency Layer
- 入口: /admin/app?pane=emergency-layer / EM Emergency Layer / EM Emergency Layer
- 目的: 緊急情報の取り込みと承認送信を管理する
- 対応ファイル:
- apps/admin/app.html:2220-2389
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: emergency-provider-reload / emergency-bulletin-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/emergency/rules/${encodeURIComponent(id)}, /api/admin/emergency/rules/${encodeURIComponent(id)}/preview, /api/admin/emergency/bulletins/${encodeURIComponent(id)}/approve, /api/admin/emergency/bulletins/${encodeURIComponent(id)}/reject, /api/admin/emergency/providers/${encodeURIComponent(key)}
- 根拠: apps/admin/app.html:2220-2389 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-emergency-layer-1440x900.png

### UI-ADM-CITY-PACK City Pack管理
- 入口: /admin/app?pane=city-pack / CP City Pack管理 / CP City Pack管理
- 目的: City Packの申請/提案/テンプレ管理を行う
- 対応ファイル:
- apps/admin/app.html:2390-3323
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: city-pack-reload / city-pack-run-audit / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/city-pack-source-audit/runs/${encodeURIComponent(runId)}?${query.toString()}, /api/admin/city-packs, /api/admin/city-packs/${encodeURIComponent(targetPackId)}/content, /api/admin/city-packs/${encodeURIComponent(selectedPack.id)}/retire, /api/admin/city-pack-requests?${params.toString()}, /api/admin/city-pack-bulletins?${params.toString()}, /api/admin/city-pack-update-proposals?${params.toString()}, /api/admin/city-pack-requests/${encodeURIComponent(requestId)}, /api/admin/review-inbox?${params.toString()}, /api/admin/city-packs/composition?${params.toString()}, /api/admin/source-evidence/${encodeURIComponent(evidenceId)}, /api/admin/city-pack-kpi, /api/admin/city-pack-metrics?${qs.toString()}, /api/admin/city-pack-source-audit/runs?limit=20, /api/admin/city-pack-education-links/${encodeURIComponent(educationId)}/${action}, /api/admin/city-pack-education-links, /api/admin/city-pack-bulletins, /api/admin/city-pack-bulletins/${encodeURIComponent(created.bulletinId)}/approve, /api/admin/source-refs/${encodeURIComponent(sourceRefId)}/${action}, /api/admin/source-refs/${encodeURIComponent(sourceRefId)}/policy, /api/admin/city-pack-requests/${encodeURIComponent(requestId)}/${action}, /api/admin/city-pack-feedback/${encodeURIComponent(feedbackId)}/${action}, /api/admin/city-pack-bulletins/${encodeURIComponent(bulletinId)}/${action}, /api/admin/city-pack-update-proposals/${encodeURIComponent(proposalId)}/${action}, /api/admin/city-pack-update-proposals, /api/admin/city-pack-template-library/${encodeURIComponent(templateId)}/${action}, /api/admin/city-pack-template-library, /api/admin/city-packs/import/dry-run, /api/admin/city-packs/import/apply, /api/admin/city-packs/${encodeURIComponent(cityPackId)}/structure, /api/admin/city-pack-source-audit/run
- 根拠: apps/admin/app.html:2390-3323 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-city-pack-1024x768.png
- artifacts/ui-audit-20260306/screenshots/admin-city-pack-1440x900.png

### UI-ADM-ERRORS 異常対応
- 入口: /admin/app?pane=errors / E 異常対応 / O 状態確認 / E 異常対応 / /admin/errors
- 目的: 運用エラーを分類・復帰する
- 対応ファイル:
- apps/admin/app.html:3324-3427
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: errors-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/os/errors/summary
- 根拠: apps/admin/app.html:3324-3427 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-errors-1440x900.png

### UI-ADM-READ-MODEL 通知集計
- 入口: /admin/app?pane=read-model / RM 通知集計 / S 状態一覧 / R 通知集計 / /admin/read-model
- 目的: 通知/ユーザー状態を集計確認する
- 対応ファイル:
- apps/admin/app.html:3428-3688
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: users-summary-analyze / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /admin/read-model/notifications?limit=50, /api/admin/os/user-billing-detail?${query.toString()}, /api/admin/os/users-summary/analyze?${query.toString()}, /api/admin/os/users-summary/export?${query.toString()}, /api/phase5/ops/users-summary?${query.toString()}
- 根拠: apps/admin/app.html:3428-3688 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-read-model-1440x900.png

### UI-ADM-VENDORS ベンダー管理
- 入口: /admin/app?pane=vendors / V ベンダー管理 / V ベンダー管理
- 目的: Vendor状態と有効化/停止を管理する
- 対応ファイル:
- apps/admin/app.html:3689-3843
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: vendor-unified-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/vendors?${params.toString()}
- 根拠: apps/admin/app.html:3689-3843 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-vendors-1440x900.png

### UI-ADM-AUDIT 判断ログ
- 入口: /admin/app?pane=audit / A 判断ログ / F FAQ履歴 / A 判断ログ / /admin/review
- 目的: traceId単位で監査証跡を追跡する
- 対応ファイル:
- apps/admin/app.html:3844-3912
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: audit-search / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/trace?traceId=${encodeURIComponent(traceId)}
- 根拠: apps/admin/app.html:3844-3912 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-audit-1440x900.png

### UI-ADM-DEVELOPER-MAP Repo Map（全体像）
- 入口: /admin/app?pane=developer-map / LR Legacy Routes
- 目的: システム全体像・Legacy導線を確認する
- 対応ファイル:
- apps/admin/app.html:3913-4022
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: repo-map-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/repo-map, /api/admin/os/kill-switch/status
- 根拠: apps/admin/app.html:3913-4022 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-developer-map-1440x900.png

### UI-ADM-DEVELOPER-MANUAL-REDAC 取説（Redac）
- 入口: /admin/app?pane=developer-manual-redac
- 目的: 運用者向け取説を確認する
- 対応ファイル:
- apps/admin/app.html:4023-4082
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: manual-redac-open-map / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: 未観測
- 根拠: apps/admin/app.html:4023-4082 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-developer-manual-redac-1440x900.png

### UI-ADM-DEVELOPER-MANUAL-USER 取説（ユーザー）
- 入口: /admin/app?pane=developer-manual-user
- 目的: 利用者向け取説を確認する
- 対応ファイル:
- apps/admin/app.html:4083-4126
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: manual-user-open-map / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: 未観測
- 根拠: apps/admin/app.html:4083-4126 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-developer-manual-user-1440x900.png

### UI-ADM-LLM LLM支援
- 入口: /admin/app?pane=llm / L LLM支援 / K FAQナレッジ管理 / L LLM支援
- 目的: LLM設定/利用状況/FAQ運用を管理する
- 対応ファイル:
- apps/admin/app.html:4127-4385
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: llm-run-faq / llm-config-set / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/llm/faq/answer, /api/admin/llm/config/status, /api/admin/llm/config/plan, /api/admin/llm/config/set, /api/admin/llm/policy/status, /api/admin/os/llm-policy/history?limit=20, /api/admin/os/llm-usage/summary?windowDays=${encodeURIComponent(String(windowDays))}&limit=20, /api/admin/os/llm-usage/export?${query.toString()}, /api/admin/llm/policy/plan, /api/admin/llm/policy/set
- 根拠: apps/admin/app.html:4127-4385 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-llm-1440x900.png

### UI-ADM-SETTINGS 設定
- 入口: /admin/app?pane=settings / S 設定 / S 設定 / S 設定
- 目的: 運用設定系の参照導線を提供する
- 対応ファイル:
- apps/admin/app.html:4386-4407
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: nav-open-settings-ops-only / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/os/rich-menu/status, /api/admin/os/rich-menu/history?limit=20, /api/admin/os/rich-menu/resolve-preview, /api/admin/os/rich-menu/plan, /api/admin/os/rich-menu/set, /api/admin/os/journey-graph/branch-queue/status?${query.toString()}, /api/admin/os/task-rules/plan, /api/admin/os/task-rules/set, /api/admin/os/link-registry-impact?${query.toString()}, /api/admin/os/task-rules/status?limit=200, /api/admin/os/task-rules/history?limit=20, /api/admin/os/task-rules/dry-run, /api/admin/os/task-rules/template/plan, /api/admin/os/task-rules/template/set, /api/admin/os/task-rules/apply/plan, /api/admin/os/task-rules/apply, /api/admin/os/journey-graph/status, /api/admin/os/journey-graph/plan, /api/admin/os/journey-graph/set, /api/admin/os/journey-graph/history?limit=20, /api/admin/os/journey-param/status, /api/admin/os/journey-param/plan, /api/admin/os/journey-param/validate, /api/admin/os/journey-param/dry-run, /api/admin/os/journey-param/apply, /api/admin/os/journey-param/rollback, /api/admin/os/journey-param/history?limit=20, /api/admin/os/journey-graph/runtime?${query.toString()}, /api/admin/os/journey-graph/runtime/history?${query.toString()}
- 根拠: apps/admin/app.html:4386-4407 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-settings-1440x900.png

### UI-ADM-MAINTENANCE 回復・保守
- 入口: /admin/app?pane=maintenance / MT 回復・保守 / M 回復・保守 / /admin/master
- 目的: 回復・保守指標を管理する
- 対応ファイル:
- apps/admin/app.html:4408-4581
- apps/admin/assets/admin_app.js:500-16698
- apps/admin/assets/admin.css:1-3113
- 表示条件: role=admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: maintenance-product-readiness-reload / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /api/admin/ops-system-snapshot/rebuild, /api/admin/ops-snapshot-health?${qs.toString()}, /api/admin/retention-runs?${qs.toString()}
- 根拠: apps/admin/app.html:4408-4581 | apps/admin/assets/admin_app.js:500-16698 | apps/admin/assets/admin.css:1-3113
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- artifacts/ui-audit-20260306/screenshots/admin-maintenance-1440x900.png

### UI-ADM-LOGIN Admin Login
- 入口: /admin/login / /admin/login
- 目的: 管理トークン認証
- 対応ファイル:
- src/index.js:729-893
- 表示条件: role=operator,admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: Login / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /admin/login, /admin/logout
- 根拠: src/index.js:729-893
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- 未観測

### UI-ADM-LEGACY-OPS 運用判断支援（legacy ops_readonly）
- 入口: /admin/ops
- 目的: legacy運用導線の互換表示（通常運用非推奨）
- 対応ファイル:
- apps/admin/ops_readonly.html:1-999
- src/shared/adminUiRoutesV2.js:12-24
- 表示条件: role=admin,developer
- レイアウト要約（左→右 / 上→下）: 左ナビ→topbar→page header→decision card→panel/table
- セクション一覧: decision-card, panel, table-section（paneにより差分）
- 主CTA / 副CTA: 参照のみ（実行は/appへ誘導） / nav + reload系
- 一覧 / 詳細 / 編集 の関係: 一覧テーブル + detail pane + actions aside（pane-grid）
- フィルタ / 検索 / 並び替え: pane別 filter input/select と sort button（data-*-sort-key）
- テーブル / カード仕様: table-scroll + sticky thead + status row color
- 状態表示: ready/attention/stop, status badge, guard banner
- 空状態: NOT AVAILABLE / データなし表示
- エラー状態: toast danger + banner + panel error
- 読込中状態: is-loading / skeleton（paneごと）
- hidden / disabled / role 制御: data-role/data-role-allow + hidden/is-hidden + disabled
- API 接続: /admin/ops, /admin/ops_readonly
- 根拠: apps/admin/ops_readonly.html:1-999 | src/shared/adminUiRoutesV2.js:12-24
- 未観測: 成功レスポンス時の全状態（ローカル認証不足で多数API 403/500）
- 視覚導線メモ（観測のみ）: 左ナビのグループ見出し→page title→decision card→主要table
- スクリーンショット:
- 未観測

## 【事実（視覚構造・視線導線）】
- 共通構造: 左nav固定列 -> topbar(メトリクス/role/build) -> page header -> decision card -> pane本文
- first focus: nav-group + page title
- second focus: decision card state / preflight banner
- third focus: table/filter 영역
- 主CTAは paneごとに reload/plan/execute 系。
- 競合CTA: 同一paneへ複数nav導線が存在（重複導線）。
- 情報密度: city-pack/monitor/maintenance が高密度。

## 【事実（接続動線 / API / 状態遷移）】
- API binding件数: 124
- 代表API: /api/admin/os/*, /api/admin/city-pack-*, /api/admin/emergency/*, /api/admin/llm/*
- 状態遷移: pane active切替、decision-state、status badge、guard banner、loading/disabled。

## 【事実（CSS / デザイン表現）】
- トークン数: 33
- 主要色: status-ok/warn/danger/info + background variants
- レイアウト: grid（nav 220px + content） + pane-grid 3列 + sticky actions
- レスポンシブ: <=1100pxでnav横スクロール/1カラム化

## 【事実（権限制御 / hidden UI / 条件表示）】
- role別pane許可: operator/admin/developer で差分あり（ui_permission_visibility_matrix.json参照）
- hidden group: communication / operations は rollout条件付き
- pane role制約: llm/maintenance/developer-* は admin/developer 前提

## 【事実（スクリーンショット証跡）】
- 取得済み: 22枚（主要18pane + viewport差分）
- 保存先: artifacts/ui-audit-20260306/screenshots/
- 取得不可: legacy standalone pages のランタイム screenshot は未取得（/admin/app優先観測）

## 【未観測 / 不明】
- 本番相当データ接続時の成功UI状態（ローカルで権限不足のため多数API失敗）
- operator/developer roleでの実画面差分 screenshot（admin role中心で観測）
- write実行成功時の完了UI（実行禁止方針により未観測）

## 【推論】
- UIは高機能だが、導線・表示条件・状態表現が多層化しており運用認知負荷が高い。
- preflight/permission失敗時に NOT AVAILABLE が広範囲に出るため、初見で可用性低下が目立つ。

## 【監査上の重要欠陥】
1. 導線重複（同一pane複数group表示）で主導線判別が難しい
2. state表現の多系統化で一貫性が低い
3. hidden/rollout/role判定が多段で、仕様追跡コストが高い
4. ローカル権限不足時の可視状態が全面劣化し、診断前提知識が必要

## 【次段の大回収入力】
- 導線重複の優先順位整理（paneごとprimary nav一本化）
- status表現の統合規約（badge/pill/row healthの共通辞書化）
- preflight異常時の段階的degrade設計（KPI/table単位で可視分離）
- role/rollout matrixのUI内可視化（「なぜ見えないか」説明）

## 【非対象】
- UI改善実装
- API仕様変更
- Firestore更新
- デプロイ/PR操作
