# 08 Human / Policy Freeze Pack

wiring / canonical key / owner / format policy が先の leaf を分離します。

## leaf_paid_reply_guard_defaults
- freeze_topic: `pitfall_missing_policy`
- why_freeze_first: `<pitfall>` 欠損時に line omit を正とするか、別 fallback literal を持つか未凍結。
- unresolved_decision: pitfall absent path の canonical behavior
- unblocks: `['binding freeze', 'exact-string anchor closure']`

## leaf_line_renderer_deeplink_with_url
- freeze_topic: `handoff_url_binding_owner`
- why_freeze_first: `payload.handoffUrl` の owner と registry binding owner が未固定。
- unresolved_decision: handoffUrl binding owner / fallback owner
- unblocks: `['binding contract closure', 'route contract anchor']`

## leaf_webhook_direct_command_ack
- freeze_topic: `canonical_state_keys_for_phase_and_done`
- why_freeze_first: phase_update / done_update の canonical state key naming を apply spec で固定していない。
- unresolved_decision: phase command と done command の正式 variant key 名
- unblocks: `['variant freeze', 'binding contract anchor']`

## leaf_task_flex_labels
- freeze_topic: `slot_key_scheme_and_title_token_sharing`
- why_freeze_first: section labels / hero title / alt text をどう分離命名するか未凍結。
- unresolved_decision: slot keys と `<title>` token 共有ポリシー
- unblocks: `['variant freeze', 'binding freeze', 'output shape anchor']`

## leaf_task_flex_buttons
- freeze_topic: `button_slot_scheme_and_optional_button_policy`
- why_freeze_first: manual/video/failure/external の optionality と slot key を仕様化していない。
- unresolved_decision: button slot keys と optional button presence policy
- unblocks: `['variant freeze', 'output shape anchor']`

## leaf_notification_body_default
- freeze_topic: `empty_notification_body_policy`
- why_freeze_first: bare `-` をどう扱うかは wording ではなく empty-body policy の問題。
- unresolved_decision: empty body fallback を registry に持つか renderer-only に残すか
- unblocks: `['format placeholder closure', 'route contract anchor']`

## leaf_notification_textmode_cta_join
- freeze_topic: `textmode_cta_join_policy`
- why_freeze_first: `label: url` は copy ではなく format contract。
- unresolved_decision: text-mode CTA join rule を registry literal とするか renderer contract とするか
- unblocks: `['format placeholder closure', 'route contract anchor']`

## leaf_citypack_feedback_usage
- freeze_topic: `feedback_content_slot_semantics`
- why_freeze_first: `<内容>` が literal example か semantic slot か現観測だけでは決めきれない。
- unresolved_decision: `<内容>` の source semantics
- unblocks: `['binding contract closure', 'reauthoring decision']`

