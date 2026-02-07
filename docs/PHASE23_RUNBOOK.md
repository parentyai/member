| result | failure_class | nextAction |
| --- | --- | --- |
| PASS | * | NO_ACTION |
| FAIL | ENV | RERUN_MAIN |
| FAIL | IMPL | FIX_AND_RERUN |
| FAIL | CONFIG | FIX_AND_RERUN |
| FAIL | UNKNOWN | STOP_AND_ESCALATE |

| key | required | notes |
| --- | --- | --- |
| stdout_head | false | diagnostic |
| result | true | routing |
| reasonCode | false | diagnostic |
| stage | false | diagnostic |
| failure_class | true | routing |
| nextAction | true | routing |
| humanDecisionHint | false | diagnostic |

| phaseResult | requiredEvidence | closeDecision |
| --- | --- | --- |
| ALL_PASS | main workflow PASS x2 (dryrun/write) | CLOSE |
| PASS_WITH_ENV_FAIL | ENV fail only + main rerun PASS | CLOSE |
| ANY_IMPL_FAIL | IMPL fail present | NO_CLOSE |
| ANY_UNKNOWN_FAIL | UNKNOWN fail present | NO_CLOSE |
| NO_MAIN_RUN | main run evidence missing | NO_CLOSE |

ALL_PASS: main workflow PASS x2 (dryrun/write)
PASS_WITH_ENV_FAIL: ENV fail only + main rerun PASS
ANY_IMPL_FAIL: IMPL fail present
ANY_UNKNOWN_FAIL: UNKNOWN fail present
NO_MAIN_RUN: main run evidence missing
