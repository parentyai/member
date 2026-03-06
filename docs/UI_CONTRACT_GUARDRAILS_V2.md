# UI Contract Guardrails V2

更新日: 2026-03-06

## 目的
- Admin UI改修で運用者向け表示と導線契約を壊さないための防波堤を定義する。
- PR0で追加した契約テストの判定基準を固定する。

## 対象
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`
- `tests/phase674/*.test.js`

## 契約（PR0）
1. 禁止語防火壁
- operator/admin 面で以下を表示しない。
- `pane`
- `rollout`
- `not available`
- `providerKey`

2. DOM/selector 安定化
- シェル: `data-ui="admin-shell"`
- 左ナビ: `data-ui="left-nav"`
- 本文: `data-ui="content-root"`
- topbar: `data-ui="topbar"`
- page header: `data-ui="page-header"`
- pane面: `.app-pane[data-pane][data-surface][data-ui="surface"]`
- 主操作: `data-control` を主要ボタンへ付与

3. URL/view-state 契約
- paneは query/hash から復元できること
- `popstate` / `hashchange` で画面同期できること
- `history.pushState|replaceState` に `pane` / `role` を保持すること
- `#app-shell[data-view-pane]` で現在paneをDOM可視化すること

4. safe fixture success 契約
- `?ui_fixture=success` で書き込みなしの成功表示を可視化できること
- 表示先: `#ui-fixture-success-banner`
- role/paneを表示し、read-only観測で証跡取得できること

## 検証コマンド
- `npm run test:admin-nav-contract`
- `npm run test:docs`

## ロールバック
- PR0差分をrevertすれば契約追加前に戻る。
