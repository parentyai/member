'use strict';

function buildHumanHandoffPacket(input) {
  const payload = input && typeof input === 'object' ? input : {};
  return {
    required: payload.required === true,
    reason: payload.reason || null,
    queue: payload.queue || 'member_support',
    metadata: payload.metadata && typeof payload.metadata === 'object' ? payload.metadata : {}
  };
}

module.exports = {
  buildHumanHandoffPacket
};
