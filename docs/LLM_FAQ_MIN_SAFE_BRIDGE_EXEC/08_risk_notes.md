# Risk Notes

## Primary Risks

- bridge drift:
  - future runtime wording changes can diverge from the registry
- false completeness:
  - only the approved 12 leaves are bridged
- hidden broadening:
  - expanding the helper into non-target leaves would violate the locked scope

## Mitigations

- fallback literal remains in each bridged path
- focused route/source assertions catch accidental broadening
- phase862 keeps non-target exclusions explicit
