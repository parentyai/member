# LINE Desktop Patrol Scaffold

Local-only scaffold for the Member LINE Desktop self-evaluation harness.

## PR6 scope
- policy schema and example config
- trace / proposal schema
- Python sidecar package skeleton
- read-only repo runtime state bridge
- macOS host capability probe
- dry-run harness that writes local trace evidence
- guard-enforced loop runner with local runtime state
- read-only evaluator bridge into existing `qualityPatrol`
- append-only local proposal queue
- per-proposal Codex packet contract
- no desktop send path
- no AX / visible-message reader yet

## Safe defaults
- `enabled=false`
- `dry_run_default=true`
- `auto_apply_level=none`
- whitelist targets only
- proposal queue only

## Commands
- `npm run line-desktop-patrol:validate`
- `npm run line-desktop-patrol:state`
- `npm run line-desktop-patrol:probe`
- `npm run line-desktop-patrol:dry-run`
- `npm run line-desktop-patrol:loop`
- `npm run line-desktop-patrol:evaluate -- --trace <artifacts/.../trace.json>`
- `npm run line-desktop-patrol:enqueue-proposals -- --trace <artifacts/.../trace.json> --planning-output <artifacts/.../desktop_patrol_eval_planning.json>`

## Layout
- `config/`
- `scenarios/`
- `src/member_line_patrol/`

## Notes
- PR6 still keeps send disabled and dry-run only.
- the guarded loop writes `artifacts/line_desktop_patrol/runtime/state.json` and respects blocked hours, hourly caps, failure streak, and the repo-side kill switch before invoking the dry-run harness.
- the evaluator bridge is read-only and reuses existing `tools/quality_patrol` logic.
- the evaluator default main artifact path is `artifacts/line_desktop_patrol/evals/<run_id>/desktop_patrol_eval.json`.
- proposal queue output is local-only at `artifacts/line_desktop_patrol/proposals/queue.jsonl` unless an explicit temp path is supplied.
- future PRs can add AX dump, screenshot capture, and visible-message reads without changing the schema roots.
