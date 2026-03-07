# PR_PLAN.md

## 0. Plan Policy
- add-only
- backward-compatible
- one-PR-one-purpose
- each PR independently revertible
- facts sourced from existing audit docs only

## 1. PR Sequence Overview

| PR | Theme | Goal |
|---|---|---|
| PR1 | Dashboard整理 | fold上で判断可能な最小画面へ再編 |
| PR2 | Composer再設計 | 状態バー中心のワークベンチ化 |
| PR3 | Monitor分離 | Monitoring / Configurationの責務分離 |
| PR4 | Evidence統合 | traceId基点の証跡統合ビュー化 |
| PR5 | CityPack整理 | v1/v2/legacy混在の解消 |
| PR6 | 視認性改善 | banner/nav/fold/JSON表示規則の統一 |

## 2. PR1 Dashboard整理

### Scope
- preflight/guardの表示階層整理（summary-first）
- dashboard fold上要素の再配置
- realtime ops/evidence詳細の移設準備

### Touch list (planned)
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- docs: `UI_REDRAW.md`, `COMPONENT_MAP.md`

### Acceptance
1. fold上に状態サマリ+要対応+主CTA+KPI最小セットが同時表示
2. preflight詳細は展開時のみ表示
3. URL/route契約は不変

## 3. PR2 Composer再設計

### Scope
- `ComposerStateBar` 導入
- CTA重複削減（state barへ集約）
- schema-driven input（required/optional）
- safety check統合
- internal key折りたたみ

### Touch list (planned)
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- docs: `STATE_MACHINE.md`, `COMPONENT_MAP.md`

### Acceptance
1. Draft->Approve->Plan->Sendを1ライン表示
2. type別必須項目が明示される
3. execute前条件が同一領域で確認できる

## 4. PR3 Monitor分離

### Scope
- monitor内の混在責務を2面へ分離
  - Monitoring
  - Configuration
- 既存route互換を維持したpane内タブ/サブビュー化

### Touch list (planned)
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`

### Acceptance
1. 監視作業時に設定JSON編集が初期表示されない
2. config作業は明示遷移で到達
3. monitorの既存データ読込契約は維持

## 5. PR4 Evidence統合

### Scope
- `Trace Search`, `Action Evidence`, `CityPack Evidence` の統合入口
- `traceId` 主キーで関連イベント表示

### Touch list (planned)
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- optional docs updates

### Acceptance
1. 任意のtraceIdで統合ビュー到達
2. 既存audit/city evidence表示を段階移設
3. 既存APIはそのまま利用

## 6. PR5 CityPack整理

### Scope
- list/editor/history/evidence の面分離
- v1/v2/legacy同居の縮退
- row actionとdetail表示ルール統一

### Touch list (planned)
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`

### Acceptance
1. list面で一覧判断が完結
2. editor面で更新作業が完結
3. evidence面で証跡確認が完結

## 7. PR6 視認性改善

### Scope
- banner accordion化
- nav幅/レスポンシブ規則の固定
- KPI fold上要件の最終調整
- JSON/RAW折りたたみ既定化

### Touch list (planned)
- `apps/admin/assets/admin.css`
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`

### Acceptance
1. 1440/1280/1024で主導線がfold上に保持
2. bannerが主CTAを隠さない
3. 1024でナビ全幅化を回避

## 8. Cross-PR Safety Gates

1. route契約維持
- `src/shared/adminUiRoutesV2.js` の意味を変更しない

2. API契約維持
- `src/index.js` と `src/routes/admin/*` のI/O互換を維持

3. Rollback
- 各PRを独立revert可能にする

4. Evidence
- before/after screenshotを各PRで保存
- role別（operator/admin/developer）差分を確認

## 9. Deferred / Unobserved

- write成功時UIの完全再現は現時点で未観測（監査時制約）
- Firestore接続正常時の最終チューニングはPR終盤で再観測が必要
