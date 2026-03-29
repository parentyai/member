# 02 Current Failure Taxonomy

This implementation keeps the existing taxonomy and only closes the phase1-safe gaps.

## Confirmed classes

- `under_informative_answer`
- `missing_official_link`
- `answer_without_next_action`
- `no_task_externalization`
- `todo_invisibility`
- `over_clarification`
- `fallback_overuse`
- `route_style_fragmentation`
- `renderer_flatness`
- `helpfulness_without_resolution`
- `rich_menu_detached_from_conversation`

## Phase1 closure targets

1. official link attachment becomes a first-class internal contract
2. every taskable response gets `next_best_action`
3. menu hint is attached only when useful and mapped to existing commands
4. answer-first ordering is normalized before semantic rendering
5. welcome / feedback / service ack stop sounding like isolated control lanes
