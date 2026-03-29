# 04 Template Inventory (Human Readable)

- normalized template families: **32**
- exact text blocks captured: **319**
- runtime truth counts: reachable=15, conditionally_reachable=14, unconfirmed=1, dead_or_test_only=2

## faq_disclaimer_templates
- family: `faq_disclaimer`
- kind: `disclaimer`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/llm/disclaimers.js`
- upstream path: FAQ admin/compat routes -> answerFaqFromKb -> getDisclaimer; paid assistant path -> generatePaidAssistantReply -> getDisclaimer
- exact blocks:
  - `この回答は公式FAQ（KB）に基づく要約です。個別事情により異なる場合があります。`
  - `提案です。自動実行は行いません。最終判断は運用担当が行ってください。`
  - `提案候補です。実行手順の確定は決定論レイヤで行ってください。`
  - `提案です。契約・法務・税務の最終判断は専門家確認のうえで行ってください。`
  - `提案情報です。最終判断は運用担当が行ってください。`
- selection predicates: getDisclaimer(purpose, { policy }) resolves purpose-specific disclaimer / faq path uses purpose=faq / paid assistant path uses purpose=paid_assistant / generic fallback disclaimer returned when purpose is unknown
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase231/phase231_disclaimer_version_in_faq_response_and_audit.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t06_paid_assistant_template_guard_contract.test.js
- notes: Counts as preset user-facing text because exact strings are hardcoded and appended or returned directly.

## policy_override_disclaimer_templates
- family: `faq_disclaimer_policy_seed`
- kind: `disclaimer`
- runtime_truth: `unconfirmed`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/repos/firestore/opsConfigRepo.js`
- upstream path: opsConfigRepo default LLM policy -> getDisclaimer(policy override) -> FAQ/paid paths if policy loaded
- exact blocks:
  - `この回答は公式FAQ（KB）に基づく要約です。個別事情により異なる場合があります。`
  - `提案です。自動実行は行いません。最終判断は運用担当が行ってください。`
  - `提案候補です。実行手順の確定は決定論レイヤで行ってください。`
  - `提案です。契約・法務・税務の最終判断は専門家確認のうえで行ってください。`
- selection predicates: systemFlagsRepo.normalizeLlmPolicy() provides DEFAULT_LLM_POLICY / getDisclaimer() may read llmPolicy.disclaimer_templates / runtime contribution depends on live policy state and caller purpose
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase658/phase658_t02_llm_policy_extensions_contract.test.js
- notes: Observed as runtime-connected seed source, but final end-user use is contingent on policy load and caller purpose; therefore runtime_truth is unconfirmed.

## faq_block_action_labels
- family: `faq_block_actions`
- kind: `cta`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/faq/answerFaqFromKb.js`
- upstream path: FAQ admin/compat route -> answerFaqFromKb blocked result -> fallbackActions -> Admin UI label render
- exact blocks:
  - `公式FAQを見る`
  - `問い合わせる`
- selection predicates: answerFaqFromKb blocked paths call buildFallbackActions() / actionKey open_official_faq maps to 公式FAQを見る / actionKey open_contact maps to 問い合わせる
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase232/phase232_faq_block_payload_contract.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase246/phase246_block_ux_contract.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase232/phase232_admin_block_ux_markup.test.js
- notes: Preset CTA labels are fixed even though suggested FAQ titles are dynamic.

## free_retrieval_empty_reply
- family: `free_retrieval_reply`
- kind: `faq`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/assistant/generateFreeRetrievalReply.js`
- upstream path: LINE webhook -> handleAssistantMessage -> replyWithFreeRetrieval -> generateFreeRetrievalReply -> buildEmptyReply
- exact blocks:
  - `<title> に一致する情報が見つかりませんでした。`
  - `キーワードを短くして再検索する`
  - `都市名/期限/手続き名を追加して再送する`
  - `対象手続きと期限が曖昧なまま再検索すると候補が広がります。`
  - `都市名・期限・手続き名を1つずつ教えてください。`
  - `不明点は運用窓口へお問い合わせください。`
- selection predicates: replyWithFreeRetrieval() chooses generateFreeRetrievalReply() / buildEmptyReply() selected when safeFaqCandidates + safeCityPackCandidates length is 0 / free plan branch only
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t05_free_retrieval_kb_citypack_contract.test.js
- notes: Exact title slot is dynamic; surrounding scaffold is preset.

