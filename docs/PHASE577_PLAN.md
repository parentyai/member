# PHASE577_PLAN

## 目的
phase4 summary の global `listAll*` fallback を failure-only に寄せ、空結果時の不要full-scan常用を抑制する。

## スコープ
- `src/usecases/admin/getUserOperationalSummary.js`
- `src/usecases/admin/getNotificationOperationalSummary.js`
- `tests/phase577/*`

## 受入条件
- users summary の events/deliveries/checklists/userChecklists fallback が失敗時分岐でのみ発火する。
- notifications summary の events fallback が失敗時分岐でのみ発火する。
- `npm run test:docs` / `npm test` が通る。
