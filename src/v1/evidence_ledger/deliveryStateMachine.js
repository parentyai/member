'use strict';

const ALLOWED_TRANSITIONS = Object.freeze({
  queued: new Set(['reply_sent', 'push_sent', 'failed']),
  reply_sent: new Set(['push_sent', 'completed', 'failed']),
  push_sent: new Set(['completed', 'failed']),
  completed: new Set([]),
  failed: new Set([])
});

function canTransition(fromState, toState) {
  const from = typeof fromState === 'string' ? fromState : 'queued';
  const to = typeof toState === 'string' ? toState : '';
  if (!ALLOWED_TRANSITIONS[from]) return false;
  return ALLOWED_TRANSITIONS[from].has(to);
}

function applyDeliveryTransition(record, toState) {
  const current = record && typeof record === 'object' ? record : { state: 'queued' };
  if (!canTransition(current.state, toState)) {
    return {
      ok: false,
      reason: 'invalid_transition',
      state: current.state
    };
  }
  return {
    ok: true,
    reason: 'transition_applied',
    state: toState,
    updatedAt: new Date().toISOString()
  };
}

module.exports = {
  canTransition,
  applyDeliveryTransition
};
