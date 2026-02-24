# PHASE364_PLAN

## 目的
phase4 users summary の deliveries/checklists read-path を scoped query 優先にし、fallback を query failure 条件へ限定する。

## スコープ
- `src/repos/firestore/analyticsReadRepo.js`
- `src/usecases/admin/getUserOperationalSummary.js`
- `docs/INDEX_REQUIREMENTS.md`
- `tests/phase364/*`

## 受入条件
- scoped read API が add-only で追加される。
- full-scan fallback は failure 条件でのみ実行される。
- 既存 API 互換が維持される。
