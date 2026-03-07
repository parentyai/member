# UI_TABLE_AND_DETAIL_RULES_V2

更新日: 2026-03-07

## 目的
一覧操作（検索・絞り込み・再読込）と詳細確認（右カラム）を同一文脈で完結させ、運用判断の往復コストを減らす。

## 対象
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `apps/admin/assets/admin.css`

## List + Detail 基本ルール
1. 一覧は `pane-main`、詳細は `pane-detail` に配置する。
2. 一覧行選択時に `pane-detail` を更新し、画面遷移は発生させない。
3. 未選択時の詳細は空状態文言を表示し、次操作を明示する。

## TableToolbar ルール
1. ツールバーは表の直上に集約する。
2. 項目順は `saved view -> search -> status filter -> reload` を基本順序とする。
3. reloadは一覧と詳細の双方を再同期する。

## Detail Rail ルール
1. 詳細は閲覧中心（read-first）とし、書き込み導線は別操作に分離する。
2. 詳細の主情報は上から `タイトル -> 状態 -> 主要メタ情報` の順で配置する。
3. API失敗時は一覧を保持したまま詳細領域のみエラー表示する。

## Responsive ルール
1. `#pane-monitor .pane-grid` は wide で2カラム、`max-width: 1100px` 以下で1カラムへ縮退する。
2. 狭幅時に一覧を先、詳細を後に表示し、主CTA/主情報のファーストビューを維持する。

## Permission 局所化ルール
1. 非許可操作は全面非表示にせず、可能な限り `disabled + 理由表示` を採用する。
2. Monitorの設定タブは operator に対して表示を維持し、`disabled` と `monitor-view-permission-notice` で説明する。

## A11y 最低要件
1. 切替ボタンは `aria-pressed` を更新する。
2. 非活性ボタンは `disabled` と `aria-disabled` を同時に設定する。
3. 権限説明は `role="status"` + `aria-live="polite"` で通知する。

## 契約テスト
- `tests/phase674/phase674_t21_monitor_workspace_split_contract.test.js`
- `tests/phase674/phase674_t22_monitor_table_toolbar_and_detail_contract.test.js`
- `npm run test:admin-nav-contract`
