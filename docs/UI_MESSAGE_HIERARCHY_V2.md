# UI_MESSAGE_HIERARCHY_V2

更新日: 2026-03-06

## 目的
通知・警告・失敗の表示位置を固定し、同じ意味を同じ階層で表示する。

## 階層定義

| level | 用途 | 代表DOM | 補足 |
| --- | --- | --- | --- |
| `system` | 画面全体の重要情報 | `#admin-guard-banner`, `#admin-local-preflight-banner`, `#ui-fixture-success-banner` | 画面上部固定 |
| `section` | 特定作業領域の制約 | `#composer-killswitch-banner` | pane内で完結 |
| `inline` | 項目補助/軽注意 | `#composer-cta2-notice` | 入力近傍に表示 |
| `toast` | 操作結果の一時通知 | `#toast` | 自動消滅 |

## state と見え方
- `success`: 完了/反映済み
- `in_progress`: 実行中
- `pending`: 未確定/下書き
- `warn`: 注意
- `error`: 失敗
- `forbidden`: 権限制約
- `disabled`: 無効化
- `unset`: 情報なし
- `testing`: 検証中

## DOM契約
- 各メッセージ要素は `data-ui-message-level` を持つ。
- 状態は `data-ui-state` で表現する。
- 実装API:
  - `applyBannerState(el, tone, level)`
  - `applyBadgeState(el, value, tone, options)`
  - `showToast(message, tone)`

## 運用ルール
- 同一事象を複数階層に同時表示しない。
- 重大障害は `system` を優先し、補助説明のみ `inline` に出す。
- 成功通知は `toast` 優先。恒久表示が必要な場合のみ `system` を使う。
