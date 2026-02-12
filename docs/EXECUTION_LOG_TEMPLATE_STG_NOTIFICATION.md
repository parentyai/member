# EXECUTION_LOG_TEMPLATE_STG_NOTIFICATION

stg 通知E2Eの証跡を、毎回同じ構造で残すためのテンプレート。

## Header
- date: `YYYY-MM-DD`
- utc_started: `<ISO8601>`
- utc_finished: `<ISO8601>`
- env: `stg`
- actor: `<x-actor>`
- main_sha: `<git rev-parse origin/main>`
- branch: `<branch used for verification>`

## Runtime Snapshot
- member_image: `<image tag>`
- webhook_image: `<image tag>`
- track_image: `<image tag>`
- member_revision: `<latestReadyRevisionName>`
- webhook_revision: `<latestReadyRevisionName>`
- track_revision: `<latestReadyRevisionName>`

## Scenario 1: Segment plan -> dry-run -> execute
- traceId:
- requestId:
- expected:
- actual:
- audit_actions:
- decision_ids:
- timeline_ids:
- result: `PASS | FAIL`
- notes:

## Scenario 2: Retry plan -> retry
- traceId:
- requestId:
- expected:
- actual:
- audit_actions:
- decision_ids:
- timeline_ids:
- result: `PASS | FAIL`
- notes:

## Scenario 3: Kill Switch ON block
- traceId:
- requestId:
- expected:
- actual:
- audit_actions:
- decision_ids:
- timeline_ids:
- result: `PASS | FAIL`
- notes:

## Scenario 4: Composer cap block
- traceId:
- requestId:
- expected:
- actual:
- audit_actions:
- decision_ids:
- timeline_ids:
- result: `PASS | FAIL`
- notes:

## Links
- actions_run_urls:
  - `<url>`
- trace_bundle_urls_or_commands:
  - `<url or command>`
- cloud_run_describe_commands:
  - `<command>`

## Final Gate
- all_scenarios_recorded: `YES | NO`
- pii_secret_redaction_checked: `YES | NO`
- follow_up_required: `YES | NO`
- follow_up_owner:
- follow_up_due_date:
