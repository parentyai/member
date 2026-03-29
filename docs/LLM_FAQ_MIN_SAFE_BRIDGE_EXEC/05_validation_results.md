# Validation Results

## Targeted Test Command

```bash
NODE_PATH=/Volumes/Arumamihs/Member/node_modules node --test \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase862/*.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase861/*.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase860/*.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase653/phase653_t05_free_retrieval_kb_citypack_contract.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase0/welcome.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase760/phase760_t10_renderer_surface_selection_contract.test.js \
  /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/tests/phase230/phase230_faq_confidence_blocks_low_confidence.test.js
```

## Result

- PASS: `32`
- FAIL: `0`

## Docs Gate

```bash
NODE_PATH=/Volumes/Arumamihs/Member/node_modules npm --prefix /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 run test:docs
```

Result:

- `[docs] OK`

## Scope Drift Check

- non-target bridge failures observed: `0`
- wider tree drift observed in this run: `0`
