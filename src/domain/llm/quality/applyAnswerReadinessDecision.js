'use strict';

const { getMinSafeApplyLiteral } = require('../closure/minSafeApplyRegistry');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function normalizeDecision(value) {
  const normalized = normalizeText(value).toLowerCase();
  if (normalized === 'hedged' || normalized === 'clarify' || normalized === 'refuse') return normalized;
  return 'allow';
}

function trimForLineMessage(value) {
  const text = normalizeText(value);
  if (!text) return '';
  return text.length > 420 ? `${text.slice(0, 420)}…` : text;
}

function shouldSuppressHedgeSuffix(payload) {
  if (payload && payload.suppressHedgeSuffix === true) return true;
  const requestShape = normalizeText(payload && payload.requestShape).toLowerCase();
  const outputForm = normalizeText(payload && payload.outputForm).toLowerCase();
  const transformSource = normalizeText(payload && payload.transformSource).toLowerCase();
  const knowledgeScope = normalizeText(payload && payload.knowledgeScope).toLowerCase();
  const transformLike = transformSource === 'prior_assistant'
    || ['rewrite', 'message_template', 'summarize'].includes(requestShape)
    || ['one_line', 'two_sentences', 'message_only', 'polite_template', 'non_dogmatic', 'softer'].includes(outputForm);
  const cityOrProcedureScoped = knowledgeScope === 'city' || knowledgeScope === 'exact_procedure';
  return transformLike && !cityOrProcedureScoped;
}

function applyAnswerReadinessDecision(params) {
  const payload = params && typeof params === 'object' ? params : {};
  const decision = normalizeDecision(payload.decision);
  const replyText = normalizeText(payload.replyText);
  const clarifyText = normalizeText(payload.clarifyText)
    || getMinSafeApplyLiteral('leaf_paid_readiness_clarify_default', 'まず対象手続きと期限を1つずつ教えてください。そこから案内を具体化します。');
  const refuseText = normalizeText(payload.refuseText)
    || getMinSafeApplyLiteral('leaf_paid_readiness_refuse_default', 'この内容は安全に断定できないため、公式窓口での最終確認をお願いします。必要なら確認ポイントを一緒に整理します。');
  const hedgeSuffix = normalizeText(payload.hedgeSuffix)
    || getMinSafeApplyLiteral('leaf_paid_readiness_hedge_suffix', '補足: 情報は更新されるため、最終確認をお願いします。');

  if (decision === 'clarify') {
    return {
      decision,
      replyText: trimForLineMessage(clarifyText),
      enforced: true
    };
  }

  if (decision === 'refuse') {
    return {
      decision,
      replyText: trimForLineMessage(refuseText),
      enforced: true
    };
  }

  if (decision === 'hedged') {
    const base = replyText || clarifyText;
    if (shouldSuppressHedgeSuffix(payload)) {
      return {
        decision,
        replyText: trimForLineMessage(base),
        enforced: true
      };
    }
    const withHedge = base.includes('最終確認')
      ? base
      : `${base}\n\n${hedgeSuffix}`;
    return {
      decision,
      replyText: trimForLineMessage(withHedge),
      enforced: true
    };
  }

  return {
    decision,
    replyText: trimForLineMessage(replyText || clarifyText),
    enforced: false
  };
}

module.exports = {
  applyAnswerReadinessDecision
};
