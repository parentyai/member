# Phase17 CLOSE 判定パッケージ

## 1. 目的
- Phase17 の7日検証が終わった時点で、即座にCLOSE判定できる型を固定する

## 2. 入力（Inputs）
- 7日分の事実ログ
  - Cloud Run logs
  - Firestore
  - admin read-model
- 収集期間の定義
  - UTC基準
  - 表示はEST併記

## 3. 収集手順
- Cloud Run logs から requestId 単位で抽出する
- Firestore は必要な場合のみ参照する
- admin read-model は結果確認の補助として参照する

## 4. 判定観点（Yes/No）
| 観点 | 期待 | 証跡 | 判定 |
|---|---|---|---|
| 送信成功の観測可能性 | test-send / send が OBS で追える | [OBS] action=test-send | Yes/No |
| webhook受信の観測可能性 | requestId 相関が追える | [OBS] action=webhook | Yes/No |
| click計測の扱い | 可能なら記録 / 非対象なら明文化 | [OBS] action=click / 非対象明記 | Yes/No |
| 監査証跡 | requestId で相関できる | requestId 一覧 | Yes/No |
| 異常時の一次切り分け | ログ粒度で原因の区別が可能 | error 行の存在 | Yes/No |

## 5. 失敗時の扱い（Fail-safe）
- 判定保留
- 原因切り分け
- 再実施

## 6. 非対象
- LLM連携の導入
- 認証方式/IAP導入
- UI改善
- 仕様追加

## 7. Phase20への引き継ぎ（検討項目）
- 運用自動化
- 集計自動化
- ダッシュボード化

## 参照
- docs/RUNBOOK_PHASE17.md
- docs/ACCEPTANCE_PHASE17.md
- docs/OPS_UI_EVALUATION.md
