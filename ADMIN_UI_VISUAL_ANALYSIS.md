# ADMIN UI Visual Analysis (Playwright Evidence)

- Audit date: 2026-03-07
- Method: Playwright runtime observation + existing screenshot artifacts
- Runtime: `http://127.0.0.1:18081/admin/app`

## 1) スクリーンショット証跡

Source dir: `artifacts/ui-ux-audit-20260307/screenshots`

- `home-operator-1440x900.png`
- `composer-operator-1440x900.png`
- `monitor-operator-1440x900.png`
- `city-pack-operator-1440x900.png`
- `vendors-operator-1440x900.png`
- `audit-operator-1440x900.png`
- `settings-operator-1440x900.png`
- `settings-admin-1440x900.png`
- `llm-admin-1440x900.png`
- `maintenance-admin-1440x900.png`
- `home-admin-1280x800.png`
- `home-admin-1024x768.png`
- `home-admin-390x844.png`

Console evidence:
- `artifacts/ui-ux-audit-20260307/console.log`

## 2) 定量観測（viewport別）

| Viewport | Key Layout Metrics | Observation |
|---|---|---|
| 1440x900 | left nav `240x900`, topbar `1185x64`, page header `1137x61`, KPI panel y=`1201`, dashboard cards below fold=`12/12` | preflight banner等の上部占有で、ダッシュボード主領域が fold 下へ押し下がる |
| 1280x800 | left nav `240x800`, KPI panel y=`1222`, dashboard cards below fold=`12/12` | 主要KPIが初期表示で見えず、再読み込み/期間調整より先に長文診断が見える |
| 1024x768 | left nav `1009x764`, KPI panel y=`2024`, dashboard cards below fold=`12/12` | ナビが実質全幅化し本文を押し下げ。作業開始までのスクロール距離が増大 |

Evidence:
- Playwright `browser_run_code` results (2026-03-07 17:05–17:06)
- CSS responsive rules: `apps/admin/assets/admin.css:385-420`
- pane action sticky: `apps/admin/assets/admin.css:247-249`, `575-577`

## 3) 視認性評価（観測ベース）

| 観点 | 観測 | 証跡 |
|---|---|---|
| 情報密度 | HomeはKPIカード群 + preflight/system banner + top summary同居で高密度 | `apps/admin/app.html:200-220`, `257-548` |
| 文字量 | preflight bannerの復旧コマンド/JSON詳細が長文で視線を奪う | `apps/admin/app.html:206-216`, `artifacts/ui-ux-audit-20260307/console.log` |
| 余白/グリッド | panel/card間余白はトークン化され一貫。ただし面内要素数で過密化 | `apps/admin/assets/admin.css:2-43`, `703-760` |
| カード構造 | decision card + panel + details の多層構造が各paneで反復 | `apps/admin/app.html:225`, `633`, `1013`, `2301` |
| フォーム長 | Composer/CityPack は fold内に収まらない長尺フォーム | `apps/admin/app.html:699-874`, `2320-2416` |
| 視線誘導 | first view で「問題説明バナー」が主視認対象となり主CTAを上書き | Playwright snapshot (home, operator) |

## 4) 失敗状態/空状態の可視

### 事実
- 空状態の文言は統一キー `データなし` が多用。
  - `apps/admin/assets/admin_app.js:1849`, `4988`, `6193` ほか
- `NOT AVAILABLE` / `情報なし` 系フォールバックを多数使用。
  - `apps/admin/assets/admin_app.js:1254`, `2431`, `4351`
- ロール/フラグ非表示は `role-hidden`, `is-hidden-by-flag` で制御。
  - `apps/admin/assets/admin.css:319`, `2860`

### 推論
- 「空データ」と「接続失敗」が同じ視覚強度に寄るため、運用者が原因判別するまでに追加操作を要する。

### 未観測
- 正常データ時の full visual hierarchy（Firestore接続正常時）は未観測。

## 5) 視認性上の主要破綻点（事実）

1. preflight/system banner が fold上の主占有要素になる
2. home主CTA（decision action）が視線競争で埋もれる
3. 1024幅でナビと本文の優先順位が逆転
4. 高密度画面（monitor/city-pack）は「作業」「診断」「証跡」が同居

