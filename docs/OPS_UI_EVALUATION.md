# Phase18-C 運用UI評価観点

## 1. 目的
- Phase17 の7日検証とは独立に、管理UI／運用導線の評価観点を固定する
- 実装変更や仕様変更を伴わない

## 2. 対象UI/エンドポイント一覧（現行実装ベース）
### UI
- /admin/ops
- /admin/review
- /admin/read-model
- /admin/implementation-targets

### 関連API（ops_readonly.html が参照）
- /api/phase5/ops/users-summary
- /api/phase5/ops/notifications-summary
- /api/phase5/ops/member-number-stale
- /api/phase5/admin/users/review
- /admin/implementation-targets
- /admin/read-model/notifications

## 3. 「運用としてOK」の定義
- 可視化: 必要な情報が一覧で取得できる
- 再現性: 同条件で同じ結果が取得できる
- 監査性: requestId 等で追跡でき、証跡が残せる

## 4. チェックリスト（Yes/No）
| 項目 | 期待 | 確認方法 | 証跡 | 判定 |
|---|---|---|---|---|
| /admin/ops が到達可能 | 200 OK で HTML 取得 | 認証付きアクセス | curl 出力 / スクショ | Yes/No |
| /admin/implementation-targets が取得可能 | JSON 配列が返る | 認証付きアクセス | curl 出力 | Yes/No |
| ops users summary が取得可能 | items 配列が返る | /api/phase5/ops/users-summary | レスポンス本文 | Yes/No |
| ops notifications summary が取得可能 | items 配列が返る | /api/phase5/ops/notifications-summary | レスポンス本文 | Yes/No |
| member-number-stale が取得可能 | count/ items が返る | /api/phase5/ops/member-number-stale | レスポンス本文 | Yes/No |
| review 操作 API が到達可能 | 200/4xx が返る | /api/phase5/admin/users/review | レスポンス本文 | Yes/No |
| read-model 通知が取得可能 | items 配列が返る | /admin/read-model/notifications | レスポンス本文 | Yes/No |

## 5. 事実ログ記録テンプレ
- 実行日時（UTC）:
- 実行日時（EST）:
- 対象URL:
- requestId:
- 結果（HTTP status）:
- 参照OBSキー: [OBS]

## 6. 非対象
- UI改善提案
- 認証方式変更
- IAP導入
- 権限強化
- 機能追加

## 7. 次フェーズへの引き継ぎ（検討項目のみ）
- 運用UIの評価結果の集計方法
- 運用UI評価の定期実施頻度
