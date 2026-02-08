# RUNBOOK_OPS_DAILY_REPORT

## Purpose
日次の ops 指標を固定フォーマットで保存し、後追い監査と比較ができる状態にする。

## Steps
1. 生成API: `POST /api/phase62/ops/report/daily?date=YYYY-MM-DD` を実行する（date省略時はUTC当日）。
2. 生成スクリプト: `node scripts/phase62_generate_ops_daily_report.js --date YYYY-MM-DD` を実行してもよい。
3. Firestore `ops_daily_reports/{YYYY-MM-DD}` の保存を確認する。
4. counts/topReady を確認し、必要なら notes を追記する（手動）。

## Notes
- 再実行は上書き/merge で同日更新される。
- 自動実行は OFF のまま。まず手動/CIで証跡を残す。
