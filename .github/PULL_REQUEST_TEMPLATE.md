# Purpose
- TODO

# Changes
- TODO

# Quality Scorecard (Required)
- Current Baseline Scorecard: `TODO` (artifact path / URL)
- Expected Post-change Scorecard: `TODO` (artifact path / URL)
- Hard Gate Impact: `TODO` (failures/warnings delta)
- Quality Risks: `TODO` (top 3)
- What Improves / What Might Regress: `TODO`

# Scope / Impact
- TODO

# Tests
- [ ] Not run (explain why)
- [ ] Run (list commands and results)
- [ ] `npm run catchup:drift-check` 実行済み（repo-map / docs-artifacts / cleanup / retention / structure / load-risk / missing-index / collection-drift / phase-origin / unreachable / scenariokey-drift）
- [ ] `npm run internal-jobs:conflict-watchlist` 実行済み（internal job の stacked / shared structural artifact PR）
- [ ] `npm run internal-jobs:merge-regen` 実行済み（internal job の stacked PR で `origin/main` を working branch に取り込んだ後）
- [ ] `npm run test:admin-nav-contract` 実行済み（Admin UI導線変更あり）
- [ ] `npm run firestore-indexes:check -- --contracts-only` 実行済み（admin/read path変更あり）
- [ ] `npm run llm:quality:gate` 実行済み
- [ ] `npm run llm:quality:must-pass` 実行済み
- [ ] `npm run llm:quality:release-policy` 実行済み

# UI / Docs
- [ ] UI表示は ADMIN_UI_DICTIONARY_JA.md に準拠
- [ ] npm run test:docs 実行済み
- [ ] UIテキスト差分なし（verify_docs PASS）

# Rollback
- TODO

# Catchup Wave
- [ ] W0 baseline evidence updated
- [ ] W1 governance gate considered
- [ ] W2 structure debt gate considered
- [ ] W3 critical contract gate considered
- [ ] W4 design readiness gate considered

# SSOT Delta
- [ ] No SSOT delta
- [ ] SSOT delta logged in `docs/SSOT_DELTA_PROPOSAL.md`

# Related Tasks (P0-###)
- TODO
