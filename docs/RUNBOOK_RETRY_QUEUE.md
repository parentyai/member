# RUNBOOK_RETRY_QUEUE

## Purpose
送信失敗（retry queue）を手動で再送し、結果を監査できる一本道を固定する。

## Steps
1. ops_readonly の Segment Send で plan を作成し planHash を確認する。
2. Execute は planHash を含めて実行する（mode/killSwitch ガードに従う）。
3. failures が出た場合、Retry Queue を開く。
4. Retry Queue の PENDING を手動で retry する。
5. 成功したものは DONE になる。失敗は lastError を確認する。

## Rollback
- enqueue された retry queue は append-only（削除しない）。
- 実装PRを revert する。
