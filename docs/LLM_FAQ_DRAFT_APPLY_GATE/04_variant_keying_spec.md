# 04 Variant Keying Spec

key なし apply が危険な generated leaves を固定します。

## leaf_webhook_consent_state_ack
- `variant_required`: `true`
- `variant_keys_needed`: `['consent_granted', 'consent_revoked']`
- why: 同意/取り消しで mutually exclusive な固定文があるため。
- apply risk if unkeyed: revoke 時に grant 文面を出す、または逆転する。
- source evidence: `['/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js:5216', '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js:5221']`

## leaf_webhook_direct_command_ack
- `variant_required`: `true`
- `variant_keys_needed`: `['phase_update', 'done_update']`
- why: phase 更新 ack と done 記録 ack で token も state meaning も異なる。
- apply risk if unkeyed: phase と done の状態反映を取り違える。
- source evidence: `['/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js:5304', '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js:5317']`

## leaf_line_renderer_service_ack
- `variant_required`: `true`
- `variant_keys_needed`: `['service_ack_wait', 'service_ack_prepare', 'service_ack_display']`
- why: renderer fallback / semantic line message の段階で alternate text がある。
- apply risk if unkeyed: service ack と表示準備/表示完了文が同じ key に潰れる。
- source evidence: `['/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/fallbackRenderer.js:14', '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/semanticLineMessage.js:44']`

## leaf_region_prompt_or_validation
- `variant_required`: `true`
- `variant_keys_needed`: `['prompt_required', 'invalid_format']`
- why: 入力促しと形式エラーは selection semantic が別。
- apply risk if unkeyed: invalid input に prompt 文だけを返す。
- source evidence: `['/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/regionLineMessages.js:3', '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/regionLineMessages.js:13']`

## leaf_region_state_ack
- `variant_required`: `true`
- `variant_keys_needed`: `['declared', 'already_set']`
- why: 登録成功と既登録で user-facing 意味が異なる。
- apply risk if unkeyed: 登録成功時に既登録文面を誤出力する。
- source evidence: `['/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/regionLineMessages.js:7', '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/regionLineMessages.js:17']`

## leaf_task_flex_labels
- `variant_required`: `true`
- `variant_keys_needed`: `['section_why_now', 'section_duration', 'section_checklist', 'section_summary', 'section_top_mistakes', 'section_context_tips', 'section_understanding', 'hero_title', 'alt_text_title']`
- why: labels は 1 文字列ではなく UI slot 群。title 依存 label も混在する。
- apply risk if unkeyed: section label と title/altText を 1 registry 値に潰す。
- source evidence: `['/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/tasks/renderTaskFlexMessage.js:120', '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/tasks/renderTaskFlexMessage.js:247']`

## leaf_task_flex_buttons
- `variant_required`: `true`
- `variant_keys_needed`: `['manual_button', 'video_button', 'mistake_button', 'external_link_button']`
- why: button labels は action type/optional presence ごとに切る必要がある。
- apply risk if unkeyed: optional video/external link ボタンが常設 literal と誤認される。
- source evidence: `['/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/tasks/renderTaskFlexMessage.js:65', '/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/tasks/renderTaskFlexMessage.js:267']`

