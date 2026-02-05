# Phase21 Scope (Fixed)

## 1. Objective
Define the implementation scope for Phase21 as a bounded set of up to five items, based on the Phase21 PREPARE artifacts, without adding new decisions, experiments, or behavior changes.

## 2. In Scope
1) P21-001: Produce a reliable denominator (`sentCount`) for CTA A/B.
2) P21-002: Ensure click tracking consistently targets the public `member-track` surface when configured (backward compatible).
3) P21-003: Lock invariants with minimal tests (anti-regression for redirect + stats).
4) P21-004: Ops verification steps (runbook-level, factual only).
5) P21-005: Evidence fixation (acceptance-level, factual only).

## 3. Out of Scope
1) Any new product features or UI/UX redesign.
2) Any new decision/optimization logic (winner selection, recommendations, auto-routing).
3) Any authentication model change (Cloud Run IAM/IAP/proxy/VPN) or security boundary change.
4) Any Firestore schema redesign or breaking change to existing collections.
5) Any re-interpretation or re-execution of Phase20 outcomes as design work.

## 4. Success Metrics
1) `node scripts/phase20_cta_ab_stats.js "openA" "openB" <fromUtc> <toUtc>` outputs JSON with `scannedDocs >= 1`.
2) The same JSON includes `clickCountA + clickCountB >= 1`.
3) The same JSON includes `sentCountA + sentCountB >= 1`.
4) `POST /track/click` on `member-track` returns HTTP status `302` with a `Location` header present.
5) `npm test` returns `fail 0`.
6) `node scripts/phase21_verify_day_window.js` exits with code `0`.
7) The output JSON includes `sentCountA>=1`, `sentCountB>=1`, `clickCountA>=1`, `clickCountB>=1`.
8) The output JSON includes `filterField="createdAt"`.

## 5. Rollback & Safe-Stop
- Rollback: revert the specific Phase21 PR being deployed.
- Safe-Stop: stop further Phase21 work if any Out of Scope item is required to proceed.
