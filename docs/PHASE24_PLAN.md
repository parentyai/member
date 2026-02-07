# PHASE24_PLAN

## Phase24の目的
Phase24 は member の本線を「ユーザー価値の連鎖」として固定し、運用判断までの一本道を明文化するフェーズである。Phase23 で固定された計測・判定基盤を前提に、次に実装すべき作業を優先度付きで確定し、迷いなく実装へ移れる状態を作る。

## 現状棚卸し（ユーザー価値単位）
| 機能 | 目的（誰の何を解決） | 現状の完成度 | 明確な欠落 / 次の一手 |
| --- | --- | --- | --- |
| 登録 | 利用開始に必要な識別情報を獲得し、運用対象として扱えるようにする | MVP | 入力品質・エラー回復・再登録導線の整理 |
| 通知 | 送信・反応（open/click）を記録し、意思決定材料を作る | 実用 | 送信対象の選定根拠と運用判断への接続 |
| チェックリスト | 行動の進捗を構造化し、次アクション判断の材料にする | MVP | 完了基準の固定と運用上の欠落検出 |
| 行動ログ | 最終行動・反応を可視化し、判断材料の信頼性を高める | 実用 | 欠損・矛盾の検出ルールの固定 |
| Ops/Review | 人間が判断できる情報を一覧化し、判断を一貫させる | MVP | 判断結果の記録・追跡と監査性の固定 |

## Phase24でやること
- 本線（登録→通知→行動/チェック→Ops判断）の実装優先度を固定する
- 運用判断に必要な最低限の情報を確定し、欠落検出を仕様化する
- 実装対象を5件に絞り、代替でやらないことを明示する

## Phase24でやらないこと
- Phase23の基盤（Runbook/CI/判定ロジック）の変更
- KPI/Gate/Verifyの閾値・意味変更
- 自動判断・最適化・推薦の導入

## Top5実装候補（優先度順）
| Priority | 作業候補 | なぜ今やるのか | 何をやらない代わりか |
| --- | --- | --- | --- |
| 1 | Ops判断結果の記録・参照（判断ログ） | 本線を「判断まで」繋ぐための最短ギャップ | 自動判断・最適化は行わない |
| 2 | ユーザー状態サマリーの欠落検出ルール固定 | 判断材料の信頼性を担保するため | 新しい指標追加はしない |
| 3 | 通知状態サマリーの欠落検出ルール固定 | 送信判断の根拠を安定させるため | チャネル追加はしない |
| 4 | チェックリスト完了基準の固定と欠落検出 | 行動進捗の判断基準を一意化するため | UI改善はしない |
| 5 | 登録データ品質の最小監査（入力欠落/重複の検出） | 運用対象の基盤を壊さないため | 取得項目の拡張はしない |

## Done定義（Phase24 CLOSE条件）
- Top5各項目に「入力・出力・証跡」の定義が揃い、作業順が固定されている
- 欠落検出ルールが仕様として明文化され、判断の迷いがない
- Phase23の基盤に変更が発生していない

## T02実装状況
- Decision Log の記録・参照が可能になった（repo/API/tests）

## T03実装状況
- 入力: phase6 member summary
- 出力: completeness { ok, missing, needsAttention, severity }
- 証跡: tests/phase24/phase24_t03_user_summary_completeness.test.js

## T04実装状況
- 入力: notification read model summary
- 出力: completeness { ok, missing, needsAttention, severity }
- 証跡: tests/phase24/phase24_t04_notification_summary_completeness.test.js

## T05実装状況
- 入力: checklist definition + user progress
- 出力: checklist { completion, completeness }
- 証跡: tests/phase24/phase24_t05_checklist_completeness.test.js

## T06実装状況
- 入力: user (registration data)
- 出力: registrationCompleteness { ok, missing, needsAttention, severity, reasons }
- 証跡: tests/phase24/phase24_t06_registration_completeness.test.js