## free_retrieval_ranked_reply
- family: `free_retrieval_reply`
- kind: `faq`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/assistant/generateFreeRetrievalReply.js`
- upstream path: LINE webhook -> handleAssistantMessage -> replyWithFreeRetrieval -> generateFreeRetrievalReply -> buildRankedReply
- exact blocks:
  - `<title> の関連情報です。`
  - `FAQ候補`
  - `CityPack候補`
  - `FAQ候補を確認する（<articleId>）`
  - `CityPack候補を確認する（<sourceId>）`
  - `キーワードを変えて再検索する`
  - `候補を同時に進めると手続きが分散しやすくなります。`
  - `根拠キー: <citationKey>`
  - `(score=<score>)`
  - `必要なら「抜け漏れチェック」「次アクション」を送ってPro支援を試せます。`
- selection predicates: generateFreeRetrievalReply buildRankedReply() selected when sanitized FAQ or CityPack candidates exist / free retrieval path only
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t05_free_retrieval_kb_citypack_contract.test.js
- notes: Exact article ids, titles, and scores are dynamic; scaffold and labels are preset.

## search_kb_replytext_templates
- family: `search_kb_replyText`
- kind: `faq`
- runtime_truth: `dead_or_test_only`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/faq/searchFaqFromKb.js`
- upstream path: searchFaqFromKb helper -> candidates consumed by callers; replyText itself not observed on current user-facing path
- exact blocks:
  - `<title> に一致するFAQが見つかりませんでした。`
  - `1. 公式FAQのキーワードを変えて再検索`
  - `2. 必要な条件を追記して再送`
  - `3. 緊急時は運用窓口へ連絡`
  - `<header> のFAQ候補です。`
  - `<rank>. <title> (score=<score>)`
  - `引用キー: <articleId>`
- selection predicates: searchFaqFromKb() computes replyText alongside candidates
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t05_free_retrieval_kb_citypack_contract.test.js
- notes: Observed helper text exists, but current runtime-connected callers use candidate arrays or newer free retrieval formatter instead of this replyText.

## response_style_templates
- family: `conversation_style_engine`
- kind: `style`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/conversation/responseStyles.js`
- upstream path: assistant packet -> styleRouter/selectResponseStyle -> responseStyles renderer -> humanized reply text
- exact blocks:
  - `まずこの順です。`
  - `つまずきやすい点: ...`
  - `確認: ...`
  - `1. 手続きを1つだけ指定してください。`
  - `この順で進めると迷いにくいです。`
  - `注意点: ...`
  - `確認したい点: ...`
  - `- まず対象手続きを1つ確定してください。`
  - `チェックリスト:`
  - `見落としやすい点: ...`
  - `確認事項: ...`
  - `- [ ] 対象手続きを1つ決める`
  - `進め方の候補です。`
  - `注意: ...`
  - `どれで進めますか: ...`
  - `A. 対象手続きを1つ指定する`
  - `切り分け手順:`
  - `詰まりポイント: ...`
  - `追加確認: ...`
  - `タイムラインで整理します。`
  - `遅れやすい点: ...`
  - `期限確認: ...`
  - `候補は次の通りです。`
  - `よくある失敗: ...`
  - `好みに合わせる確認: ...`
  - `順番に進めると詰まりにくいです。`
  - `先に注意: ...`
  - `確認したいこと: ...`
  - `状況の特定に必要な情報が不足しています。`
  - `手続き名と期限が曖昧なまま進めることです。`
- selection predicates: urgent regex or urgency=high -> Quick / topic=activity -> Weekend / topic in regulation/medical/visa/tax/school/pricing -> Checklist / deadline or journeyPhase pre/arrival -> Timeline / confused regex -> Coach / messageLength <= 24 -> Choice / topic=other -> Debug / timeOfDay >= 20 -> Story / default -> Coach
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase717/phase717_t03_style_router_contract.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase717/phase717_t04_style_humanizer_contract.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase717/phase717_t09_style_variation_contract.test.js
- notes: This record groups eight preset style families; exact line bodies are fixed but action content inside them can be dynamic.

## free_contextual_followup_domain_answers
- family: `free_contextual_followup`
- kind: `faq`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/conversation/freeContextualFollowup.js`
- upstream path: LINE webhook free path -> contextual domain resume -> resolveFreeContextualFollowup -> replyText
- exact blocks:
  - `住まい探しは、本人確認と収入確認の書類を先にそろえると進みます。`
  - `内見は予約制の物件が多いので、候補を絞って空き枠を先に確認しましょう。`
  - `次は、希望条件を3つに絞って候補物件を3件まで減らすのが近道です。`
  - `希望エリアと入居時期は決まっていますか？`
  - `学校手続きは、住所証明と予防接種記録を先にそろえると止まりにくいです。`
  - `面談や登録は予約制の学校が多いので、対象校が決まったら空き枠を確認しましょう。`
  - `次は、対象校を1校に絞って必要書類を先に確定するのが最短です。`
  - `学年と希望エリアは決まっていますか？`
  - `SSNは、本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。`
  - `窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認してください。`
  - `次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認すると確実です。`
  - `いまの在留ステータスは分かっていますか？`
  - `口座開設は、本人確認と住所証明の2点を先にそろえると進みやすいです。`
  - `支店手続きは予約制のことがあるので、来店前に予約可否を確認しましょう。`
  - `次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。`
  - `使いたい銀行か用途は決まっていますか？`
