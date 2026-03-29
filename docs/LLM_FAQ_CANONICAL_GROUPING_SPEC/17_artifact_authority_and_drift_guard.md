# 17 Artifact Authority And Drift Guard

## Provenance Decision

- canonical spec directory is reused in place: 
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC
- source provenance is verified against the same audit root and repo HEAD:
  - repo_root: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001
  - repo_head: 834eaf010876a6c08d21efd38a0e135df7987cb4
  - audit_dir: /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_TEMPLATE_AUDIT

## Authority Rule (Primary vs Mirror)

- primary machine-readable spec:
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json
- mirror machine-readable spec:
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/10_canonical_grouping_spec.json
- human-readable anchor:
  - /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/04_canonical_grouping_spec.md

## Drift Guard

- lock timestamp: 2026-03-20T12:48:24Z
- 05 sha256: b06647e52cddd8582ec95eeda5990f5c698f37781e54b047fe11c719ac6516a2
- 10 sha256: b06647e52cddd8582ec95eeda5990f5c698f37781e54b047fe11c719ac6516a2
- parity status at lock time: equal

### Required check before any future add-only update

```bash
python3 - <<'PY'
import json,hashlib
p='/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/05_canonical_grouping_spec.json'
m='/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_CANONICAL_GROUPING_SPEC/10_canonical_grouping_spec.json'
pa=open(p,'rb').read(); ma=open(m,'rb').read()
print('sha05',hashlib.sha256(pa).hexdigest())
print('sha10',hashlib.sha256(ma).hexdigest())
print('json_equal',json.loads(pa)==json.loads(ma))
PY
```

## Update protocol

1. update primary (05) first.
2. regenerate mirror (10) from primary in the same commit.
3. rerun drift guard and record new hashes in this file.
4. do not update mirror independently.
