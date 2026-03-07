# ADMIN UI Structural Inventory (Read-only Audit)

- Audit date: 2026-03-07
- Mode: Read-only UX structure audit (no implementation, no write action execution)
- Target scope:
  - `apps/admin/app.html`
  - `apps/admin/assets/admin_app.js`
  - `apps/admin/assets/admin.css`
  - `src/routes/admin/*`
  - `src/usecases/*`
  - `src/index.js`
  - `src/shared/adminUiRoutesV2.js`

## 0) Mandatory raw git logs
```bash
git status -sb
git branch --show-current
git rev-parse HEAD
```
```text
## HEAD (no branch)
715f7cf72420361803e942f0027bb9aef4af1a03
```

## 1) 観測コマンド（抜粋）
```bash
rg -n 'class="nav-item".*data-pane-target="[^"]+"' apps/admin/app.html
rg -n '^\s*<section id="pane-[^"]+" class="app-pane"' apps/admin/app.html
rg -n 'data-role-allow|role-btn|data-role=' apps/admin/app.html
rg -n 'postJson\(|fetch\('/ apps/admin/assets/admin_app.js
rg -n 'window\.confirm\(' apps/admin/assets/admin_app.js
rg -n -- '--[a-zA-Z0-9-]+|status|badge|pill|banner|toast|empty|loading|sticky|@media' apps/admin/assets/admin.css
rg -n '/api/admin|/admin/' src/index.js src/shared/adminUiRoutesV2.js src/routes/admin/*
```

## 2) 事実: UIサーフェス一覧（20面）

| Surface ID | Screen | Entry | Evidence |
|---|---|---|---|
| UI-ADM-LOGIN | Admin Login | `/admin/login` | `src/index.js:739`, `src/index.js:833` |
| UI-ADM-HOME | ダッシュボード | nav `home` | `apps/admin/app.html:20`, `apps/admin/app.html:224` |
| UI-ADM-FEATURE-CATALOG | 機能カタログ | nav `ops-feature-catalog` | `apps/admin/app.html:20`, `apps/admin/app.html:550` |
| UI-ADM-OPS-HEALTH | システム健全性 | nav `ops-system-health` | `apps/admin/app.html:64`, `apps/admin/app.html:577` |
| UI-ADM-ALERTS | 要対応 | nav `alerts` | `apps/admin/app.html:60`, `apps/admin/app.html:603` |
| UI-ADM-COMPOSER | 通知作成 | nav `composer` | `apps/admin/app.html:28`, `apps/admin/app.html:632` |
| UI-ADM-MONITOR | 配信結果/ジャーニー状況 | nav `monitor` (重複導線あり) | `apps/admin/app.html:32`, `apps/admin/app.html:36`, `apps/admin/app.html:1012` |
| UI-ADM-EMERGENCY | 緊急レイヤー | nav `emergency-layer` | `apps/admin/app.html:44`, `apps/admin/app.html:2130` |
| UI-ADM-CITY-PACK | City Pack管理 | nav `city-pack` | `apps/admin/app.html:40`, `apps/admin/app.html:2300` |
| UI-ADM-ERRORS | 異常対応 | nav `errors` | `apps/admin/app.html:68`, `apps/admin/app.html:3234` |
| UI-ADM-READ-MODEL | 通知集計 | nav `read-model` | `apps/admin/app.html:52`, `apps/admin/app.html:3338` |
| UI-ADM-VENDORS | ベンダー管理 | nav `vendors` | `apps/admin/app.html:48`, `apps/admin/app.html:3601` |
| UI-ADM-AUDIT | 判断ログ/監査検索 | nav `audit` | `apps/admin/app.html:84`, `apps/admin/app.html:3756` |
| UI-ADM-DEV-MAP | Repo Map/運用証跡マップ | nav `developer-map` | `apps/admin/app.html:88`, `apps/admin/app.html:3825` |
| UI-ADM-MANUAL-REDAC | 取説（Redac） | dev nav | `apps/admin/app.html:118`, `apps/admin/app.html:3935` |
| UI-ADM-MANUAL-USER | 取説（ユーザー） | dev nav | `apps/admin/app.html:122`, `apps/admin/app.html:3995` |
| UI-ADM-LLM | LLM支援 | nav `llm` (admin/developer) | `apps/admin/app.html:76`, `apps/admin/app.html:4039` |
| UI-ADM-SETTINGS | 設定 | nav `settings` | `apps/admin/app.html:72`, `apps/admin/app.html:4336` |
| UI-ADM-MAINTENANCE | 回復・保守 | nav `maintenance` (admin/developer) | `apps/admin/app.html:80`, `apps/admin/app.html:4401` |
| UI-ADM-LEGACY-ENTRY | legacy URL群（互換導線） | `/admin/ops` `/admin/composer` など | `src/shared/adminUiRoutesV2.js:3-67`, `src/index.js:452` |

