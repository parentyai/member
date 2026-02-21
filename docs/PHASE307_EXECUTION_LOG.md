# PHASE307_EXECUTION_LOG

## Implemented
- `src/domain/normalizers/*` 追加（scenario/ops_state 正規化）
- legacy duplicate repo 6組を canonical フォワーダへ置換（DEPRECATED明示）
- `src/repos/firestore/indexFallbackPolicy.js` 追加と主要repoへのwarn hook追加
- `src/domain/security/protectionMatrix.js` 追加 + `src/index.js` 参照化（admin挙動維持）
- `POST /internal/jobs/retention-dry-run` 追加（dry-run固定 / token guard）
- `docs/INDEX_REQUIREMENTS.md` / `docs/SSOT_RETENTION.md` 追加
- `tests/phase307/*.test.js` 追加

## Verification
- `npm run test:docs`
- `npm test`
- `node --test tests/phase307/*.test.js`
