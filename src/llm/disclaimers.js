'use strict';

const DISCLAIMER_MAP = Object.freeze({
  faq: Object.freeze({
    version: 'faq_disclaimer_v1',
    text: 'この回答は公式FAQ（KB）に基づく要約です。個別事情により異なる場合があります。'
  }),
  ops_explain: Object.freeze({
    version: 'ops_disclaimer_v1',
    text: '提案です。自動実行は行いません。最終判断は運用担当が行ってください。'
  }),
  next_actions: Object.freeze({
    version: 'next_actions_disclaimer_v1',
    text: '提案候補です。実行手順の確定は決定論レイヤで行ってください。'
  })
});

function getDisclaimer(purpose) {
  if (typeof purpose === 'string' && DISCLAIMER_MAP[purpose]) {
    return DISCLAIMER_MAP[purpose];
  }
  return Object.freeze({ version: 'generic_disclaimer_v1', text: '提案情報です。最終判断は運用担当が行ってください。' });
}

module.exports = {
  getDisclaimer
};
