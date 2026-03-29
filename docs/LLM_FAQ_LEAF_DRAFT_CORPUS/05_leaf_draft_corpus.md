# 05 Leaf Draft Corpus

- generation_mode: `SAFE_ONLY`
- generated drafts: `35`
- deferred_review: `36`
- excluded_non_generate: `9`

## leaf_free_retrieval_empty_reply
- draft_status: `draft_ready`
- output_shape: `fallback_text`
- parent_g3 / parent_g4: `g3_free_retrieval_search_unit` / `g4_assistant_free_retrieval_registry_slot`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep not-found framing, narrowing guidance, and support fallback in one free retrieval empty-result response.; Preserve free-tier retrieval lane attribution.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not claim search succeeded when no candidates were found.
- primary_text:
```text
<title> に一致する情報が見つかりませんでした。
キーワードを短くして再検索する
都市名/期限/手続き名を追加して再送する
対象手続きと期限が曖昧なまま再検索すると候補が広がります。
都市名・期限・手続き名を1つずつ教えてください。
不明点は運用窓口へお問い合わせください。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: direct searchFaqFromKb ranked replyText assert remains weak elsewhere; empty branch exact strings are more stable

## leaf_free_style_quick
- draft_status: `draft_ready`
- output_shape: `plain_text_answer`
- parent_g3 / parent_g4: `g3_free_retrieval_search_unit` / `g4_assistant_free_retrieval_registry_slot`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- must_keep_facts: Preserve the quick style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- primary_text:
```text
まずこの順です。
つまずきやすい点: ...
確認: ...
1. 手続きを1つだけ指定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_free_style_coach
- draft_status: `draft_ready`
- output_shape: `plain_text_answer`
- parent_g3 / parent_g4: `g3_free_retrieval_search_unit` / `g4_assistant_free_retrieval_registry_slot`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- must_keep_facts: Preserve the coach style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- primary_text:
```text
この順で進めると迷いにくいです。
注意点: ...
確認したい点: ...
- まず対象手続きを1つ確定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_free_style_checklist
- draft_status: `draft_ready`
- output_shape: `plain_text_answer`
- parent_g3 / parent_g4: `g3_free_retrieval_search_unit` / `g4_assistant_free_retrieval_registry_slot`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- must_keep_facts: Preserve the checklist style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- primary_text:
```text
チェックリスト:
見落としやすい点: ...
確認事項: ...
- [ ] 対象手続きを1つ決める
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_free_style_timeline
- draft_status: `draft_ready`
- output_shape: `plain_text_answer`
- parent_g3 / parent_g4: `g3_free_retrieval_search_unit` / `g4_assistant_free_retrieval_registry_slot`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- must_keep_facts: Preserve the timeline style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- primary_text:
```text
タイムラインで整理します。
遅れやすい点: ...
期限確認: ...
1. 手続きを1つだけ指定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_free_style_weekend
- draft_status: `draft_ready`
- output_shape: `plain_text_answer`
- parent_g3 / parent_g4: `g3_free_retrieval_search_unit` / `g4_assistant_free_retrieval_registry_slot`
- route責務: `POST /webhook/line free retrieval`
- audience: `end_user` leak=`false`
- safety role: `faq`
- must_keep_facts: Preserve the weekend style shell only; semantic action content remains dynamic.; Keep free retrieval style routing separate from contextual and paid lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new style ids or rename current style selectors.
- primary_text:
```text
候補は次の通りです。
よくある失敗: ...
好みに合わせる確認: ...
- まず対象手続きを1つ確定してください。
状況の特定に必要な情報が不足しています。
手続き名と期限が曖昧なまま進めることです。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_paid_conversation_format_shell
- draft_status: `draft_ready`
- output_shape: `plain_text_answer`
- parent_g3 / parent_g4: `g3_paid_conversation_format_unit` / `g4_assistant_paid_format_registry_slot`
- route責務: `POST /webhook/line paid finalization`
- audience: `end_user` leak=`false`
- safety role: `faq`
- must_keep_facts: Keep the paid conversation shell headings and question line placeholders.; Preserve conversation-format ownership separate from semantic answer policy.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not remove or rename fixed shell sections without changing downstream contract.
- primary_text:
```text
いまの状況を短く整理します。
まずは次の一手です:
多くの人が詰まりやすいのは <pitfall>。
<gap> の認識で進めてもよいですか？
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_paid_reply_guard_defaults
- draft_status: `draft_ready`
- output_shape: `fallback_text`
- parent_g3 / parent_g4: `g3_paid_conversation_format_unit` / `g4_assistant_paid_format_registry_slot`
- route責務: `POST /webhook/line paid finalization`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep guard-level default lines used when main paid reply is empty or malformed.; Preserve reply-guard role separate from readiness/refuse decisions.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promote guard defaults into normal semantic answer copy.
- primary_text:
```text
状況を整理しながら進めましょう。
まず最優先で進めたい手続きを1つ教えてください。
まずは次の一手です。
多くの人が詰まりやすいのは <pitfall>。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_paid_readiness_clarify_default
- draft_status: `draft_ready`
- output_shape: `clarify_prompt`
- parent_g3 / parent_g4: `g3_paid_safety_gate_unit` / `g4_assistant_paid_safety_registry_slot`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- must_keep_facts: Keep readiness clarify/refuse/hedge defaults distinct by decision.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse clarify, refuse, and hedge into one generic message.
- primary_text:
```text
まず対象手続きと期限を1つずつ教えてください。そこから案内を具体化します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_paid_readiness_refuse_default
- draft_status: `draft_ready`
- output_shape: `refuse_text`
- parent_g3 / parent_g4: `g3_paid_safety_gate_unit` / `g4_assistant_paid_safety_registry_slot`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- must_keep_facts: Keep readiness clarify/refuse/hedge defaults distinct by decision.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse clarify, refuse, and hedge into one generic message.
- primary_text:
```text
この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを一緒に整理します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_paid_readiness_hedge_suffix
- draft_status: `draft_ready`
- output_shape: `disclaimer_block`
- parent_g3 / parent_g4: `g3_paid_safety_gate_unit` / `g4_assistant_paid_safety_registry_slot`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- must_keep_facts: Keep readiness clarify/refuse/hedge defaults distinct by decision.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not collapse clarify, refuse, and hedge into one generic message.
- primary_text:
```text
補足: 情報は更新されるため、最終確認をお願いします。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_paid_finalizer_fallback
- draft_status: `draft_ready`
- output_shape: `fallback_text`
- parent_g3 / parent_g4: `g3_paid_safety_gate_unit` / `g4_assistant_paid_safety_registry_slot`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep empty-selected-reply fallback text separate from clarify/refuse overwrites.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- primary_text:
```text
状況を整理しながら進めます。優先手続きを1つ決めて進めましょう。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_paid_finalizer_refuse
- draft_status: `draft_ready`
- output_shape: `refuse_text`
- parent_g3 / parent_g4: `g3_paid_safety_gate_unit` / `g4_assistant_paid_safety_registry_slot`
- route責務: `paid orchestrator`
- audience: `end_user` leak=`false`
- safety role: `warning`
- must_keep_facts: Keep finalizer refuse override separate from clarify and empty fallback defaults.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- primary_text:
```text
この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_guard_missing_reply_fallback
- draft_status: `draft_ready`
- output_shape: `fallback_text`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
状況を整理しながら進めましょう。まずは優先する手続きを1つ決めるのがおすすめです。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_low_relevance_clarify
- draft_status: `draft_ready`
- output_shape: `clarify_prompt`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
いまの質問だけでは対象手続きを特定できません。
対象手続きを1つ指定する（例: ビザ更新 / 住居契約 / 税務）
期限を1つ添える（例: 1週間後）
対象手続きと期限が曖昧なまま進めると、案内の精度が下がります。
対象手続き名と期限を1つずつ教えてください。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_retrieval_failure_fallback
- draft_status: `draft_ready`
- output_shape: `fallback_text`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
関連情報を取得できませんでした。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_readiness_clarify
- draft_status: `draft_ready`
- output_shape: `clarify_prompt`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `warning`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
まず対象手続きと期限を1つずつ教えてください。そこから具体的な次の一手を整理します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_readiness_refuse
- draft_status: `draft_ready`
- output_shape: `refuse_text`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `warning`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
この内容は安全に断定できないため、公式窓口で最終確認をお願いします。必要なら確認項目を整理します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_synthetic_ack
- draft_status: `draft_ready`
- output_shape: `command_ack`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
受け取りました。続けて状況を一緒に整理します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_consent_state_ack
- draft_status: `draft_ready`
- output_shape: `consent_ack`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
AI機能の利用に同意しました。
```
- structured_blocks: ["AI機能の利用への同意を取り消しました。"]
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_webhook_direct_command_ack
- draft_status: `draft_ready`
- output_shape: `command_ack`
- parent_g3 / parent_g4: `g3_webhook_top_level_unit` / `g4_webhook_top_level_registry_slot`
- route責務: `POST /webhook/line top-level`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep top-level webhook fallback/ack semantics distinct from assistant answer lanes.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not merge consent or command acknowledgements into assistant answer copy.
- primary_text:
```text
フェーズ更新を記録しました: <phaseCommand>
```
- structured_blocks: ["完了を記録しました: <doneKey>"]
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_welcome_message
- draft_status: `draft_ready`
- output_shape: `welcome_text`
- parent_g3 / parent_g4: `g3_welcome_message_unit` / `g4_notification_registry_slot`
- route責務: `welcome push flow`
- audience: `end_user` leak=`false`
- safety role: `notification`
- must_keep_facts: Keep one-time welcome notification wording and official-contact framing.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.
- primary_text:
```text
公式からのご案内はすべてこちらのLINEでお送りします。重要なお知らせは「公式連絡」からご確認ください。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_line_renderer_overflow_summary
- draft_status: `draft_ready`
- output_shape: `renderer_default_text`
- parent_g3 / parent_g4: `g3_line_renderer_service_fallback_unit` / `g4_line_renderer_fallback_registry_slot`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- primary_text:
```text
表示できる件数を超えたため要約して案内します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_line_renderer_deeplink_with_url
- draft_status: `draft_ready`
- output_shape: `renderer_default_text`
- parent_g3 / parent_g4: `g3_line_renderer_service_fallback_unit` / `g4_line_renderer_fallback_registry_slot`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- primary_text:
```text
詳しくは次の画面で確認できます: <url>
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_line_renderer_deeplink_generic
- draft_status: `draft_ready`
- output_shape: `renderer_default_text`
- parent_g3 / parent_g4: `g3_line_renderer_service_fallback_unit` / `g4_line_renderer_fallback_registry_slot`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- primary_text:
```text
続きはアプリ内画面で確認できます。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_line_renderer_service_ack
- draft_status: `draft_ready`
- output_shape: `renderer_default_text`
- parent_g3 / parent_g4: `g3_line_renderer_service_fallback_unit` / `g4_line_renderer_fallback_registry_slot`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- primary_text:
```text
確認しています。少しお待ちください。
```
- structured_blocks: ["回答を準備しています。", "回答を表示します。"]
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_line_renderer_render_failure
- draft_status: `draft_ready`
- output_shape: `renderer_default_text`
- parent_g3 / parent_g4: `g3_line_renderer_service_fallback_unit` / `g4_line_renderer_fallback_registry_slot`
- route責務: `renderer fallback`
- audience: `end_user` leak=`false`
- safety role: `fallback`
- must_keep_facts: Keep renderer-service fallback wording separate from assistant answer content.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not add new LINE surface types or routing promises.
- primary_text:
```text
メッセージを生成できませんでした。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_notification_body_default
- draft_status: `draft_ready`
- output_shape: `notification_text`
- parent_g3 / parent_g4: `g3_notification_renderer_unit` / `g4_notification_registry_slot`
- route責務: `notification sender`
- audience: `end_user` leak=`false`
- safety role: `notification`
- must_keep_facts: Keep notification renderer defaults separate from source notification title/body content.; Preserve text-mode CTA join semantics when template buttons are unavailable.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent CTA URLs or button counts.
- primary_text:
```text
-
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_notification_textmode_cta_join
- draft_status: `draft_ready`
- output_shape: `notification_text`
- parent_g3 / parent_g4: `g3_notification_renderer_unit` / `g4_notification_registry_slot`
- route責務: `notification sender`
- audience: `end_user` leak=`false`
- safety role: `cta`
- must_keep_facts: Keep notification renderer defaults separate from source notification title/body content.; Preserve text-mode CTA join semantics when template buttons are unavailable.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent CTA URLs or button counts.
- primary_text:
```text
label: url
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_region_prompt_or_validation
- draft_status: `draft_ready`
- output_shape: `clarify_prompt`
- parent_g3 / parent_g4: `g3_journey_direct_command_unit` / `g4_journey_text_registry_slot`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- primary_text:
```text
地域（City, State）を入力してください。例: Austin, TX
```
- structured_blocks: ["地域の形式が読み取れませんでした。例: Austin, TX の形式で入力してください。"]
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_region_state_ack
- draft_status: `draft_ready`
- output_shape: `command_ack`
- parent_g3 / parent_g4: `g3_journey_direct_command_unit` / `g4_journey_text_registry_slot`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- primary_text:
```text
地域を登録しました: <cityLabel>, <stateLabel>
```
- structured_blocks: ["地域は既に登録済みです。変更が必要な場合は管理者へご連絡ください。"]
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_citypack_feedback_received
- draft_status: `draft_ready`
- output_shape: `command_ack`
- parent_g3 / parent_g4: `g3_journey_direct_command_unit` / `g4_journey_text_registry_slot`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `cta`
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- primary_text:
```text
City Packの誤り報告を受け付けました。確認後に反映します。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_citypack_feedback_usage
- draft_status: `draft_ready`
- output_shape: `clarify_prompt`
- parent_g3 / parent_g4: `g3_journey_direct_command_unit` / `g4_journey_text_registry_slot`
- route責務: `journey direct command parser`
- audience: `end_user` leak=`false`
- safety role: `clarify`
- must_keep_facts: Keep parser-driven command reply semantics and examples bound to the current command family.; Preserve journey command ownership separate from task-detail surfaces and reminders.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not promise ticket creation or side effects beyond what the current source states.
- primary_text:
```text
City Pack Feedback: <内容> の形式で送信してください。
```
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_task_flex_labels
- draft_status: `draft_ready`
- output_shape: `flex_label_set`
- parent_g3 / parent_g4: `g3_journey_task_surface_unit` / `g4_journey_task_registry_slot`
- route責務: `journey task detail and postback`
- audience: `end_user` leak=`false`
- safety role: `label`
- must_keep_facts: Keep fixed section labels, headings, and card titles in the task flex surface.; Preserve task-flex ownership and do not merge with task-detail leak copy.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent new task sections or card titles.
- labels: ["いまやる理由", "必要時間", "やること", "概要", "よくある失敗", "あなたの状況の注意", "理解する", "【<title>】", "<title> のタスク詳細"]
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

## leaf_task_flex_buttons
- draft_status: `draft_ready`
- output_shape: `flex_button_set`
- parent_g3 / parent_g4: `g3_journey_task_surface_unit` / `g4_journey_task_registry_slot`
- route責務: `journey task detail and postback`
- audience: `end_user` leak=`false`
- safety role: `button`
- must_keep_facts: Keep task-flex button labels and link-opening CTA labels fixed.; Preserve understanding-manual/video/failure action semantics.
- prohibited_claims: Do not invent new legal, tax, contract, or eligibility claims.; Do not promote shadow or dead templates into live output.; Do not merge operator/admin wording into unrelated end-user leaves.; Do not invent new task-detail postback actions or video assumptions.
- buttons: ["📖 手順マニュアル", "🎥 3分動画", "⚠ よくある失敗", "外部リンクを開く"]
- self-check: shape=`True` claim=`True` tone=`True` route=`True` audience=`True`
- review 必要性: `no`
- open questions: none

