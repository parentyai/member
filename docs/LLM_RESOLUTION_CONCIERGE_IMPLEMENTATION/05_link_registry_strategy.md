# 05 Link Registry Strategy

## Principle

Links are sourced from FAQ / City Pack / existing retrieval evidence and normalized into one response-layer registry contract.

## User-facing source policy in phase1

allowed:

- `official`
- `semi_official`
- `internal_approved`

blocked for primary user-facing direct links:

- `observational_lived_source`
- unknown / low-authority sources

## Implementation notes

- no hard-coded direct URL is embedded in route logic
- route lanes pass candidate links into the concierge layer
- concierge layer normalizes `link_id`, `source_type`, `authority_band`, `freshness_status`
- evidence refs are derived from the normalized link entries
