# PHASE310_PLAN

## 目的
- `/admin/app` に「開発者」メニューと Repo Map ペインを add-only で追加し、非エンジニアが全体像を把握できる導線を作る。
- Repo Map を `docs/REPO_AUDIT_INPUTS/repo_map_ui.json` の自動生成データのみで表示する。

## スコープ
- 追加: `GET /api/admin/repo-map`
- 追加: `scripts/generate_repo_map.js`
- 追加: `docs/REPO_AUDIT_INPUTS/repo_map_ui.json`
- 変更: `apps/admin/app.html`, `apps/admin/assets/admin_app.js`, `apps/admin/assets/admin.css`
- 変更: `.github/workflows/audit.yml`, `package.json`, `docs/ADMIN_UI_DICTIONARY_JA.md`, `docs/SSOT_INDEX.md`
- 追加: `tests/phase310/*`

## 非対象
- Firestore スキーマ変更
- 既存通知 API の契約変更
- 既存 pane の削除/再設計

## 受け入れ条件
1. `/api/admin/repo-map` が admin token + actor ヘッダで参照できる。
2. `/admin/app` 右上「開発者」メニューから Repo Map / システム状態 / 監査ログ / 実装状況へ遷移できる。
3. Repo Map は折り畳みなしで、技術語に日本語説明を付けて表示する。
4. `npm run repo-map:check` を CI で実行し、差分未反映を fail できる。
5. `npm run test:docs` と `npm test` が通る。
