# Test Strategy

## Bridge-Focused Tests

- new phase:
  - `phase862`

### Added

- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase862/phase862_t01_min_safe_bridge_runtime_contract.test.js`
- `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase862/phase862_t02_min_safe_bridge_webhook_contract.test.js`

## What They Prove

- registry-backed bridge is used for the target 12 leaves
- emitted literal is unchanged
- output shape is unchanged
- route/source contract remains unchanged
- intentionally excluded webhook/renderer leaves are still absent from the bridge scope

## Reused Coverage

- phase860 closure anchors
- phase861 registry contract tests
- phase653 / phase760 / phase230 / welcome focused tests
