# Phase16 Runbook (Real Test)

## Purpose
- Phase16 の実動テスト（最小1件）を事実記録で固定する

## Scope
- 対象: LINE 実動テスト（test-send → 受信 → クリック）
- 非対象: 仕様変更 / 追加送信 / 新規判断

## Pre-check
- main SHA を記録する
- 送信は1件のみ

## 実行手順（人間操作は最大3つ）
1) NOTIFICATION_ID を用意
2) 環境変数を設定し、スクリプトを1回実行
3) LINE 受信の目視確認（Yes/No）と、可能なら1回クリック（Yes/No）

## 実行コマンド（例）
- `git rev-parse HEAD`
- `export BASE_URL="https://member-xxxxx-ue.a.run.app"`
- `export NOTIFICATION_ID="<notificationId>"`
- `export LINE_USER_ID="<lineUserId>"`
- `bash scripts/phase16_test_send.sh`

## 期待結果（Yes/No）
- curl の HTTP status が 200
- LINE に届く（Yes/No）
- 可能ならクリックが記録される（Yes/No）

## OBSログ最小確認
- requestId で `[OBS] action=test-send` を確認
- 同一 requestId で webhook / click が追える場合は確認

## 証跡記録テンプレ
- 実行日時(UTC):
- main SHA:
- BASE_URL:
- requestId:
- notificationId:
- lineUserId(マスク):
- curl HTTP status:
- LINE受信: Yes/No
- クリック記録: Yes/No
- OBSログ抜粋:
- 判定: PASS / FAIL

---

## 実テスト結果（Phase16-T03）
- 実行日時(UTC): 2026-02-02 23:47:43
- main SHA: 5c6a2e4b92f772564fff23c71e542f1114b26890
- BASE_URL: https://member-pvxgenwkba-ue.a.run.app
- requestId: 6e3a95ab-3f3c-43c2-8eaf-e03fadc11966
- notificationId: FCq6dNq1VFfJFR2hiLs6
- lineUserId(マスク): U303…c680
- curl HTTP status: 500
- LINE受信: 未実施（HTTP 500 のため送信停止）
- クリック記録: 未実施
- OBSログ抜粋: [OBS] action=test-send result=error requestId=6e3a95ab-3f3c-43c2-8eaf-e03fadc11966 lineUserId=U3037952f2f6531a3d8b24fd13ca3c680 notificationId=FCq6dNq1VFfJFR2hiLs6
- 判定: FAIL

---

## 実テスト結果（Phase16-T03 再実行）
- 実行日時(UTC): 2026-02-03 00:59:11.257262
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

## 実テスト結果（Phase16-T03 CTAクリック）
- 実行日時(UTC): 2026-02-03 02:32:43
- 実行者: Nobuhide Shimamura
- main SHA: 62b196037405324e1ef30389404e8363deeb82de
- BASE_URL: https://member-pvxgenwkba-ue.a.run.app
- requestId (test-send): 9da52a7a-a2bb-4fb6-9f4c-182750d6eb2c
- requestId (click): dc427de4-cf11-45f2-b927-945cb7822eff
- notificationId: AXe0e2INxRyKPGxNMeBw
- linkRegistryId: 1AYUKDAVhs873twOEY0s
- deliveryId: XRlfRXROm36f4UWWZCKs
- lineUserId(マスク): U303…c680
- curl HTTP status: 200
- LINE受信: Yes
- クリック記録: Yes
- OBSログ抜粋:
  - [OBS] action=test-send result=ok requestId=9da52a7a-a2bb-4fb6-9f4c-182750d6eb2c lineUserId=U3037952f2f6531a3d8b24fd13ca3c680 notificationId=AXe0e2INxRyKPGxNMeBw deliveryId=XRlfRXROm36f4UWWZCKs
  - [OBS] action=click result=ok requestId=dc427de4-cf11-45f2-b927-945cb7822eff deliveryId=XRlfRXROm36f4UWWZCKs linkRegistryId=1AYUKDAVhs873twOEY0s
- 判定: PASS