## 3) 事実: ナビ/シェル構造

- 左ナビは4グループ構成。
  - `dashboard/run/control/developer` (`apps/admin/app.html:14`, `apps/admin/app.html:26`, `apps/admin/app.html:58`, `apps/admin/app.html:94`)
- 同一paneへの重複導線が存在。
  - `monitor` に `配信結果` と `ジャーニー状況` が同時に接続 (`apps/admin/app.html:32`, `apps/admin/app.html:36`)
- Topbarにも developer 操作群が存在し、左ナビと導線重複。
  - `#topbar-dev-map` など (`apps/admin/app.html:163-172`)
- role switch は UI上で即時切替可能（運用/管理/開発）。
  - (`apps/admin/app.html:154-156`, `apps/admin/assets/admin_app.js:2733-2787`)

## 4) 事実: UIコンポーネント群

- 共通骨格
  - left nav: `.app-nav` (`apps/admin/app.html:11`)
  - top bar: `.app-topbar` (`apps/admin/app.html:129`)
  - page header: `.page-header` (`apps/admin/app.html:178`)
  - system banner群: guard/preflight/fixture (`apps/admin/app.html:195-220`)
- 面内パターン
  - decision card (`apps/admin/app.html:225`, `apps/admin/app.html:633`, `apps/admin/app.html:1013`)
  - pane grid main/detail/actions (`apps/admin/app.html:1032-1034`, `apps/admin/app.html:2075-2091`)
  - compact tables + sort buttons (`apps/admin/app.html:962-970`, `apps/admin/app.html:2474-2480`)
  - details(JSON/RAW) blocks (`apps/admin/app.html:995-1002`, `apps/admin/app.html:2536-2538`)

## 5) 事実: write操作（UI起点）

- JS上の write 呼び出しは `postJson()` で集中。
  - composer: draft/preview/approve/send plan/execute (`apps/admin/assets/admin_app.js:14579`, `14609`, `14645`, `14683`, `14727`)
  - city pack: create/content/retire/import/audit (`apps/admin/assets/admin_app.js:7693`, `7823`, `7845`, `12510`, `12591`)
  - rich menu/journey/task rules (`apps/admin/assets/admin_app.js:9527`, `9558`, `11224`, `11386`, `11153`)
- 高リスク操作の多くは `window.confirm()` ガードを使用。
  - (`apps/admin/assets/admin_app.js:2119`, `9551`, `11217`, `14721`, `15630`)

## 6) 事実: API接続（route契約）

- canonical route 契約は `adminUiRoutesV2`。
  - `/admin/app` を正規シェルに定義 (`src/shared/adminUiRoutesV2.js:5-10`)
  - `/admin/*` legacyは pane redirect (`src/shared/adminUiRoutesV2.js:12-67`)
- `/api/admin/os/*` は `src/index.js` で大規模ルーティング分岐。
  - kill-switch/config/task-rules/journey/notifications など (`src/index.js:1927-2359`)
