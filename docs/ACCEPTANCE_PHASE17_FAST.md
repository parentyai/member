# Phase17 FAST Acceptance (7時間圧縮検証)

## 目的
- 7日運用の代替として、同一フローを短時間に集中実行し、OBSログで相関確認可能な事実を残す

## 実行サマリ
- 実行方式: scripts/phase17_burst_test.sh
- 実行回数: 20
- 成功回数: 20
- 失敗回数: 0
- 実行時刻(ローカル): 2026-02-02 21:06:41
- 対象 lineUserId: U3037952f2f6531a3d8b24fd13ca3c680
- 対象 notificationId: FCq6dNq1VFfJFR2hiLs6

## 実行ログ（requestId一覧）
- run=1 requestId=03995253-933a-47f8-b285-1b94f2f00b06
- run=2 requestId=fb1bb4e4-34b1-47d2-bb07-c736669d44fb
- run=3 requestId=d968b529-035e-478a-ba43-fe76738209e7
- run=4 requestId=d0806ae8-ec26-4b06-aadd-22cb30cd585b
- run=5 requestId=b1e23b87-3b36-4e80-b1d6-46160fb74e64
- run=6 requestId=b6c8bd01-1176-4874-8ddd-23b2462ac362
- run=7 requestId=69f4a23f-cdfe-4a84-9e14-f2f69c55678b
- run=8 requestId=bba2fdec-edbf-43f5-8768-c640c66062c3
- run=9 requestId=2cf7d94d-081e-4647-967b-aa3a80af0aa8
- run=10 requestId=908833c9-433d-483d-a490-d86640a1b477
- run=11 requestId=e084031f-be0c-4ebc-bcb9-3e58be73ae50
- run=12 requestId=870a3d19-d6c0-4336-8d9a-91e7493cf6a4
- run=13 requestId=e2fdc3ff-a05a-484b-9b63-842ff568b498
- run=14 requestId=701069b4-44ab-4c8f-8efa-7e0588021b69
- run=15 requestId=c3bd689a-69da-43e3-8ed1-e9a620b2ea18
- run=16 requestId=7aa85fa1-9cdf-457f-a049-3e5b0c93f4ee
- run=17 requestId=c7057f15-3b34-4b35-affa-c5dbaaa19442
- run=18 requestId=0ed3e74c-ce4b-4e02-a4fc-7ed4b9cd2a25
- run=19 requestId=15cba44c-4084-4f36-b855-5f9b83054e84
- run=20 requestId=9d52d510-be59-410e-992f-a6cf7822df96

## OBSログ抽出結果（件数）
- action=test-send: 25件
  - result=ok: 21件
  - result=reject: 1件
  - result=error: 3件
- action=webhook: 0件
- action=click: 1件

## 異常系の事実（想定どおりの拒否/エラー）
- kill-switch ON での test-send
  - requestId: a807597c-4b17-4bed-881f-d2d8efa22f87
  - OBS: [OBS] action=test-send result=reject
- invalid linkRegistryId で通知作成
  - requestId: e67ed5e4-cffe-4f17-9a43-81f904f34389
  - HTTP: 404 not found
- click without deliveryId
  - requestId: 1e0dd7f5-248b-4d19-b30a-f6a1b0e0c792
  - OBS: [OBS] action=click result=reject

## 結果
- 20回連続の送信フローが requestId 単位で記録された
- 異常系は拒否/エラーとして記録された
- 実行結果は本書に固定する
