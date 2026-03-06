# UI_GAP_AND_INCONSISTENCY_REPORT

## Cross-check Findings
1. HTMLは存在するがJSバインド未観測
- 一部 nav-item（data-pane-target系）は setupNav で一括処理されるが個別idハンドラがない。
- 根拠: apps/admin/app.html:16-221, apps/admin/assets/admin_app.js:2532-2537

2. ボタンはあるがAPI実行不能状態
- local runtimeで多くのAPIが権限不足/未設定で失敗し NOT AVAILABLE 表示。
- 根拠: screenshots/admin-home-1440x900.png, console errors (playwright runtime), apps/admin/assets/admin_app.js:1378-1429

3. 同義導線の重複
- 同一paneへのnav項目が複数グループに重複（run/notifications/catalog/operations）。
- 根拠: apps/admin/app.html:26-203

4. hidden groupの理解コスト
- data-nav-surface=hidden + rollout + roleAllow + flags の多段判定。
- 根拠: apps/admin/app.html:118-203, apps/admin/assets/admin_app.js:684-751,3648-3658

5. 状態表現の多系統
- status表現が decision-state / status-* / badge-* / row-health-* に分散。
- 根拠: apps/admin/assets/admin.css:799-813,943-956,1235-1245,1252-1263,2237-2267

6. legacy面の入口複線
- /admin/* legacy routes が redirect/compat で残存。
- 根拠: src/shared/adminUiRoutesV2.js:3-79, src/index.js:437-483

7. docsと実装の追跡負荷
- nav policyが docsに複数世代履歴を保持し、最新判定の読み取りに文脈が必要。
- 根拠: docs/SSOT_ADMIN_UI_OS.md:27-85


## 監査メモ
- 事実/推論を分離し、推測による穴埋めは行っていない。
- 未観測項目は明示的に「未観測」と記載。
