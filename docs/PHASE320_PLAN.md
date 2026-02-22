# PHASE320_PLAN

## 目的
`getUserStateSummary` の read path を user-targeted + range-first へ収束し、full-scan 常用経路を縮小する。

## スコープ
- `src/usecases/phase5/getUserStateSummary.js`
- `tests/phase320/*`（新規）
- `docs/SSOT_INDEX.md`

## 受入条件
- `getUserStateSummary` が `usersRepo.getUser(lineUserId)` を使用する。
- events/deliveries は createdAt/sentAt の bounded range query を優先し、0件時のみ既存 fallback を使う。
- registration completeness は `listUsersByMemberNumber` 経由で重複判定を維持する。
- `npm run test:docs` / `npm test` / `node --test tests/phase320/*.test.js` が通る。
