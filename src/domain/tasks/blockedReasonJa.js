'use strict';

const BLOCKED_REASON_JA = Object.freeze({
  dependency_unmet: '前のタスクが未完了',
  quiet_hours: '通知停止時間',
  kill_switch: '一時停止中',
  plan_limit: 'プラン上限',
  max_actions: '本日の上限',
  invalid_trigger: '条件未成立'
});

function toBlockedReasonJa(reason) {
  const key = typeof reason === 'string' ? reason.trim() : '';
  if (!key) return null;
  return BLOCKED_REASON_JA[key] || '処理待ち';
}

module.exports = {
  BLOCKED_REASON_JA,
  toBlockedReasonJa
};
