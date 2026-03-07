'use strict';

const uxEventsRepo = require('../../repos/firestore/uxEventsRepo');
const { isUxOsEventsEnabled } = require('../../domain/tasks/featureFlags');

async function appendUxEvent(params, deps) {
  if (!isUxOsEventsEnabled()) {
    return { ok: false, disabled: true, reason: 'ENABLE_UXOS_EVENTS_V1_off' };
  }
  const resolvedDeps = deps && typeof deps === 'object' ? deps : {};
  const repository = resolvedDeps.uxEventsRepo || uxEventsRepo;
  const result = await repository.appendUxEvent(params || {});
  return {
    ok: true,
    disabled: false,
    id: result && result.id ? result.id : null,
    eventType: result && result.eventType ? result.eventType : null,
    deliveryId: result && result.deliveryId ? result.deliveryId : null,
    idempotent: Boolean(result && result.idempotent)
  };
}

module.exports = {
  appendUxEvent
};
