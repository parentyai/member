# SSOT Phase22

## Purpose
Phase22 is the phase to make CTA A/B "decision-ready" by connecting stable same-day (createdAt) sent/click measurement outputs to operational visibility and decision material, without changing measurement behavior.

## Capabilities From Phase21
Can do:
- Verify same-day (createdAt) sentCount and clickCount increments for CTA A/B.
- Use verify exitCode classification to separate implementation failure (1) from environment failure (2).
- Run `scripts/phase21_verify_day_window.js` on main as the single verification command.

Cannot do:
- Decide winner or change routing logic.
- Redefine measurement windows or stats logic.
- Reinterpret Phase21 evidence or rerun experiments as design work.

## Success Criteria (Facts)
- Verify command exits with `exitCode=0` for a defined UTC day window.
- Output JSON includes `sentCountA>=1`, `sentCountB>=1`, `clickCountA>=1`, `clickCountB>=1` and `filterField="createdAt"`.
- CTR is computable from observed `clickCount` and `sentCount` within the same UTC window.
- Verification results are logged with UTC timestamps and main SHA.
