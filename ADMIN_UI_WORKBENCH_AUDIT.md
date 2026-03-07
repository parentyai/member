# ADMIN UI Workbench Audit (Composer / Operation Flow)

- Audit date: 2026-03-07
- Scope: Composer中心 + 実作業フロー（read-only観測）
- Rule: 書き込み操作は実行せず、操作導線のみ観測

## Phase3) 通知ワークベンチ（Composer）監査

### 事実
- Composer pane は decision card + details内 workspace 構造。
  - `apps/admin/app.html:632-1010`
- 主要 write操作は `draft/approve/plan/execute`。
  - ボタン: `#create-draft`, `#approve`, `#plan`, `#execute` (`apps/admin/app.html:664-671`)
  - API: `/api/admin/os/notifications/*` (`apps/admin/assets/admin_app.js:14579`, `14645`, `14683`, `14727`)
- タイプ別入力差分あり。
  - `ANNOUNCEMENT/VENDOR/AB/STEP` field block (`apps/admin/app.html:792-874`)
- 状態は pill + toast + result pre で表現。
  - `#composer-status-pill`, `showToast()`, `#draft-result/#plan-result/#execute-result`
  - (`apps/admin/app.html:661`, `995-1002`, `apps/admin/assets/admin_app.js:2374-2384`)

### コンポーネント評価

| Component | Purpose | Issue | UX Severity |
|---|---|---|---|
| Composer decision card | 面の要約/CTA | 同系CTAが header・card・form内で重複 | High |
| Live preview panel | 送信内容確認 | Safety理由と入力不足が別領域で同期しづらい | Medium |
| Type-specific fields | 通知タイプ別入力 | タイプ変更時の必須差分が1画面内で長く、全体把握しにくい | High |
| Saved notifications table | 既存通知再利用/編集 | フィルタ項目が多く、主行動（承認/送信）に対し探索コスト高 | Medium |
| Scenario-step matrix | STEP可視化 | WorkbenchにEvidence/Developer用途が混在 | Medium |
| Internal details block | planHash/confirmToken確認 | 運用者向け主操作の近くに内部キーが露出 | High |

### 検出（指定項目）

- タイプ別入力差分: あり (`apps/admin/app.html:792-874`)
- 状態機械不透明: あり（DRAFT/ACTIVE/PLAN/SENT が複数UI部位に分散）
  - `apps/admin/assets/admin_app.js:14589-14745`
- シナリオ全体不可視: あり（scenario/stepはあるが全体フローの単一ビューがない）
- 操作重複: あり（同機能ボタンのミラー）
  - `bindComposerCardActionMirrors()` (`apps/admin/assets/admin_app.js:14532-14551`)
- Evidence混入: あり（詳細（内部キー）ブロックが本作業面に常在）
  - `apps/admin/app.html:995-1002`

## Phase5) 作業フロー監査（Playwright + URL遷移）

### 事実
- 左ナビ遷移時、URL `pane=` が同期される。
  - `apps/admin/assets/admin_app.js:1044-1054`, `3982-3985`
- deep link / back 対応ロジックあり。
  - `resolvePaneFromLocation`, `setupHistorySync` (`apps/admin/assets/admin_app.js:3890-3900`, `4009-4015`)

### 操作ログ（read-only）

| Flow | 操作 | 期待 | 観測結果 | 証跡 |
|---|---|---|---|---|
| 通知作成導線 | Home → 左ナビ `作成` | Composer到達 | 到達。URL `pane=composer` | Playwright snapshot (2026-03-07), `apps/admin/assets/admin_app.js:3982-3985` |
| 通知承認導線 | Composer内 `承認（有効化）` | confirm→approve API | ボタン/confirm/API接続を確認。実行は未実施 | `apps/admin/app.html:667`, `apps/admin/assets/admin_app.js:14620-14656` |
| 通知送信導線 | Composer内 `送信計画`→`送信実行` | planHash/confirmToken連鎖 | 連鎖ロジック確認。実行未実施 | `apps/admin/assets/admin_app.js:14659-14747` |
| シナリオ編集導線 | Monitor `Journey Map / Rule Editor` | runtime/plan/set操作 | 到達確認。操作群多数、面内密度高 | `apps/admin/app.html:1552-1707` |
| CityPack更新導線 | 左ナビ `City Pack管理` | list→detail→更新 | 到達確認。create/save/retire等のwrite操作あり | `apps/admin/app.html:2320-3133`, `apps/admin/assets/admin_app.js:7693-7847` |
| Evidence確認導線 | CityPack/Monitor/Audit | trace/evidence参照 | 到達確認。証跡表示が複数paneに分散 | `apps/admin/app.html:190-193`, `3107-3126`, `3756-3775` |

### ブロッカー（実行時）

- local preflight banner が上位に表示され、Firestore依存API失敗を継続通知。
  - UI文言: `ADC_REAUTH_REQUIRED`
  - 影響: 多くの一覧が `データなし/情報なし` 化
- Console/network error が高頻度。
  - `artifacts/ui-ux-audit-20260307/console.log`

## 事実/推論/未観測

### 事実
- Composer は入力・安全チェック・一覧再編集・内部キー確認を単一paneで担っている。
- 操作は可能だが、主要導線に診断バナー/データ欠落が重なると作業文脈が途切れる。

### 推論
- 「通知作成→承認→送信」の正常系でも、UI要素の同居密度が高く判断順序が固定されにくい。

### 未観測
- 承認成功/送信成功後の実データ反映（write禁止のため未観測）。
