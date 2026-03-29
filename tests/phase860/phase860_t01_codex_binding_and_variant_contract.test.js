'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { test } = require('node:test');

const { generateFreeRetrievalReply } = require('../../src/usecases/assistant/generateFreeRetrievalReply');
const { buildServiceAckMessage } = require('../../src/v1/line_renderer/fallbackRenderer');
const {
  regionPrompt,
  regionInvalid,
  regionDeclared,
  regionAlreadySet
} = require('../../src/domain/regionLineMessages');
const {
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
} = require('../../src/domain/llm/closure/codexOnlyClosureContracts');

function readSource(path) {
  return fs.readFileSync(path, 'utf8');
}

test('phase860: codex closure freezes free retrieval empty reply title binding to normalized question text', async () => {
  assert.equal(FREE_RETRIEVAL_EMPTY_REPLY_BINDING.leafId, 'leaf_free_retrieval_empty_reply');
  assert.deepEqual(FREE_RETRIEVAL_EMPTY_REPLY_BINDING.tokens, ['<title>']);
  assert.equal(resolveFreeRetrievalEmptyReplyTitle('  SSN予約  '), 'SSN予約');
  assert.equal(resolveFreeRetrievalEmptyReplyTitle('   '), 'ご質問');

  const result = await generateFreeRetrievalReply({
    lineUserId: 'U_PHASE860_BINDING',
    question: '  SSN予約  ',
    locale: 'ja'
  }, {
    searchFaqFromKb: async () => ({ ok: true, mode: 'empty', candidates: [] }),
    searchCityPackCandidates: async () => ({ ok: true, mode: 'empty', candidates: [] })
  });

  assert.equal(result.ok, true);
  assert.equal(result.mode, 'empty');
  assert.equal(typeof result.replyText, 'string');
  assert.match(result.replyText, /SSN予約 に一致する情報が見つかりませんでした。/);
  assert.match(result.replyText, /不明点は運用窓口へお問い合わせください。/);
});

test('phase860: webhook consent ack variants freeze observed keys and literals without wording changes', () => {
  const webhookSource = readSource('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js');

  assert.deepEqual(WEBHOOK_CONSENT_STATE_ACK_VARIANT_KEYS, ['consent_granted', 'consent_revoked']);
  assert.deepEqual(WEBHOOK_CONSENT_STATE_ACK_VARIANTS, {
    consent_granted: 'AI機能の利用に同意しました。',
    consent_revoked: 'AI機能の利用への同意を取り消しました。'
  });
  assert.ok(webhookSource.includes("text: 'AI機能の利用に同意しました。'"));
  assert.ok(webhookSource.includes("text: 'AI機能の利用への同意を取り消しました。'"));
});

test('phase860: line renderer service ack variants freeze observed keys and fallback literals', () => {
  const semanticSource = readSource('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/v1/line_renderer/semanticLineMessage.js');
  const webhookSource = readSource('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js');

  assert.deepEqual(LINE_RENDERER_SERVICE_ACK_VARIANT_KEYS, [
    'service_ack_wait',
    'service_ack_prepare',
    'service_ack_display'
  ]);
  assert.equal(LINE_RENDERER_SERVICE_ACK_VARIANTS.service_ack_wait, buildServiceAckMessage().text);
  assert.equal(LINE_RENDERER_SERVICE_ACK_VARIANTS.service_ack_prepare, '回答を準備しています。');
  assert.equal(LINE_RENDERER_SERVICE_ACK_VARIANTS.service_ack_display, '回答を表示します。');
  assert.ok(semanticSource.includes("|| '回答を準備しています。'"));
  assert.ok(semanticSource.includes("|| '回答を表示します。'"));
  assert.ok(webhookSource.includes('buildServiceAckMessage()'));
});

test('phase860: region variants preserve canonical keys and binding-aware declared text', () => {
  const webhookSource = readSource('/Volumes/Arumamihs/Member-llm-faq-template-audit-T001/src/routes/webhookLine.js');

  assert.deepEqual(REGION_PROMPT_OR_VALIDATION_VARIANT_KEYS, ['prompt_required', 'invalid_format']);
  assert.deepEqual(REGION_PROMPT_OR_VALIDATION_VARIANTS, {
    prompt_required: regionPrompt(),
    invalid_format: regionInvalid()
  });

  assert.equal(REGION_STATE_ACK_BINDING.leafId, 'leaf_region_state_ack');
  assert.deepEqual(REGION_STATE_ACK_BINDING.tokens, ['<cityLabel>', '<stateLabel>']);
  assert.deepEqual(REGION_STATE_ACK_VARIANT_KEYS, ['declared', 'already_set']);
  assert.equal(REGION_STATE_ACK_VARIANTS.already_set, regionAlreadySet());
  assert.equal(renderRegionStateAckVariant('declared', { cityLabel: 'Austin', stateLabel: 'TX' }), regionDeclared('Austin', 'TX'));
  assert.equal(renderRegionStateAckVariant('already_set', {}), regionAlreadySet());

  assert.ok(webhookSource.includes("if (region.status === 'prompt_required')"));
  assert.ok(webhookSource.includes('region.reason === \'invalid_format\' ? regionInvalid() : regionPrompt()'));
  assert.ok(webhookSource.includes("if (region.status === 'declared')"));
  assert.ok(webhookSource.includes('regionDeclared(region.regionCity, region.regionState)'));
  assert.ok(webhookSource.includes("if (region.status === 'already_set')"));
});
