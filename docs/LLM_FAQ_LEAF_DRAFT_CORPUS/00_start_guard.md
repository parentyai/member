# 00 Start Guard

```bash
git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 branch --show-current
git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 rev-parse HEAD
git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 rev-parse --short HEAD
git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 status -sb
ls -la /Volumes/Arumamihs/Member-llm-faq-template-audit-T001/docs/LLM_FAQ_LEAF_MANIFEST
find /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 -name 'Member_LLM_Integrated_Spec_V1.md' -print | sort
```

## Observed facts
- repo head: `834eaf010876a6c08d21efd38a0e135df7987cb4`
- generation mode: `SAFE_ONLY`
- required leaf artifacts: present
- integrated spec: present
- note: retry observation did not reproduce the earlier `.swp`; input leaf manifest dir is read as stable for this run
