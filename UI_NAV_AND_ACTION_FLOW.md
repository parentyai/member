# UI_NAV_AND_ACTION_FLOW

## 主要シナリオ
1. 管理UIログイン導線
- /admin/login で token 入力（src/index.js:729-887）
- 成功後 /admin/ops 経由で /admin/app?pane=home へ到達（src/shared/adminUiRoutesV2.js:12-24, src/index.js:724-876）

2. 通知作成→確認→送信
- pane=composer で draft/approve/plan/execute（apps/admin/app.html:753-757）
- JS binding: setupComposerActions（apps/admin/assets/admin_app.js:14234-14535）
- API: /api/admin/os/notifications/draft|preview|approve|send/plan|send/execute（src/index.js:2289-2319）

3. ユーザー監視→詳細
- pane=monitor / pane=read-model
- monitor data: /api/admin/os/notifications/list, /admin/read-model/notifications（apps/admin/assets/admin_app.js:8180-8256）
- users summary detail: /api/admin/os/users-summary/analyze, /api/admin/os/user-billing-detail（apps/admin/assets/admin_app.js:8547-8818）

4. City Pack管理導線
- pane=city-pack
- filters + inbox + template + audit run（apps/admin/app.html:2390-3323）
- API: /api/admin/city-pack-* 群（src/index.js:1144-1252）

5. Vendor管理導線
- pane=vendors
- reload/filter/sort + edit/activate/disable（apps/admin/assets/admin_app.js:15690-15778）
- API: /api/admin/vendors（src/index.js:1031-1062）

6. 開発者導線
- pane=developer-map / manual-redac / manual-user
- nav/topbar shortcuts（apps/admin/app.html:149-179,261-271; apps/admin/assets/admin_app.js:3531-3587）

7. hidden group露出条件
- communication/operations は data-nav-surface=hidden + data-nav-rollout=admin,developer（apps/admin/app.html:118-203）
- rollout判定は nav core policy（apps/admin/assets/admin_app.js:533-537,684-690,721-751）

8. エラー復帰
- preflight banner: 再診断/コマンドコピー/監査ログ遷移（apps/admin/app.html:298-315, apps/admin/assets/admin_app.js:1187-1305）

9. 空状態から初回操作
- Dashboard/各tableで NOT AVAILABLE / データなし表示（スクリーンショット群, apps/admin/assets/admin.css:2906-2910）

10. 一覧→深掘り
- table row click で detail pane 更新（city-pack/vendor/read-model 各 row click handler）
- refs: apps/admin/assets/admin_app.js:5642-5716, 5868-5924, 6199-6270


## 実際に開けた画面
- artifacts/ui-audit-20260306/screenshots/admin-alerts-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-audit-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-city-pack-1024x768.png
- artifacts/ui-audit-20260306/screenshots/admin-city-pack-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-composer-1280x800.png
- artifacts/ui-audit-20260306/screenshots/admin-composer-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-developer-manual-redac-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-developer-manual-user-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-developer-map-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-emergency-layer-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-errors-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-home-1024x768.png
- artifacts/ui-audit-20260306/screenshots/admin-home-1280x800.png
- artifacts/ui-audit-20260306/screenshots/admin-home-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-llm-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-maintenance-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-monitor-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-ops-feature-catalog-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-ops-system-health-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-read-model-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-settings-1440x900.png
- artifacts/ui-audit-20260306/screenshots/admin-vendors-1440x900.png

## 開けなかった画面
- legacy standalone pages（/admin/ops_readonly 等）は static code観測のみ
