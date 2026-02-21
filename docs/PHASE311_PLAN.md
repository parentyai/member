# PHASE311_PLAN

## 目的
- 管理UIに三層構造（運用層 / 開発層 / 説明層）を add-only で統合し、既存の運用一本道を壊さずに「全体像」と「取説」を同一画面で扱えるようにする。
- Repo Map の表示データを CI 生成 JSON（`docs/REPO_AUDIT_INPUTS/repo_map_ui.json`）で固定し、手動更新前提をなくす。

## スコープ
- 変更: `scripts/generate_repo_map.js`（`layers` 出力追加）
- 変更: `docs/REPO_AUDIT_INPUTS/repo_map_ui.json`（生成結果更新）
- 変更: `src/routes/admin/repoMap.js`（`layers` 互換追加返却）
- 変更: `apps/admin/app.html`（取説ペイン追加、開発者メニュー導線追加）
- 変更: `apps/admin/assets/admin_app.js`（三層描画、通知マトリクス上書き）
- 変更: `apps/admin/assets/admin.css`（取説レイアウト）
- 変更: `docs/ADMIN_UI_DICTIONARY_JA.md`（表示文言 add-only）
- 追加: `tests/phase311/*`
- 追加: `docs/PHASE311_EXECUTION_LOG.md`
- 変更: `docs/SSOT_INDEX.md`（add-only 追記）

## 非対象
- Firestore スキーマ変更
- 既存通知 API 契約変更
- 既存 pane の削除や大規模再設計

## 受け入れ条件
1. `/api/admin/repo-map` が既存互換を維持したまま `layers` を返す。
2. `/admin/app` に取説（Redac向け / ユーザー向け）ペインが追加され、`<details>` を使わない。
3. Repo Map の developer ステータスが `planned|in_progress|completed|deprecated` で決定的に生成される。
4. `npm run repo-map:check`, `npm run test:docs`, `npm test`, `node --test tests/phase311/*.test.js` が通る。
