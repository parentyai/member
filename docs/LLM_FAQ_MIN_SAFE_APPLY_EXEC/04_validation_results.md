# Validation Results

## Targeted Test Command

```bash
NODE_PATH=/Volumes/Arumamihs/Member/node_modules node --test \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase861/*.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase860/*.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t05_free_retrieval_kb_citypack_contract.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase0/welcome.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase760/phase760_t10_renderer_surface_selection_contract.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase230/phase230_faq_confidence_blocks_low_confidence.test.js
```

## Result

- PASS: `27`
- FAIL: `0`

## Docs Gate

```bash
NODE_PATH=/Volumes/Arumamihs/Member/node_modules npm --prefix /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 run test:docs
```

Result:

- `[docs] OK`

## Scope Verification

- registry leaves: `12`
- non-target example absent:
  - `leaf_paid_finalizer_fallback`
  - `leaf_free_retrieval_empty_reply`
