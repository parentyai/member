# Phase6 Plan (Prepare)

## 目的
Phase6 START の前提条件を固定し、実装開始の判断を可能にする。

## スコープ境界
### やること
- Phase6 の SSOT/Acceptance/Guardrails を docs-only で作成
- Phase6 のタスク台帳（TODO_PHASE6.md）を作成

### やらないこと
- 実装コードの変更
- Phase0〜Phase5 の設計/証跡の再解釈

## 進め方
- 1 PR = 1 Task ID
- Evidence は PR / コマンド結果 / 日付を記載
- レビュー観点: 境界の明記 / 推測排除 / docs-only

## 失敗時の切り戻し
- docs-only PR は revert のみ
- 実装PRが混入した場合は即停止・差し戻し
