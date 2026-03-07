# COMPONENT_MAP.md

## 0. Basis
This map is derived only from:
- `ADMIN_UI_STRUCTURE.md`
- `ADMIN_UI_NAV_AUDIT.md`
- `ADMIN_UI_WORKBENCH_AUDIT.md`
- `ADMIN_UI_VISUAL_ANALYSIS.md`
- `ADMIN_UI_REDESIGN.md`

## 1. Shared Shell Components

| Component | Layer | Current Evidence | Target Responsibility |
|---|---|---|---|
| `LeftNav` | Global | `ADMIN_UI_STRUCTURE.md` section 3 | 作業カテゴリ導線のみ。重複導線を持たない |
| `TopBar` | Global | `ADMIN_UI_STRUCTURE.md` section 3 | role表示 + 軽量ショートカットのみ |
| `PageHeader` | Global | `ADMIN_UI_STRUCTURE.md` section 4 | 画面目的・主CTA表示 |
| `DecisionCard` | Global | `ADMIN_UI_STRUCTURE.md` section 4 | 状態要約のみ（実行操作を持たない） |
| `SystemBanner` | System | `ADMIN_UI_VISUAL_ANALYSIS.md` section 3,4 | summary-first / expand-detail |

## 2. Dashboard Components

| Component | Current Problem | Redraw |
|---|---|---|
| `DashboardSummary` | preflight占有で視線競合 | fold上に最小要約を固定 |
| `DashboardKpiGrid` | 初期表示でfold下落ち | card数を初期最小化 + 展開導線 |
| `DashboardPrimaryCta` | decision/action/headerで重複 | 1つに統一 |
| `DashboardDiagnosticsPanel` | 長文が主導線を遮断 | accordionへ移設 |

## 3. Composer Workbench Components

| Component | Current Evidence | Target |
|---|---|---|
| `ComposerStateBar` | `ADMIN_UI_WORKBENCH_AUDIT.md` (状態分散) | Draft -> Approve -> Plan -> Send を1ライン表示 |
| `ComposerScenarioMap` | `ADMIN_UI_WORKBENCH_AUDIT.md` (全体不可視) | シナリオ全体図をフォーム隣接表示 |
| `ComposerFormSchema` | type field長尺 | type別 required/optional を明示制御 |
| `ComposerPreviewSafety` | previewとsafetyが分離 | プレビュー+安全チェック統合 |
| `ComposerSavedViewList` | フィルタはあるが保存ビュー弱い | saved views + universal filters |
| `ComposerInternalMetaPanel` | internal key露出 | 初期折りたたみ詳細へ隔離 |

## 4. Monitor Components

| Component | Current | Target |
|---|---|---|
| `MonitoringOverview` | runtime編集と混在 | 監視専用（KPI/異常/履歴） |
| `MonitoringUserTimeline` | 有効 | 監視面に残置 |
| `MonitorInsights` | 診断混在 | 監視面に残置（設定UIと分離） |
| `RuntimeConfigPanel` | monitor内混在 | `Monitor Configuration` 面へ分離 |

## 5. City Pack Components

| Component | Current | Target |
|---|---|---|
| `CityPackList` | v2/v1/legacy混在 | list面に統合 |
| `CityPackEditor` | list/detailに分散 | editor面で編集集中 |
| `CityPackHistory` | 複数panel散在 | history面へ統合 |
| `CityPackEvidencePanel` | detail末尾に混在 | evidence面に独立 |

## 6. Evidence Components

| Component | Current | Target |
|---|---|---|
| `TraceSearch` | audit pane | 統合Evidenceビューの入口 |
| `ActionEvidence` | managed-action-evidence + audit分散 | traceIdキーで単一表示 |
| `CityPackEvidence` | city-pack専用に局所化 | 統合Evidenceで横断表示 |
| `RouteAuditLogViewer` | developer/auditに分散 | Evidenceタブ内に統合 |

## 7. State/Feedback Components

| Component | Current Evidence | Target Rule |
|---|---|---|
| `StatusBadge` | badge/pill/decision-state併存 | 語彙/色/位置を統一 |
| `Toast` | `showToast()`多用 | 操作結果の短期通知専用 |
| `InlineError` | 一部inputで弱い | 入力項目直下に必ず表示 |
| `EmptyState` | `データなし`多用 | 「空理由 + 次アクション」へ強化 |
| `LoadingState` | 画面差分あり | skeleton/読み込み文言を統一 |

## 8. Permission/Role Components

| Component | Current | Target |
|---|---|---|
| `RoleSwitch` | 可視面積が大きく変動 | 可視差分理由を明示し局所化 |
| `PermissionGuardNotice` | role-hidden中心で説明不足 | 非表示/無効理由を可視表示 |
| `FeatureFlagVisibility` | `is-hidden-by-flag` 散在 | flag理由と表示規則を統一 |

## 9. Add-only Mapping Rule

- 既存ID/selectorは維持し、新UIコンポーネントはラッパー導入で段階置換。
- 既存route/API契約は不変、UI構成のみ再配線。
- 旧componentはcompat layerで残し、PR単位で縮退。
