# Promotion Rules

## Ready Literal Now

A leaf is promoted to `ready_literal_now` only when all of the following hold in the current tree:

- unresolved placeholder: none
- binding source: not required or closure-complete
- variant key: not required or closure-complete
- exact-string anchor: present
- output-shape anchor: present
- route-contract anchor: present where the closure pack required one
- shell or format placeholder: absent
- human or policy freeze: not pending
- current wording can be treated as final literal output without extra runtime fill

## Ready After Binding Contract

A leaf is promoted to `ready_after_binding_contract` only when:

- wording remains unchanged and usable
- unresolved token remains, but its binding source is now frozen by observed code and tests
- human or policy freeze is not pending
- variant key is not required
- current tests are sufficient for exact string plus output shape

## Ready After Variant Keying

A leaf is promoted to `ready_after_variant_keying` only when:

- wording remains unchanged and usable
- variant key names and key-to-text mapping are now frozen
- binding source is not required, or binding closure is already complete
- exact-string and route/output anchors added by closure execution are sufficient
- human or policy freeze is not pending

## Still Blocked

A leaf remains blocked when any of the following persists:

- `policy_freeze_pending`
- `shell_still_not_final`
- `format_placeholder_still_present`
- `binding_not_sufficient`
- `variant_not_sufficient`
- `test_anchor_still_insufficient`
- `mixed_blocker`

## Anti-Promotion Guard

The rerun does not treat the following as sufficient by themselves:

- passing tests without literal-or-contract readiness
- variant freeze without policy freeze resolution
- binding closure without final literal readiness
- shell text without final wording
