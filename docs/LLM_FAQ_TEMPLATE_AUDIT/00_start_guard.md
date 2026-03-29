# 00 Start Guard

## Root Start Guard (observed, blocked)

```bash
git fetch --all --prune
git -C /Volumes/Arumamihs/Member branch --show-current
codex/quality-patrol-prA-T001

git -C /Volumes/Arumamihs/Member rev-parse HEAD
28722c6509654630660ae6e74d5852038ea134f7

git -C /Volumes/Arumamihs/Member rev-parse --short HEAD
28722c65

git -C /Volumes/Arumamihs/Member rev-parse origin/main
834eaf010876a6c08d21efd38a0e135df7987cb4

git -C /Volumes/Arumamihs/Member status -sb
## codex/quality-patrol-prA-T001...origin/codex/quality-patrol-prA-T001 [ahead 20]
 M src/repos/firestore/richMenuTemplatesRepo.js
 M src/usecases/journey/handleJourneyLineCommand.js
 M src/usecases/journey/handleJourneyPostback.js
 M src/usecases/tasks/renderTaskFlexMessage.js
 M tests/phase730/phase730_t01_render_task_flex_and_split.test.js
 M tests/phase730/phase730_t03_journey_todo_detail_parser.test.js
 M tests/phase730/phase730_t04_journey_todo_detail_command_flex.test.js
 M tests/phase741/phase741_t01_task_os_parser_commands.test.js
 M tests/phase741/phase741_t03_journey_task_os_handlers.test.js
?? tests/phase741/phase741_t08_rich_menu_template_postback_guard.test.js
```

## Guard decision

- root worktree is **blocked**
- reason 1: dirty (`git status -sb` shows tracked and untracked changes)
- reason 2: `HEAD != origin/main`

## Clean detached audit worktree

```bash
git -C /Volumes/Arumamihs/Member worktree add --detach /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 origin/main
git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 status -sb
## HEAD (no branch)

git -C /Volumes/Arumamihs/Member-llm-faq-template-audit-T001 rev-parse HEAD
834eaf010876a6c08d21efd38a0e135df7987cb4
```

## Observation workspace

- audit workspace: `/Volumes/Arumamihs/Member-llm-faq-template-audit-T001`
- all runtime/source/test observations in this audit are based on the detached `origin/main` snapshot above
