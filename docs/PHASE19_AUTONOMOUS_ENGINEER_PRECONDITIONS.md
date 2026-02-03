# Phase19 自律運用前提条件（Autonomous Engineer Preconditions）

## 1. 目的
- Phase19 は「自律実行の前提条件固定フェーズ」である
- 人間は判断主体ではない

## 2. エンジニアAIの責務境界（YES / NO）
- テスト実行（npm test）: YES
- ログ検証（[OBS] 集計）: YES
- 軽微な修正（tests/docs/scripts）: YES
- 本番挙動変更: NO
- KPI解釈: NO
- 実験の開始/終了判断: NO

## 3. 自律ループ定義（固定順序）
1) テスト実行
2) 結果判定（PASS / FAIL）
3) FAIL時の最小修正
4) 再テスト
5) 事実ログの記録（docs or logs）
6) 人間への通知（要約のみ）

## 4. 異常検知と自動停止条件
以下のいずれかで即停止:
- npm test FAIL が連続
- OBS result=error が閾値超過
- kill-switch ON
- Firestore write error

## 5. 記録義務
必ず記録する項目:
- 実行日時（UTC）
- 実行コマンド
- テスト件数 / fail数
- 修正の有無
- 影響範囲（docs / test / script のみ）

## 6. 人間の役割（限定）
- docs を読む
- Phase を進める / 止める判断をする

## 7. 禁止事項
- 暗黙の判断
- 勝手な最適化
- 成果の誇張
- 「問題なし」という主観表現

## 参照（リンク）
- SSOT_PHASE15.md
- RUNBOOK_PHASE17.md
- RUNBOOK_PHASE18_CTA_AB.md
