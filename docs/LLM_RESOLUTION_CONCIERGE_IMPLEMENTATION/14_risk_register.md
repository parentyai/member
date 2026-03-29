# 14 Risk Register

## Risk 1

- risk: low-authority or observational links leak into user-facing output
- detection: link registry contract tests
- mitigation: phase1 allowed source policy only exposes `official`, `semi_official`, `internal_approved`

## Risk 2

- risk: concierge shaping leaks into non-target lanes
- detection: phase1 scope lock tests
- mitigation: fixed phase1 lane allowlist in `conciergeLayer`

## Risk 3

- risk: answer-first formatting regresses route persona continuity
- detection: webhook integration contract tests
- mitigation: integration uses existing semantic envelope and existing reply routing