- selection predicates: recentActionRows resolve a contextual domain / messageText length <= 16 / resolveFollowupIntent returns a supported followupIntent / domain-specific direct answer exists
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase754/phase754_t03_free_contextual_followup_contract.test.js
- notes: Preset short followup answers are domain-specific and can add a question line when needsQuestion is true.

## paid_casual_templates
- family: `paid_casual_conversation`
- kind: `fallback`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/assistant/generatePaidCasualReply.js`
- upstream path: LINE webhook paid path -> routeConversation(casual) -> generatePaidCasualReply
- exact blocks:
  - `こんにちは。今日はどの手続きから進めますか？`
  - `ありがとうございます。必要なら、今いちばん気になっている手続きを1つだけ教えてください。`
  - `了解です。状況を短く整理しながら進めます。`
  - `ありがとうございます。いまの状況を一緒に整えて進めます。`
  - `把握しました。まずは迷いを減らすところから進めます。`
  - `<contextLabel>の続きとして、いま詰まっている点を1つだけ教えてください。`
  - `<contextLabel>で次に決めたいことを1つだけ教えてください。`
  - `<contextLabel>について、まず何から進めたいですか？`
  - `続きで進めるため、いま一番気になっている点を1つだけ教えてください。`
  - `状況を合わせたいので、次に決めたいことを1つだけ教えてください。`
  - `短くで大丈夫なので、先に進めたい手続きを1つだけ教えてください。`
  - `次は、不足しやすい書類を1つずつ確認しましょう。`
  - `次は、最寄り窓口を1つ決めて予約要否を確認しましょう。`
  - `次は、期限が近い手続きを1つに固定して進めましょう。`
  - `学校手続きは、住所証明と予防接種記録を先にそろえると止まりにくいです。`
  - `学校登録や面談は予約制のことがあるので、対象校が決まったら予約要否を確認しましょう。`
  - `次は、対象校を1校に絞って必要書類を先に確定するのが最短です。`
  - `住居手続きは、本人確認と収入確認に使う書類を先にそろえるのが近道です。`
  - `内見は予約が必要な物件が多いので、候補を絞って空き枠を確認しましょう。`
  - `次は、候補物件を3件まで絞ってから内見可否を確認すると進みやすいです。`
  - `SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。`
  - `窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認しましょう。`
  - `次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認するのが確実です。`
  - `口座開設は本人確認と住所証明の2点を先にそろえると進みやすいです。`
  - `支店手続きは予約制のことがあるので、来店前に予約可否を確認しましょう。`
  - `次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。`
- selection predicates: paid plan branch with conversation router selecting casual mode / greeting/smalltalk posture short-circuit to greeting or smalltalk templates / contextHint and followupIntent choose direct answer map or generic prompt set
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase718/phase718_t02_paid_greeting_runtime_smoke.test.js
- notes: This family intentionally includes greeting, smalltalk, intro, generic prompt, followup action lines, and domain direct answers.

## paid_domain_concierge_templates
- family: `paid_domain_concierge`
- kind: `faq`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/assistant/generatePaidDomainConciergeReply.js`
- upstream path: LINE webhook paid path -> routeConversation/domain_orchestrator -> generatePaidDomainConciergeReply
- exact blocks:
  - `住まい探しですね。`
  - `希望条件を3つに絞る`
  - `審査に必要な書類が不足すると契約手続きが止まりやすくなります。`
  - `希望エリアと入居時期を教えてもらえますか？`
  - `住居契約では、本人確認と収入確認に使う書類を先にそろえるのが近道です。`
  - `内見は予約が必要な物件が多いので、候補を絞って先に空き枠を確認しましょう。`
  - `次は、条件を1つ減らして候補物件を3件まで絞ると進みやすいです。`
  - `学校手続きですね。`
  - `学区と対象校の条件を確認する`
  - `提出書類の不足や期限超過で入学手続きが止まりやすくなります。`
  - `学年と希望エリアを教えてもらえますか？`
  - `学校手続きは、住所証明と予防接種記録を先にそろえると止まりにくいです。`
  - `面談や学校登録は予約制のことが多いので、対象校が決まったら先に空き枠を確認しましょう。`
  - `学校手続きの次は、対象校を1校に絞って必要書類を先に確定するのが最短です。`
  - `SSN手続きですね。`
  - `申請条件と本人確認書類を確認する`
  - `本人確認書類の不備があると再訪が必要になりやすくなります。`
  - `いまの在留ステータスを教えてもらえますか？`
  - `SSNは本人確認書類と在留資格が分かる書類を先にそろえるのが最優先です。`
  - `窓口は予約が必要な地域もあるので、最寄り窓口の予約要否を先に確認しましょう。`
  - `次は、必要書類を1つの一覧にまとめてから窓口の予約要否を確認するのが確実です。`
  - `銀行口座まわりですね。`
  - `口座種別を1つ決める`
  - `住所証明の条件が合わないと口座開設が遅れやすくなります。`
  - `使いたい銀行か用途を教えてもらえますか？`
  - `口座開設は本人確認と住所証明の2点を先にそろえると早いです。`
  - `支店手続きは予約制のことがあるので、来店前に予約可否を確認してください。`
  - `次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。`
  - `いまの状況を整理します。`
  - `今すぐ進める手続きを1つ決める`
  - `優先順位が曖昧だと手続きが分散しやすくなります。`
  - `いま一番困っている手続きを1つだけ教えてください。`
  - `必要書類は、まず最優先の手続きに必要なものだけ先に整理すると進めやすいです。`
  - `予約要否は手続きごとに違うので、最優先手続きの窓口だけ先に確認しましょう。`
  - `次は、最優先手続きを1つ決めて期限を確認するのが最短です。`
  - `了解です。前提を修正して続けます。`
  - `次は<action>。`
  - `詰まりやすいのは <pitfall>。`
  - `<question>`