- read-model, link-registry, city-pack, llm も別系統で分岐。
  - (`src/index.js:3596-3785`, `src/index.js:1154-1271`, `src/index.js:2441-2543`)

## 7) Phase1: UI情報アーキテクチャ分類

| Layer | Screen | Purpose | User Task | Data Source | Write Action | Risk Level |
|---|---|---|---|---|---|---|
| Dashboard | Home / Feature Catalog / Ops Health | 全体状況把握 | KPI確認、要対応把握 | `/api/admin/os/dashboard/kpi`, `/api/admin/ops-system-snapshot` | 一部あり（snapshot rebuild） | Medium |
| Workbench | Composer / Monitor / Emergency | 通知運用・実行 | 作成、承認、送信、監視、緊急対応 | `/api/admin/os/notifications/*`, `/api/admin/monitor-insights`, `/api/admin/emergency/*` | 多数 | High |
| Data | City Pack / Vendors / Read Model | データ管理・閲覧 | 一覧/詳細/更新 | `/api/admin/city-*`, `/api/admin/vendors`, `/admin/read-model/notifications` | 多数 | High |
| LLM | LLM支援 | LLM設定/説明/利用監視 | policy/config確認・適用 | `/api/admin/llm/*`, `/api/admin/os/llm-usage/*` | あり | High |
| Evidence | Audit / Repo Map / Trace | 監査・証跡追跡 | trace検索、監査確認 | `/api/admin/trace`, `/api/admin/repo-map`, `/api/admin/legacy-status` | 低（主にread） | Medium |
| System | Settings / Maintenance / Local Preflight | 権限/診断/回復 | 設定確認、保守操作 | `/api/admin/local-preflight`, `/api/admin/os/kill-switch/*` | あり | High |

## 8) Phase1 問題検出（構造）

### 事実
- 目的重複: monitor導線が重複 (`apps/admin/app.html:32`, `apps/admin/app.html:36`)
- Evidence/System/Workbench が同一画面中で混在。
  - 例: monitor内に runtime編集 + insights + diagnostics + decision card (`apps/admin/app.html:1552`, `1827`, `1934`, `2009`)
- Dashboard肥大化: Homeに realtime ops + 多数KPIカード + preflight banner を同居 (`apps/admin/app.html:242`, `257`, `200`)

### 未観測
- 実際の write成功後の全UI状態（実行禁止のため、fixture以外は未観測）

## 9) Phase4: データ構造理解性監査

| Entity | UI Visibility | Structure Clarity | UX Issue | Evidence |
|---|---|---|---|---|
| User | users summary + read model + monitor | 中 | 同一ユーザー情報が3面に分散 | `apps/admin/app.html:1045`, `3338`, `3498` |
| Notification | composer form + saved table + monitor list | 高 | 状態遷移(草案→承認→計画→送信)は複数パネル分散 | `apps/admin/app.html:699`, `880`, `1000` |
| Journey | monitor journey panel | 中 | 編集JSONと運用監視が同一面で混在 | `apps/admin/app.html:1552-1707` |
| CityPack | city-pack unified + legacy + detail | 高 | v2/v1/legacyブロック同居で認知負荷高 | `apps/admin/app.html:2417`, `2526`, `2541` |
| Evidence | audit + city-pack evidence + managed action evidence | 中 | 証跡UIが複数面に分割 | `apps/admin/app.html:190`, `3107`, `3756` |

## 10) 監査結論（構造のみ）

### 事実
- Admin UIは「単一シェル + 多pane」構造で統一されている。
- ただし pane内の責務分離は不均一で、Workbench/Evidence/System の混在が複数面で確認された。

### 推論
- 画面単位の責務境界が曖昧なため、運用者の「どこで判断し、どこで実行し、どこで証跡確認するか」が固定されにくい。

### 未観測
- 実データ正常時の full-path（create→approve→send→evidence反映）は未観測。
