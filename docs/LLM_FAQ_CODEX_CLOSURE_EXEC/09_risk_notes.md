# Risk Notes

1. `leaf_webhook_low_relevance_clarify`
- anchored through deterministic source composition rather than a direct exported helper
- if style-router semantics change, this test will detect drift but does not freeze a new runtime helper

2. `leaf_paid_finalizer_fallback`
- current runtime output is guard-shaped, so exact source fallback text and runtime text are not identical
- this execution freezes both layers explicitly instead of forcing them to collapse

3. Wider phase731 drift
- one broader orchestrator test is currently failing outside the touched surface
- not fixing it here preserves scope discipline
