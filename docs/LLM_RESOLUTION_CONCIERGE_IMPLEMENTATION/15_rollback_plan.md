# 15 Rollback Plan

## Immediate stop

- remove concierge integration calls from `webhookLine.js`
- keep existing route reply text behavior

## Partial rollback

- revert `src/usecases/notifications/sendWelcomeMessage.js`
- revert `src/v1/line_renderer/fallbackRenderer.js`
- keep new concierge domain files unused

## Full rollback

- revert all concierge domain files and implementation docs
- rerun targeted tests and docs gate

## Data impact

- none
- phase1 change is response shaping only
