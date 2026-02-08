# RUNBOOK_SEGMENT_SEND

## Purpose
セグメント抽出 → plan → execute → audit 確認の流れを固定する。

## Steps
1. セグメント抽出: `GET /api/phase66/segments/send-targets` を実行し対象を確認する。
2. plan 作成: `POST /api/phase67/send/plan` で templateKey + segmentQuery を送る。
3. audit 確認: `audit_logs` に plan が append されていることを確認する。
4. execute 実行: `POST /api/phase68/send/execute` を実行する。
5. audit 確認: execute の audit snapshot と failures を確認する。
6. rollback が必要ならテンプレ/セグメントを再調整し再実行する。

## Notes
- execute は mode=EXECUTE かつ killSwitch OFF でのみ許可。
- plan の templateKey + count + hash が一致しない場合は reject。
