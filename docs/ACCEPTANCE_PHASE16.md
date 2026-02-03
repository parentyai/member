# Phase16 Acceptance

## Scope
- Phase16 実動テスト（最小1件）の事実記録
- 対象: 管理API test-send → 受信確認 → クリック可否
- 非対象: 仕様変更 / 実装変更 / 認証方式変更

## Completion Criteria (Yes/No)
- RUNBOOK_PHASE16.md に実動テストの PASS 記録がある: Yes
- 実動テストの requestId / notificationId / lineUserId(マスク) が記録されている: Yes
- 実動テストの判定（PASS/FAIL）が明示されている: Yes

## Evidence Log
- 実行日時(UTC): 2026-02-03 00:59:11.257262
- 実行者: Nobuhide Shimamura
- main SHA: 99daf39e0853d763e5ca1f60740f99c8df1e5d26
- BASE_URL: https://member-pvxgenwkba-ue.a.run.app
- requestId: 4d39ab69-8da1-4f0d-b303-09814ee6c1aa
- notificationId: FCq6dNq1VFfJFR2hiLs6
- lineUserId(マスク): U303…c680
- curl HTTP status: 200
- LINE受信: Yes
- クリック記録: No（CTAなし）
- OBSログ抜粋: [OBS] action=test-send result=ok requestId=4d39ab69-8da1-4f0d-b303-09814ee6c1aa lineUserId=U3037952f2f6531a3d8b24fd13ca3c680 notificationId=FCq6dNq1VFfJFR2hiLs6 deliveryId=RPrGhBJxcseyBaWnT188
- 判定: PASS

---

## Evidence Log（CTA付き通知・クリック成立）
- 実行日時(UTC): 2026-02-03 02:32:43
- 実行者: Nobuhide Shimamura
- main SHA: 62b196037405324e1ef30389404e8363deeb82de
- BASE_URL: https://member-pvxgenwkba-ue.a.run.app
- linkRegistryId: 1AYUKDAVhs873twOEY0s
- notificationId: AXe0e2INxRyKPGxNMeBw
- deliveryId: XRlfRXROm36f4UWWZCKs
- test-send HTTP status: 200
- OBSログ抜粋:
  - [OBS] action=test-send result=ok requestId=9da52a7a-a2bb-4fb6-9f4c-182750d6eb2c lineUserId=U3037952f2f6531a3d8b24fd13ca3c680 notificationId=AXe0e2INxRyKPGxNMeBw deliveryId=XRlfRXROm36f4UWWZCKs
  - [OBS] action=click result=ok requestId=dc427de4-cf11-45f2-b927-945cb7822eff deliveryId=XRlfRXROm36f4UWWZCKs linkRegistryId=1AYUKDAVhs873twOEY0s
- 判定: PASS

## Reference
- docs/RUNBOOK_PHASE16.md
