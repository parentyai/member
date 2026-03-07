# SSOT_UXOS_FOUNDATION_P0_V1

UX OS Foundation P0 の add-only 契約。
対象は `通知 -> 反応 -> 次アクション` の最小閉ループのみ。

## 1. Scope

- in-scope:
  - `appendUxEvent`（best-effort）
  - `events` collection への `type=ux_event` 追記
  - `uxEventType`:
    - `reaction_received`
    - `notification_sent`
  - `getNextBestAction`（minimal）
  - read-only route:
    - `GET /api/admin/os/uxos/next-action`
    - `GET /api/admin/os/ux-policy/readonly`
  - fatigue warn-only（送信阻害なし）
- out-of-scope:
  - Emergency override UX
  - UX Policy 編集UI（write）
  - 既存 API/Firestore フィールド意味変更

注記:
- Emergency override は P0対象外のまま維持し、別契約 `docs/SSOT_UXOS_EMERGENCY_OVERRIDE_P1_V1.md` で add-only 拡張する。

## 2. Feature Flags

- `ENABLE_UXOS_EVENTS`（default: `0`）
  - `0`: ux_event append 停止
  - `1`: ux_event append 有効（best-effort）
- `ENABLE_UXOS_NBA`（default: `0`）
  - `0`: next-best-action route は disabled 応答
  - `1`: minimal NBA を返す
- `ENABLE_UXOS_FATIGUE_WARN`（default: `0`）
  - `0`: fatigue warning 無効
  - `1`: warn-only を返す（block しない）
- `ENABLE_UXOS_POLICY_READONLY`（default: `0`）
  - `0`: policy readonly route は disabled 応答
  - `1`: read-only policy snapshot を返す

## 3. Data Contract（Firestore, add-only）

新規 collection は作らない。既存 `events` に add-only で追記する。

### `events/{eventId}`（type=`ux_event`）

- required:
  - `lineUserId` (string)
  - `type` = `ux_event`
  - `uxEventType` (`reaction_received` | `notification_sent`)
- optional:
  - `traceId`, `requestId`, `actor`, `source`
  - `ref` (object):
    - `notificationId`
    - `deliveryId`
    - `todoKey`
    - `reaction`
  - `metrics` (object):
    - `deliveredCount`
    - `skippedCount`
    - `capBlockedCount`
  - `eventVersion`（number, current=`1`）
- timestamp:
  - `createdAt` は既存 `eventsRepo.createEvent` の serverTimestamp を利用

## 4. Retention / Read Priority / Rollback

- retention:
  - `events` は既存 retention を継続
  - 参照: `docs/SSOT_RETENTION.md`, `docs/SSOT_RETENTION_ADDENDUM.md`
- read priority:
  - primary decision source にはしない
  - 運用監査・可視化用途を primary とする
  - 読み取り失敗時は fail-open（主処理は継続）
- rollback:
  1. `ENABLE_UXOS_EVENTS=0`
  2. `ENABLE_UXOS_NBA=0`
  3. `ENABLE_UXOS_FATIGUE_WARN=0`
  4. `ENABLE_UXOS_POLICY_READONLY=0`
  5. 必要時 PR revert（既存 `events` 追記は参照停止で無害化）

## 5. Compatibility

- add-only:
  - 既存 `events` の意味は変更しない
  - 新規 event type と新規 optional fields のみ追加
- non-breaking:
  - 既存 route / webhook / composer / task / llm 契約は維持
  - fatigue は warn-only で送信結果を変えない
