# 09 Link-First Response Strategy

## Design intent

Link-first does not mean “always add URLs”.  
It means operational answers carry the best available primary path as a first-class field when that path materially helps the next step.

## Observed baseline

- current link capabilities exist:
  - `src/repos/firestore/linkRegistryRepo.js`
  - URL selection in `src/usecases/assistant/concierge/composeConciergeReply.js`
- current gap:
  - links are not guaranteed across paid domain / casual / finalizer routes
  - user-facing link metadata is not normalized into a shared response contract

## Proposed source hierarchy

| source_type | meaning | phase1 use |
| --- | --- | --- |
| `official` | law, government, school district, official operations | preferred |
| `semi_official` | trusted institutional but not primary legal authority | allowed when official unavailable |
| `internal_guidance` | Member-owned task guidance or LIFF / MINI App entry | allowed for workflow continuation |

## Authority bands

| authority_band | rule |
| --- | --- |
| `primary_required` | regulated or high-risk answer; official path expected |
| `primary_preferred` | official path desired but absence does not block provisional answer |
| `workflow_internal` | internal next-step surface may be more useful than an external page |

## When links should be mandatory

Phase1 mandatory-link candidates:

1. `documents_required`
2. `deadline_check`
3. `eligibility_check`
4. `state_rule_diff`
5. `school / district / enrollment`
6. `DMV / IDs / SSN / immigration procedural answers`

Phase1 optional-link candidates:

1. conversational acknowledgements
2. lightweight prioritization nudges
3. pure task-state summaries where the internal task detail surface is enough

## Surface mapping

| link situation | preferred surface |
| --- | --- |
| one high-value official source | text line with explicit relevance |
| multiple official sources | flex citation summary |
| structured intake or upload required | LIFF / MINI App handoff, not rich-menu direct URL |
| persistent workflow navigation | rich menu binding, not direct URL |

## Rich Menu direct URL constraint

`URI_DIRECT_URL_REJECTED` means rich menu must not be treated as a raw URL launcher for arbitrary external destinations.  
Therefore:

- rich menu carries category / workflow entry, not external authority links
- external official links stay in reply payload, flex, LIFF, or MINI App handoff

## Relevance rule

Do not attach links unless all are true:

1. link resolves a concrete next step
2. link is better than paraphrase alone
3. authority / freshness is acceptable for the lane
4. link does not distract from the immediate action

## No-link fallback

When no valid external link exists:

- still provide answer summary
- still provide next best action
- surface `fallback_if_unavailable`
- if internal flow is stronger, point to task detail / LIFF / MINI App instead

## Phase1 constraints

- do not retrofit every existing route with direct URL text immediately
- first define shared link contract
- then attach links in high-value lanes only
- keep current safety gating intact

