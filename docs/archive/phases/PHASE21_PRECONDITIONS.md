# Phase21 Preconditions (PREPARE)

## START Conditions
- Phase20 is CLOSED and its factual evidence is fixed on `main`.
- A public click surface exists (`member-track`) and is reachable unauthenticated for `POST /track/click` (HTTP 302 with `Location`).
- The stats script can produce `clickCount > 0` using `filterField=createdAt` over a specified UTC window.
- Phase21 START requires an explicit START declaration (this file does not START Phase21).

## HOLD Conditions
- Any attempt to add decision logic (winner selection, optimization, auto-routing) is introduced.
- Any change requests authentication model changes (IAP/proxy/VPN/Cloud Run IAM model change).
- Any change would require re-interpreting Phase20 facts as design decisions.

## Explicit Prohibitions (Phase21 PREPARE)
- No implementation changes.
- No behavior changes.
- No new decision logic.
- No re-interpretation of Phase20 outcomes.

