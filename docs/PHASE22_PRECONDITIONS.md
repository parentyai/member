# Phase22 Preconditions

## START Conditions
- Phase21 CLOSE is declared in docs.
- Phase21 verify script exists on main and is the sole verification command.
- Exit code rules (0/1/2 meanings) are fixed in docs.
- Phase22 START requires an explicit declaration.

## HOLD Conditions
- Latest verify result has `exitCode=1` (implementation/spec failure unresolved).
- Verify cannot run without `exitCode=2` (environment error not classified as such).
- Required evidence logs (UTC + main SHA + outputs) are missing for the intended window.

## Prohibited
- Reinterpreting Phase21 evidence, exitCode meanings, or verification criteria.
- Changing Phase21 measurement logic or stats window definitions.
- Adding new experiments or decision logic under Phase22 PREPARE.
