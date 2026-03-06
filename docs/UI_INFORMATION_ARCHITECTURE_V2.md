# UI_INFORMATION_ARCHITECTURE_V2

## グローバルシェル
- `left-nav`: 画面入口の選択のみ担当
- `topbar`: 全体サマリーと role 切替のみ担当（実行操作は置かない）
- `page-header`: 現在画面の目的と主CTAを表示
- `main-content`: 各paneの作業領域

## 左ナビ情報設計（V2）
### 表示グループ
- `dashboard`
- `run`
- `control`
- `developer`（developer roleのみ）

### Role別可視性
| role | visible groups |
| --- | --- |
| operator | `dashboard`, `run`, `control` |
| admin | `dashboard`, `run`, `control` |
| developer | `dashboard`, `run`, `control`, `developer` |

## グループ別の責務
### dashboard
- ホーム
- 機能カタログ

### run
- 通知作成
- 配信結果
- ジャーニー状況
- City Pack管理
- 緊急レイヤー
- ベンダー管理
- 通知集計

### control
- 要対応
- システム健全性
- 異常対応
- 設定
- LLM支援（admin/developer）
- 回復・保守（admin/developer）
- 判断ログ
- 運用証跡マップ（admin/developer）

### developer
- Repo Map
- システム状態
- 監査ログ
- 実装状況
- LEGACY導線
- 取説（Redac / ユーザー）

## V1からの主な変更
- 旧重複導線グループを統廃合（notifications/users/catalog/communication/operations）。
- `settings` は `control` 内の単一入口へ統一。
- 開発向け導線は `developer` グループに隔離。

## 契約テスト
- `npm run test:docs`
- `npm run test:admin-nav-contract`

