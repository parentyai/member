# Changed Files Rationale

## Code

### `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/closure/minSafeApplyRegistry.js`

- purpose:
  - add-only corpus/registry for the approved 12 leaves
- direct impact:
  - new literal registry only
- indirect impact:
  - none at runtime until a separate apply step chooses to consume it

## Tests

### `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase861/phase861_t01_min_safe_apply_registry_contract.test.js`

- purpose:
  - exact-string, output-shape, and helper-backed source alignment for the 12-leaf registry

### `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase861/phase861_t02_min_safe_apply_route_contract.test.js`

- purpose:
  - route-source literal alignment for the webhook-backed leaves

## Docs

- execution evidence only
- no existing doc rewrite

## Non-Target Guard

- no files under routing, orchestration, renderer, or notification runtime were modified
- no non-target leaf was added to the registry
