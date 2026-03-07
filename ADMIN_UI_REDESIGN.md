# ADMIN UI Redesign Input (Design-only, No Implementation)

- Audit date: 2026-03-07
- This document is Phase7-10 output for redesign planning only.
- 実装は未実施。

## Phase7) SaaS UIベンチマーク比較

| UI Feature | Member (Observed) | Best SaaS Reference | Gap |
|---|---|---|---|
| Saved views | Composer/CityPackは個別フィルタ中心で保存ビューの明示導線が弱い | Linear `Custom Views`（保存・共有・お気に入り）: https://linear.app/docs/custom-views | 画面横断の「再利用可能な作業ビュー」が不足 |
| Universal filtering | 画面ごとにフィルタ実装が分散（id/status/date等） | Linear `Filters`（ほぼ全viewでfilter、viewへ保存）: https://linear.app/docs/filters/ | フィルタ操作の一貫性が不足 |
| Dashboard customization | Homeは固定カード構成で診断バナーが上位占有 | Stripe Dashboard basics（home widget追加/削除、一覧フィルタ/エクスポート）: https://docs.stripe.com/dashboard | 主作業前にノイズが先行し、情報優先順位を崩す |
| List + detail context | monitor/city-packで詳細表示はあるが責務が多重 | Notion `Open pages in side peek/center peek/full page`: https://www.notion.com/help/views-filters-and-sorts | 一覧文脈を保つ詳細操作の規則が弱い |
| View settings model | 各paneで独自の設定UI | Notion view settings（layout/properties/filter/sort/group一元）: https://www.notion.com/help/views-filters-and-sorts | 設定操作の学習コストが高い |
| Index tabs / saved views | ナビ+paneはあるが、業務別のタブ化が限定 | HubSpot saved views + view tabs: https://knowledge.hubspot.com/records/create-and-manage-saved-views | 「作業単位の固定導線」を個人/チームで再利用しにくい |
| Role permission explanation | role hidden はあるが理由提示は部分的 | HubSpot permissions/visibility運用（参照: https://knowledge.hubspot.com/user-management/hubspot-user-permissions-guide） | 非表示理由の可視化が不均一 |

### 事実
- ベンチマーク参照はすべて公開ドキュメントの操作構造（見た目ではなく運用機能）を比較対象とした。

### 未観測
- 各SaaSの最新UIスクリーン実地比較（本監査はMember repo中心のため、機能文書比較まで）。

## Phase8) UX破綻ポイント TOP10

| Rank | Issue | Impact | Evidence |
|---|---|---|---|
| 1 | preflight/system bannerが fold上で主面積を占有 | 主CTAが埋もれ、初動判断が遅延 | `apps/admin/app.html:200-220`, Playwright 1440/1280/1024 metrics |
| 2 | 同一paneへの重複導線（monitor） | 遷移意図が曖昧化 | `apps/admin/app.html:32`, `36` |
| 3 | 作業導線の多重化（left nav + topbar + decision card） | どこが主導線か不明瞭 | `apps/admin/app.html:163-172`, `236-240`, `643-647` |
| 4 | Composerで実務入力と内部キー表示が同居 | 認知切替コスト増、誤操作リスク増 | `apps/admin/app.html:699-874`, `995-1002` |
| 5 | City Packで v2/v1/legacyブロック同居 | 画面責務が過密 | `apps/admin/app.html:2417-2542` |
| 6 | monitorで運用監視と設定変更系UIが同居 | 監視タスク中に編集導線が混入 | `apps/admin/app.html:1552-1707`, `1827-1936` |
| 7 | 空状態と失敗状態の視覚差が弱い | 原因切り分けが遅い | `apps/admin/assets/admin_app.js:2431`, `1849`, `4351` |
| 8 | role切替で可視領域が大きく変動 | 同一手順の再現性低下 | `apps/admin/assets/admin_app.js:2637-2779`, `apps/admin/assets/admin.css:315-321` |
| 9 | 1024幅でナビがほぼ全幅化 | 本文アクセスまでの操作距離増 | Playwright metric: left nav `1009x764` |
| 10 | API失敗時に多pane同時劣化 | 作業停止が連鎖 | `artifacts/ui-ux-audit-20260307/console.log` |

## Phase9) UI再設計原則（監査結果由来）

1. ワークベンチ中心
- 作業面と監査面を分離し、1画面1主目的を固定する。

2. 状態機械可視
- `draft/approved/planned/sent` を単一位置・単一語彙で表示する。

3. スキーマ駆動入力
- 通知タイプごとに必須/任意/非表示を明示し、入力領域を段階化する。

4. 全体像ビュー
- homeは「判断要約」と「次アクション」のみ fold上に固定する。

5. Evidence分離
- trace/raw/internal key は detail rail か evidence pane に集約する。

6. Dashboard簡素化
- preflightは要約 + 展開に縮約し、復旧コマンド本文は初期折りたたみ。

## Phase10) 改善設計（構造案）

## A. 通知ワークベンチ
- 上段: 状態/主CTA（下書き, 計画, 実行）
- 中段左: 入力フォーム（タイプで段階表示）
- 中段右: ライブプレビュー + 安全チェック
- 下段: 通知一覧（保存ビュー + filter + row action）
- 別枠: 内部キー/trace（初期非展開）

## B. ジャーニータイムライン
- monitorから「監視」と「設定」を分離
- 監視面: KPI/異常/対象一覧
- 設定面: graph/policy編集（明示的に別面）

## C. データ構造ビュー
- read-model / users-summary / city-pack を entity別に入口整理
- 一覧→詳細は side panel を基本にし、ページ遷移を最小化

## D. Evidenceビュー
- trace検索、action evidence、city-pack evidence を統合検索入口に集約
- `traceId` を主キーに、関連操作を時系列表示

## E. Dashboard
- fold上: 「状態サマリ」「要対応件数」「主CTA」
- fold下: KPI詳細カード
- preflight詳細はaccordion化

## 事実 / 推論 / 未観測

### 事実
- 現行UIは運用面/設定面/証跡面の要素が同時表示される面が複数存在する。

### 推論
- 画面責務の分離を先に行うと、運用者の判断速度と誤操作耐性の改善余地が最も大きい。

### 未観測
- 正常接続時データでの最終レイアウト評価（現在はFirestore失敗が継続）。
