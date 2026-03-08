'use strict';

function resolveGroupPrivacyPolicy(event) {
  const source = event && event.source && typeof event.source === 'object' ? event.source : {};
  const sourceType = typeof source.type === 'string' ? source.type : 'unknown';
  const isGroup = sourceType === 'group' || sourceType === 'room';
  return {
    sourceType,
    isGroup,
    individualizedRecallAllowed: !isGroup,
    writeProfileMemoryAllowed: !isGroup,
    writeComplianceMemoryAllowed: true
  };
}

module.exports = {
  resolveGroupPrivacyPolicy
};
