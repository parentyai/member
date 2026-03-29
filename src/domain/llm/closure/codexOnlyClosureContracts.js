'use strict';

const {
  regionPrompt,
  regionDeclared,
  regionInvalid,
  regionAlreadySet
} = require('../../regionLineMessages');
const { buildServiceAckMessage } = require('../../../v1/line_renderer/fallbackRenderer');

function normalizeText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function resolveFreeRetrievalEmptyReplyTitle(question) {
  return normalizeText(question) || 'ご質問';
}

const FREE_RETRIEVAL_EMPTY_REPLY_BINDING = Object.freeze({
  leafId: 'leaf_free_retrieval_empty_reply',
  tokens: Object.freeze(['<title>']),
  bindingSourceKind: 'normalized_question',
  bindingSourcePath: 'buildEmptyReply(question) -> normalizeText(question)',
  defaultValue: 'ご質問'
});

const WEBHOOK_CONSENT_STATE_ACK_VARIANT_KEYS = Object.freeze([
  'consent_granted',
  'consent_revoked'
]);

const WEBHOOK_CONSENT_STATE_ACK_VARIANTS = Object.freeze({
  consent_granted: 'AI機能の利用に同意しました。',
  consent_revoked: 'AI機能の利用への同意を取り消しました。'
});

const LINE_RENDERER_SERVICE_ACK_VARIANT_KEYS = Object.freeze([
  'service_ack_wait',
  'service_ack_prepare',
  'service_ack_display'
]);

const LINE_RENDERER_SERVICE_ACK_VARIANTS = Object.freeze({
  service_ack_wait: buildServiceAckMessage().text,
  service_ack_prepare: '回答を準備しています。',
  service_ack_display: '回答を表示します。'
});

const REGION_PROMPT_OR_VALIDATION_VARIANT_KEYS = Object.freeze([
  'prompt_required',
  'invalid_format'
]);

const REGION_PROMPT_OR_VALIDATION_VARIANTS = Object.freeze({
  prompt_required: regionPrompt(),
  invalid_format: regionInvalid()
});

const REGION_STATE_ACK_VARIANT_KEYS = Object.freeze([
  'declared',
  'already_set'
]);

const REGION_STATE_ACK_BINDING = Object.freeze({
  leafId: 'leaf_region_state_ack',
  tokens: Object.freeze(['<cityLabel>', '<stateLabel>']),
  bindingSourcePath: 'regionDeclared(region.regionCity, region.regionState)',
  fallbackValue: '-'
});

const REGION_STATE_ACK_VARIANTS = Object.freeze({
  already_set: regionAlreadySet()
});

function renderRegionStateAckVariant(variantKey, bindings) {
  const payload = bindings && typeof bindings === 'object' ? bindings : {};
  if (variantKey === 'declared') {
    return regionDeclared(payload.cityLabel, payload.stateLabel);
  }
  if (variantKey === 'already_set') {
    return REGION_STATE_ACK_VARIANTS.already_set;
  }
  throw new Error(`unknown region state ack variant: ${variantKey}`);
}

module.exports = {
  FREE_RETRIEVAL_EMPTY_REPLY_BINDING,
  WEBHOOK_CONSENT_STATE_ACK_VARIANT_KEYS,
  WEBHOOK_CONSENT_STATE_ACK_VARIANTS,
  LINE_RENDERER_SERVICE_ACK_VARIANT_KEYS,
  LINE_RENDERER_SERVICE_ACK_VARIANTS,
  REGION_PROMPT_OR_VALIDATION_VARIANT_KEYS,
  REGION_PROMPT_OR_VALIDATION_VARIANTS,
  REGION_STATE_ACK_BINDING,
  REGION_STATE_ACK_VARIANT_KEYS,
  REGION_STATE_ACK_VARIANTS,
  resolveFreeRetrievalEmptyReplyTitle,
  renderRegionStateAckVariant
};
