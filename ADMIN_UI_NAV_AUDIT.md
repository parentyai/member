# ADMIN UI Navigation Audit (Left-nav first)

- Audit date: 2026-03-07
- Scope: left nav, top chips, context links, role visibility
- Evidence source: `apps/admin/app.html`, `apps/admin/assets/admin_app.js`, `apps/admin/assets/admin.css`, Playwright snapshots

## Phase2-1) 事実: ナビ構造

- 左ナビは 3つの primary group + 1つの secondary developer group。
  - `dashboard/run/control/developer` (`apps/admin/app.html:14`, `26`, `58`, `94`)
- 左ナビは pane切替の主導線。
  - click handler で `activatePane(target)` (`apps/admin/assets/admin_app.js:2791-2795`)
- role/rollout/allow 条件で表示を動的制御。
  - role filter (`apps/admin/assets/admin_app.js:2637-2656`)
  - group visibility (`apps/admin/assets/admin_app.js:2659-2691`)
  - dedupe by pane (`apps/admin/assets/admin_app.js:1083-1116`, `1178-1182`)

## Phase2-2) 監査表

| Item | Location | Visible | Role 제한 | UX Issue |
|---|---|---|---|---|
| Dashboard nav | left nav group dashboard | 常時 | operator/admin/developer | なし（単純導線） |
| Composer nav | left nav group run | 常時 | operator/admin/developer | なし |
| Monitor nav | left nav group run | 常時 | operator/admin/developer | `配信結果` と `ジャーニー状況` が同一 pane `monitor` へ重複導線 |
| City Pack nav | left nav group run | 常時 | operator/admin/developer | 面内情報量が大きく、ナビだけでは作業種別を分離できない |
| LLM nav | left nav group control | 条件付き | `data-role-allow="admin,developer"` | operator視点で同カテゴリ内に不可視項目が発生 |
| Maintenance nav | left nav group control | 条件付き | `data-role-allow="admin,developer"` | operator/adminで群内密度が変動 |
| Developer map nav | left nav group control | 条件付き | `data-role-allow="admin,developer"` | control配下に evidence/developer 面が混在 |
| Developer secondary nav group | left nav group developer | developerのみ | `data-role="developer"` + chrome hide | topbar developer buttonsと役割重複 |
| Top developer chips | topbar `.top-developer` | admin/developer | `data-role-allow` + JS hide | 左ナビと同じ遷移先が重複 |
| Role switch | topbar role buttons | 常時(ただしdeveloperボタン非表示条件あり) | JSで `data-hide-developer-role` | ロール切替とナビ可視制御の結合度が高い |

Evidence:
- nav items: `apps/admin/app.html:20-88`
- duplicate monitor entry: `apps/admin/app.html:32`, `apps/admin/app.html:36`
- role-gated entries: `apps/admin/app.html:76-88`
- topbar developer chips: `apps/admin/app.html:163-172`
- role hidden CSS: `apps/admin/assets/admin.css:315-321`, `636`, `3095`
- role policy JS: `apps/admin/assets/admin_app.js:2637-2779`

## Phase2-3) 事実: 二次ナビ / コンテキストリンク

- Topbarに developer shortcut 群（Repo Map, Audit, Manual）が存在。
- decision card 内 action buttons（作成・編集 / 有効化・公開 / 停止・無効化）が多paneで再利用。
  - 例: home/composer/monitor/city-pack (`apps/admin/app.html:236-240`, `643-647`, `1025-1027`, `2311-2313`)
- page header actions (`#page-action-primary`, `#page-action-secondary`) も存在し、文脈操作が複数箇所に散在。
  - (`apps/admin/app.html:184-186`, `apps/admin/assets/admin_app.js:2622-2634`)

## Phase2-4) UX破綻（ナビ観点）

### 事実
- 導線重複: left nav + topbar + decision card で同一遷移先を複数提示。
- role切替時に UI可視面積が大きく変化（operatorでdeveloper導線非表示）。
- monitor/city-pack は1 pane 内に複数ジョブ型UIが同居し、ナビ粒度と作業粒度が一致しない。

### 推論
- ナビを唯一導線として見たとき、画面名だけでは「作成/監視/証跡確認」の境界が弱く、誤遷移と再探索が増える構造。

### 未観測
- role別 full menu の比較スクリーンショット（operator/admin/developerの同一時点比較）は一部のみ取得済み。

## Phase2-5) Playwright証跡

- Home snapshot (operator): left navに `ダッシュボード/作成/配信結果/City Pack管理/...` を確認。
- click `作成` で URL が `pane=composer` に同期。
- click `配信結果` で URL が `pane=monitor` に同期。
- click `City Pack管理` で URL が `pane=city-pack` に同期。

Evidence:
- Runtime snapshot log (this audit run): `http://127.0.0.1:18081/admin/app?...&pane=home/composer/monitor/city-pack`
- Console/network error trace: `artifacts/ui-ux-audit-20260307/console.log`
