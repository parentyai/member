# Phase22 TODO

1. 目的: 同日窓（createdAt）での sent/click 実測値を意思決定に使える形で可視化する。入力: Phase21 の verify 出力JSONと実行ログ。出力: 可視化サマリ（sent/click/CTR/観測期間）と参照パス。失敗時の切り戻し: 追加した可視化PRのrevert。
2. 目的: 週次/日次の観測期間を固定し、比較可能な集計を揃える。入力: 既存の stats 出力JSON。出力: 固定期間の集計結果と比較表。失敗時の切り戻し: 集計用PRのrevert。
3. 目的: exitCode=1/2 の分類を運用ログに連携し、判断の前提を明確化する。入力: verify exitCode と stderr 出力。出力: 失敗種別の記録（実装/環境）。失敗時の切り戻し: ログ連携PRのrevert。
4. 目的: 意思決定材料の最小セットを定義し、Phase22の完了判定に紐づける。入力: sent/click/CTR と観測期間。出力: 判定用のチェックリスト。失敗時の切り戻し: チェックリストPRのrevert。
5. 目的: Phase22 の検証結果を次フェーズに引き継ぐための事実ログを残す。入力: 直近の verify 実行ログ。出力: execution log の追記。失敗時の切り戻し: ログPRのrevert。
