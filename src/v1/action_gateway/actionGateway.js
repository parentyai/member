'use strict';

const { resolveActionClass } = require('../policy_graph/resolveActionClass');

function enforceActionGateway(input) {
  const payload = input && typeof input === 'object' ? input : {};
  const actionClass = resolveActionClass(payload.actionClass);
  const toolName = typeof payload.toolName === 'string' ? payload.toolName.trim() : '';
  const confirmationToken = typeof payload.confirmationToken === 'string' ? payload.confirmationToken.trim() : '';

  if (actionClass === 'human_only') {
    return {
      allowed: false,
      decision: 'block',
      reason: 'human_only_action_blocked',
      safeToolList: []
    };
  }

  if (actionClass === 'assist' && !confirmationToken) {
    return {
      allowed: false,
      decision: 'clarify',
      reason: 'assist_confirmation_required',
      safeToolList: []
    };
  }

  if (toolName && actionClass === 'draft' && /^delete|^write|^execute/i.test(toolName)) {
    return {
      allowed: false,
      decision: 'block',
      reason: 'dangerous_side_effect_blocked',
      safeToolList: []
    };
  }

  return {
    allowed: true,
    decision: 'allow',
    reason: 'action_allowed',
    safeToolList: toolName ? [toolName] : []
  };
}

module.exports = {
  enforceActionGateway
};
