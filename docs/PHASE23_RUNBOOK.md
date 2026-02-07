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
