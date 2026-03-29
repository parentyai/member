# 04 Codex-Only Closure Pack

GPT 再生成や human policy freeze を先に要求しない leaf だけを含めます。

## leaf_free_retrieval_empty_reply
- `closure_class`: `codex_binding_closure_candidate`
- `current_apply_class`: `parameterized_apply_candidate`
- blockers: `['binding_missing_only', 'weak_exact_string_anchor', 'weak_output_shape_anchor']`
- why_codex_only: token source が観測済みで、new wording なしに binding + test closure で進められます。
- required_binding_contracts: `['<title>']`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'output_shape_assert']`
- success_condition: binding contract と対応 test anchors が凍結されること。
- still_not_apply_until: binding contract と test anchors の両方が閉じるまで。

## leaf_webhook_consent_state_ack
- `closure_class`: `codex_variant_closure_candidate`
- `current_apply_class`: `keyed_variant_candidate`
- blockers: `['variant_key_missing_only', 'weak_exact_string_anchor', 'weak_output_shape_anchor']`
- why_codex_only: alternate strings は現行 corpus にあり、必要なのは key 凍結と anchors です。
- required_binding_contracts: `[]`
- required_variant_keys: `['consent_granted', 'consent_revoked']`
- required_test_anchors: `['exact_string_assert', 'output_shape_assert']`
- success_condition: variant key と対応 test anchors が凍結されること。
- still_not_apply_until: variant key と test anchors の両方が閉じるまで。

## leaf_line_renderer_service_ack
- `closure_class`: `codex_variant_closure_candidate`
- `current_apply_class`: `keyed_variant_candidate`
- blockers: `['variant_key_missing_only', 'weak_exact_string_anchor', 'weak_route_contract_anchor']`
- why_codex_only: alternate strings は現行 corpus にあり、必要なのは key 凍結と anchors です。
- required_binding_contracts: `[]`
- required_variant_keys: `['service_ack_wait', 'service_ack_prepare', 'service_ack_display']`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert']`
- success_condition: variant key と対応 test anchors が凍結されること。
- still_not_apply_until: variant key と test anchors の両方が閉じるまで。

## leaf_region_prompt_or_validation
- `closure_class`: `codex_variant_closure_candidate`
- `current_apply_class`: `keyed_variant_candidate`
- blockers: `['variant_key_missing_only', 'weak_exact_string_anchor', 'weak_output_shape_anchor', 'weak_route_contract_anchor']`
- why_codex_only: alternate strings は現行 corpus にあり、必要なのは key 凍結と anchors です。
- required_binding_contracts: `[]`
- required_variant_keys: `['prompt_required', 'invalid_format']`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert', 'output_shape_assert']`
- success_condition: variant key と対応 test anchors が凍結されること。
- still_not_apply_until: variant key と test anchors の両方が閉じるまで。

## leaf_region_state_ack
- `closure_class`: `codex_variant_closure_candidate`
- `current_apply_class`: `keyed_variant_candidate`
- blockers: `['binding_and_variant_missing', 'weak_exact_string_anchor', 'weak_output_shape_anchor', 'weak_route_contract_anchor']`
- why_codex_only: alternate strings は現行 corpus にあり、必要なのは key 凍結と anchors です。
- required_binding_contracts: `['<cityLabel>', '<stateLabel>']`
- required_variant_keys: `['declared', 'already_set']`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert', 'output_shape_assert']`
- success_condition: variant key と対応 test anchors が凍結されること。
- still_not_apply_until: variant key と test anchors の両方が閉じるまで。

## leaf_paid_readiness_clarify_default
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_output_shape_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert', 'output_shape_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_paid_readiness_refuse_default
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_output_shape_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert', 'output_shape_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_paid_readiness_hedge_suffix
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_output_shape_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert', 'output_shape_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_paid_finalizer_fallback
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_output_shape_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'output_shape_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_paid_finalizer_refuse
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_webhook_guard_missing_reply_fallback
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_output_shape_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'output_shape_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_webhook_low_relevance_clarify
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_webhook_retrieval_failure_fallback
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_output_shape_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'output_shape_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_webhook_readiness_clarify
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_webhook_readiness_refuse
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_webhook_synthetic_ack
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_welcome_message
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_line_renderer_overflow_summary
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_line_renderer_deeplink_generic
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_line_renderer_render_failure
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

## leaf_citypack_feedback_received
- `closure_class`: `codex_test_anchor_closure_candidate`
- `current_apply_class`: `literal_apply_candidate`
- blockers: `['weak_exact_string_anchor', 'weak_output_shape_anchor', 'weak_route_contract_anchor']`
- why_codex_only: placeholder / shell / policy freeze を伴わず、主因は test anchor 不足です。
- required_binding_contracts: `[]`
- required_variant_keys: `[]`
- required_test_anchors: `['exact_string_assert', 'route_contract_assert', 'output_shape_assert']`
- success_condition: missing exact-string / shape / route anchors が補われること。
- still_not_apply_until: test anchors が閉じるまで。

