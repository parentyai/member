'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const {
  PHASE1_CONCIERGE_LANES,
  isPhase1ConciergeLane,
  buildWelcomeConciergeText,
  buildCityPackFeedbackReceivedText,
  buildCityPackFeedbackUsageText
} = require('../../src/domain/llm/concierge/conciergeLayer');

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

const REPO_ROOT = path.resolve(__dirname, '../..');

test('phase909: phase1 lane allowlist is fixed and excludes non-target families', () => {
  assert.deepEqual(Array.from(PHASE1_CONCIERGE_LANES), [
    'paid_domain',
    'paid_orchestrated',
    'paid_main',
    'paid_casual',
    'free_retrieval',
    'welcome',
    'citypack_feedback_received',
    'citypack_feedback_usage',
    'service_ack'
  ]);
  assert.equal(isPhase1ConciergeLane('welcome'), true);
  assert.equal(isPhase1ConciergeLane('ready_after_binding_contract'), false);
  assert.equal(isPhase1ConciergeLane('operator'), false);
  assert.equal(isPhase1ConciergeLane('unknown'), false);
});

test('phase909: webhook and adjacent phase1 lanes are wired to concierge shaping helpers', () => {
  const webhookSource = read(path.join(REPO_ROOT, 'src/routes/webhookLine.js'));
  const welcomeSource = read(path.join(REPO_ROOT, 'src/usecases/notifications/sendWelcomeMessage.js'));
  const fallbackRendererSource = read(path.join(REPO_ROOT, 'src/v1/line_renderer/fallbackRenderer.js'));

  assert.ok(webhookSource.includes("lane: 'paid_domain'"));
  assert.ok(webhookSource.includes("lane: 'paid_orchestrated'"));
  assert.ok(webhookSource.includes("lane: 'free_retrieval'"));
  assert.ok(webhookSource.includes("lane: 'paid_casual'"));
  assert.ok(webhookSource.includes("lane: 'paid_main'"));
  assert.ok(webhookSource.includes('buildCityPackFeedbackReceivedText()'));
  assert.ok(webhookSource.includes('buildCityPackFeedbackUsageText()'));
  assert.ok(webhookSource.includes('mergeSemanticReplyParams('));
  assert.ok(welcomeSource.includes('buildWelcomeConciergeText(WELCOME_TEXT)'));
  assert.ok(fallbackRendererSource.includes("buildServiceAckText('確認しています。少しお待ちください。')"));
});

test('phase909: welcome and citypack feedback helpers keep answer-first concierge phrasing', () => {
  const welcome = buildWelcomeConciergeText('公式からのご案内はすべてこちらのLINEでお送りします。');
  const feedbackReceived = buildCityPackFeedbackReceivedText();
  const feedbackUsage = buildCityPackFeedbackUsageText();

  assert.match(welcome, /^公式からのご案内/);
  assert.match(welcome, /次の一手:/);
  assert.match(feedbackReceived, /^City Packの誤り報告を受け付けました/);
  assert.match(feedbackUsage, /^City Pack Feedback:/);
});
