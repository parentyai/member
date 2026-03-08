'use strict';

function resolveWritebackPolicy(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const temporaryMode = payload.temporaryMode === true;
  const groupMode = payload.groupMode === true;
  return {
    task: true,
    session: !temporaryMode,
    profile: !temporaryMode && !groupMode,
    compliance: true
  };
}

module.exports = {
  resolveWritebackPolicy
};
