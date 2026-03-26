# LINE Desktop Patrol Scaffold

Local-only scaffold for the Member LINE Desktop self-evaluation harness.

## PR2 scope
- policy schema and example config
- trace / proposal schema
- Python sidecar package skeleton
- read-only repo runtime state bridge
- macOS host capability probe
- dry-run harness that writes local trace evidence
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

## Layout
- `config/`
- `scenarios/`
- `src/member_line_patrol/`

## Notes
- PR2 still keeps send disabled and dry-run only.
- future PRs can add AX dump, screenshot capture, and visible-message reads without changing the schema roots.
