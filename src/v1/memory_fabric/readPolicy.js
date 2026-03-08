'use strict';

function resolveMemoryReadPolicy(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const lane = typeof payload.lane === 'string' ? payload.lane.trim().toLowerCase() : 'session';
  const groupMode = payload.groupMode === true;
  return {
    lane,
    includeProfile: !groupMode && lane !== 'compliance',
    includeTask: lane !== 'profile',
    includeSession: true,
    includeCompliance: true
  };
}

module.exports = {
  resolveMemoryReadPolicy
};
