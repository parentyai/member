# PHASE_CITY_PACK_REQUEST_FLOW_PLAN

目的: City Pack を「LINE申告→半自動草案→人間承認→Go-Live→120日監査」で運用できるよう、既存City Pack基盤に request 状態機械を add-only で追加する。

## 制約
- SSOT add-only
- main直push禁止（1PR）
- 既存通知/既存API互換維持
- LLMは補助のみ（採用決定/延長/配信可否は不可）
- traceIdで audit_logs と接続

## 追加コレクション
### city_pack_requests/{requestId}
- status: queued|collecting|drafted|needs_review|approved|active|rejected|failed
- lineUserId
- regionCity, regionState, regionKey
- requestedAt
- lastJobRunId
- traceId
- draftCityPackIds[]
- draftTemplateIds[]
- draftSourceRefIds[]
- error

## users add-only
- regionCity
- regionState
- regionKey
- regionDeclaredAt
- regionDeclaredBy (user/ops)

## 追加ルート（admin/internal）
- GET /api/admin/city-pack-requests
- GET /api/admin/city-pack-requests/:requestId
- POST /api/admin/city-pack-requests/:requestId/approve
- POST /api/admin/city-pack-requests/:requestId/reject
- POST /api/admin/city-pack-requests/:requestId/request-changes
- POST /api/admin/city-pack-requests/:requestId/retry-job
- POST /api/admin/city-pack-requests/:requestId/activate
- POST /internal/jobs/city-pack-draft-generator

## 主要フロー
1. LINE申告 (City/State) -> users更新 + events記録 + city_pack_requests(queued)
2. draft job -> source_refs作成 + city_packs(draft)作成 + requestをdrafted
3. admin承認 -> approved
4. activate -> city_pack active (既存activateCityPack) + request active

## テスト（phase260）
- region申告 -> request生成
- draft job -> source_refs/city_packs作成
- admin routes認証
- internal job token guard
- /admin/app request UI contract

## ロールバック
- PR revert
- internal job token無効化
- request statusをrejected/failedに更新
