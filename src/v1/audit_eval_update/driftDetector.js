'use strict';

function detectRuntimeDrift(state) {
  const payload = state && typeof state === 'object' ? state : {};
  const driftReasons = [];
  if (payload.envFlag !== true) driftReasons.push('env_flag_disabled');
  if (payload.systemFlag !== true) driftReasons.push('system_flag_disabled');
  if (payload.effectiveEnabled !== true) driftReasons.push('effective_disabled');
  if (payload.blockingReason) driftReasons.push(`blocking_reason:${payload.blockingReason}`);
  return {
    drifted: driftReasons.length > 0,
    driftReasons
  };
}

module.exports = {
  detectRuntimeDrift
};
