# 01 Input Validation

## Fact Freeze Validation
- `total_leafs_scanned`: actual=`80` expected=`80` match=`True`
- `eligible_generate`: actual=`35` expected=`35` match=`True`
- `generated_drafts`: actual=`35` expected=`35` match=`True`
- `deferred_review`: actual=`36` expected=`36` match=`True`
- `excluded_non_generate`: actual=`9` expected=`9` match=`True`

## Parse / Shape
- `04_leaf_draft_corpus.json`: `parse_ok=true`
- generated drafts loaded: `35`
- draft statuses observed: `['draft_ready']`
- self_check false count: `0`
- must_not_merge_with self-ref count: `0`

## Placeholder Detection Capability
- generated drafts with placeholder/shell tokens detected: `15`
- affected leafs: `['leaf_citypack_feedback_usage', 'leaf_free_retrieval_empty_reply', 'leaf_free_style_checklist', 'leaf_free_style_coach', 'leaf_free_style_quick', 'leaf_free_style_timeline', 'leaf_free_style_weekend', 'leaf_line_renderer_deeplink_with_url', 'leaf_notification_body_default', 'leaf_notification_textmode_cta_join', 'leaf_paid_conversation_format_shell', 'leaf_paid_reply_guard_defaults', 'leaf_region_state_ack', 'leaf_task_flex_labels', 'leaf_webhook_direct_command_ack']`

## Validation Result
- generated_drafts count `35`: `pass`
- deferred/excluded counts: `pass`
- self_check false: `none observed`
- draft_status != draft_ready in generated set: `none observed`
- self-reference in `must_not_merge_with`: `none observed`
