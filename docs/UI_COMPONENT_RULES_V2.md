# UI_COMPONENT_RULES_V2

更新日: 2026-03-06

## 目的
- 管理UIの状態表現を `success / in_progress / pending / warn / error / forbidden / disabled / unset / testing` に統一する。
- 既存クラス互換（`badge-*`, `toast.*`, `row-health-*`）を維持しながら、新しい `state-*` 契約を追加する。

## 対象ファイル
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`

## 状態コンポーネント規則

### 1. StatusBadge
- 実装: `applyBadgeState(el, value, tone, options)`
- 付与属性:
  - `data-ui-state=<normalized-state>`
  - `data-ui-message-level=inline`（必要箇所）
- 主要クラス:
  - `badge-ok`
  - `badge-warn`
  - `badge-danger`
  - `badge-info`
  - `badge-unset`
  - `badge-disabled`
  - `state-*`

### 2. Toast
- 実装: `showToast(message, tone)`
- 付与属性:
  - `data-ui-message-level=toast`
  - `data-ui-state=<normalized-state>`
- 主要クラス:
  - 既存互換: `ok | warn | danger`
  - 新規契約: `state-success | state-pending | state-in_progress | state-warn | state-error | state-forbidden | state-disabled | state-unset | state-testing`

### 3. RowHealth
- 実装: `applyRowHealthState(rowEl, tone)`
- 付与属性:
  - `data-ui-state=<normalized-state>`
- 主要クラス:
  - 既存互換: `row-health-ok | row-health-warn | row-health-danger`
  - 新規契約: `row-state-*`

### 4. Banner
- 実装: `applyBannerState(el, tone, level)`
- 付与属性:
  - `data-ui-state=<normalized-state>`
  - `data-ui-message-level=system|section`
- 主要クラス:
  - 既存互換: `is-danger | is-warn`
  - 新規契約: `is-ok`

## メッセージ階層の表示領域
- `system`: `#admin-guard-banner`, `#admin-local-preflight-banner`, `#ui-fixture-success-banner`
- `section`: `#composer-killswitch-banner`
- `inline`: `#composer-cta2-notice` ほか `inline-notice`
- `toast`: `#toast`

## 実装ルール
- add-onlyで導入する（既存CSS互換を先に壊さない）。
- 既存APIレスポンス契約は変更しない。
- 新規UIキー追加が必要な場合は辞書 `ADMIN_UI_DICT` ブロックに登録する（PR2では新規キー未追加）。

## 検証
- `npm run test:docs`
- `npm run test:admin-nav-contract`