- selection predicates: conversationRouter/orchestrator resolves domain intent / DOMAIN_SPECS selected by domainIntent or fallbackIntent / followupIntent may select directAnswers within the domain
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase720/phase720_t05_paid_main_natural_reply_contract.test.js
- notes: not_observed

## paid_assistant_conversation_format
- family: `paid_assistant_conversation`
- kind: `faq`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/assistant/generatePaidAssistantReply.js`
- upstream path: paid assistant answer generation -> formatPaidReplyConversation -> webhook send
- exact blocks:
  - `いまの状況を短く整理します。`
  - `まずは次の一手です:`
  - `多くの人が詰まりやすいのは <pitfall>。`
  - `<gap> の認識で進めてもよいですか？`
- selection predicates: generatePaidAssistantReply default path uses conversation format when ENABLE_PAID_ASSISTANT_CONVERSATION_FORMAT_V1 is not disabled / disclaimer appended if present
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t06_paid_assistant_template_guard_contract.test.js
- notes: Model-generated semantic content is dynamic; this record inventories only the fixed conversation scaffolding.

## paid_assistant_legacy_structured_format
- family: `paid_assistant_legacy`
- kind: `faq`
- runtime_truth: `dead_or_test_only`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/assistant/generatePaidAssistantReply.js`
- upstream path: paid assistant answer generation -> formatPaidReply (legacy) -> webhook send if conversation-format flag disabled
- exact blocks:
  - `1. 状況整理`
  - `1) 要約（前提）`
  - `前提情報の整理が不足しています。`
  - `2. 抜け漏れ`
  - `2) 抜け漏れ（最大<maxGaps>）`
  - `現時点で大きな抜け漏れは確認できません。`
  - `3. リスク`
  - `3) リスク（最大<maxRisks>）`
  - `重大リスクは限定的です。`
  - `4. NextAction`
  - `4) NextAction（最大<maxNextActions>・根拠キー付）`
  - `まずはFAQ候補の再確認を行ってください。`
  - `5. 根拠参照キー`
  - `5) 参照（KB/CityPackキー）`
  - `6. 注意事項`
  - `提案です。最終判断は運用担当が行ってください。`
- selection predicates: legacy formatter selected only when conversation format flag is disabled
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t06_paid_assistant_template_guard_contract.test.js
- notes: Current runtime truth filter classified this family as dead_or_test_only for final user-visible output on main path.

## paid_reply_guard_defaults
- family: `paid_reply_guard`
- kind: `fallback`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/conversation/paidReplyGuard.js`
- upstream path: paid assistant/orchestrator output -> sanitizePaidMainReply -> finalizer -> webhook send
- exact blocks:
  - `状況を整理しながら進めましょう。`
  - `まず最優先で進めたい手続きを1つ教えてください。`
  - `まずは次の一手です。`
  - `多くの人が詰まりやすいのは <pitfall>。`
- selection predicates: sanitizePaidMainReply() invoked before final send / defaults applied when situation line or question line missing
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase720/phase720_t05_paid_main_natural_reply_contract.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase832/phase832_t03_reply_template_fingerprint_contract.test.js
- notes: This family is a structural guard and strips legacy terms before final delivery.

## answer_readiness_gate_templates
- family: `answer_readiness_gate`
- kind: `warning`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/quality/applyAnswerReadinessDecision.js`
- upstream path: reply generated -> answer readiness decision applied -> clarify/refuse/hedged text returned
- exact blocks:
  - `まず対象手続きと期限を1つずつ教えてください。そこから案内を具体化します。`
  - `この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを一緒に整理します。`
  - `補足: 情報は更新されるため、最終確認をお願いします。`
- selection predicates: applyAnswerReadinessDecision decision=clarify|refuse|hedged|allow / clarifyText/refuseText may be injected by caller; otherwise defaults above apply
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase230/phase230_faq_confidence_blocks_low_confidence.test.js
- notes: not_observed

