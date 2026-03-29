'use strict';

const { buildServiceAckText } = require('../../domain/llm/concierge/conciergeLayer');

function buildOverflowFallbackMessage(state) {
  const payload = state && typeof state === 'object' ? state : {};
  const hint = typeof payload.handoffUrl === 'string' && payload.handoffUrl.trim()
    ? `詳しくは次の画面で確認できます: ${payload.handoffUrl.trim()}`
    : '続きはアプリ内画面で確認できます。';
  return {
    type: 'text',
    text: `表示できる件数を超えたため要約して案内します。${hint}`
  };
}

function buildServiceAckMessage() {
  return {
    type: 'text',
    text: buildServiceAckText('確認しています。少しお待ちください。')
  };
}

module.exports = {
  buildOverflowFallbackMessage,
  buildServiceAckMessage
};
