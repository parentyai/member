# 14 Risk Register

| Risk ID | Risk | Detection | Impact | Mitigation in this spec |
| --- | --- | --- | --- | --- |
| R1 | Same-copy different-route collapse | Compare route scope and decision nodes in G3 and route CSV | Loss of route attribution and compat governance | hard_no_merge and separate G3 units |
| R2 | Safety copy merged by wording only | Review safety boundary matrix and gate function evidence | Fail-safe semantics regression | assistant_paid_safety_owner and paid_safety_layers stay isolated |
| R3 | Audience leak hidden by broad group | Check audience_leak=true families and G2 or G3 leak notes | Operator or internal wording reaches end-user surfaces | leak flags preserved at family and group level |
| R4 | Quick reply omitted as if surface absent | Review special class notes and G4 dynamic quick reply slot | Future surface inventory misses quick reply path | dynamic quick reply slot stays explicit |
| R5 | Shadow families promoted into live lanes | Compare runtime_truth and shadow_classes | Unconfirmed or dead copy contaminates live grouping | shadow_only policy and dedicated shadow groups |
| R6 | Integrated spec enums treated as direct inventory values | Compare input validation and grouping axes crosswalk notes | False deterministic mapping claims | structural-only crosswalk statement in grouping axes and JSON notes |
| R7 | Mixed webhook top-level family normalized away | Inspect G1 and G3 webhook_top_level groups | Command ack and safety fallback become indistinguishable | low-readiness isolated owner and slot |

## Counterexample Set

1. Same wording does not imply one group when route scope differs.
2. Same selector theme does not imply one owner when compat or policy governance differs.
3. Safety copy cannot be normalized by style similarity because fail-safe semantics differ.
4. Audience leak candidates must remain visible instead of being hidden inside broader journey or notification groups.
5. Not observing a standalone preset quick reply family does not imply quick reply surface is absent.
6. Dead or test-only families cannot join live corpus just because their wording resembles live copy.
7. Policy override seed cannot be promoted from unconfirmed to reachable without runtime evidence.
