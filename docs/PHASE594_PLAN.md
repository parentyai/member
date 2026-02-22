# Phase594 Plan

## Goal
missing-index fallback surface の baseline を `READ_PATH_BUDGETS` に固定し、以後の増悪を停止する。

## Scope
- `/Users/parentyai.com/Projects/Member/docs/READ_PATH_BUDGETS.md`
- `/Users/parentyai.com/Projects/Member/tests/phase594/*`
- `/Users/parentyai.com/Projects/Member/docs/SSOT_INDEX.md`

## Non-Goals
- read-path query behavior の再変更
- budget policy の緩和

## Contract
- `current_baseline_phase594` を add-only 追記
- `missing_index_surface_max` を基準化
- `generate_missing_index_surface.js --check` で budget 超過時に fail

## Acceptance
- baseline section が docs に固定される
- budget contract test が通る
