'use strict';

const assert = require('assert');
const { test } = require('node:test');

const { buildLineNotificationMessage } = require('../../src/usecases/notifications/buildLineNotificationMessage');

test('buildLineNotificationMessage: builds template buttons for up to 3 CTAs', () => {
  const result = buildLineNotificationMessage({
    notification: {
      title: '通知タイトル',
      body: '通知本文'
    },
    ctas: [
      { ctaText: '開く', url: 'https://example.com/1' },
      { ctaText: '詳細', url: 'https://example.com/2' },
      { ctaText: 'FAQ', url: 'https://example.com/3' }
    ],
    preferTemplateButtons: true
  });

  assert.strictEqual(result.lineMessageType, 'template_buttons');
  assert.strictEqual(result.message.type, 'template');
  assert.strictEqual(result.message.template.type, 'buttons');
  assert.strictEqual(result.message.template.actions.length, 3);
  assert.strictEqual(result.message.template.actions[0].type, 'uri');
});

test('buildLineNotificationMessage: falls back to text when template buttons cannot be used', () => {
  const longBody = 'x'.repeat(161);
  const result = buildLineNotificationMessage({
    notification: {
      title: 'Long',
      body: longBody
    },
    ctas: [
      { ctaText: '開く', url: 'https://example.com/1' },
      { ctaText: '詳細', url: 'https://example.com/2' }
    ],
    preferTemplateButtons: true
  });

  assert.strictEqual(result.lineMessageType, 'text');
  assert.strictEqual(result.fallbackReason, 'template_buttons_unavailable');
  assert.strictEqual(result.message.type, 'text');
  assert.ok(result.message.text.includes('https://example.com/1'));
  assert.ok(result.message.text.includes('https://example.com/2'));
});

test('buildLineNotificationMessage: keeps text mode when template buttons disabled', () => {
  const result = buildLineNotificationMessage({
    notification: {
      title: '通知タイトル',
      body: '通知本文'
    },
    ctas: [
      { ctaText: '開く', url: 'https://example.com/1' }
    ],
    preferTemplateButtons: false
  });

  assert.strictEqual(result.lineMessageType, 'text');
  assert.strictEqual(result.fallbackReason, 'template_buttons_disabled');
  assert.strictEqual(result.message.type, 'text');
});
