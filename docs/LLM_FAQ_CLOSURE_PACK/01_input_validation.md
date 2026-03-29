# 01 Input Validation

## Fact Freeze Validation
- `total_leafs_scanned`: actual=`80` expected=`80` match=`True`
- `generated_drafts`: actual=`35` expected=`35` match=`True`
- `deferred_review`: actual=`36` expected=`36` match=`True`
- `excluded_non_generate`: actual=`9` expected=`9` match=`True`
- `literal_apply_candidate`: actual=`16` expected=`16` match=`True`
- `parameterized_apply_candidate`: actual=`3` expected=`3` match=`True`
- `keyed_variant_candidate`: actual=`7` expected=`7` match=`True`
- `copy_shell_only`: actual=`7` expected=`7` match=`True`
- `blocked_apply`: actual=`2` expected=`2` match=`True`
- `ready_literal_now`: actual=`0` expected=`0` match=`True`
- `ready_after_binding_contract`: actual=`1` expected=`1` match=`True`
- `ready_after_variant_keying`: actual=`0` expected=`0` match=`True`
- `shell_only_not_for_apply`: actual=`7` expected=`7` match=`True`
- `blocked_apply`: actual=`27` expected=`27` match=`True`

## Parse Checks
- `04_leaf_draft_corpus.json`: `parse_ok=true`
- `05_leaf_manifest.json`: `parse_ok=true`
- generated draft ids recovered: `35`
- placeholder inventory reachable: `True`
- variant keying spec reachable: `True`
- binding contract reachable: `True`
- blocked queue reachable: `True`
- `ready_literal_now = 0` remains the current snapshot conclusion.
