# SSOT_CITY_PACK_SECURITY_RULES

City Pack 追加コレクションの Security Rules 設計（add-only）。  
本書はルール「仕様」を定義する。実際の deploy 反映はインフラ手順に従う。

## Collections
- `city_packs`
- `city_pack_requests`
- `source_refs`
- `source_evidence`
- `source_audit_runs`

## Access Policy
- Read/Write は `isAdmin()` のみ許可。
- Public/unauthorized からのアクセスは拒否（fail-closed）。

## Write Constraints
### source_refs
- 許可フィールドのみ更新可能（allow-list）。
- `status` は定義済み enum のみ。
- `validUntil` は timestamp 必須。

### source_evidence
- create-only（append-only）。
- update/delete 禁止。
- `traceId` 必須。

### source_audit_runs
- create/update は admin のみ。
- `runId` 単位の冪等更新を許可。

### city_packs
- `status=active` へ遷移する更新時:
  - `sourceRefs` が空でないこと
  - `allowedIntents` が `CITY_PACK` を含むこと
  - `validUntil` が存在すること

### city_pack_requests
- status は定義済み enum のみ。
- `lineUserId` / `regionKey` / `traceId` 必須。
- `draftCityPackIds[]` などの参照は add-only 更新のみ許可。

## Audit Requirements
- `city_pack.*` 操作は `audit_logs` へ append-only で保存。
- `traceId` / `requestId` / `actor` を必須記録。
