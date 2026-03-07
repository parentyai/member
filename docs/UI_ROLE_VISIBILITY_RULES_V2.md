# UI_ROLE_VISIBILITY_RULES_V2

更新日: 2026-03-07

## 目的
Admin UI の role 別可視性を、画面単位と操作単位で一貫運用する。

## 実装根拠
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js` (`resolveAllowedPaneForRole`, `setRole`, `applyRoleVisibility`)
- `apps/admin/assets/admin.css` (`role-hidden`, role別表示制御)

## ロール定義
- `operator`: 運用担当
- `admin`: 管理担当
- `developer`: 開発担当

## 可視性ポリシー
1. 画面遷移時は `resolveAllowedPaneForRole` で許可paneへ正規化する。
2. 非許可要素は `role-hidden` で局所非表示にする。
3. 非表示理由は guard 文言で説明し、全画面を遮断しない。
4. URL直アクセスでも role 判定を優先する。

## 画面可視性マトリクス（V2）
| Pane | operator | admin | developer |
| --- | --- | --- | --- |
| `home` | 表示 | 表示 | 表示 |
| `ops-feature-catalog` | 表示 | 表示 | 表示 |
| `composer` | 表示 | 表示 | 表示 |
| `monitor` | 表示 | 表示 | 表示 |
| `city-pack` | 表示 | 表示 | 表示 |
| `vendors` | 表示 | 表示 | 表示 |
| `read-model` | 表示 | 表示 | 表示 |
| `alerts` | 表示 | 表示 | 表示 |
| `ops-system-health` | 表示 | 表示 | 表示 |
| `errors` | 表示 | 表示 | 表示 |
| `settings` | 表示 | 表示 | 表示 |
| `audit` | 表示 | 表示 | 表示 |
| `llm` | 非表示 | 表示 | 表示 |
| `maintenance` | 非表示 | 表示 | 表示 |
| `developer-map` | 非表示 | 表示 | 表示 |
| `developer-manual-redac` | 非表示 | 表示 | 表示 |
| `developer-manual-user` | 非表示 | 表示 | 表示 |
| `emergency-layer` | 表示 | 表示 | 表示 |

## 操作可視性ルール
1. operator で禁止する操作
- 開発者専用ナビ (`nav-group-developer`)
- admin限定ボタン (`data-role="admin"`)

2. admin/developer で許可する操作
- 保守・復旧・LLM設定
- Developer manuals / map

3. UI表示戦略
- 情報閲覧は可能な限り維持する。
- 書き込み操作のみ無効化し、理由表示を併記する。

4. Monitorの局所ガード（PR5）
- `#monitor-view-configuration` は operator でも表示を維持する。
- 非許可roleでは `disabled` + `aria-disabled=true` で操作を止める。
- 理由は `#monitor-view-permission-notice` で画面内に明示する。

## 契約テスト
- `npm run test:admin-nav-contract`
- `tests/phase644/*.test.js`
- `tests/phase674/*.test.js`

## 変更ルール
- role判定変更は add-only で実施する。
- route意味変更はしない（`src/shared/adminUiRoutesV2.js` 互換維持）。
