from __future__ import annotations

from hashlib import sha256
from pathlib import Path
import json
from typing import Any, Mapping


OBSERVATION_PROPOSAL_TYPES = frozenset({
    "observation_only",
    "sample_collection",
    "transcript_coverage_repair",
    "no_action_until_evidence",
    "blocked_by_observation_gap",
})

OBSERVATION_CAUSES = frozenset({
    "observation_gap",
    "transcript_unavailable",
    "review_unit_blocked",
    "evidence_insufficient",
    "observation_only_no_runtime_inference",
    "blocked_by_missing_context",
    "blocked_by_unavailable_data",
})

RETRIEVAL_CAUSES = frozenset({
    "retrieval_blocked",
    "knowledge_candidate_missing",
    "knowledge_candidate_unused",
    "fallback_selected_over_grounded",
    "city_specificity_gap",
})

ROUTING_CAUSES = frozenset({
    "followup_context_loss",
    "finalizer_template_collapse",
    "procedural_guidance_gap",
})

POLICY_CAUSES = frozenset({
    "readiness_rejection",
})

PROPOSAL_TYPE_TO_SCOPE = {
    "observation_only": "docs",
    "sample_collection": "eval",
    "transcript_coverage_repair": "eval",
    "no_action_until_evidence": "docs",
    "blocked_by_observation_gap": "docs",
    "knowledge_fix": "routing",
    "readiness_fix": "routing",
    "template_fix": "routing",
    "continuity_fix": "routing",
    "specificity_fix": "routing",
    "retrieval_fix": "routing",
    "runtime_fix": "routing",
}

PROPOSAL_TYPE_TO_SCORE_DELTA = {
    "observation_only": 0.03,
    "sample_collection": 0.05,
    "transcript_coverage_repair": 0.06,
    "no_action_until_evidence": 0.02,
    "blocked_by_observation_gap": 0.02,
    "knowledge_fix": 0.12,
    "readiness_fix": 0.10,
    "template_fix": 0.09,
    "continuity_fix": 0.10,
    "specificity_fix": 0.11,
    "retrieval_fix": 0.12,
    "runtime_fix": 0.10,
}


def read_json_file(path: str | Path) -> dict[str, Any]:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def _string_list(values: Any, *, limit: int = 64) -> list[str]:
    rows = values if isinstance(values, list) else ([values] if values else [])
    out: list[str] = []
    seen: set[str] = set()
    for item in rows:
        if len(out) >= limit:
            break
        if not isinstance(item, str):
            continue
        text = item.strip()
        if not text or text in seen:
            continue
        seen.add(text)
        out.append(text)
    return out


def _normalize_risk(value: Any) -> str:
    text = str(value or "medium").strip().lower()
    if text in {"low", "medium", "high"}:
        return text
    return "medium"


def _fallback_proposal_id(trace: Mapping[str, Any], proposal: Mapping[str, Any]) -> str:
    seed = "|".join([
        str(trace.get("run_id") or "run"),
        str(proposal.get("proposalType") or "proposal"),
        str(proposal.get("title") or "untitled"),
    ])
    return f"ldp_{sha256(seed.encode('utf-8')).hexdigest()[:24]}"


def _cause_from_refs(proposal: Mapping[str, Any]) -> str | None:
    refs = _string_list(proposal.get("rootCauseRefs"), limit=8)
    for ref in refs:
        if ":" in ref:
            return ref.rsplit(":", 1)[-1].strip() or None
        if ref.strip():
            return ref.strip()
    return None


def resolve_root_cause_category(trace: Mapping[str, Any], proposal: Mapping[str, Any]) -> str:
    failure_reason = str(trace.get("failure_reason") or "").strip().lower()
    if "ui_drift" in failure_reason:
        return "ui_drift"

    cause = _cause_from_refs(proposal)
    if cause in OBSERVATION_CAUSES:
        return "observation_gap"
    if cause in RETRIEVAL_CAUSES:
        return "retrieval_gap"
    if cause in ROUTING_CAUSES:
        return "routing_gap"
    if cause in POLICY_CAUSES:
        return "policy_gap"

    proposal_type = str(proposal.get("proposalType") or "").strip()
    if proposal_type in OBSERVATION_PROPOSAL_TYPES:
        return "observation_gap"
    if proposal_type in {"knowledge_fix", "retrieval_fix", "specificity_fix"}:
        return "retrieval_gap"
    if proposal_type == "readiness_fix":
        return "policy_gap"
    if proposal_type in {"template_fix", "continuity_fix", "runtime_fix"}:
        return "routing_gap"
    return "operator_followup"


def resolve_change_scope(proposal: Mapping[str, Any]) -> str:
    target_files = _string_list(proposal.get("targetFiles"))
    if target_files and all(path.startswith("docs/") for path in target_files):
        return "docs"
    proposal_type = str(proposal.get("proposalType") or "").strip()
    return PROPOSAL_TYPE_TO_SCOPE.get(proposal_type, "unknown")


def resolve_expected_score_delta(proposal: Mapping[str, Any]) -> float:
    proposal_type = str(proposal.get("proposalType") or "").strip()
    return PROPOSAL_TYPE_TO_SCORE_DELTA.get(proposal_type, 0.04)


def build_queue_entry(trace: Mapping[str, Any], proposal: Mapping[str, Any]) -> dict[str, Any]:
    proposal_id = str(proposal.get("proposalKey") or "").strip() or _fallback_proposal_id(trace, proposal)
    run_id = str(trace.get("run_id") or "").strip()
    if not run_id:
        raise ValueError("trace.run_id is required")
    affected_files = _string_list(proposal.get("targetFiles"))
    return {
        "proposal_id": proposal_id,
        "source_trace_ids": [run_id],
        "root_cause_category": resolve_root_cause_category(trace, proposal),
        "proposed_change_scope": resolve_change_scope(proposal),
        "affected_files": affected_files,
        "expected_score_delta": resolve_expected_score_delta(proposal),
        "risk_level": _normalize_risk(proposal.get("riskLevel")),
        "requires_human_review": True,
    }


def build_codex_packet(
    *,
    queue_entry: Mapping[str, Any],
    trace: Mapping[str, Any],
    proposal: Mapping[str, Any],
    main_artifact: Mapping[str, Any],
    trace_path: str | Path,
    planning_artifact_path: str | Path,
    main_artifact_path: str | Path | None = None,
) -> dict[str, Any]:
    target_files = _string_list(proposal.get("targetFiles"))
    rollback_plan = _string_list(proposal.get("rollbackPlan"), limit=12)
    blocked_by = _string_list(proposal.get("blockedBy"), limit=12)
    preconditions = _string_list(proposal.get("preconditions"), limit=12)
    trace_id = str(trace.get("run_id") or "")
    summary = main_artifact.get("summary") if isinstance(main_artifact.get("summary"), dict) else {}
    return {
        "contract_version": "line_desktop_patrol_codex_packet_v1",
        "proposal_id": queue_entry["proposal_id"],
        "queue_entry": dict(queue_entry),
        "trace_ref": {
            "run_id": trace_id,
            "trace_path": str(Path(trace_path)),
            "scenario_id": trace.get("scenario_id"),
            "target_id": trace.get("target_id"),
            "failure_reason": trace.get("failure_reason"),
        },
        "evaluation_ref": {
            "planning_artifact_path": str(Path(planning_artifact_path)),
            "main_artifact_path": str(Path(main_artifact_path)) if main_artifact_path else None,
            "planning_status": main_artifact.get("planningStatus"),
            "analysis_status": main_artifact.get("analysisStatus"),
            "observation_status": main_artifact.get("observationStatus"),
        },
        "proposal": {
            "proposal_type": proposal.get("proposalType"),
            "title": proposal.get("title"),
            "objective": proposal.get("objective"),
            "why_now": proposal.get("whyNow"),
            "why_not_others": proposal.get("whyNotOthers"),
            "root_cause_refs": _string_list(proposal.get("rootCauseRefs"), limit=12),
            "target_files": target_files,
            "expected_impact": _string_list(proposal.get("expectedImpact"), limit=12),
            "rollback_plan": rollback_plan,
            "preconditions": preconditions,
            "blocked_by": blocked_by,
            "confidence": proposal.get("confidence"),
            "priority": proposal.get("priority"),
            "risk_level": queue_entry["risk_level"],
        },
        "operator_summary": {
            "headline": summary.get("headline"),
            "status": summary.get("status"),
            "recommended_pr_count": main_artifact.get("recommendedPrCount"),
        },
        "codex_task_brief": (
            f"Inspect {len(target_files)} target files, use the linked trace and planning artifacts as evidence, "
            "keep changes add-only or minimally invasive, and stop at a reviewable proposal or patch set. "
            "Do not auto-apply runtime or routing changes without human review."
        ),
    }


def build_queue_payloads(
    *,
    trace: Mapping[str, Any],
    planning_artifact: Mapping[str, Any],
    main_artifact: Mapping[str, Any],
    trace_path: str | Path,
    planning_artifact_path: str | Path,
    main_artifact_path: str | Path | None = None,
) -> list[dict[str, Any]]:
    proposals = planning_artifact.get("recommendedPr")
    if not isinstance(proposals, list):
        proposals = []
    payloads: list[dict[str, Any]] = []
    for proposal in proposals:
        if not isinstance(proposal, dict):
            continue
        queue_entry = build_queue_entry(trace, proposal)
        packet = build_codex_packet(
            queue_entry=queue_entry,
            trace=trace,
            proposal=proposal,
            main_artifact=main_artifact,
            trace_path=trace_path,
            planning_artifact_path=planning_artifact_path,
            main_artifact_path=main_artifact_path,
        )
        payloads.append({
            "queue_entry": queue_entry,
            "codex_packet": packet,
        })
    return payloads
