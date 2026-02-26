# SSOT_CITY_PACK_SECURITY_RULES

City Pack 追加コレクションの Security Rules 設計（add-only）。  
本書はルール「仕様」を定義する。実際の deploy 反映はインフラ手順に従う。

## Collections
- `city_packs`
- `city_pack_requests`
- `source_refs`
- `source_evidence`
- `source_audit_runs`
- `municipality_schools`
- `school_calendar_links`

## Access Policy
- Read/Write は `isAdmin()` のみ許可。
- Public/unauthorized からのアクセスは拒否（fail-closed）。

## Write Constraints
### source_refs
- 許可フィールドのみ更新可能（allow-list）。
- `status` は定義済み enum のみ（`active/expired/needs_review/dead/blocked/retired`）。
- `validUntil` は timestamp 必須。
- 教育系連携フィールド（`domainClass/schoolType/eduScope/regionKey/usedByCityPackIds`）は add-only で保持する。

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

### municipality_schools
- Read/Write は `isAdmin()` または service account のみ。
- `type=public` をアプリ層で固定（private は保存対象外）。
- `traceId` を保存し、監査突合を可能にする。

### school_calendar_links
- Read/Write は `isAdmin()` または service account のみ。
- 実カレンダー本文は保持しない（link-only）。
- `validUntil` は 120日ポリシーと連動し、期限監査対象とする。
- `traceId` を保存し、`source_refs`/`source_evidence` と相互参照可能にする。

## Audit Requirements
- `city_pack.*` 操作は `audit_logs` へ append-only で保存。
- `traceId` / `requestId` / `actor` を必須記録。
