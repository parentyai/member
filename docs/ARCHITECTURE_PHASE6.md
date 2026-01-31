# Phase6 Architecture Boundaries

## 1. Scope (Yes/No)
### API
- In-Scope: Yes (only APIs explicitly defined in Phase6 tasks)
- Out-of-Scope: Yes (any API not explicitly defined in Phase6 tasks)

### UI
- In-Scope: Yes (only UI changes explicitly defined in Phase6 tasks)
- Out-of-Scope: Yes (new screens, UX improvements, or redesigns)

### Ops
- In-Scope: Yes (human decision support only)
- Out-of-Scope: Yes (automation, auto-notify, auto-judgment)

### Data
- In-Scope: Yes (non-destructive read/write on existing collections only)
- Out-of-Scope: Yes (new collections, destructive schema changes)

## 2. Responsibility Boundaries
- routes: request validation and shaping only
- usecases: orchestration and business ordering only
- repos: Firestore CRUD only
- ops: human decision support only
- Phase5 inheritance: Yes (existing boundaries remain unchanged)

## 3. Dependency Direction
- UI -> API (routes) -> usecases -> repos -> DB
- Allowed: UI depends on API; API depends on usecases; usecases depend on repos
- Prohibited: reverse dependencies and cross-layer shortcuts

## 4. Prohibited Changes
- Add new entrypoints (no additional listen/createServer)
- Add implicit side effects at import time
- Modify Phase0-Phase5 SSOT/Acceptance/Playbooks/Runbooks
- Introduce automation or AI judgment
- Add new collections or destructive schema changes

## 5. Entry Point / Data Safety
- Entrypoint: src/index.js only (no additional servers)
- New collections: No
- New fields: No (unless a Phase6 task explicitly requires it)

## 6. Relation to Phase6 Tasks
- P6-003 and later code tasks must follow this document
- Implementation decisions are derived only from SSOT_PHASE6.md and this document
