# PHASE188_PLAN

## Phase188の目的
通知待機日数の SSOT を確定し、read-model/UIの待機日数表示が仕様どおりに成立する状態を作る。

## Phase188A（SSOT欠落解消 / 値はTBD）
### Scope IN
- `docs/SSOT_NOTIFICATION_WAIT_RULES.md` を新規作成（値はTBD）
- `docs/SSOT_INDEX.md` に導線追加（add-only）
- `docs/PHASE188_PLAN.md` / `docs/PHASE188_EXECUTION_LOG.md` の追加

### Scope OUT
- baseDate/offsetDays の値決定
- read-model 算出ロジック変更
- UI変更
- src/apps/tests の変更

### Acceptance / Done
- SSOTが新規作成され、未設定時挙動が明文化されている
- `npm run test:docs` PASS
- working tree CLEAN

## Phase188B（値確定 + nextWaitDays算出）
### 前提
- stepKeyごとの baseDate / offsetDays がユーザーから明示されていること

### Scope IN
- `docs/SSOT_NOTIFICATION_WAIT_RULES.md` の値追記（add-only）
- `src/usecases/admin/getNotificationReadModel.js` で nextWaitDays 算出
- `tests/phase188` の追加

### Scope OUT
- waitRuleType の追加/意味変更
- 通知送信フロー変更
- UI構造変更
