# PHASE172_EXECUTION_LOG

UTC: 2026-02-12T02:55:00Z
branch: `codex/phasec-c8-cap-snapshot-opt`
base: `origin/main` @ `898521e1e75a7e09a0112f1138c2185a95c76464`

## Scope
- 通知cap判定で同一ユーザーの delivery count を複数回問い合わせる構造を見直し、
  1回のスナップショット集計を再利用できるよう最適化。
- `osConfig impactPreview` も同じスナップショット経路に統一し、
  legacy fallback 時の重複スキャンを削減。

## Code Changes
- `src/repos/firestore/deliveriesRepo.js`
  - `getDeliveredCountsSnapshot()` を追加（weekly/daily/category を一括算出）
  - optimized path: aggregate count + legacy sentAt fallback 1回
  - index fallback path: single scan で一括算出
- `src/usecases/notifications/checkNotificationCap.js`
  - snapshot 集計を優先利用（override時は従来count関数にフォールバック）
- `src/routes/admin/osConfig.js`
  - impact preview の count 取得を snapshot ベースへ置換

## Test Updates
- `tests/phase160/phase160_notification_caps_delivery_counts.test.js`
  - snapshot API のカウント整合を追加検証
- `tests/phase160/phase160_check_notification_cap_delivery_count_mode.test.js`
  - checkNotificationCap が snapshot 経路を使うことを追加検証
- `tests/security/admin_config_impact_preview_breakdown.test.js`
  - quietHours 時の counter 未呼び出し検証を snapshot モックへ更新

## Local Verification
- `node --test tests/phase160/phase160_check_notification_cap_delivery_count_mode.test.js` PASS
- `node --test tests/phase160/phase160_notification_caps_delivery_counts.test.js` PASS
- `node --test tests/security/admin_config_impact_preview_breakdown.test.js` PASS
- `node --test tests/phase68/phase68_blocked_by_notification_cap.test.js` PASS
- `node --test tests/phase73/phase73_retry_blocked_by_notification_cap.test.js` PASS
- `node --test tests/phase161/phase161_composer_blocked_by_notification_cap.test.js` PASS
- `npm test` PASS (`477/477`)
- `npm run test:trace-smoke` PASS
- `npm run test:ops-smoke` PASS
