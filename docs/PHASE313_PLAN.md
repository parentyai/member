# PHASE313_PLAN

## 目的
`/admin/review` など legacy 導線を残したまま、`/admin/app` への回帰導線と状態可視化を追加する。

## スコープ
- `src/routes/admin/legacyStatus.js`（新規）
- `src/index.js`（`/api/admin/legacy-status` 追加）
- `apps/admin/app.html`
- `apps/admin/assets/admin_app.js`
- `docs/ADMIN_UI_DICTIONARY_JA.md`（add-only）
- `tests/phase313/*`（新規）

## 受入条件
- `/api/admin/legacy-status` が admin token 保護下で応答。
- 開発者メニューから LEGACY 導線を表示/再読込できる。
- 既存 `/admin/review` 直配信は互換維持。