## required_core_facts_domain_clarify
- family: `core_facts_gate`
- kind: `warning`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/policy/evaluateRequiredCoreFactsGate.js`
- upstream path: paid orchestrator -> evaluateRequiredCoreFactsGate -> clarify candidate or enforced clarify text
- exact blocks:
  - `SSNを正確に案内するため、在留ステータスか最寄り窓口の地域を教えてください。`
  - `口座手続きを正確に案内するため、利用予定の銀行か来店地域を教えてください。`
  - `学校手続きを正確に案内するため、対象学年か希望エリアを教えてください。`
  - `住まい探しを具体化するため、希望エリアか入居時期を教えてください。`
  - `まず対象手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。`
- selection predicates: evaluateRequiredCoreFactsGate() fires when critical facts missing for domain and enforcement path active / domainIntent selects domain-specific clarify text
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase851/phase851_t07_city_specificity_gap_contract.test.js
- notes: not_observed

## verify_candidate_clarify_templates
- family: `orchestrator_verify`
- kind: `warning`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/verifyCandidate.js`
- upstream path: paid orchestrator -> verifyCandidate -> clarify candidate / hedged candidate -> finalizeCandidate
- exact blocks:
  - `学校手続きなら、学年と住所エリアが分かれば必要書類をすぐ絞れます。`
  - `学校手続きは予約制の窓口があるため、対象校の地域を先に確認しましょう。`
  - `学校手続きの次は、対象校を1校に絞って不足書類を先に潰すのが最短です。`
  - `SSNは在留ステータスと本人確認書類が分かれば必要書類を確定できます。`
  - `SSN窓口は地域で運用差があるので、最寄り地域を先に決めましょう。`
  - `SSNの次は、必要書類を1つの一覧にまとめて窓口要件を確認するのが確実です。`
  - `住まい探しは、希望エリアが分かると必要書類の優先順位を絞れます。`
  - `内見予約が必要な物件が多いので、候補エリアを先に1つ決めましょう。`
  - `住まい探しの次は、候補物件を3件まで絞って内見順を決めるのが最短です。`
  - `口座開設は用途と在留情報が分かると必要書類を絞れます。`
  - `支店ごとに予約要否が違うため、来店予定地域を先に決めましょう。`
  - `口座手続きの次は、口座種別を1つ決めて必要書類を先に確定するのが最短です。`
  - `学校手続きを絞りたいので、学年か希望エリアを1つ教えてください。`
  - `対象校を絞るため、学年か地域を先に1つ決めましょう。`
  - `SSN手続きを進めるため、在留ステータスを1つ教えてください。`
  - `SSN窓口を絞るため、最寄り地域を1つ教えてください。`
  - `住まい探しを進めるため、希望エリアか入居時期を1つ教えてください。`
  - `候補物件を絞るため、予算帯かエリアを先に1つ決めましょう。`
  - `口座手続きを進めるため、用途か希望銀行を1つ教えてください。`
  - `口座開設条件を絞るため、来店地域か口座種別を1つ教えてください。`
  - `対象を絞って案内したいので、いま一番気になっている手続きを1つ教えてください。`
  - `まず優先手続きを1つに絞りたいので、対象手続きと期限を教えてください。`
  - `断定を避けるため、重要な条件は公式窓口で最終確認してください。`
- selection predicates: verifyCandidate() chooses clarify_candidate when selected missing or evidence insufficient / domainIntent + followupIntent may select CLARIFY_FOLLOWUP_BY_DOMAIN direct answer / otherwise one of CLARIFY_VARIANTS_BY_DOMAIN is picked with repetition avoidance
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase731/phase731_t02_paid_orchestrator_run_contract.test.js
- notes: not_observed

## finalize_candidate_fallback_templates
- family: `orchestrator_finalizer`
- kind: `fallback`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/orchestrator/finalizeCandidate.js`
- upstream path: orchestrator selected candidate -> sanitizePaidMainReply -> finalizeCandidate -> applyAnswerReadinessDecision -> final text
- exact blocks:
  - `状況を整理しながら進めます。優先手続きを1つ決めて進めましょう。`
  - `まず対象手続きと期限を1つずつ教えてください。`
  - `まず対象手続きと期限を1つずつ教えてください。そこから次の一手を絞ります。`
  - `この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを整理します。`
- selection predicates: finalizeCandidate() uses fallbackText when selected reply is empty or guard strips it / defaultQuestion used when verificationOutcome=clarify and no followup question remains / readinessClarifyText or default clarify/refuse text may overwrite guarded reply
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase731/phase731_t02_paid_orchestrator_run_contract.test.js
- notes: not_observed

## runtime_knowledge_fallback_templates
- family: `runtime_knowledge_candidates`
- kind: `fallback`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/llm/knowledge/buildRuntimeKnowledgeCandidates.js`
- upstream path: runtime knowledge assembly -> buildRuntimeKnowledgeCandidates -> candidate consumed by reply builder
- exact blocks:
  - `関連情報をもとに整理します。`
  - `・希望条件を2つまで固定する`
  - `・地域条件と初期費用を先に確認する`
  - `・前の話題で未確定の条件を1つだけ埋める`
  - `・対象条件と期限を1つずつ整理する`
  - `入居時期か希望エリアは決まっていますか？`
  - `赴任先の都市か住むエリアは決まっていますか？`
  - `いま一番止まっている条件はどこですか？`
  - `いま優先したい条件は何ですか？`
