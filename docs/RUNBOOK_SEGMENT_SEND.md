# RUNBOOK_SEGMENT_SEND

## Purpose
セグメント抽出 → plan → execute → audit 確認の流れを固定する。

## Steps
1. セグメント抽出: `GET /api/phase66/segments/send-targets` を実行し対象を確認する。
2. plan 作成: `POST /api/phase67/send/plan` で templateKey + segmentQuery を送る。
3. audit 確認: `audit_logs` に plan が append されていることを確認する。
4. dry-run: `POST /api/phase81/segment-send/dry-run` を実行し planHash / confirmToken を取得する。
5. execute 実行: `POST /api/phase68/send/execute` を planHash + confirmToken 付きで実行する。
6. audit 確認: execute の audit snapshot と failures を確認する。
7. rollback が必要ならテンプレ/セグメントを再調整し再実行する。

## Notes
- execute は mode=EXECUTE かつ killSwitch OFF でのみ許可。
- plan の templateKey + count + hash が一致しない場合は reject。
- confirmToken mismatch (409) の場合は再度 dry-run を行う。
- `segmentQuery` の許容キー（add-only）:
  - `readinessStatus`: `READY|NOT_READY`（未指定はALL）
  - `needsAttention`: `1` の場合、READYでもblockingありを含める
  - `hasMemberNumber`: `true|false`（未指定/`any` は無視）
  - `ridacStatus`: `DECLARED|UNLINKED|NONE`（未指定/`any` は無視）
  - `limit`: number（未指定は50）
