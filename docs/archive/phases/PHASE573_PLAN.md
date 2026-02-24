# PHASE573_PLAN

## 目的
phase4 users summary の read-path を scoped-first に寄せ、global fallback 依存を縮小する。

## スコープ
- `src/repos/firestore/analyticsReadRepo.js`
- `src/usecases/admin/getUserOperationalSummary.js`
- `tests/phase573/*`

## 受入条件
- scoped query 優先の契約が add-only で成立する。
- `fallbackMode=block` 時に global fallback が強制実行されない。
- `npm run test:docs` / `npm test` が通る。
