# LLM Quality Auto Eval Rubric v1

## Required Inputs
- candidate scorecard JSON
- baseline scorecard JSON
- must-pass fixture result JSON
- replay/perturbation result JSON
- benchmark registry manifest JSON

## Hard Gate Conditions (Auto)
1. `candidate.hardGate.pass === true`
2. critical slices are `pass`:
   - short_followup
   - domain_continuation
   - group_chat
   - japanese_service_quality
   - minority_personas
   - cultural_slices
3. judge calibration:
   - disagreementRate <= 0.15
   - promptSensitivityDrift <= 0.10
4. replay critical failures = 0
5. must-pass fixtures = pass

## No Regression Policy (Auto)
Required non-regression dimensions:
- factuality_grounding
- safety_compliance_privacy
- conversation_continuity
- repetition_loop_avoidance
- japanese_service_quality
- line_native_fit
- minority_persona_robustness

## Improvement Policy (Auto)
- `candidate.overallScore > baseline.overallScore`
- short_followup and domain_continuation slices must not decline.

## Frontier Warnings (Auto)
- quality delta < +2 and latency regression > 25% => warning
- quality non-improving and cost regression > 20% => fail
- ACK SLA violation rate > 1% => fail

## Required Outputs
- `release_gate_policy`
- `no_regression_policy`
- `baseline_vs_candidate_diff`
- `must_pass_fixture_list`
- verdict (`pass` / `warning` / `fail`)
