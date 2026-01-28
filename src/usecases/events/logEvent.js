'use strict';

const eventsRepo = require('../../repos/firestore/eventsRepo');

function validateEventInput(type, ref) {
  if (!type) return { ok: false, error: 'type required' };
  const safeRef = ref || {};
  if (type === 'open' || type === 'click') {
    if (!safeRef.notificationId) return { ok: false, error: 'notificationId required' };
  }
  if (type === 'complete') {
    if (!safeRef.checklistId || !safeRef.itemId) return { ok: false, error: 'checklistId and itemId required' };
  }
  return { ok: true };
}

async function logEventBestEffort(params) {
  const payload = params || {};
  const validation = validateEventInput(payload.type, payload.ref);
  if (!validation.ok) {
    return { ok: false, error: validation.error };
  }
  try {
    const created = await eventsRepo.createEvent({
      lineUserId: payload.lineUserId,
      type: payload.type,
      ref: payload.ref
    });
    return { ok: true, id: created.id };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = {
  validateEventInput,
  logEventBestEffort
};
