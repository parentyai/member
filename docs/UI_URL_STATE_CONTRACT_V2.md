# UI URL / View-State Contract V2

更新日: 2026-03-06

## 目的
Admin UIのURLと画面状態の不一致を防ぐ。

## 契約
1. 入力
- `?pane=<pane>` を優先して初期paneを決定する
- hashにも対応する（`#pane` / `#?pane=<pane>`）

2. 遷移
- pane切替で `history.pushState|replaceState` を更新する
- state payloadに `pane` と `role` を保持する

3. 復元
- `popstate` 時に role + pane を同期復元する
- `hashchange` 時に hash由来paneへ同期する

4. DOM可視化
- `#app-shell[data-view-pane]` に現在paneを反映する

5. 検証用成功表示
- `?ui_fixture=success` 時、`#ui-fixture-success-banner` を表示し
  role/paneを明示する

## 対応実装
- `apps/admin/assets/admin_app.js`

## CI契約
- `tests/phase674/phase674_t16_ui_url_state_contract.test.js`
- `tests/phase674/phase674_t18_ui_success_fixture_contract.test.js`
