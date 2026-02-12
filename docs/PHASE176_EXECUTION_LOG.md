# PHASE176_EXECUTION_LOG

UTC: 2026-02-12T03:40:30Z
branch: `codex/phasec-c11-redac-branding-fix`
base: `origin/main` @ `6b4bfbb`

## Track Mapping
- Execution log number: `PHASE176`（全体通番）
- Product track: `Phase C-4`（Redac 完全移行）
- 通番とプロダクトフェーズは別軸で管理する。

## Scope
- `RIDAC` / `Ridac` / `ridac` の内部キー・Secret名・APIパス・データ項目名を `REDAC` / `Redac` / `redac` へ全面移行。
- Firestore key / collection / audit action / event type / segment filter key を `redac*` へ統一。
- 管理UI・runbook・workflow・テストファイル名を含めて全面リネーム。

## Breaking Changes
- Admin API: `/api/admin/redac-membership/unlink` に変更（旧 `/api/admin/ridac-membership/unlink` は削除）。
- Secret name: `REDAC_MEMBERSHIP_ID_HMAC_SECRET` に変更（旧 `RIDAC_MEMBERSHIP_ID_HMAC_SECRET` は削除）。
- Firestore field / collection:
  - `ridacMembership*` -> `redacMembership*`
  - `ridac_membership_links` -> `redac_membership_links`
- Segment query key:
  - `ridacStatus` -> `redacStatus`

## Local Verification
- `rg -n "RIDAC|Ridac|ridac" --hidden --glob '!.git'` -> no matches
- `npm test` PASS (480/480)
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS
