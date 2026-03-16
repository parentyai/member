# LLM_SRO_TRACEABILITY_MAP_V1

Canonical Semantic Response Object (SRO) を中心に、runtime trace と U番号責務を逆引きするための add-only マップ。

## Canonical trace fields
- `contract_version`
  - canonical SRO の契約識別子。現行は `sro_v2`
- `path_type`
  - `fast | slow | unknown`
- `u_units[]`
  - U-01〜U-35 の責務識別子
- `service_surface`
  - `text | quick_reply | flex | template | liff | mini_app | push | service_message`
- `group_privacy_mode`
  - `direct | group_safe`
- `policy_trace`
  - `policy_source / legal_decision / safety_gate / disclosure_required / escalation_required / reason_codes[]`
- `citation_summary`
  - `finalized / readiness_decision / freshness_status / authority_satisfied / disclaimer_required`

## Runtime wiring
- strict parser / canonical sanitizer
  - `/Volumes/Arumamihs/Member-main-latest/src/v1/semantic/semanticResponseObject.js`
- compatibility adapter
  - `/Volumes/Arumamihs/Member-main-latest/src/v1/semantic/responseContractConformance.js`
- LINE surface policy
  - `/Volumes/Arumamihs/Member-main-latest/src/v1/line_surface_policy/lineInteractionPolicy.js`
- LINE semantic renderer
  - `/Volumes/Arumamihs/Member-main-latest/src/v1/line_renderer/semanticLineMessage.js`
- webhook envelope + trace append
  - `/Volumes/Arumamihs/Member-main-latest/src/routes/webhookLine.js`
- trace bundle summary
  - `/Volumes/Arumamihs/Member-main-latest/src/usecases/admin/getTraceBundle.js`

## U-unit mapping
未分離の runtime は 1:1 モジュール分割ではなく、trace 上で複数U番号を並記して composite として扱う。

| Runtime path | U-units | Notes |
| --- | --- | --- |
| canonical SRO sanitize / validate | `U-16`, `U-17`, `U-18` | response finalization, rendering contract, audit-safe payload normalization |
| paid orchestrator reply path | `U-05`, `U-06`, `U-09`, `U-10`, `U-11`, `U-12`, `U-13`, `U-16`, `U-17`, `U-23` | lifecycle/domain/retrieval/readiness/task planning/orchestration の composite |
| paid main readiness path | `U-05`, `U-06`, `U-09`, `U-11`, `U-12`, `U-13`, `U-14`, `U-15`, `U-16`, `U-17` | readiness/policy/exception/safety を含む main slow path |
| free retrieval path | `U-05`, `U-06`, `U-09`, `U-10`, `U-11`, `U-16`, `U-17` | retrieval中心。task planner は lightweight |
| casual fast path | `U-02`, `U-17`, `U-26`, `U-27` | fast path の intent + LINE interaction/rendering |
| group privacy gate | `U-15`, `U-34` | policy/safety + group privacy |
| human handoff trace | `U-15`, `U-32` | escalation_required / handoff_state で観測 |

## LINE interaction policy
- `quick_reply`
  - quick reply 候補があり handoff 不要のとき優先
- `template`
  - 明示要求かつ action候補がある場合のみ採用
- `flex`
  - long text で quick reply/template に寄らない場合
- `text`
  - default fallback

## Audit expectations
- `llm_gate.decision` と `llm_actions` に canonical trace fields が残ること
- trace bundle の `routeHints` から `contractVersions / pathTypes / serviceSurfaces / groupPrivacyModes / handoffStates / uUnits` を逆引きできること