- selection predicates: buildRuntimeKnowledgeCandidates builds synthetic knowledge candidate when knowledge source summary exists / slice selects action and followup line
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase834/phase834_t03_saved_faq_candidate_activation_contract.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase832/phase832_t07_summary_generic_fallback_slice_contract.test.js
- notes: This family is indirect: candidate text is built here, then consumed downstream by reply pipelines.

## webhook_assistant_top_level_templates
- family: `webhook_assistant_top_level`
- kind: `fallback`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js`
- upstream path: POST /webhook/line -> handleLineWebhook -> handleAssistantMessage / direct command branches -> fixed ack or fallback text
- exact blocks:
  - `状況を整理しながら進めましょう。まずは優先する手続きを1つ決めるのがおすすめです。`
  - `いまの質問だけでは対象手続きを特定できません。`
  - `対象手続きを1つ指定する（例: ビザ更新 / 住居契約 / 税務）`
  - `期限を1つ添える（例: 1週間後）`
  - `対象手続きと期限が曖昧なまま進めると、案内の精度が下がります。`
  - `対象手続き名と期限を1つずつ教えてください。`
  - `関連情報を取得できませんでした。`
  - `まず対象手続きと期限を1つずつ教えてください。そこから具体的な次の一手を整理します。`
  - `この内容は安全に断定できないため、公式窓口で最終確認をお願いします。必要なら確認項目を整理します。`
  - `受け取りました。続けて状況を一緒に整理します。`
  - `AI機能の利用に同意しました。`
  - `AI機能の利用への同意を取り消しました。`
  - `フェーズ更新を記録しました: <phaseCommand>`
  - `完了を記録しました: <doneKey>`
- selection predicates: low relevance gate invokes buildLowRelevanceConversationReply() / guardPaidMainReplyText used when paid reply missing / readiness clarify/refuse may be applied at webhook layer / consent commands and direct commands emit fixed ack text
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase716/phase716_t05_webhook_concierge_audit_and_killswitch_contract.test.js, /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase720/phase720_t05_paid_main_natural_reply_contract.test.js
- notes: This family mixes assistant fallback, clarify/refuse, synthetic ack, consent ack, and direct command acknowledgements that are all routed from webhookLine.

## line_surface_renderer_defaults
- family: `line_renderers`
- kind: `fallback`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/fallbackRenderer.js`
- upstream path: assistant/journey/notification payload -> line renderer -> fallback text/template/flex defaults
- exact blocks:
  - `表示できる件数を超えたため要約して案内します。`
  - `詳しくは次の画面で確認できます: <url>`
  - `続きはアプリ内画面で確認できます。`
  - `確認しています。少しお待ちください。`
  - `回答を準備しています。`
  - `回答を表示します。`
  - `ご案内`
  - `お知らせがあります。`
  - `メッセージを生成できませんでした。`
- selection predicates: fallbackRenderer used for overflow/service ack / semanticLineMessage chooses flex/template/text by line surface policy / lineChannelRenderer normalizes arbitrary message objects and falls back to text defaults
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase0/buildLineNotificationMessage.test.js
- notes: Route tracer observed assistant sends are mostly text today; flex/template defaults remain conditionally reachable through renderer policy and non-assistant flows.

## welcome_message
- family: `welcome_notification`
- kind: `notification`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/sendWelcomeMessage.js`
- upstream path: LINE webhook ensure user -> sendWelcomeMessage -> pushFn
- exact blocks:
  - `公式からのご案内はすべてこちらのLINEでお送りします。重要なお知らせは「公式連絡」からご確認ください。`
- selection predicates: sendWelcomeMessage() runs once when ensured user has not yet received welcome message
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase0/welcome.test.js
- notes: Pure fixed notification text; no dynamic blocks except delivery state.

## notification_renderer_defaults
- family: `line_notification_renderer`
- kind: `cta`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/notifications/buildLineNotificationMessage.js`
- upstream path: sendNotification -> buildLineNotificationMessage -> text/template buttons LINE payload
- exact blocks:
  - `-`
  - `notification`
  - `label: url`
- selection predicates: normalizeBody() returns - when title/body absent / normalizeAltText() falls back to notification / multi-CTA text mode appends label: url lines when template buttons unavailable or disabled
- tests: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase0/buildLineNotificationMessage.test.js
- notes: Notification titles, bodies, and CTA labels are usually dynamic; this family inventories only preset renderer defaults and join patterns.

