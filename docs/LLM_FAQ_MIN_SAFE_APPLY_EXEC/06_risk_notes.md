# Risk Notes

## Primary Risks

- registry drift:
  - if current runtime wording changes later, the new tests will fail until the registry is intentionally updated
- false sense of completion:
  - this turn does not wire runtime to the registry
- boundary creep:
  - non-target leaves must not be added opportunistically in follow-up changes

## Guardrails Used

- literal copy only
- exact 12-leaf scope lock
- focused tests only
- no runtime file edits
