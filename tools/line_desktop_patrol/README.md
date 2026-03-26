# LINE Desktop Patrol Scaffold

Local-only scaffold for the Member LINE Desktop self-evaluation harness.

## PR1 scope
- policy schema and example config
- trace / proposal schema
- Python sidecar package skeleton
- read-only repo runtime state bridge
- no desktop send path
- no AX / screenshot adapter yet

## Safe defaults
- `enabled=false`
- `dry_run_default=true`
- `auto_apply_level=none`
- whitelist targets only
- proposal queue only

## Commands
- `npm run line-desktop-patrol:validate`
- `npm run line-desktop-patrol:state`

## Layout
- `config/`
- `scenarios/`
- `src/member_line_patrol/`

## Notes
- PR1 intentionally stops before any macOS UI control.
- future PRs can add the adapter layer without changing the schema roots.
