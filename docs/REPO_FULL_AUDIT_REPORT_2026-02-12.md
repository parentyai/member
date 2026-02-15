# REPO_FULL_AUDIT_REPORT_2026-02-12

この文書はフル監査の参照先を SSOT に固定し、現行リポジトリの監査導線を一括で示す。

## SSOT / Runbook 入口
- `docs/SSOT_INDEX.md`
- `docs/SSOT_ADMIN_UI_OS.md`
- `docs/SSOT_ADMIN_UI_DATA_MODEL.md`
- `docs/SSOT_NOTIFICATION_WAIT_RULES.md`
- `docs/SSOT_NOTIFICATION_PRESETS.md`
- `docs/SSOT_SERVICE_PHASES.md`
- `docs/SSOT_SERVICE_PHASE_X_PRESET_MATRIX.md`
- `docs/ADMIN_UI_DICTIONARY_JA.md`

## 監査/運用 Runbook
- `docs/RUNBOOK_TRACE_AUDIT.md`
- `docs/RUNBOOK_ADMIN_OPS.md`
- `docs/RUNBOOK_OPS.md`
- `docs/RUNBOOK_DEPLOY_ENVIRONMENTS.md`

## データ/監査ログ
- `docs/DATA_MAP.md`
- `docs/RUNBOOK_TRACE_AUDIT.md`

## 追記（2026-02-15）
- 待機方式は型先行定義（SSOT: `docs/SSOT_NOTIFICATION_WAIT_RULES.md`）。値未入力時は UI で「未設定（SSOT未入力）」を表示する。
- Phase24 の UI 差分は「UI改善」ではなく、SSOT/辞書/ReadModel の整合を閉じるための表示固定（閉路保証）として扱う。
