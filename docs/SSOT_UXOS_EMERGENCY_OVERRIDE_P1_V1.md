# SSOT_UXOS_EMERGENCY_OVERRIDE_P1_V1

UX OS Next Best Action に Emergency Override を add-only で統合する契約。

## 1. Scope

- in-scope:
  - `getNextBestAction` の優先判定に emergency override を追加
  - 判定条件:
    - `ENABLE_UXOS_EMERGENCY_OVERRIDE=1`
    - `users/{lineUserId}.regionKey` が存在
    - `emergency_bulletins.status=sent` に同一 `regionKey` の新着が存在
    - 新着判定は `UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS` 以内
  - 返却 action:
    - `CHECK_EMERGENCY_ALERT`
    - source=`emergency_override`
  - read-only policy snapshot (`/api/admin/os/ux-policy/readonly`) へ
    `uxosEmergencyOverrideEnabled` と `notification.emergencyOverrideMode` を追加
- out-of-scope:
  - webhook/user facing メッセージ文面の上書き
  - emergency rule/provider 契約変更
  - Firestore schema の意味変更

## 2. Feature Flags

- `ENABLE_UXOS_EMERGENCY_OVERRIDE`（default: `0`）
  - `0`: override 無効（既存 task/LLM 判定のみ）
  - `1`: override 有効
- `UXOS_EMERGENCY_OVERRIDE_SCAN_LIMIT`（default: `120`, min=`10`, max=`300`）
  - `emergency_bulletins(status=sent)` の走査上限
- `UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS`（default: `24`, min=`1`, max=`336`）
  - sent bulletin を有効扱いする最大時間

## 3. Read Contract

- `users/{lineUserId}`
  - `regionKey`（優先）
  - fallback: `targetRegionKey`, `region`
- `emergency_bulletins`
  - query: `status=sent`（single filter）
  - in-memory filter: `regionKey` 一致

## 4. Safety / Compatibility

- add-only:
  - 既存 route/usecase/repo の意味は変更しない
  - 新規flagと優先分岐のみ追加
- fail-open:
  - override 判定失敗時は task/LLM 判定へフォールバック
- bounded query:
  - scan 件数は `UXOS_EMERGENCY_OVERRIDE_SCAN_LIMIT` で上限固定

## 5. Rollback

1. `ENABLE_UXOS_EMERGENCY_OVERRIDE=0`
2. 必要なら `UXOS_EMERGENCY_OVERRIDE_MAX_AGE_HOURS=1` で段階縮退
3. PR revert（データ書き込み追加なしのため即時可逆）