## region_line_messages
- family: `region_command`
- kind: `command_reply`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/regionLineMessages.js`
- upstream path: LINE webhook -> direct command branch -> region message helper -> replyFn
- exact blocks:
  - `地域（City, State）を入力してください。例: Austin, TX`
  - `地域を登録しました: <cityLabel>, <stateLabel>`
  - `地域の形式が読み取れませんでした。例: Austin, TX の形式で入力してください。`
  - `地域は既に登録済みです。変更が必要な場合は管理者へご連絡ください。`
- selection predicates: region direct command parser routes to region line messages helpers
- tests: not_observed
- notes: All four strings are hardcoded, runtime-connected direct command replies.

## citypack_feedback_messages
- family: `citypack_feedback`
- kind: `command_reply`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/cityPackFeedbackMessages.js`
- upstream path: LINE webhook -> city pack feedback direct command -> helper -> replyFn
- exact blocks:
  - `City Packの誤り報告を受け付けました。確認後に反映します。`
  - `City Pack Feedback: <内容> の形式で送信してください。`
- selection predicates: city pack feedback direct command branch
- tests: not_observed
- notes: Two fixed feedback texts only.

## redac_membership_messages
- family: `redac_membership`
- kind: `command_reply`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/redacLineMessages.js`
- upstream path: LINE webhook -> membership direct command -> redacLineMessages helper -> replyFn
- exact blocks:
  - `会員IDは登録済みです（末尾: <last4>）。`
  - `内容が違う場合は「会員ID 00-0000」を送信してください。`
  - `会員IDは解除済みです。`
  - `再登録する場合は「会員ID 00-0000」を送信してください。`
  - `会員IDは未登録です。`
  - `登録する場合は「会員ID 00-0000」を送信してください。`
  - `会員IDの登録が完了しました。`
  - `「会員ID 確認」で登録状態を確認してください。`
  - `その会員IDはすでに登録があります。`
  - `番号を再確認し、必要なら運用担当へご連絡ください。`
  - `会員IDの形式が正しくありません。`
  - `例「会員ID 00-0000」の形式で送信してください。`
  - `会員IDの使い方です。`
  - `「会員ID 00-0000」で登録し、「会員ID 確認」で状態を確認してください。`
  - `現在この操作は利用できません。`
  - `時間をおいて再度お試しください。`
- selection predicates: membership command parser + repo state determine status path
- tests: not_observed
- notes: Each reply is a summary + nextAction pair wrapped by withNextAction().

## journey_task_detail_defaults
- family: `journey_task_detail`
- kind: `fallback`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/journey/taskDetailSectionReply.js`
- upstream path: LINE command TODO詳細 / continuation -> taskDetailSectionReply -> replyFn
- exact blocks:
  - `手順マニュアルは未登録です。管理画面の Task Detail Editor で登録してください。`
  - `よくある失敗は未登録です。管理画面の Task Detail Editor で登録してください。`
  - `タスク詳細キーの解決に失敗しました。時間をおいて再試行してください。`
  - `続きはありません。`
  - `【手順マニュアル <index>/<total>】`
  - `【よくある失敗 <index>/<total>】`
  - `【詳細 <index>/<total>】`
  - `長文のため <endExclusive>/<totalChunks> 件まで表示しました。続きは「<continueCommand>」を送信してください。`
- selection predicates: task detail section command path / manualText/failureText presence determines fallback text / continuation parser determines chunk header and continuation prompt
- tests: not_observed
- notes: Admin-facing copy (“Task Detail Editor”) is intentionally user-facing in current runtime because it is returned directly to LINE users when content is missing.

