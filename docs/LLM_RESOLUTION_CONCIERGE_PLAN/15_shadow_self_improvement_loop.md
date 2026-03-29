# 15 Shadow Self-Improvement Loop

## Design goal

Improve concierge behavior safely before any live automation touches real customers.

## Hard boundary

- no live customer auto-optimization in phase1
- internal allowlist / test accounts / canary only
- stop switch and cooldown required
- transcript, diff, score, and rollback evidence required
- rule change and model change must be tracked separately

## Observed repo baseline

- this repo contains multiple `shadow` patterns, for example vendor relevance shadowing and shadow write policies
- this repo does **not** contain an observed LINE desktop automation implementation
- therefore desktop automation is a planned integration contract, not an in-repo observed executable in this planning turn

## Proposed loop

1. build replay dataset from:
   - canonical grouping lanes
   - journey-phase scenarios
   - known failure taxonomy
2. run shadow generation against candidate concierge layer
3. capture:
   - transcript
   - response contract
   - link payload
   - task projection payload
4. score with rubric
5. classify failure
6. propose fix
7. require human approval
8. canary on allowlist accounts only
9. widen only after regression and safety gates pass

## Desktop automation scope

Phase1 assumption:

- desktop automation, if used, is limited to:
  - internal allowlist accounts
  - replay or scripted scenario accounts
  - shadow score capture
- no unattended live production users

## Candidate fix pipeline

| step | output |
| --- | --- |
| replay failure | tagged case |
| rubric score | failure taxonomy |
| proposal generator | candidate fix proposal |
| human gate | approved / rejected |
| canary run | scored evidence |
| rollout gate | allow / block |

## Abort thresholds

- safety regression > threshold
- route persona divergence spike
- official link attachment collapse
- task progression proxy drops below guard
- unnecessary clarify rate rises sharply

## Stop controls

- global shadow loop kill switch
- allowlist-only mode
- per-run max action budget
- cooldown window
- manual rollback log requirement

