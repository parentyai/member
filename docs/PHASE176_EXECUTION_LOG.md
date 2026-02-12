# PHASE176_EXECUTION_LOG

UTC: 2026-02-12T03:40:30Z
branch: `codex/phasec-c11-redac-branding-fix`
base: `origin/main` @ `6b4bfbb`

## Track Mapping
- Execution log number: `PHASE176`（全体通番）
- Product track: `Phase C-4`（Redac 完全移行）
- 通番とプロダクトフェーズは別軸で管理する。

## Scope
- 旧会員連携命名を `REDAC` / `Redac` / `redac` へ全面移行。
- Firestore key / collection / audit action / event type / segment filter key を `redac*` へ統一。
- 管理UI・runbook・workflow・テストファイル名を含めて全面リネーム。

## Breaking Changes
- Admin API: `/api/admin/redac-membership/unlink` に変更（旧パスは削除）。
- Secret name: `REDAC_MEMBERSHIP_ID_HMAC_SECRET` に変更（旧名は削除）。
- Firestore field / collection / segment query key を `redac*` に統一。

## Local Verification
- `rg -n "REDAC|Redac|redac" src apps tests docs .github` で移行後命名を確認
- `npm test` PASS (480/480)
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS
