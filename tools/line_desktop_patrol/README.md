# LINE Desktop Patrol Scaffold

Local-only scaffold for the Member LINE Desktop self-evaluation harness.

## PR8 scope
- policy schema and example config
- trace / proposal schema
- Python sidecar package skeleton
- read-only repo runtime state bridge
- macOS host capability probe
- dry-run harness that writes local trace evidence
- guard-enforced loop runner with local runtime state
- optional screenshot-only observation in the dry-run harness
- standalone bounded AX summary dump command
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
- `PYTHONPATH=tools/line_desktop_patrol/src python3 -m member_line_patrol.macos_adapter --dump-ax-tree --output-path /tmp/line_desktop_patrol_ax.json --execute`

## Layout
- `config/`
- `scenarios/`
- `src/member_line_patrol/`

## Notes
- PR8 still keeps send disabled and dry-run only.
- the guarded loop writes `artifacts/line_desktop_patrol/runtime/state.json` and respects blocked hours, hourly caps, failure streak, and the repo-side kill switch before invoking the dry-run harness.
- when `store_screenshots=true`, the dry-run harness may capture `runs/<run_id>/after.png` on macOS and record it in `screenshot_after`.
- the AX summary command is standalone in PR8 and degrades to `ax_timeout` or `host_not_macos` instead of hanging the run.
- the evaluator bridge is read-only and reuses existing `tools/quality_patrol` logic.
- the evaluator default main artifact path is `artifacts/line_desktop_patrol/evals/<run_id>/desktop_patrol_eval.json`.
- proposal queue output is local-only at `artifacts/line_desktop_patrol/proposals/queue.jsonl` unless an explicit temp path is supplied.
- future PRs can wire AX dump artifacts into the dry-run harness and add visible-message reads without changing the schema roots.
