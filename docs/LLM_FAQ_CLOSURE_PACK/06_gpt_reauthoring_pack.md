# 06 GPT Re-Authoring Pack

shell / semantic-fill draft のみを含めます。文面はここでは生成しません。

## leaf_free_style_quick
- why_gpt_reauthoring_required: current draft が shell / ellipsis / semantic-fill placeholder に依存しており final wording を持たないため。
- unresolved_tokens: `['...']`
- output_shape: `plain_text_answer`
- route_scope: `POST /webhook/line free retrieval`
- audience_scope: `end_user`
- safety_scope: `faq`
- must_not_merge_with: `['leaf_free_retrieval_ranked_reply', 'leaf_free_contextual_followup']`
- required_finalization_decisions_before_apply: `['style shell を final literal に落とす decision', 're-authored text に対する exact-string anchor plan']`
```text
まずこの順です。
つまずきやすい点: ...
確認: ...
1. 手続きを1つだけ指定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```

## leaf_free_style_coach
- why_gpt_reauthoring_required: current draft が shell / ellipsis / semantic-fill placeholder に依存しており final wording を持たないため。
- unresolved_tokens: `['...']`
- output_shape: `plain_text_answer`
- route_scope: `POST /webhook/line free retrieval`
- audience_scope: `end_user`
- safety_scope: `faq`
- must_not_merge_with: `['leaf_free_retrieval_ranked_reply', 'leaf_free_contextual_followup']`
- required_finalization_decisions_before_apply: `['style shell を final literal に落とす decision', 're-authored text に対する exact-string anchor plan']`
```text
この順で進めると迷いにくいです。
注意点: ...
確認したい点: ...
- まず対象手続きを1つ確定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```

## leaf_free_style_checklist
- why_gpt_reauthoring_required: current draft が shell / ellipsis / semantic-fill placeholder に依存しており final wording を持たないため。
- unresolved_tokens: `['...']`
- output_shape: `plain_text_answer`
- route_scope: `POST /webhook/line free retrieval`
- audience_scope: `end_user`
- safety_scope: `faq`
- must_not_merge_with: `['leaf_free_retrieval_ranked_reply', 'leaf_free_contextual_followup']`
- required_finalization_decisions_before_apply: `['style shell を final literal に落とす decision', 're-authored text に対する exact-string anchor plan']`
```text
チェックリスト:
見落としやすい点: ...
確認事項: ...
- [ ] 対象手続きを1つ決める
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```

## leaf_free_style_timeline
- why_gpt_reauthoring_required: current draft が shell / ellipsis / semantic-fill placeholder に依存しており final wording を持たないため。
- unresolved_tokens: `['...']`
- output_shape: `plain_text_answer`
- route_scope: `POST /webhook/line free retrieval`
- audience_scope: `end_user`
- safety_scope: `faq`
- must_not_merge_with: `['leaf_free_retrieval_ranked_reply', 'leaf_free_contextual_followup']`
- required_finalization_decisions_before_apply: `['style shell を final literal に落とす decision', 're-authored text に対する exact-string anchor plan']`
```text
タイムラインで整理します。
遅れやすい点: ...
期限確認: ...
1. 手続きを1つだけ指定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```

## leaf_free_style_weekend
- why_gpt_reauthoring_required: current draft が shell / ellipsis / semantic-fill placeholder に依存しており final wording を持たないため。
- unresolved_tokens: `['...']`
- output_shape: `plain_text_answer`
- route_scope: `POST /webhook/line free retrieval`
- audience_scope: `end_user`
- safety_scope: `faq`
- must_not_merge_with: `['leaf_free_retrieval_ranked_reply', 'leaf_free_contextual_followup']`
- required_finalization_decisions_before_apply: `['style shell を final literal に落とす decision', 're-authored text に対する exact-string anchor plan']`
```text
候補は次の通りです。
よくある失敗: ...
好みに合わせる確認: ...
- まず対象手続きを1つ確定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```

## leaf_paid_conversation_format_shell
- why_gpt_reauthoring_required: current draft が shell / ellipsis / semantic-fill placeholder に依存しており final wording を持たないため。
- unresolved_tokens: `['<pitfall>', '<gap>']`
- output_shape: `plain_text_answer`
- route_scope: `POST /webhook/line paid finalization`
- audience_scope: `end_user`
- safety_scope: `faq`
- must_not_merge_with: `['leaf_paid_reply_guard_defaults', 'leaf_paid_domain_concierge']`
- required_finalization_decisions_before_apply: `['pitfall source freeze', 'gap/followup source freeze', 'section preservation policy']`
```text
いまの状況を短く整理します。
まずは次の一手です:
多くの人が詰まりやすいのは <pitfall>。
<gap> の認識で進めてもよいですか？
```

