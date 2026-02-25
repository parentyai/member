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
  }),
  paid_assistant: Object.freeze({
    version: 'paid_assistant_disclaimer_v1',
    text: '提案です。契約・法務・税務の最終判断は専門家確認のうえで行ってください。'
  })
});

function parsePolicyTemplates(input) {
  const payload = input && typeof input === 'object' ? input : null;
  if (!payload) return null;
  const templates = payload.disclaimer_templates;
  if (!templates || typeof templates !== 'object' || Array.isArray(templates)) return null;
  return templates;
}

function resolveTemplateText(templates, key) {
  if (!templates || typeof templates !== 'object') return '';
  const value = templates[key];
  if (typeof value !== 'string') return '';
  const normalized = value.trim();
  return normalized || '';
}

function getDisclaimer(purpose, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const policy = opts.policy || null;
  const templates = parsePolicyTemplates(policy);
  const purposeKey = typeof purpose === 'string' ? purpose.trim() : '';
  if (templates) {
    const purposeText = resolveTemplateText(templates, purposeKey);
    if (purposeText) {
      return {
        version: `policy_${purposeKey || 'generic'}_disclaimer_v1`,
        text: purposeText
      };
    }
    const genericText = resolveTemplateText(templates, 'generic');
    if (genericText) {
      return {
        version: 'policy_generic_disclaimer_v1',
        text: genericText
      };
    }
  }
  if (typeof purpose === 'string' && DISCLAIMER_MAP[purpose]) {
    return DISCLAIMER_MAP[purpose];
  }
  return Object.freeze({ version: 'generic_disclaimer_v1', text: '提案情報です。最終判断は運用担当が行ってください。' });
}

module.exports = {
  getDisclaimer
};
