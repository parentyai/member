# UI_REDRAW.md

## 0. Scope
- This is a redesign blueprint only.
- Source of truth: `ADMIN_UI_STRUCTURE.md`, `ADMIN_UI_WORKBENCH_AUDIT.md`, `ADMIN_UI_VISUAL_ANALYSIS.md`, `ADMIN_UI_NAV_AUDIT.md`, `ADMIN_UI_REDESIGN.md`.
- Constraints: 推測禁止 / add-only / 既存互換維持 / PR分割。

## 1. Redraw Goal
管理UIを「機能の集合」から「作業が止まらないワークベンチ」に再構成する。

- 構造理解: どの画面が何の作業かを即判別できる
- 操作継続: banner/失敗状態が作業導線を遮断しない
- 安全性: 状態遷移が1つの視覚モデルで追える
- 証跡性: traceId起点で操作と結果を追跡できる

## 2. Current Structural Defects (from audit)

1. Dashboard fold破綻
- preflight/system bannerがfold上占有。
- KPIが初期表示で見えない。
- Evidence: `ADMIN_UI_VISUAL_ANALYSIS.md` section 2,3.

2. Workbench責務混在
- Composerで入力/状態/内部キー/一覧を過密同居。
- Evidence: `ADMIN_UI_WORKBENCH_AUDIT.md` section Phase3.

3. Monitor混在
- MonitoringとConfigurationが同一面に混在。
- Evidence: `ADMIN_UI_WORKBENCH_AUDIT.md` section Flow, `ADMIN_UI_REDESIGN.md` Rank 6.

4. City Pack混在
- v1/v2/legacy blockが同居。
- Evidence: `ADMIN_UI_STRUCTURE.md` Phase4 table, `ADMIN_UI_REDESIGN.md` Rank 5.

5. 導線重複
- left nav / topbar / decision card で同一遷移を多重提示。
- Evidence: `ADMIN_UI_NAV_AUDIT.md` section Phase2-4.

## 3. Target Information Architecture (Layered)

### 3.1 Dashboard
目的: 判断専用。

表示（fold上固定）
- 状態サマリ
- 要対応件数
- 主CTA（1つ）
- KPIサマリ（最小）

折りたたみ化
- preflight詳細
- 復旧コマンド全文
- 診断JSON

除外（Dashboardから移設）
- realtime ops操作
- evidence詳細
- 長文診断本文

### 3.2 Workbench
目的: 実行作業。

Composer target layout
```text
[State Bar: Draft -> Approve -> Plan -> Send]
[Scenario Overview] [Notification Form]
[Preview + Safety Check]
[Notification List + Saved Views]
```

原則
- 主CTAは状態バー起点に統一
- internal keyは詳細折りたたみへ隔離
- safety checkは入力エラーと同一文脈に統合

### 3.3 Data
目的: データ更新/確認。

- City Pack: List / Editor / History / Evidence を分離
- Vendors: list + detail を標準パターン化
- Read Model: 参照専用面として操作系を分離

### 3.4 LLM
目的: LLM設定/診断。

- LLM policy/config運用をSystem寄りに整理
- Workbench導線と混線しない配置

### 3.5 Evidence
目的: 証跡追跡。

共通ビュー化
- Trace Search
- Action Evidence
- City Pack Evidence

共通キー
- `traceId`

### 3.6 System
目的: 運用保守/復旧。

- preflight/guard/kill-switchをSystemに集約
- DashboardはSystemの要約のみ表示

## 4. Screen Redraw Map

| Current Surface | Target Zone | Redraw Action |
|---|---|---|
| home | Dashboard | 判断要素のみ残し、診断詳細はaccordion化 |
| composer | Workbench | state bar中心へ再編、CTA重複解消 |
| monitor | Workbench + System | Monitoring面とConfiguration面へ分割 |
| city-pack | Data + Evidence | v1/v2/legacy分割、evidence分離 |
| audit/developer-map | Evidence | traceId中心の統合入口へ再編 |
| maintenance/settings | System | 保守操作の集中面として整理 |

## 5. Navigation Redraw Rules

1. 左ナビは作業単位で固定。
2. 同一pane重複導線（monitor重複）を解消。
3. topbar shortcutは補助導線へ縮退。
4. decision card CTAは状態バー/作業バーに統合。
5. role切替は可視面積の変化を最小化（理由表示を追加）。

## 6. Visual Redraw Rules

1. bannerは summary-first, detail-expand。
2. KPIはfold上に最小セットを必置。
3. nav幅はbreakpointごとに固定挙動化。
4. JSON/RAWは初期折りたたみ。
5. empty/error/loading/success を同一位置・同一語彙で表示。

## 7. Compatibility Rules (must keep)

- route契約維持: `src/shared/adminUiRoutesV2.js`
- API I/O契約維持: `src/index.js` existing handlers
- add-only migration
- rollback可能性維持（PR単位revert）

## 8. Done Criteria for Redraw

1. Dashboard初期表示で主CTAと要対応件数が同時可視。
2. Composerで状態遷移が1ラインで追跡可能。
3. Monitorで監視作業と設定作業の面分離が成立。
4. City PackでList/Editor/Evidenceが分離。
5. traceId起点でEvidence統合ビューへ遷移可能。
