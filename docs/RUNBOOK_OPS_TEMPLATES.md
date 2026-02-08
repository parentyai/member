# RUNBOOK_OPS_TEMPLATES

## Purpose
Ops通知テンプレの作成〜有効化〜送信判断を、draft/active/inactive で安全に運用する。

## Steps
1. Automation config を確認する（OFF/DRY_RUN_ONLY/EXECUTE）。
2. draft 作成: `POST /api/phase61/templates` で key/title/body を登録する。
3. draft 更新: `PATCH /api/phase61/templates/:key` で内容を調整する（draftのみ可）。
4. 有効化: `POST /api/phase61/templates/:key/activate`。
5. dry-run 実行: `POST /api/phase47/automation/dry-run` で影響確認（書き込みなし）。
6. execute 実行: mode=EXECUTE かつ confirmation を満たす時のみ実行する。
7. decision log / timeline を確認し、監査証跡を残す。

## Notes
- active テンプレは編集不可。変更は draft を作り直して差し替える。
- 自動実行は default OFF。必ず mode を確認する。
