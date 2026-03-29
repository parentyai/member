# 13 Missing Binding Questions

1. `leaf_citypack_feedback_usage` の `<内容>` は literal instruction 例なのか、将来 binding token なのか。
2. `leaf_paid_conversation_format_shell` の `<gap>` は `gaps[0]` 固定なのか、followupQuestion 派生なのか。
3. `leaf_paid_reply_guard_defaults` で `<pitfall>` が欠損した場合、line omit を正とする contract をどこに置くか。
4. `leaf_line_renderer_service_ack` の 3 variants を結ぶ canonical state key はどこで凍結するか。
5. `leaf_task_flex_labels` の `<title>` は hero title と altText を同一 token で束ねてよいか。
6. `leaf_task_flex_buttons` の `外部リンクを開く` は default button literal なのか action-link label fallback なのか。
7. `leaf_line_renderer_deeplink_with_url` を apply に進める前に、`payload.handoffUrl` の source owner をどの registry contract に紐付けるか。
