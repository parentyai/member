'use strict';

const MAP = {
  STOP_AND_ESCALATE: 'ops_escalate',
  FIX_AND_RERUN: 'ops_fix_and_rerun',
  RERUN_MAIN: 'ops_rerun_main'
};

async function suggestNotificationTemplate(params) {
  const payload = params || {};
  const nextAction = payload.nextAction || null;
  const templateKey = nextAction && MAP[nextAction] ? MAP[nextAction] : null;
  return {
    ok: true,
    templateKey
  };
}

module.exports = {
  suggestNotificationTemplate
};