## task_flex_labels_and_buttons
- family: `task_flex`
- kind: `button`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/tasks/renderTaskFlexMessage.js`
- upstream path: LINE command/postback -> handleJourneyLineCommand -> renderTaskFlexMessage -> flex reply
- exact blocks:
  - `いまやる理由`
  - `必要時間`
  - `やること`
  - `概要`
  - `よくある失敗`
  - `あなたの状況の注意`
  - `理解する`
  - `📖 手順マニュアル`
  - `🎥 3分動画`
  - `⚠ よくある失敗`
  - `外部リンクを開く`
  - `【<title>】`
  - `<title> のタスク詳細`
- selection predicates: task detail flex path when renderTaskFlexMessage() used
- tests: not_observed
- notes: All button labels and section labels are fixed preset user-facing text.

## journey_command_replies
- family: `journey_commands`
- kind: `command_reply`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/journey/handleJourneyLineCommand.js`
- upstream path: LINE message/postback -> parser -> handleJourneyLineCommand / handleJourneyPostback -> fixed replyText or flex payload
- exact blocks:
  - `属性の形式が不正です。例: 属性:単身 / 属性:夫婦 / 属性:帯同1 / 属性:帯同2`
  - `日付形式が不正です。YYYY-MM-DD 形式で入力してください。例: 渡航日:2026-04-01`
  - `属性を「<household>」に更新しました。
TODO同期: <syncedCount>件`
  - `<dateLabel>を <dateValue> に更新しました。
TODO同期: <syncedCount>件`
  - `Task OS入口は現在停止中です。`
  - `地域手続き導線は現在停止中です。`
  - `地域手続きの取得に失敗しました。時間をおいて再度お試しください。`
  - `カテゴリ指定が不正です。利用可能: <TASK_CATEGORIES>`
  - `相談導線を開きました。
この操作は「案内表示 + 利用イベント記録」のみで、チケット作成は行いません。
困っている内容を1メッセージで送ってください。
例: 口座開設の必要書類が分からない`
  - `TODOキーが必要です。例: TODO業者:bank_open`
  - `TODOキーが必要です。例: TODO詳細:visa_documents`
  - `続き表示の形式が不正です。例: TODO詳細続き:todoKey:manual:2`
  - `CityPackモジュール購読は現在停止中です。`
  - `CityPack購読状況: <statusLine>
変更する場合は「CityPack案内」を送信してください。`
  - `モジュール指定が不正です。例: CityPack購読:schools`
  - `モジュール指定が不正です。schools/healthcare/driving/housing/utilities から選択してください。`
  - `CityPack購読を更新しました: <statusLine>`
  - `TODO「<todoKey>」を完了にしました。素晴らしい進捗です。
未完了: <openCount>件 / 期限超過: <overdueCount>件`
  - `TODO「<todoKey>」を進行中に更新しました。
未完了: <openCount>件 / 期限超過: <overdueCount>件`
  - `TODO「<todoKey>」を未着手に更新しました。
未完了: <openCount>件 / 期限超過: <overdueCount>件`
  - `TODO「<todoKey>」をスヌーズしました（解除予定: <date>）。
未完了: <openCount>件 / 期限超過: <overdueCount>件`
  - `詳細を見る場合は「TODO詳細:todoKey」を送信してください。`
  - `期限確認は「今週の期限」（7日以内/期限超過）、地域差がある手続きは「地域手続き」で確認できます。`
  - `タスク詳細表示は現在停止中です。`
- selection predicates: journey line command parser determines command family / feature flags gate Task OS, regional procedures, task detail, city pack subscription / todo status commands choose completion/progress/snooze templates
- tests: not_observed
- notes: This family groups many hardcoded command replies because they share the same parser-driven command surface.

## journey_reminder_message
- family: `journey_todo_reminder`
- kind: `reminder`
- runtime_truth: `reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/journey/runJourneyTodoReminderJob.js`
- upstream path: internal journey reminder job -> buildReminderMessage -> pushFn
- exact blocks:
  - `期限が近いTODOがあります。
[<todoKey>] <title>
期限: <dueDate>
確認: 「<ctaAction>」を送信してください。
trigger:<triggerType>`
- selection predicates: internal reminder job selects due/triggered items / ctaAction becomes 地域手続き or TODO詳細:<todoKey>
- tests: not_observed
- notes: Trigger line is intentionally user-facing and should be preserved in inventory.

## blocked_reason_labels
- family: `task_blocked_reason_labels`
- kind: `label`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/domain/tasks/blockedReasonJa.js`
- upstream path: task blocked reason code -> blockedReasonJa label map -> downstream task/journey surface if rendered
- exact blocks:
  - `前のタスクが未完了`
  - `通知停止時間`
  - `一時停止中`
  - `プラン上限`
  - `本日の上限`
  - `条件未成立`
  - `処理待ち`
- selection predicates: blocked reason code -> Japanese label map
- tests: not_observed
- notes: User-facing label map was observed, but direct runtime surface was not fully traced; therefore conditionally_reachable.

## emergency_message_template
- family: `emergency_draft`
- kind: `warning`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/emergency/messageTemplates.js`
- upstream path: emergency usecase -> messageTemplates -> downstream bulletin/notification send path
- exact blocks:
  - `[<severity>] <headline>
地域: <regionKey>
カテゴリ: <category>
最新の公式情報をご確認ください。`
- selection predicates: emergency bulletin/message template creation path
- tests: not_observed
- notes: Adjacent runtime family included because it is preset user-facing text, but it is outside the main FAQ/assistant route.

## ops_escalation_default_notification
- family: `ops_escalation`
- kind: `cta`
- runtime_truth: `conditionally_reachable`
- primary path: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/usecases/phase33/executeOpsNextAction.js`
- upstream path: ops next action execution -> default escalation notification payload
- exact blocks:
  - `Ops Escalation`
  - `Ops escalation required.`
  - `Open`
- selection predicates: phase33 executeOpsNextAction default notification payload construction
- tests: not_observed
- notes: Adjacent runtime family included because it is a preset user-facing notification template.
